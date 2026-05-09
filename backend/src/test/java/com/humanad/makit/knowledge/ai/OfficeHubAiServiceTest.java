package com.humanad.makit.knowledge.ai;

import com.humanad.makit.ai.KnowledgeRetriever;
import com.humanad.makit.ai.bedrock.BedrockClient;
import com.humanad.makit.ai.bedrock.BedrockProperties;
import com.humanad.makit.ai.bedrock.MockBedrockService;
import com.humanad.makit.ai.dto.ChatStreamChunk;
import com.humanad.makit.ai.dto.RetrievalOptions;
import com.humanad.makit.ai.dto.RetrievedChunk;
import com.humanad.makit.ai.prompt.PromptInjectionGuard;
import com.humanad.makit.ai.prompt.PromptLoader;
import com.humanad.makit.ai.prompt.PromptVariantProperties;
import com.humanad.makit.commerce.knowledge.KnowledgeDocument;
import com.humanad.makit.commerce.knowledge.KnowledgeDocumentRepository;
import com.humanad.makit.knowledge.ai.dto.ActionRequest;
import com.humanad.makit.knowledge.ai.dto.AskRequest;
import com.humanad.makit.knowledge.ai.dto.AskResponse;
import com.humanad.makit.knowledge.ai.dto.FeedbackRequest;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Unit tests for {@link OfficeHubAiService}. Uses the real
 * {@link MockBedrockService} (so streaming branches actually exercise the
 * {@code instanceof MockBedrockService} path) plus the real
 * {@link PromptLoader} so prompt-template regressions surface here.
 *
 * Mocked: {@link KnowledgeRetriever}, {@link KnowledgeDocumentRepository},
 * {@link OfficeHubFeedbackRepository}.
 */
@ExtendWith(MockitoExtension.class)
class OfficeHubAiServiceTest {

    private final BedrockClient bedrock = new MockBedrockService();
    private final BedrockProperties props = new BedrockProperties(
            false,
            "us-east-1",
            new BedrockProperties.Models(
                    "anthropic.claude-3-haiku-20240307-v1:0",
                    "anthropic.claude-3-sonnet-20240229-v1:0",
                    "amazon.titan-embed-text-v1",
                    "stability.stable-diffusion-xl-v1",
                    "amazon.titan-image-generator-v1"),
            new BedrockProperties.Defaults(1024, 2048, 0.5, 0.2, 30, 7.0),
            Map.of(),
            null);
    private final SimpleMeterRegistry meters = new SimpleMeterRegistry();
    private final PromptInjectionGuard guard = new PromptInjectionGuard(meters);
    private final PromptLoader prompts = new PromptLoader(PromptVariantProperties.empty());

    @Mock KnowledgeRetriever retriever;
    @Mock KnowledgeDocumentRepository docRepo;
    @Mock OfficeHubFeedbackRepository feedbackRepo;

    private OfficeHubAiService service;

    @BeforeEach
    void setUp() {
        service = new OfficeHubAiService(
                bedrock, props, retriever, prompts, guard, docRepo, feedbackRepo, meters,
                new com.humanad.makit.knowledge.ai.SlowCallSampler());
    }

    // -------------------------------------------------------------------- ask

    @Test
    void ask_returnsAnswerAndCitations() {
        when(retriever.retrieve(eq("질문 본문"), any(RetrievalOptions.class)))
                .thenReturn(List.of(new RetrievedChunk(
                        "chunk-1", "doc-1", 0,
                        "사내 정책 본문 일부", 0.91,
                        Map.of("title", "사내 정책"))));

        AskResponse res = service.ask(new AskRequest("질문 본문", null, null, null));

        assertThat(res.contextId()).isNotBlank();
        assertThat(res.answer()).isNotBlank();
        assertThat(res.modelId()).isEqualTo(props.models().claudeHaiku());
        assertThat(res.citations()).hasSize(1);
        AskResponse.Citation c = res.citations().get(0);
        assertThat(c.documentId()).isEqualTo("doc-1");
        assertThat(c.title()).isEqualTo("사내 정책");
        assertThat(c.snippet()).isNotBlank();
    }

    @Test
    void ask_keepsCallerProvidedContextIdAndHandlesEmptyRetrieval() {
        when(retriever.retrieve(any(), any())).thenReturn(List.of());

        AskResponse res = service.ask(new AskRequest("질문", "ctx-keep-me", null, 3));

        assertThat(res.contextId()).isEqualTo("ctx-keep-me");
        assertThat(res.citations()).isEmpty();
        assertThat(res.answer()).isNotBlank();
    }

    @Test
    void askStream_emitsCitationThenDeltaThenDone() {
        when(retriever.retrieve(any(), any())).thenReturn(List.of(new RetrievedChunk(
                "chunk-1", "doc-1", 0, "본문", 0.8,
                Map.of("title", "T1"))));

        List<ChatStreamChunk> chunks = service.askStream(
                new AskRequest("질문", "ctx-stream", null, null))
                .collectList()
                .block();

        assertThat(chunks).isNotNull().isNotEmpty();
        // First event must be the citation.
        assertThat(chunks.get(0).event()).isEqualTo(ChatStreamChunk.EventType.citation);
        assertThat(chunks.get(0).data())
                .contains("\"documentId\":\"doc-1\"")
                .contains("\"title\":\"T1\"");
        // Body must contain at least one delta event.
        assertThat(chunks).extracting(ChatStreamChunk::event)
                .contains(ChatStreamChunk.EventType.delta);
        // Last event must be `done` and carry the contextId.
        ChatStreamChunk last = chunks.get(chunks.size() - 1);
        assertThat(last.event()).isEqualTo(ChatStreamChunk.EventType.done);
        assertThat(last.data()).contains("\"contextId\":\"ctx-stream\"");
    }

