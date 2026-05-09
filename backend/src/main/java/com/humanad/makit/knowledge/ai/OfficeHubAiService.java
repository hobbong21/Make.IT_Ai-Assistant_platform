package com.humanad.makit.knowledge.ai;

import com.humanad.makit.ai.KnowledgeRetriever;
import com.humanad.makit.ai.bedrock.BedrockClient;
import com.humanad.makit.ai.bedrock.BedrockInvocation;
import com.humanad.makit.ai.bedrock.BedrockProperties;
import com.humanad.makit.ai.bedrock.BedrockService;
import com.humanad.makit.ai.bedrock.MockBedrockService;
import com.humanad.makit.ai.dto.ChatStreamChunk;
import com.humanad.makit.ai.dto.RetrievalOptions;
import com.humanad.makit.ai.dto.RetrievedChunk;
import com.humanad.makit.ai.prompt.PromptInjectionGuard;
import com.humanad.makit.ai.prompt.PromptLoader;
import com.humanad.makit.commerce.knowledge.KnowledgeDocument;
import com.humanad.makit.commerce.knowledge.KnowledgeDocumentRepository;
import com.humanad.makit.knowledge.ai.dto.ActionRequest;
import com.humanad.makit.knowledge.ai.dto.AskRequest;
import com.humanad.makit.knowledge.ai.dto.AskResponse;
import com.humanad.makit.knowledge.ai.dto.FeedbackRequest;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Timer;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Office Hub RAG orchestrator. Mirrors {@link com.humanad.makit.ai.rag.RAGChatbotEngine}
 * but writes to a separate prompt namespace ({@code prompts/knowledge/}) so the
 * Hub can evolve its prompts independently of Commerce Brain.
 *
 * <p>Endpoints supported by {@link OfficeHubAiController}:
 * <ul>
 *   <li>{@code ask}        — free-form question over Hub knowledge.</li>
 *   <li>{@code summarize}  — 3-line summary of one document.</li>
 *   <li>{@code related}    — nearest-neighbour docs by embedding.</li>
 *   <li>{@code tags}       — recommend additional tags.</li>
 *   <li>{@code draft}      — propose a follow-up document outline.</li>
 * </ul>
 */
@Slf4j
@Service
public class OfficeHubAiService {

    static final String PROMPT_ASK       = "knowledge/office_hub_ask.md";
    static final String PROMPT_SUMMARIZE = "knowledge/office_hub_summarize.md";
    static final String PROMPT_RELATED   = "knowledge/office_hub_related.md";
    static final String PROMPT_TAGS      = "knowledge/office_hub_tags.md";
    static final String PROMPT_DRAFT     = "knowledge/office_hub_draft.md";

    private final BedrockClient bedrock;
    private final BedrockProperties props;
    private final KnowledgeRetriever retriever;
    private final PromptLoader prompts;
    private final PromptInjectionGuard guard;
    private final KnowledgeDocumentRepository docRepo;
    private final OfficeHubFeedbackRepository feedbackRepo;
    private final MeterRegistry meters;

    public OfficeHubAiService(BedrockClient bedrock,
                              BedrockProperties props,
                              KnowledgeRetriever retriever,
                              PromptLoader prompts,
                              PromptInjectionGuard guard,
                              KnowledgeDocumentRepository docRepo,
                              OfficeHubFeedbackRepository feedbackRepo,
                              MeterRegistry meters) {
        this.bedrock = bedrock;
        this.props = props;
        this.retriever = retriever;
        this.prompts = prompts;
        this.guard = guard;
        this.docRepo = docRepo;
        this.feedbackRepo = feedbackRepo;
        this.meters = meters;
    }

    // ===================================================================== ask

