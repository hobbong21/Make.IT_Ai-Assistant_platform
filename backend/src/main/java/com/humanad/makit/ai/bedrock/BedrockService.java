package com.humanad.makit.ai.bedrock;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import io.github.resilience4j.circuitbreaker.CircuitBreakerRegistry;
import io.github.resilience4j.circuitbreaker.annotation.CircuitBreaker;
import io.github.resilience4j.reactor.circuitbreaker.operator.CircuitBreakerOperator;
import io.github.resilience4j.ratelimiter.annotation.RateLimiter;
import io.github.resilience4j.retry.annotation.Retry;
import io.micrometer.core.instrument.DistributionSummary;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Tags;
import io.micrometer.core.instrument.Timer;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Flux;
import software.amazon.awssdk.core.SdkBytes;
import software.amazon.awssdk.services.bedrockruntime.BedrockRuntimeAsyncClient;
import software.amazon.awssdk.services.bedrockruntime.BedrockRuntimeClient;
import software.amazon.awssdk.services.bedrockruntime.model.InvokeModelRequest;
import software.amazon.awssdk.services.bedrockruntime.model.InvokeModelResponse;
import software.amazon.awssdk.services.bedrockruntime.model.InvokeModelWithResponseStreamRequest;
import software.amazon.awssdk.services.bedrockruntime.model.InvokeModelWithResponseStreamResponseHandler;
import software.amazon.awssdk.services.bedrockruntime.model.PayloadPart;

import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Map;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicLong;

/**
 * Real Bedrock invocation layer.
 *
 * Responsibilities:
 *  - Build provider-specific request bodies (Claude vs Titan vs SDXL).
 *  - Parse provider-specific responses uniformly into {@link BedrockInvocation}.
 *  - Attach resilience4j CircuitBreaker / Retry / RateLimiter.
 *  - Record Micrometer metrics (latency, token distribution, cost estimate, user tag).
 *  - Drive a three-tier fallback cascade on text invocation.
 *  - Stream Claude token deltas via {@link #invokeTextStream}.
 *
 * Controllers/services must not inject this directly — they depend on the four
 * domain interfaces in com.humanad.makit.ai.
 */
@Service
@ConditionalOnProperty(name = "aws.bedrock.enabled", havingValue = "true", matchIfMissing = true)
public class BedrockService implements BedrockClient {

    private static final Logger log = LoggerFactory.getLogger(BedrockService.class);

    private static final String CB = "bedrock";
    private static final String SYSTEM_USER = "system";

    private final BedrockRuntimeClient client;
    private final BedrockRuntimeAsyncClient asyncClient; // optional — streaming only
    private final BedrockProperties props;
    private final BedrockFallbackProperties fallback;
    private final MeterRegistry meter;
    private final CircuitBreakerRegistry cbRegistry;
    private final ObjectMapper om = new ObjectMapper();

    public BedrockService(BedrockRuntimeClient client,
                          ObjectProvider<BedrockRuntimeAsyncClient> asyncClientProvider,
                          BedrockProperties props,
                          ObjectProvider<BedrockFallbackProperties> fallbackProvider,
                          MeterRegistry meter,
                          ObjectProvider<CircuitBreakerRegistry> cbRegistryProvider) {
        this.client = client;
        this.asyncClient = asyncClientProvider.getIfAvailable();
        this.props = props;
        this.fallback = fallbackProvider.getIfAvailable(
                () -> new BedrockFallbackProperties(null, null));
        this.meter = meter;
        this.cbRegistry = cbRegistryProvider.getIfAvailable();
    }

    // ------------------------------------------------------------------ TEXT

    @CircuitBreaker(name = CB, fallbackMethod = "fallbackText")
    @Retry(name = CB)
    @RateLimiter(name = CB)
    @Override
    public BedrockInvocation invokeText(String modelId,
                                        String prompt,
                                        String systemPrompt,
                                        Integer maxTokens,
                                        Double temperature) {
        return invokeTextInternal(modelId, prompt, systemPrompt, maxTokens, temperature, "primary");
    }