    // ---------------------------------------------------------------- actions

    @Test
    void runAction_summarize_doesNotCallRetriever() {
        AskResponse res = service.runAction("summarize",
                new ActionRequest("doc-1", "제목", "본문 내용", List.of("a"), null));

        assertThat(res.answer()).isNotBlank();
        assertThat(res.citations()).isEmpty();
        verify(retriever, never()).retrieve(any(), any());
    }

    @Test
    void runAction_tags_doesNotCallRetriever() {
        AskResponse res = service.runAction("tags",
                new ActionRequest("doc-1", "제목", "본문 내용", List.of("기존태그"), null));

        assertThat(res.answer()).isNotBlank();
        assertThat(res.citations()).isEmpty();
        verify(retriever, never()).retrieve(any(), any());
    }

    @Test
    void runAction_draft_doesNotCallRetriever() {
        AskResponse res = service.runAction("draft",
                new ActionRequest("doc-1", "제목", "본문 내용", null, null));

        assertThat(res.answer()).isNotBlank();
        assertThat(res.citations()).isEmpty();
        verify(retriever, never()).retrieve(any(), any());
    }

    @Test
    void runAction_related_excludesSelfDocAndReturnsOthersAsCitations() {
        when(retriever.retrieve(any(), any())).thenReturn(List.of(
                new RetrievedChunk("c-self", "doc-1", 0, "self chunk",  0.99, Map.of("title", "Self")),
                new RetrievedChunk("c-2",    "doc-2", 0, "other chunk", 0.88, Map.of("title", "Other-2")),
                new RetrievedChunk("c-3",    "doc-3", 0, "third chunk", 0.77, Map.of("title", "Other-3"))
        ));

        AskResponse res = service.runAction("related",
                new ActionRequest("doc-1", "제목", "충분히 긴 본문입니다.", null, null));

        assertThat(res.citations())
                .extracting(AskResponse.Citation::documentId)
                .containsExactly("doc-2", "doc-3");
        assertThat(res.answer()).isNotBlank();
    }

    @Test
    void runAction_related_returnsNoCitationsWhenBodyBlank() {
        AskResponse res = service.runAction("related",
                new ActionRequest("doc-1", "제목", "  ", null, null));

        assertThat(res.citations()).isEmpty();
        verify(retriever, never()).retrieve(any(), any());
    }

    @Test
    void runAction_prefersPersistedDocBodyOverRequestBody() {
        KnowledgeDocument db = new KnowledgeDocument();
        db.setDocumentId("doc-1");
        db.setTitle("DB 제목");
        db.setContent("DB 본문");
        when(docRepo.findById("doc-1")).thenReturn(Optional.of(db));

        // Should not throw; we just verify the persisted-body path runs cleanly.
        AskResponse res = service.runAction("summarize",
                new ActionRequest("doc-1", "요청 제목", "요청 본문", null, null));

        assertThat(res.answer()).isNotBlank();
    }

    @Test
    void runAction_unknown_throwsIllegalArgument() {
        assertThatThrownBy(() -> service.runAction("unknown",
                new ActionRequest("doc-1", "t", "b", null, null)))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Unsupported action");
    }

    // --------------------------------------------------------------- feedback

    @Test
    void recordFeedback_persistsRowAndReturnsId() {
        UUID savedId = UUID.randomUUID();
        UUID userId  = UUID.randomUUID();
        when(feedbackRepo.save(any(OfficeHubFeedback.class))).thenAnswer(inv -> {
            OfficeHubFeedback fb = inv.getArgument(0);
            fb.setId(savedId);
            return fb;
        });

        UUID returned = service.recordFeedback(
                new FeedbackRequest("ctx-1", "doc-1", "ask", true, "도움 됐어요"),
                userId);

        assertThat(returned).isEqualTo(savedId);
        ArgumentCaptor<OfficeHubFeedback> cap = ArgumentCaptor.forClass(OfficeHubFeedback.class);
        verify(feedbackRepo).save(cap.capture());
        OfficeHubFeedback persisted = cap.getValue();
        assertThat(persisted.getContextId()).isEqualTo("ctx-1");
        assertThat(persisted.getDocumentId()).isEqualTo("doc-1");
        assertThat(persisted.getAction()).isEqualTo("ask");
        assertThat(persisted.isHelpful()).isTrue();
        assertThat(persisted.getComment()).isEqualTo("도움 됐어요");
        assertThat(persisted.getUserId()).isEqualTo(userId);
        // Counter incremented with the right tags.
        assertThat(meters.counter("knowledge.ai.feedback",
                "action", "ask", "helpful", "true").count()).isEqualTo(1.0);
    }
}
