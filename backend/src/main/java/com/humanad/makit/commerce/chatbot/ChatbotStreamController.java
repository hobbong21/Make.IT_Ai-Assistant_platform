package com.humanad.makit.commerce.chatbot;

import com.humanad.makit.ai.dto.ChatStreamChunk;
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
    public Flux<ServerSentEvent<String>> stream(@Valid @RequestBody ChatMessageRequest req) {
        UUID userId = currentUserId();
        // Resolve (or create) the contextId up front so we can include it in the `done`
        // event payload (QA-006). The FE reads payload.contextId to persist conversation continuity.
        String effectiveContextId = (req.contextId() == null || req.contextId().isBlank())
                ? UUID.randomUUID().toString()
                : req.contextId();
        ChatMessageRequest effectiveReq = new ChatMessageRequest(
                req.message(),
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
        Flux<ServerSentEvent<String>> events = chatbotService.chatStream(effectiveReq, userId, "web")
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
}