    public AskResponse ask(AskRequest req) {
        Timer.Sample sample = Timer.start(meters);
        String contextId = req.contextId() != null && !req.contextId().isBlank()
                ? req.contextId() : UUID.randomUUID().toString();

        String safeQ = guard.scan(req.question()).sanitizedText();
        List<RetrievedChunk> chunks = retrieve(safeQ, req.collectionId(), req.topK());

        Map<String, Object> vars = new HashMap<>();
        vars.put("context", buildContextBlock(chunks));
        vars.put("question", safeQ);

        PromptLoader.LoadedPrompt loaded = prompts.loadVersioned(PROMPT_ASK, vars);
        BedrockInvocation inv = invoke(loaded.text());

        sample.stop(Timer.builder("knowledge.ai.ask.latency")
                .tag("collection", req.collectionId() == null ? "all" : req.collectionId())
                .register(meters));
        meters.counter("knowledge.ai.ask.calls").increment();

        return new AskResponse(
                contextId,
                trim(inv.outputText()),
                toCitations(chunks),
                new AskResponse.Usage(Math.max(0, inv.tokensIn()), Math.max(0, inv.tokensOut())),
                inv.modelId(),
                Instant.now());
    }

    /** SSE stream: citations first, then token deltas, then a `done` event with contextId. */
    public Flux<ChatStreamChunk> askStream(AskRequest req) {
        return Flux.defer(() -> {
            String contextId = req.contextId() != null && !req.contextId().isBlank()
                    ? req.contextId() : UUID.randomUUID().toString();
            String safeQ = guard.scan(req.question()).sanitizedText();
            List<RetrievedChunk> chunks = retrieve(safeQ, req.collectionId(), req.topK());

            Map<String, Object> vars = new HashMap<>();
            vars.put("context", buildContextBlock(chunks));
            vars.put("question", safeQ);
            String prompt = prompts.loadVersioned(PROMPT_ASK, vars).text();

            List<ChatStreamChunk> leading = new ArrayList<>(chunks.size());
            for (AskResponse.Citation c : toCitations(chunks)) {
                leading.add(new ChatStreamChunk(ChatStreamChunk.EventType.citation,
                        String.format(
                                "{\"documentId\":\"%s\",\"title\":\"%s\",\"chunkIndex\":%d,\"score\":%.4f,\"snippet\":\"%s\"}",
                                escape(c.documentId()), escape(c.title()), c.chunkIndex(), c.score(),
                                escape(c.snippet()))));
            }

            Flux<ChatStreamChunk> deltas = invokeStream(prompt)
                    .map(t -> new ChatStreamChunk(ChatStreamChunk.EventType.delta, t));

            ChatStreamChunk done = new ChatStreamChunk(ChatStreamChunk.EventType.done,
                    String.format("{\"contextId\":\"%s\"}", contextId));

            return Flux.concat(Flux.fromIterable(leading), deltas, Mono.just(done));
        }).onErrorResume(e -> {
            log.error("Office Hub askStream failure: {}", e.toString());
            return Flux.just(new ChatStreamChunk(ChatStreamChunk.EventType.error,
                    "AI 응답 생성 중 오류가 발생했어요. 잠시 후 다시 시도해 주세요."));
        });
    }

    // ============================================================== 4 actions

    public AskResponse runAction(String action, ActionRequest req) {
        String promptKey = promptForAction(action);
        if (promptKey == null) {
            throw new IllegalArgumentException("Unsupported action: " + action);
        }

        Timer.Sample sample = Timer.start(meters);
        String contextId = UUID.randomUUID().toString();

        // For "related", retrieval is the answer surface, not a citation source.
        boolean isRelated = "related".equals(action);

        // Prefer DB-stored body if available (avoids trusting raw payloads); fall back to req.body.
        String docBody = req.body();
        String docTitle = req.title();
        try {
            KnowledgeDocument db = docRepo.findById(req.documentId()).orElse(null);
            if (db != null) {
                docBody = db.getContent();
                docTitle = db.getTitle();
            }
        } catch (Exception ignore) { /* DB optional for action prompts */ }

        List<RetrievedChunk> related = isRelated
                ? retrieveRelated(req.documentId(), docBody, req.collectionId())
                : List.of();

        Map<String, Object> vars = new HashMap<>();
        vars.put("title",   guard.scan(nullToEmpty(docTitle)).sanitizedText());
        vars.put("body",    guard.scan(nullToEmpty(docBody)).sanitizedText());
        vars.put("tags",    req.tags() == null ? "" : String.join(", ", req.tags()));
        vars.put("related", buildRelatedBlock(related));

        BedrockInvocation inv = invoke(prompts.loadVersioned(promptKey, vars).text());

        sample.stop(Timer.builder("knowledge.ai.action.latency")
                .tag("action", action).register(meters));
        meters.counter("knowledge.ai.action.calls", "action", action).increment();

        return new AskResponse(
                contextId,
                trim(inv.outputText()),
                toCitations(related),
                new AskResponse.Usage(Math.max(0, inv.tokensIn()), Math.max(0, inv.tokensOut())),
                inv.modelId(),
                Instant.now());
    }