    private BedrockInvocation invokeTextInternal(String modelId, String prompt, String systemPrompt,
                                                 Integer maxTokens, Double temperature, String tier) {
        long start = System.nanoTime();
        String body = buildTextBody(modelId, prompt, systemPrompt, maxTokens, temperature);

        try {
            InvokeModelResponse resp = client.invokeModel(InvokeModelRequest.builder()
                    .modelId(modelId)
                    .contentType("application/json")
                    .accept("application/json")
                    .body(SdkBytes.fromUtf8String(body))
                    .build());

            String rawJson = resp.body().asUtf8String();
            BedrockInvocation invocation = parseTextResponse(modelId, rawJson, start);
            recordMetrics(modelId, "text", "success", invocation, tier, "unknown");
            return invocation;
        } catch (RuntimeException e) {
            recordError(modelId, "text", e);
            throw e;
        }
    }

    // ------------------------------------------------------------- STREAMING

    /**
     * Streaming text invocation. Emits one {@link String} per Claude
     * {@code content_block_delta} event. Terminates on {@code message_stop}.
     *
     * <p>Resilience:
     * <ul>
     *   <li>30-second per-stream timeout</li>
     *   <li>Reactor {@link Retry#backoff} 1 retry @ 500ms</li>
     *   <li>{@link CircuitBreakerOperator} bound to the shared "bedrock" CB</li>
     * </ul>
     *
     * <p>Metrics: {@code bedrock.stream.first-token-ms}, {@code bedrock.stream.total-ms}.
     * Tagged with {@code user_id} from MDC (or {@value #SYSTEM_USER}).
     *
     * @param modelId Claude model id (Anthropic message API)
     * @param prompt the user-side prompt text
     * @param params optional map with {@code systemPrompt}, {@code maxTokens}, {@code temperature}
     */
    public Flux<String> invokeTextStream(String modelId, String prompt, Map<String, Object> params) {
        if (asyncClient == null) {
            return Flux.error(new BedrockInvocationException(
                    "Streaming unavailable: BedrockRuntimeAsyncClient bean not present"));
        }
        if (!isClaude(modelId)) {
            return Flux.error(new BedrockInvocationException(
                    "Streaming currently supports Anthropic Claude model ids only: " + modelId));
        }
        final String userId = mdcOrSystem();
        final String systemPrompt = paramStr(params, "systemPrompt");
        final Integer maxTokens = paramInt(params, "maxTokens", props.defaults().maxTokensText());
        final Double temperature = paramDouble(params, "temperature", props.defaults().temperature());
        final String body = buildTextBody(modelId, prompt, systemPrompt, maxTokens, temperature);
        final AtomicLong startNs = new AtomicLong();
        final AtomicBoolean firstTokenSeen = new AtomicBoolean(false);

        Flux<String> raw = Flux.create(sink -> {
            startNs.set(System.nanoTime());

            var request = InvokeModelWithResponseStreamRequest.builder()
                    .modelId(modelId)
                    .contentType("application/json")
                    .accept("application/json")
                    .body(SdkBytes.fromUtf8String(body))
                    .build();

            var handler = InvokeModelWithResponseStreamResponseHandler.builder()
                    .subscriber(InvokeModelWithResponseStreamResponseHandler.Visitor.builder()
                            .onChunk(chunk -> dispatchChunk(chunk, sink, firstTokenSeen, startNs, modelId, userId))
                            .build())
                    .onComplete(() -> sink.complete())
                    .onError(err -> sink.error(err))
                    .build();

            asyncClient.invokeModelWithResponseStream(request, handler)
                    .whenComplete((ok, err) -> {
                        long total = TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - startNs.get());
                        Timer.builder("bedrock.stream.total-ms")
                                .tags("model", modelId, "user_id", userId,
                                        "status", err == null ? "success" : "error")
                                .register(meter)
                                .record(Duration.ofMillis(total));
                        if (err != null) {
                            meter.counter("bedrock.error",
                                    "model", modelId,
                                    "operation", "stream",
                                    "type", err.getClass().getSimpleName()).increment();
                        }
                    });
        });

        Flux<String> resilient = raw
                .timeout(Duration.ofSeconds(30))
                .retryWhen(reactor.util.retry.Retry.backoff(1, Duration.ofMillis(500))
                        .filter(t -> !(t instanceof BedrockInvocationException)));

