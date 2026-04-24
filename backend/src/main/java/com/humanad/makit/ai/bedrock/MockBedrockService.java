package com.humanad.makit.ai.bedrock;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Flux;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Duration;
import java.util.Base64;
import java.util.List;
import java.util.Map;
import java.util.Random;
import java.util.concurrent.ThreadLocalRandom;

/**
 * Deterministic, offline substitute for BedrockService. Active when:
 *   aws.bedrock.enabled=false  OR  (mock profile active and credentials missing)
 *
 * Returns canned but shape-correct payloads so backend + frontend can develop
 * without AWS access.
 */
@Service
@EnableConfigurationProperties(BedrockProperties.class)
@ConditionalOnProperty(name = "aws.bedrock.enabled", havingValue = "false")
public class MockBedrockService implements BedrockClient {

    private static final Logger log = LoggerFactory.getLogger(MockBedrockService.class);
    private final ObjectMapper om = new ObjectMapper();

    public MockBedrockService() {
        log.warn("MockBedrockService active — all AI calls return canned data.");
    }

    @Override
    public BedrockInvocation invokeText(String modelId, String prompt, String systemPrompt,
                                        Integer maxTokens, Double temperature) {
        String canned = cannedReply(prompt);
        String raw = buildMockClaudeJson(canned);
        return new BedrockInvocation(modelId, raw, canned,
                Math.min(400, prompt.length() / 4),
                Math.min(400, canned.length() / 4),
                "end_turn", 42);
    }

    @Override
    public BedrockInvocation invokeImage(String modelId, String requestJson) {
        // Return a tiny 1x1 transparent PNG base64. Strategy should upload to S3 like the real thing.
        String pngB64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
        ObjectNode resp = om.createObjectNode();
        ArrayNode artifacts = resp.putArray("artifacts");
        ObjectNode art = artifacts.addObject();
        art.put("base64", pngB64);
        art.put("seed", 42);
        art.put("finishReason", "SUCCESS");
        String raw;
        try {
            raw = om.writeValueAsString(resp);
        } catch (JsonProcessingException e) {
            raw = "{}";
        }
        return new BedrockInvocation(modelId, raw, null, 0, 0, "image", 88);
    }

    @Override
    public BedrockInvocation invokeEmbedding(String modelId, String text) {
        // Deterministic pseudo-embedding derived from SHA-256 of text, normalized.
        float[] vec = deterministicVector(text, 1024);
        ObjectNode resp = om.createObjectNode();
        ArrayNode arr = resp.putArray("embedding");
        for (float v : vec) arr.add(v);
        resp.put("inputTextTokenCount", Math.max(1, text.length() / 4));
        String raw;
        try {
            raw = om.writeValueAsString(resp);
        } catch (JsonProcessingException e) {
            raw = "{}";
        }
        return new BedrockInvocation(modelId, raw, null, Math.max(1, text.length() / 4), 0, "embed", 5);
    }

    /**
     * Mirrors {@link BedrockService#invokeTextStream} in dev. Produces between
     * 2 and 10 canned chunks distributed across 200-500ms, so the frontend SSE
     * path has realistic pacing when Bedrock is disabled.
     */
    public Flux<String> invokeTextStream(String modelId, String prompt, Map<String, Object> params) {
        String reply = cannedReply(prompt);
        int chunks = 2 + ThreadLocalRandom.current().nextInt(9); // 2..10
        int totalMs = 200 + ThreadLocalRandom.current().nextInt(301); // 200..500
        long perChunkMs = Math.max(20, totalMs / chunks);

        int size = Math.max(1, reply.length() / chunks);
        java.util.List<String> pieces = new java.util.ArrayList<>(chunks);
        for (int i = 0; i < chunks; i++) {
            int from = i * size;
            int to = (i == chunks - 1) ? reply.length() : Math.min(reply.length(), from + size);
            if (from >= reply.length()) break;
            pieces.add(reply.substring(from, to));
        }
        if (pieces.isEmpty()) pieces = List.of(reply);
        return Flux.fromIterable(pieces).delayElements(Duration.ofMillis(perChunkMs));
    }

    // ---------------- helpers

    private String cannedReply(String prompt) {
        // Rough shape cues so downstream parsing works
        if (prompt.contains("sentiment") || prompt.contains("감정")) {
            return "```json\n{\"sentiment\":\"positive\",\"score\":0.82,\"keywords\":[\"mock\",\"test\"],\"summary\":\"Mock sentiment.\"}\n```";
        }
        if (prompt.contains("hashtags") || prompt.contains("instagram") || prompt.contains("인스타")) {
            return "```json\n{\"caption\":\"Mock caption for testing.\",\"hashtags\":[\"#mock\",\"#test\",\"#dev\"],\"imagePrompt\":\"A minimalist mock product shot\"}\n```";
        }
        if (prompt.contains("summary") || prompt.contains("요약")) {
            return "```json\n{\"title\":\"Mock Title\",\"summary\":\"Mock summary of the content.\",\"keywords\":[\"mock\",\"stub\"],\"language\":\"ko\"}\n```";
        }
        return "Mock response generated without Bedrock access.";
    }

    private String buildMockClaudeJson(String text) {
        ObjectNode root = om.createObjectNode();
        ArrayNode content = root.putArray("content");
        ObjectNode part = content.addObject();
        part.put("type", "text");
        part.put("text", text);
        root.put("stop_reason", "end_turn");
        ObjectNode usage = root.putObject("usage");
        usage.put("input_tokens", 50);
        usage.put("output_tokens", Math.min(400, text.length() / 4));
        try {
            return om.writeValueAsString(root);
        } catch (JsonProcessingException e) {
            return "{}";
        }
    }

    private float[] deterministicVector(String text, int dim) {
        byte[] seed;
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            seed = md.digest(text.getBytes(StandardCharsets.UTF_8));
        } catch (NoSuchAlgorithmException e) {
            seed = text.getBytes(StandardCharsets.UTF_8);
        }
        long s = 0;
        for (int i = 0; i < 8 && i < seed.length; i++) {
            s = (s << 8) | (seed[i] & 0xff);
        }
        Random r = new Random(s);
        float[] v = new float[dim];
        double norm = 0;
        for (int i = 0; i < dim; i++) {
            v[i] = (float) (r.nextGaussian());
            norm += v[i] * v[i];
        }
        norm = Math.sqrt(norm);
        if (norm > 0) {
            for (int i = 0; i < dim; i++) v[i] = (float) (v[i] / norm);
        }
        // Touch unused import so the compiler stays happy if we extend later:
        Base64.getEncoder();
        return v;
    }
}
