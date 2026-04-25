package com.humanad.makit.commerce.chatbot;

import com.humanad.makit.ai.dto.ChatStreamChunk;
import com.humanad.makit.audit.Auditable;
import com.humanad.makit.commerce.chatbot.dto.ChatMessageRequest;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.MediaType;
import org.springframework.http.codec.ServerSentEvent;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import reactor.core.publisher.Flux;

import java.time.Duration;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicBoolean;

@Slf4j
@RestController
@RequiredArgsConstructor
@Tag(name = "commerce")
@RequestMapping("/api/commerce/chatbot")
public class ChatbotStreamController {

    private final ChatbotService chatbotService;

    @PostMapping(value = "/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    @Auditable(resource = "chatbot")
    public Flux<ServerSentEvent<String>> stream(@Valid @RequestBody ChatMessageRequest req) {
        UUID userId = currentUserId();
        // Resolve (or create) the contextId up front so we can include it in the `done`
        // event payload (QA-006). The FE reads payload.contextId to persist conversation continuity.
        String effectiveContextId = (req.contextId() == null || req.contextId().isBlank())
                ? UUID.randomUUID().toString()
                : req.contextId();

        // Extract page context hint from message prefix if present.
        // Format: "[페이지 컨텍스트: <hint>]\n<actual question>"
        ContextExtractionResult extraction = extractContextHint(req.message());
        String contextHint = extraction.contextHint();
        String cleanMessage = extraction.cleanMessage();

        ChatMessageRequest effectiveReq = new ChatMessageRequest(
                cleanMessage,
                effectiveContextId,
                req.useRag(),
                req.temperature()
        );

        // PRR-006: the previous implementation (`Flux.merge(events, heartbeat).takeUntilOther(body.ignoreElements())`)
        // subscribed to the `body` publisher twice — once via `events` and once again via
        // `body.ignoreElements()`. Because `ChatbotService.chatStream` performs side effects
        // (context resolution + user-message persistence + Bedrock invocation) on subscription,
        // every request incurred double DB writes and double Bedrock cost.
        //
        // Fix: the body publisher is subscribed exactly once. A shared completion flag stops
        // the interval-driven heartbeat when the body terminates (complete or error), so we
        // never need a second subscription to observe that signal.
        AtomicBoolean completed = new AtomicBoolean(false);
        Flux<ServerSentEvent<String>> events = chatbotService.chatStream(effectiveReq, userId, "web", contextHint)
                .map(chunk -> {
                    String data = chunk.data() == null ? "" : chunk.data();
                    // Inject contextId into the `done` event payload if not already present.
                    if (chunk.event() == ChatStreamChunk.EventType.done) {
                        data = injectContextId(data, effectiveContextId);
                    }
                    return ServerSentEvent.<String>builder()
                            .event(chunk.event().name())
                            .data(data)
                            .build();
                })
                .doOnTerminate(() -> completed.set(true))
                .doOnCancel(() -> completed.set(true));
        Flux<ServerSentEvent<String>> heartbeat = Flux.interval(Duration.ofSeconds(15))
                .takeWhile(i -> !completed.get())
                .map(i -> ServerSentEvent.<String>builder().event("ping").data("").build());
        return events.mergeWith(heartbeat);
    }

    /**
     * Ensures the JSON payload of a `done` SSE event carries {@code contextId}.
     * Accepts either a valid JSON object (in which case we append/overwrite the key)
     * or an empty / non-JSON string (in which case we emit a fresh JSON object).
     */
    static String injectContextId(String rawJson, String contextId) {
        if (contextId == null) return rawJson == null ? "{}" : rawJson;
        String trimmed = rawJson == null ? "" : rawJson.trim();
        String contextFrag = "\"contextId\":\"" + escapeJson(contextId) + "\"";
        if (trimmed.isEmpty() || !trimmed.startsWith("{") || !trimmed.endsWith("}")) {
            return "{" + contextFrag + "}";
        }
        if (trimmed.contains("\"contextId\"")) {
            return trimmed; // already present — don't double-add
        }
        String inner = trimmed.substring(1, trimmed.length() - 1).trim();
        if (inner.isEmpty()) {
            return "{" + contextFrag + "}";
        }
        return "{" + contextFrag + "," + inner + "}";
    }

    private static String escapeJson(String s) {
        return s.replace("\\", "\\\\").replace("\"", "\\\"");
    }

    private UUID currentUserId() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        try {
            return UUID.fromString(auth.getName());
        } catch (Exception ex) {
            return UUID.randomUUID();
        }
    }

    /**
     * Extract page context hint from message prefix.
     * Expected format: "[페이지 컨텍스트: <hint>]\n<actual message>"
     *
     * Returns a record with both the extracted context hint and the clean message.
     * If no context hint is found, contextHint is null and cleanMessage is the original message.
     */
    private ContextExtractionResult extractContextHint(String message) {
        if (message == null || message.isBlank()) {
            return new ContextExtractionResult(null, message);
        }

        // Regex: ^\\[페이지 컨텍스트:\\s*([^\\]]+)\\]\\s*\\n?(.*)$
        // Matches: [페이지 컨텍스트: <hint>]\n<rest>
        String regex = "^\\[페이지 컨텍스트:\\s*([^\\]]+)\\]\\s*(?:\\n)?(.*)$";
        java.util.regex.Pattern pattern = java.util.regex.Pattern.compile(regex, java.util.regex.Pattern.DOTALL);
        java.util.regex.Matcher matcher = pattern.matcher(message);

        if (matcher.find()) {
            String contextHint = matcher.group(1).trim();
            String cleanMessage = matcher.group(2).trim();
            log.debug("Extracted page context: '{}'", contextHint);
            return new ContextExtractionResult(contextHint, cleanMessage);
        }

        return new ContextExtractionResult(null, message);
    }

    /**
     * Result of context hint extraction.
     */
    private record ContextExtractionResult(String contextHint, String cleanMessage) {}
}