    public Flux<ChatStreamChunk> runActionStream(String action, ActionRequest req) {
        return Flux.defer(() -> {
            AskResponse res = runAction(action, req);
            List<ChatStreamChunk> events = new ArrayList<>();
            for (AskResponse.Citation c : res.citations()) {
                events.add(new ChatStreamChunk(ChatStreamChunk.EventType.citation,
                        String.format(
                                "{\"documentId\":\"%s\",\"title\":\"%s\",\"chunkIndex\":%d,\"score\":%.4f,\"snippet\":\"%s\"}",
                                escape(c.documentId()), escape(c.title()), c.chunkIndex(), c.score(),
                                escape(c.snippet()))));
            }
            // Chunk the answer to keep the UI feeling streamed.
            String answer = res.answer() == null ? "" : res.answer();
            int step = 48;
            for (int i = 0; i < answer.length(); i += step) {
                events.add(new ChatStreamChunk(ChatStreamChunk.EventType.delta,
                        answer.substring(i, Math.min(answer.length(), i + step))));
            }
            events.add(new ChatStreamChunk(ChatStreamChunk.EventType.done,
                    String.format("{\"contextId\":\"%s\"}", res.contextId())));
            return Flux.fromIterable(events);
        }).onErrorResume(e -> {
            log.error("Office Hub action stream failure: {}", e.toString());
            return Flux.just(new ChatStreamChunk(ChatStreamChunk.EventType.error,
                    "AI 응답 생성 중 오류가 발생했어요."));
        });
    }

    // ============================================================== feedback

    public UUID recordFeedback(FeedbackRequest req, UUID userId) {
        OfficeHubFeedback fb = new OfficeHubFeedback();
        fb.setContextId(req.contextId());
        fb.setDocumentId(req.documentId());
        fb.setUserId(userId);
        fb.setAction(req.action());
        fb.setHelpful(req.helpful());
        fb.setComment(req.comment());
        OfficeHubFeedback saved = feedbackRepo.save(fb);
        meters.counter("knowledge.ai.feedback",
                "action", req.action(),
                "helpful", String.valueOf(req.helpful())).increment();
        return saved.getId();
    }

    // ================================================================ helpers

    private static String promptForAction(String action) {
        return switch (action) {
            case "summarize" -> PROMPT_SUMMARIZE;
            case "related"   -> PROMPT_RELATED;
            case "tags"      -> PROMPT_TAGS;
            case "draft"     -> PROMPT_DRAFT;
            default -> null;
        };
    }

    private List<RetrievedChunk> retrieve(String query, String collectionId, Integer topK) {
        // NOTE: collectionId is accepted on the wire for forward-compatibility but is
        // intentionally NOT pushed into the retriever filter today. The current
        // KnowledgeDocument schema (Phase 2) has no collection column, and the
        // indexer writes chunks with companyId=null — so filtering by collection
        // here would always return zero results. Re-enable once a real
        // `collection_id` is added to KnowledgeDocument and the indexer carries it.
        int k = topK == null ? 5 : Math.min(10, Math.max(1, topK));
        return retriever.retrieve(query, new RetrievalOptions(k, 0.2, Map.of()));
    }

