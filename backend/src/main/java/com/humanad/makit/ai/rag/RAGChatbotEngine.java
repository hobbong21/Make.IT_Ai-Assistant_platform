package com.humanad.makit.ai.rag;

import com.humanad.makit.ai.ChatbotEngine;
import com.humanad.makit.ai.KnowledgeRetriever;
import com.humanad.makit.ai.bedrock.BedrockClient;
import com.humanad.makit.ai.bedrock.BedrockInvocation;
import com.humanad.makit.ai.bedrock.BedrockProperties;
import com.humanad.makit.ai.bedrock.BedrockService;
import com.humanad.makit.ai.bedrock.MockBedrockService;
import com.humanad.makit.ai.dto.ChatRequest;
import com.humanad.makit.ai.dto.ChatResponse;
import com.humanad.makit.ai.dto.ChatStreamChunk;
import com.humanad.makit.ai.dto.ConversationContext;
import com.humanad.makit.ai.dto.RetrievalOptions;
import com.humanad.makit.ai.dto.RetrievedChunk;
import com.humanad.makit.ai.prompt.PromptInjectionGuard;
import com.humanad.makit.ai.prompt.PromptLoader;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Retrieval-Augmented Generation chatbot orchestrator.
 *
 * Flow:
 *   1. Open/resolve ConversationContext.
 *   2. If useRag: retrieve top-K chunks via KnowledgeRetriever.
 *   3. Load prompts/commerce/rag_system.md with {{context}} + {{question}}.
 *   4. Call Claude Haiku via BedrockClient.
 *   5. Return ChatResponse with citations and usage.
 *
 * Streaming is REAL in Phase 4.5+ — {@link #chatStream} consumes
 * {@link BedrockService#invokeTextStream} (or its mock counterpart) and
 * interleaves citation + delta + done events.
 */
@Service
public class RAGChatbotEngine implements ChatbotEngine {

    private static final Logger log = LoggerFactory.getLogger(RAGChatbotEngine.class);
    private static final String PROMPT_KEY = "commerce/rag_system.md";

    private final BedrockClient bedrock;
    private final BedrockProperties props;
    private final KnowledgeRetriever retriever;
    private final PromptLoader prompts;
    private final PromptInjectionGuard guard;

    // In-memory context registry for v1. Replace with Redis-backed store in v1.1.
    private final Map<String, ConversationContext> contexts = new ConcurrentHashMap<>();

    @Autowired
    public RAGChatbotEngine(BedrockClient bedrock,
                            BedrockProperties props,
                            KnowledgeRetriever retriever,
                            PromptLoader prompts,
                            PromptInjectionGuard guard) {
        this.bedrock = bedrock;
        this.props = props;
        this.retriever = retriever;
        this.prompts = prompts;
        this.guard = guard;
    }

    @Override
    public ChatResponse chat(ChatRequest req, ConversationContext ctx) {
        ConversationContext useCtx = ctx != null ? ctx : resolveOrOpen(req.contextId(), null);

        // Prompt-injection scan ahead of prompt rendering.
        PromptInjectionGuard.SanitizationResult scan = guard.scan(req.message());
        String safeQuestion = scan.sanitizedText();

        List<RetrievedChunk> retrieved = req.useRag()
                ? retriever.retrieve(req.message(), RetrievalOptions.defaults())
                : List.of();

        String contextBlock = buildContextBlock(retrieved);
        Map<String, Object> vars = new HashMap<>();
        vars.put("context", contextBlock);
        vars.put("question", safeQuestion);
        vars.put("history", renderHistory(useCtx));

        PromptLoader.LoadedPrompt loaded = prompts.loadVersioned(PROMPT_KEY, vars);
        String systemPrompt = extractSystemBlock(loaded.text());
        String userPrompt = extractUserBlock(loaded.text());

        BedrockInvocation inv = bedrock.invokeText(
                props.models().claudeHaiku(),
                userPrompt,
                systemPrompt,
                req.maxTokens() != null ? req.maxTokens() : props.defaults().maxTokensText(),
                req.temperature() != null ? req.temperature() : props.defaults().temperature());

        List<ChatResponse.Citation> citations = new ArrayList<>(retrieved.size());
        for (RetrievedChunk c : retrieved) {
            citations.add(new ChatResponse.Citation(
                    c.documentId(), c.chunkIndex(), c.score(), snippet(c.text())));
        }

        // Touch ctx last-active. Records are immutable, so replace in the map.
        ConversationContext updated = new ConversationContext(
                useCtx.contextId(), useCtx.userId(), useCtx.sessionId(),
                useCtx.history(), useCtx.openedAt(), Instant.now());
        contexts.put(useCtx.contextId(), updated);

        return new ChatResponse(
                useCtx.contextId(),
                inv.outputText() == null ? "" : inv.outputText().trim(),
                citations,
                new ChatResponse.Usage(Math.max(0, inv.tokensIn()), Math.max(0, inv.tokensOut())),
                inv.modelId(),
                Instant.now());
    }

    @Override
    public Flux<ChatStreamChunk> chatStream(ChatRequest req, ConversationContext ctx) {
        return Flux.defer(() -> {
            ConversationContext useCtx = ctx != null ? ctx : resolveOrOpen(req.contextId(), null);

            PromptInjectionGuard.SanitizationResult scan = guard.scan(req.message());
            String safeQuestion = scan.sanitizedText();

            List<RetrievedChunk> retrieved = req.useRag()
                    ? retriever.retrieve(req.message(), RetrievalOptions.defaults())
                    : List.of();

            Map<String, Object> vars = new HashMap<>();
            vars.put("context", buildContextBlock(retrieved));
            vars.put("question", safeQuestion);
            vars.put("history", renderHistory(useCtx));

            PromptLoader.LoadedPrompt loaded = prompts.loadVersioned(PROMPT_KEY, vars);
            String systemPrompt = extractSystemBlock(loaded.text());
            String userPrompt = extractUserBlock(loaded.text());

            // 1. Citations first (UI renders sources ahead of token stream).
            List<ChatStreamChunk> leading = new ArrayList<>(retrieved.size());
            for (RetrievedChunk c : retrieved) {
                leading.add(new ChatStreamChunk(
                        ChatStreamChunk.EventType.citation,
                        String.format("{\"documentId\":\"%s\",\"chunkIndex\":%d,\"score\":%.4f}",
                                c.documentId(), c.chunkIndex(), c.score())));
            }

            // 2. Delta stream — real Bedrock streaming when available, else mock equivalent.
            Flux<String> textStream = resolveStream(
                    props.models().claudeHaiku(), userPrompt,
                    Map.of("systemPrompt", systemPrompt == null ? "" : systemPrompt,
                           "maxTokens", req.maxTokens() != null ? req.maxTokens() : props.defaults().maxTokensText(),
                           "temperature", req.temperature() != null ? req.temperature() : props.defaults().temperature()));

            Flux<ChatStreamChunk> deltas = textStream.map(t ->
                    new ChatStreamChunk(ChatStreamChunk.EventType.delta, t));

            // 3. Terminal event references the context id so UI can close cleanly.
            ChatStreamChunk done = new ChatStreamChunk(
                    ChatStreamChunk.EventType.done,
                    String.format("{\"contextId\":\"%s\"}", useCtx.contextId()));

            return Flux.concat(Flux.fromIterable(leading), deltas, Mono.just(done));
        }).onErrorResume(e -> {
            log.error("chatStream failure: {}", e.toString());
            return Flux.just(new ChatStreamChunk(ChatStreamChunk.EventType.error,
                    "AI 서비스에 일시적인 문제가 발생했어요."));
        });
    }

    /**
     * Dispatch to whichever streaming implementation the injected client
     * provides. Keeps the interface-typed dependency stable for callers.
     */
    private Flux<String> resolveStream(String modelId, String prompt, Map<String, Object> params) {
        if (bedrock instanceof BedrockService real) {
            return real.invokeTextStream(modelId, prompt, params);
        }
        if (bedrock instanceof MockBedrockService mock) {
            return mock.invokeTextStream(modelId, prompt, params);
        }
        return Flux.error(new IllegalStateException(
                "Injected BedrockClient does not implement invokeTextStream: " + bedrock.getClass()));
    }

    @Override
    public ConversationContext openContext(UUID userId, String sessionId) {
        return resolveOrOpen(null, userId != null ? userId : UUID.randomUUID());
    }

    @Override
    public void closeContext(String contextId) {
        if (contextId != null) contexts.remove(contextId);
    }

    // ------------------------------------------------------------- helpers

    private ConversationContext resolveOrOpen(String contextId, UUID userId) {
        if (contextId != null && contexts.containsKey(contextId)) return contexts.get(contextId);
        String id = contextId != null ? contextId : UUID.randomUUID().toString();
        ConversationContext ctx = new ConversationContext(
                id,
                userId != null ? userId : UUID.randomUUID(),
                "default",
                new ArrayList<>(),
                Instant.now(),
                Instant.now());
        contexts.put(id, ctx);
        return ctx;
    }

    private String buildContextBlock(List<RetrievedChunk> chunks) {
        if (chunks.isEmpty()) return "(no relevant context found)";
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < chunks.size(); i++) {
            RetrievedChunk c = chunks.get(i);
            sb.append("[#").append(i + 1).append("] ")
                    .append("(doc=").append(c.documentId())
                    .append(", score=").append(String.format("%.3f", c.score())).append(")\n")
                    .append(c.text()).append("\n\n");
        }
        return sb.toString();
    }

    private String renderHistory(ConversationContext ctx) {
        if (ctx.history() == null || ctx.history().isEmpty()) return "(no prior turns)";
        StringBuilder sb = new StringBuilder();
        for (ConversationContext.Turn t : ctx.history()) {
            sb.append(t.role().name()).append(": ").append(t.content()).append("\n");
        }
        return sb.toString();
    }

    private String snippet(String text) {
        if (text == null) return "";
        String t = text.replaceAll("\\s+", " ").trim();
        return t.length() <= 160 ? t : t.substring(0, 160) + "...";
    }

    /**
     * Pull the block between `--- system ---` and `--- user ---` markers, if present.
     * Markers allow the single .md file to declare both prompt roles.
     */
    static String extractSystemBlock(String full) {
        int s = full.indexOf("--- system ---");
        int u = full.indexOf("--- user ---");
        if (s < 0 || u < 0 || u < s) return null;
        return full.substring(s + "--- system ---".length(), u).trim();
    }

    static String extractUserBlock(String full) {
        int u = full.indexOf("--- user ---");
        if (u < 0) return full;
        return full.substring(u + "--- user ---".length()).trim();
    }
}
