package com.humanad.makit.knowledge.ai;

import com.humanad.makit.ai.dto.ChatStreamChunk;
import com.humanad.makit.knowledge.ai.dto.ActionRequest;
import com.humanad.makit.knowledge.ai.dto.AskRequest;
import com.humanad.makit.knowledge.ai.dto.AskResponse;
import com.humanad.makit.knowledge.ai.dto.FeedbackRequest;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.MediaType;
import org.springframework.http.codec.ServerSentEvent;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;
import reactor.core.publisher.Flux;

import java.time.Duration;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * Office Hub AI endpoints.
 *
 * <pre>
 *  POST /api/knowledge/ai/ask                  -> {@link AskResponse}
 *  POST /api/knowledge/ai/ask/stream           -> SSE
 *  POST /api/knowledge/ai/actions/{action}     -> {@link AskResponse}
 *  POST /api/knowledge/ai/actions/{action}/stream -> SSE
 *  POST /api/knowledge/ai/feedback             -> {@code {"id": uuid}}
 * </pre>
 *
 * Allowed actions: {@code summarize | related | tags | draft}.
 */
@Slf4j
@RestController
@RequiredArgsConstructor
@Tag(name = "knowledge")
@RequestMapping("/api/knowledge/ai")
public class OfficeHubAiController {

    private static final Set<String> ALLOWED_ACTIONS = Set.of("summarize", "related", "tags", "draft");

    private final OfficeHubAiService service;

    @Operation(summary = "Free-form RAG question over Office Hub knowledge")
    @PostMapping("/ask")
    public AskResponse ask(@Valid @RequestBody AskRequest req) {
        return service.ask(req);
    }

    @PostMapping(value = "/ask/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public Flux<ServerSentEvent<String>> askStream(@Valid @RequestBody AskRequest req) {
        return wrapSse(service.askStream(req));
    }

    @PostMapping("/actions/{action}")
    public AskResponse action(@PathVariable String action, @Valid @RequestBody ActionRequest req) {
        validateAction(action);
        return service.runAction(action, req);
    }

    @PostMapping(value = "/actions/{action}/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public Flux<ServerSentEvent<String>> actionStream(@PathVariable String action,
                                                      @Valid @RequestBody ActionRequest req) {
        validateAction(action);
        return wrapSse(service.runActionStream(action, req));
    }

    @PostMapping("/feedback")
    public Map<String, String> feedback(@Valid @RequestBody FeedbackRequest req) {
        UUID id = service.recordFeedback(req, currentUserId());
        return Map.of("id", id.toString());
    }

    // ------------------------------------------------------------- helpers

    private static void validateAction(String action) {
        if (!ALLOWED_ACTIONS.contains(action)) {
            // 400 (not 500) — this is a client-side error caused by an unsupported
            // path variable, so surface it as Bad Request to callers.
            throw new org.springframework.web.server.ResponseStatusException(
                    org.springframework.http.HttpStatus.BAD_REQUEST,
                    "Unsupported action: " + action + " (allowed: " + ALLOWED_ACTIONS + ")");
        }
    }

    /**
     * Wrap a {@link ChatStreamChunk} flux in SSE envelopes plus a 15s heartbeat,
     * mirroring the same single-subscription pattern as ChatbotStreamController
     * to avoid double Bedrock charges.
     */
    private Flux<ServerSentEvent<String>> wrapSse(Flux<ChatStreamChunk> body) {
        AtomicBoolean done = new AtomicBoolean(false);
        Flux<ServerSentEvent<String>> events = body
                .map(c -> ServerSentEvent.<String>builder()
                        .event(c.event().name())
                        .data(c.data() == null ? "" : c.data())
                        .build())
                .doOnTerminate(() -> done.set(true))
                .doOnCancel(() -> done.set(true));
        Flux<ServerSentEvent<String>> heartbeat = Flux.interval(Duration.ofSeconds(15))
                .takeWhile(i -> !done.get())
                .map(i -> ServerSentEvent.<String>builder().event("ping").data("").build());
        return events.mergeWith(heartbeat);
    }

    private UUID currentUserId() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || auth.getName() == null) return null;
        try {
            return UUID.fromString(auth.getName());
        } catch (Exception ex) {
            return null;
        }
    }
}