        CircuitBreaker cb = resolveCircuitBreaker();
        if (cb != null) {
            resilient = resilient.transformDeferred(CircuitBreakerOperator.of(cb));
        }
        return resilient;
    }

    private void dispatchChunk(PayloadPart chunk, reactor.core.publisher.FluxSink<String> sink,
                               AtomicBoolean firstTokenSeen, AtomicLong startNs,
                               String modelId, String userId) {
        try {
            String json = new String(chunk.bytes().asByteArray(), StandardCharsets.UTF_8);
            JsonNode root = om.readTree(json);
            String type = root.path("type").asText("");
            switch (type) {
                case "content_block_delta" -> {
                    String text = root.path("delta").path("text").asText("");
                    if (!text.isEmpty()) {
                        if (firstTokenSeen.compareAndSet(false, true)) {
                            long ms = TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - startNs.get());
                            Timer.builder("bedrock.stream.first-token-ms")
                                    .tags("model", modelId, "user_id", userId)
                                    .register(meter)
                                    .record(Duration.ofMillis(ms));
                        }
                        sink.next(text);
                    }
                }
                case "message_stop" -> sink.complete();
                case "error" -> {
                    String msg = root.path("message").asText("bedrock stream error");
                    sink.error(new BedrockInvocationException(msg));
                }
                default -> { /* message_start, content_block_start, ping — ignore */ }
            }
        } catch (Exception e) {
            sink.error(new BedrockInvocationException("Failed to parse stream chunk", e));
        }
    }

    private io.github.resilience4j.circuitbreaker.CircuitBreaker resolveCircuitBreaker() {
        try {
            return cbRegistry == null ? null : cbRegistry.circuitBreaker(CB);
        } catch (RuntimeException ex) {
            log.debug("Circuit breaker {} not available for streaming: {}", CB, ex.toString());
            return null;
        }
    }

    // ----------------------------------------------------------------- IMAGE

    @CircuitBreaker(name = CB, fallbackMethod = "fallbackImage")
    @Retry(name = CB)
    @RateLimiter(name = CB)
    @Override
    public BedrockInvocation invokeImage(String modelId, String requestJson) {
        long start = System.nanoTime();
        try {
            InvokeModelResponse resp = client.invokeModel(InvokeModelRequest.builder()
                    .modelId(modelId)
                    .contentType("application/json")
                    .accept("application/json")
                    .body(SdkBytes.fromUtf8String(requestJson))
                    .build());

            String rawJson = resp.body().asUtf8String();
            long ms = TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - start);
            BedrockInvocation invocation = new BedrockInvocation(modelId, rawJson, null, 0, 0, "image", ms);
            recordMetrics(modelId, "image", "success", invocation, "primary", "unknown");
            return invocation;
        } catch (RuntimeException e) {
            recordError(modelId, "image", e);
            throw e;
        }
    }

    // ------------------------------------------------------------- EMBEDDING

    @CircuitBreaker(name = CB, fallbackMethod = "fallbackEmbedding")
    @Retry(name = CB)
    @RateLimiter(name = CB)
    @Override
    public BedrockInvocation invokeEmbedding(String modelId, String text) {
        long start = System.nanoTime();
        try {
            ObjectNode body = om.createObjectNode();
            body.put("inputText", text);
            // Titan Embed v2 accepts dimensions + normalize overrides, defaults are fine.

            InvokeModelResponse resp = client.invokeModel(InvokeModelRequest.builder()
                    .modelId(modelId)
                    .contentType("application/json")
                    .accept("application/json")
                    .body(SdkBytes.fromUtf8String(om.writeValueAsString(body)))
                    .build());

            String rawJson = resp.body().asUtf8String();
            JsonNode root = om.readTree(rawJson);
            int tokensIn = root.path("inputTextTokenCount").asInt(0);
            long ms = TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - start);
            BedrockInvocation invocation = new BedrockInvocation(modelId, rawJson, null, tokensIn, 0, "embed", ms);
            recordMetrics(modelId, "embedding", "success", invocation, "primary", "unknown");
            return invocation;
        } catch (RuntimeException | JsonProcessingException e) {
            recordError(modelId, "embedding", e);
            if (e instanceof RuntimeException re) throw re;
            throw new BedrockInvocationException("embedding build failed", e);
        } catch (Exception e) {
            recordError(modelId, "embedding", e);
            throw new BedrockInvocationException("embedding unexpected", e);
        }
    }

    // ---------------------------------------------------------- REQUEST BODY

    private String buildTextBody(String modelId, String prompt, String systemPrompt,
                                 Integer maxTokens, Double temperature) {
        int mt = maxTokens != null ? maxTokens : props.defaults().maxTokensText();
        double temp = temperature != null ? temperature : props.defaults().temperature();

        try {
            if (isClaude(modelId)) {
                // Anthropic messages API shape
                ObjectNode body = om.createObjectNode();
                body.put("anthropic_version", "bedrock-2023-05-31");
                body.put("max_tokens", mt);
                body.put("temperature", temp);
                if (systemPrompt != null && !systemPrompt.isBlank()) {
                    body.put("system", systemPrompt);
                }
                ArrayNode messages = body.putArray("messages");
                ObjectNode userMsg = messages.addObject();
                userMsg.put("role", "user");
                ArrayNode content = userMsg.putArray("content");
                ObjectNode textPart = content.addObject();
                textPart.put("type", "text");
                textPart.put("text", prompt);
                return om.writeValueAsString(body);
            }
            // Titan Text
            ObjectNode body = om.createObjectNode();
            String composite = systemPrompt == null ? prompt : systemPrompt + "\n\n" + prompt;
            body.put("inputText", composite);
            ObjectNode cfg = body.putObject("textGenerationConfig");
            cfg.put("maxTokenCount", mt);
            cfg.put("temperature", temp);
            cfg.put("topP", 0.9);
            return om.writeValueAsString(body);
        } catch (JsonProcessingException e) {
            throw new BedrockInvocationException("Failed to build request body", e);
        }
    }

    // --------------------------------------------------------- RESPONSE PARSE

    private BedrockInvocation parseTextResponse(String modelId, String rawJson, long startNanos) {
        long latencyMs = TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - startNanos);
        try {
            JsonNode root = om.readTree(rawJson);
            if (isClaude(modelId)) {
                String text = "";
                JsonNode contentArr = root.path("content");
                if (contentArr.isArray() && !contentArr.isEmpty()) {
                    StringBuilder sb = new StringBuilder();
                    for (JsonNode part : contentArr) {
                        if ("text".equals(part.path("type").asText())) {
                            sb.append(part.path("text").asText());
                        }
                    }
                    text = sb.toString();
                }
                JsonNode usage = root.path("usage");
                int in = usage.path("input_tokens").asInt(-1);
                int out = usage.path("output_tokens").asInt(-1);
                String stop = root.path("stop_reason").asText("end_turn");
                return new BedrockInvocation(modelId, rawJson, text, in, out, stop, latencyMs);
            }
            // Titan Text
            int in = root.path("inputTextTokenCount").asInt(-1);
            JsonNode results = root.path("results");
            String text = "";
            int out = -1;
            String stop = "end";
            if (results.isArray() && !results.isEmpty()) {
                JsonNode first = results.get(0);
                text = first.path("outputText").asText("");
                out = first.path("tokenCount").asInt(-1);
                stop = first.path("completionReason").asText("end");
            }
            return new BedrockInvocation(modelId, rawJson, text, in, out, stop, latencyMs);
        } catch (Exception e) {
            throw new BedrockInvocationException("Failed to parse " + modelId + " response", e);
        }
    }

    // ------------------------------------------------------------- FALLBACKS

    /**
     * Tier-1 failure fallback. Attempts Tier-2 (secondary model) first; on further
     * failure drops to Tier-3 canned response.
     *
     * NEVER silently pretends the canned response is a primary success — the
     * returned {@link BedrockInvocation#fallback()} flag is true and
     * {@link BedrockInvocation#fallbackReason()} carries context.
     */
    @SuppressWarnings("unused")
    private BedrockInvocation fallbackText(String modelId, String prompt, String systemPrompt,
                                           Integer maxTokens, Double temperature, Throwable t) {
        log.warn("Bedrock Tier-1 exhausted model={} cause={}", modelId, t.toString());
        meter.counter("bedrock.fallback", "model", modelId, "operation", "text", "tier", "1").increment();

        String tier2Model = fallback.textModel();
        if (tier2Model != null && !tier2Model.isBlank() && !tier2Model.equals(modelId)) {
            try {
                log.info("Bedrock Tier-2 attempting fallback model={}", tier2Model);
                BedrockInvocation inv = invokeTextInternal(tier2Model, prompt, systemPrompt,
                        maxTokens, temperature, "fallback_tier2");
                meter.counter("bedrock.fallback", "model", tier2Model, "operation", "text", "tier", "2-success").increment();
                return new BedrockInvocation(
                        inv.modelId(), inv.rawResponseJson(), inv.outputText(),
                        inv.tokensIn(), inv.tokensOut(), "fallback_tier2", inv.latencyMs(),
                        true, "primary_unavailable:" + t.getClass().getSimpleName());
            } catch (RuntimeException t2) {
                log.warn("Bedrock Tier-2 also failed model={} cause={}", tier2Model, t2.toString());
                meter.counter("bedrock.fallback", "model", tier2Model, "operation", "text", "tier", "2-fail").increment();
            }
        }

        // Tier-3: canned
        meter.counter("bedrock.fallback", "model", modelId, "operation", "text", "tier", "3").increment();
        return new BedrockInvocation(modelId, "{\"fallback\":true}", fallback.cannedText(),
                0, 0, "fallback", 0, true, "primary_unavailable:" + t.getClass().getSimpleName());
    }

    @SuppressWarnings("unused")
    private BedrockInvocation fallbackImage(String modelId, String requestJson, Throwable t) {
        log.warn("Bedrock image fallback engaged model={} cause={}", modelId, t.toString());
        meter.counter("bedrock.fallback", "model", modelId, "operation", "image").increment();
        throw new BedrockInvocationException("Image generation temporarily unavailable", t);
    }

    @SuppressWarnings("unused")
    private BedrockInvocation fallbackEmbedding(String modelId, String text, Throwable t) {
        log.warn("Bedrock embedding fallback engaged model={} cause={}", modelId, t.toString());
        meter.counter("bedrock.fallback", "model", modelId, "operation", "embedding").increment();
        throw new BedrockInvocationException("Embedding temporarily unavailable", t);
    }

    // --------------------------------------------------------------- METRICS

    private void recordMetrics(String modelId, String operation, String status, BedrockInvocation inv,
                               String tier, String promptVersion) {
        String userId = mdcOrSystem();
        Tags tags = Tags.of("model", modelId, "operation", operation, "status", status,
                "tier", tier, "prompt_version", promptVersion);
        Timer.builder("bedrock.invoke")
                .tags(tags)
                .register(meter)
                .record(Duration.ofMillis(inv.latencyMs()));

        if (inv.tokensIn() > 0) {
            DistributionSummary.builder("bedrock.tokens.input")
                    .tags("model", modelId, "user_id", userId)
                    .register(meter)
                    .record(inv.tokensIn());
        }
        if (inv.tokensOut() > 0) {
            DistributionSummary.builder("bedrock.tokens.output")
                    .tags("model", modelId, "user_id", userId)
                    .register(meter)
                    .record(inv.tokensOut());
        }

        // Cost estimate from tariff map; skipped when missing.
        Map<String, BedrockProperties.Tariff> t = props.tariff();
        if (t != null) {
            BedrockProperties.Tariff tariff = t.get(modelId);
            if (tariff != null) {
                double cost = (Math.max(0, inv.tokensIn()) / 1000.0) * tariff.inputPer1k()
                        + (Math.max(0, inv.tokensOut()) / 1000.0) * tariff.outputPer1k();
                meter.counter("bedrock.cost.usd", "model", modelId, "user_id", userId).increment(cost);
            }
        }
    }

    private void recordError(String modelId, String operation, Throwable e) {
        meter.counter("bedrock.error",
                "model", modelId,
                "operation", operation,
                "type", e.getClass().getSimpleName()).increment();
        log.error("Bedrock call failed model={} op={} err={}", modelId, operation, e.toString());
    }

    // ---------------------------------------------------------------- HELPERS

    private boolean isClaude(String modelId) {
        return modelId != null && modelId.startsWith("anthropic.");
    }

    private static String mdcOrSystem() {
        String v = MDC.get("userId");
        return (v == null || v.isBlank()) ? SYSTEM_USER : v;
    }

    private static String paramStr(Map<String, Object> p, String k) {
        if (p == null) return null;
        Object v = p.get(k);
        return v == null ? null : String.valueOf(v);
    }

    private static Integer paramInt(Map<String, Object> p, String k, Integer def) {
        if (p == null) return def;
        Object v = p.get(k);
        if (v instanceof Number n) return n.intValue();
        if (v instanceof String s && !s.isBlank()) {
            try { return Integer.parseInt(s.trim()); } catch (NumberFormatException ignored) {}
        }
        return def;
    }

    private static Double paramDouble(Map<String, Object> p, String k, Double def) {
        if (p == null) return def;
        Object v = p.get(k);
        if (v instanceof Number n) return n.doubleValue();
        if (v instanceof String s && !s.isBlank()) {
            try { return Double.parseDouble(s.trim()); } catch (NumberFormatException ignored) {}
        }
        return def;
    }
}
