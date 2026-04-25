package com.humanad.makit.commerce.chatbot;

import com.humanad.makit.ai.ChatbotEngine;
import com.humanad.makit.ai.dto.ChatRequest;
import com.humanad.makit.ai.dto.ChatResponse;
import com.humanad.makit.ai.dto.ChatStreamChunk;
import com.humanad.makit.commerce.chatbot.dto.ChatMessageRequest;
import com.humanad.makit.commerce.chatbot.dto.ChatMessageResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import reactor.core.publisher.Flux;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class ChatbotService {

    private final ChatbotEngine engine;
    private final ConversationContextRepository contextRepo;
    private final ChatMessageRepository messageRepo;

    @Transactional
    public ChatMessageResponse chat(ChatMessageRequest req, UUID userId, String sessionId) {
        ConversationContext ctx = resolveContext(req.contextId(), userId, sessionId);
        persistMessage(ctx.getContextId(), ChatMessage.Role.USER, req.message(), null, null);

        com.humanad.makit.ai.dto.ConversationContext aiCtx = new com.humanad.makit.ai.dto.ConversationContext(
                ctx.getContextId(), userId, sessionId, List.of(), ctx.getStartTime().toInstant(), ctx.getLastActivity().toInstant()
        );
        ChatRequest aiReq = new ChatRequest(
                UUID.randomUUID(), req.message(), ctx.getContextId(),
                req.useRag() == null || req.useRag(),
                req.temperature(), null
        );
        ChatResponse res = engine.chat(aiReq, aiCtx);
        Integer tIn = res.usage() == null ? null : res.usage().tokensIn();
        Integer tOut = res.usage() == null ? null : res.usage().tokensOut();
        persistMessage(ctx.getContextId(), ChatMessage.Role.ASSISTANT, res.reply(), tIn, tOut);
        ctx.setLastActivity(OffsetDateTime.now());

        List<ChatMessageResponse.Citation> cites = res.citations() == null ? List.of() :
                res.citations().stream()
                        .map(c -> new ChatMessageResponse.Citation(c.documentId(), c.chunkIndex(), c.score(), c.snippet()))
                        .toList();
        return new ChatMessageResponse(
                ctx.getContextId(), res.reply(), "ASSISTANT", cites,
                res.usage() == null ? null : new ChatMessageResponse.Usage(res.usage().tokensIn(), res.usage().tokensOut())
        );
    }

    public Flux<ChatStreamChunk> chatStream(ChatMessageRequest req, UUID userId, String sessionId) {
        return chatStream(req, userId, sessionId, null);
    }

    /**
     * Stream variant that accepts an optional page context hint.
     * The hint is prepended to the system prompt to provide contextual awareness.
     */
    public Flux<ChatStreamChunk> chatStream(ChatMessageRequest req, UUID userId, String sessionId, String pageContextHint) {
        ConversationContext ctx = resolveContext(req.contextId(), userId, sessionId);
        persistMessage(ctx.getContextId(), ChatMessage.Role.USER, req.message(), null, null);

        com.humanad.makit.ai.dto.ConversationContext aiCtx = new com.humanad.makit.ai.dto.ConversationContext(
                ctx.getContextId(), userId, sessionId, List.of(), ctx.getStartTime().toInstant(), ctx.getLastActivity().toInstant()
        );
        ChatRequest aiReq = new ChatRequest(
                UUID.randomUUID(), req.message(), ctx.getContextId(),
                req.useRag() == null || req.useRag(),
                req.temperature(), null
        );
        return engine.chatStream(aiReq, aiCtx, pageContextHint);
    }

    private ConversationContext resolveContext(String contextId, UUID userId, String sessionId) {
        if (contextId != null && !contextId.isBlank()) {
            return contextRepo.findById(contextId).orElseGet(() -> openContext(contextId, userId, sessionId));
        }
        return openContext(UUID.randomUUID().toString(), userId, sessionId);
    }

    private ConversationContext openContext(String contextId, UUID userId, String sessionId) {
        ConversationContext ctx = new ConversationContext();
        ctx.setContextId(contextId);
        ctx.setUserId(userId);
        ctx.setSessionId(sessionId == null ? "web" : sessionId);
        ctx.setStatus(ConversationContext.Status.ACTIVE);
        return contextRepo.save(ctx);
    }

    private void persistMessage(String contextId, ChatMessage.Role role, String content, Integer tIn, Integer tOut) {
        ChatMessage m = new ChatMessage();
        m.setContextId(contextId);
        m.setRole(role);
        m.setContent(content);
        m.setTokensIn(tIn);
        m.setTokensOut(tOut);
        messageRepo.save(m);
    }
}