    /**
     * For the "related docs" action we use the *current document* as the query,
     * then drop chunks belonging to the same documentId so we never recommend
     * the doc the user is already reading.
     */
    private List<RetrievedChunk> retrieveRelated(String documentId, String body, String collectionId) {
        if (body == null || body.isBlank()) return List.of();
        // See note in retrieve(): collectionId filter intentionally omitted until
        // schema supports per-collection chunk metadata.
        // Pull more than topK so we still have results after self-filtering.
        List<RetrievedChunk> raw = retriever.retrieve(
                body.length() > 1000 ? body.substring(0, 1000) : body,
                new RetrievalOptions(10, 0.2, Map.of()));
        List<RetrievedChunk> kept = new ArrayList<>();
        java.util.Set<String> seen = new java.util.HashSet<>();
        for (RetrievedChunk c : raw) {
            if (documentId.equals(c.documentId())) continue;
            if (seen.add(c.documentId())) kept.add(c);
            if (kept.size() >= 5) break;
        }
        return kept;
    }

    private List<AskResponse.Citation> toCitations(List<RetrievedChunk> chunks) {
        List<AskResponse.Citation> out = new ArrayList<>(chunks.size());
        for (RetrievedChunk c : chunks) {
            String title = c.metadata() == null ? "" : nullToEmpty(c.metadata().get("title"));
            out.add(new AskResponse.Citation(
                    c.documentId(), title, c.chunkIndex(), c.score(), snippet(c.text())));
        }
        return out;
    }

    private static String buildContextBlock(List<RetrievedChunk> chunks) {
        if (chunks.isEmpty()) return "(관련 사내 문서를 찾지 못했습니다)";
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

    private static String buildRelatedBlock(List<RetrievedChunk> chunks) {
        if (chunks.isEmpty()) return "(연관 문서가 충분하지 않습니다)";
        StringBuilder sb = new StringBuilder();
        for (RetrievedChunk c : chunks) {
            String title = c.metadata() == null ? "" : nullToEmpty(c.metadata().get("title"));
            sb.append("- doc=").append(c.documentId())
              .append(" title=\"").append(title).append("\"")
              .append(" score=").append(String.format("%.3f", c.score()))
              .append("\n  발췌: ").append(snippet(c.text())).append("\n");
        }
        return sb.toString();
    }

    private BedrockInvocation invoke(String prompt) {
        // Office Hub uses Claude Haiku for snappy responses; system prompt is
        // baked into the rendered template (no `--- system ---` split needed).
        return bedrock.invokeText(
                props.models().claudeHaiku(),
                prompt,
                null,
                props.defaults().maxTokensText(),
                props.defaults().temperature());
    }

    private Flux<String> invokeStream(String prompt) {
        Map<String, Object> params = Map.of(
                "systemPrompt", "",
                "maxTokens", props.defaults().maxTokensText(),
                "temperature", props.defaults().temperature());
        if (bedrock instanceof BedrockService real) {
            return real.invokeTextStream(props.models().claudeHaiku(), prompt, params);
        }
        if (bedrock instanceof MockBedrockService mock) {
            return mock.invokeTextStream(props.models().claudeHaiku(), prompt, params);
        }
        return Flux.error(new IllegalStateException("BedrockClient lacks streaming: " + bedrock.getClass()));
    }

    private static String snippet(String text) {
        if (text == null) return "";
        String t = text.replaceAll("\\s+", " ").trim();
        return t.length() <= 160 ? t : t.substring(0, 160) + "...";
    }

    private static String nullToEmpty(String s) { return s == null ? "" : s; }

    private static String trim(String s) { return s == null ? "" : s.trim(); }

    private static String escape(String s) {
        if (s == null) return "";
        return s.replace("\\", "\\\\")
                .replace("\"", "\\\"")
                .replace("\n", " ")
                .replace("\r", " ");
    }
}
