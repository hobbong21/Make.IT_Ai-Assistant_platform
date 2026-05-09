package com.humanad.makit.knowledge.ai;

import com.humanad.makit.ai.dto.ChatStreamChunk;
import com.humanad.makit.knowledge.ai.dto.ActionRequest;
import com.humanad.makit.knowledge.ai.dto.AskRequest;
import com.humanad.makit.knowledge.ai.dto.AskResponse;
import com.humanad.makit.knowledge.ai.dto.FeedbackRequest;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.http.codec.ServerSentEvent;
import org.springframework.web.server.ResponseStatusException;
import reactor.core.publisher.Flux;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Unit tests for {@link OfficeHubAiController}. Verifies:
 *  - the 4-action whitelist (summarize/related/tags/draft) is enforced and
 *    unknown actions surface as HTTP 400 (not 500),
 *  - SSE wrapping preserves the {@code citation/delta/done} event names and
 *    the underlying data payload,
 *  - feedback is delegated to the service and the returned UUID is echoed.
 */
@ExtendWith(MockitoExtension.class)
class OfficeHubAiControllerTest {

    @Mock OfficeHubAiService service;
    @InjectMocks OfficeHubAiController controller;

    // ------------------------------------------------------ action whitelist

    @Test
    void action_unknown_returns400() {
        assertThatThrownBy(() -> controller.action("unknown",
                new ActionRequest("doc-1", "t", "b", null, null)))
                .isInstanceOfSatisfying(ResponseStatusException.class, ex ->
                        assertThat(ex.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST));
    }

    @Test
    void action_allowsAllFourWhitelistedActions() {
        AskResponse stub = new AskResponse(
                "ctx", "answer", List.of(),
                new AskResponse.Usage(1, 1), "model", Instant.now());
        for (String a : List.of("summarize", "related", "tags", "draft")) {
            when(service.runAction(eq(a), any())).thenReturn(stub);
            AskResponse r = controller.action(a,
                    new ActionRequest("doc-1", "t", "b", null, null));
            assertThat(r).isSameAs(stub);
        }
    }

    @Test
    void actionStream_unknown_returns400() {
        assertThatThrownBy(() -> controller.actionStream("hack",
                new ActionRequest("doc-1", "t", "b", null, null)))
                .isInstanceOfSatisfying(ResponseStatusException.class, ex ->
                        assertThat(ex.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST));
    }

    // ------------------------------------------------------------- SSE shape

    @Test
    void askStream_wrapsChunksAsSseEventsWithCitationDeltaDone() {
        List<ChatStreamChunk> upstream = List.of(
                new ChatStreamChunk(ChatStreamChunk.EventType.citation,
                        "{\"documentId\":\"doc-1\",\"title\":\"T\",\"chunkIndex\":0,\"score\":0.9,\"snippet\":\"s\"}"),
                new ChatStreamChunk(ChatStreamChunk.EventType.delta, "hello"),
                new ChatStreamChunk(ChatStreamChunk.EventType.delta, " world"),
                new ChatStreamChunk(ChatStreamChunk.EventType.done,
                        "{\"contextId\":\"ctx-1\"}"));
        when(service.askStream(any())).thenReturn(Flux.fromIterable(upstream));

        // Take only the body events (heartbeat fires every 15s so won't appear).
        List<ServerSentEvent<String>> events = controller
                .askStream(new AskRequest("질문", null, null, null))
                .take(upstream.size())
                .collectList()
                .block();

        assertThat(events).isNotNull().hasSize(4);
        assertThat(events).extracting(ServerSentEvent::event)
                .containsExactly("citation", "delta", "delta", "done");
        assertThat(events.get(0).data()).contains("\"documentId\":\"doc-1\"");
        assertThat(events.get(1).data()).isEqualTo("hello");
        assertThat(events.get(3).data()).contains("\"contextId\":\"ctx-1\"");
    }

    @Test
    void actionStream_wrapsChunksAsSseEvents() {
        List<ChatStreamChunk> upstream = List.of(
                new ChatStreamChunk(ChatStreamChunk.EventType.citation, "{\"documentId\":\"d\"}"),
                new ChatStreamChunk(ChatStreamChunk.EventType.delta, "abc"),
                new ChatStreamChunk(ChatStreamChunk.EventType.done, "{\"contextId\":\"c\"}"));
        when(service.runActionStream(eq("summarize"), any()))
                .thenReturn(Flux.fromIterable(upstream));

        List<ServerSentEvent<String>> events = controller
                .actionStream("summarize",
                        new ActionRequest("doc-1", "t", "b", null, null))
                .take(upstream.size())
                .collectList()
                .block();

        assertThat(events).isNotNull();
        assertThat(events).extracting(ServerSentEvent::event)
                .containsExactly("citation", "delta", "done");
    }

    // -------------------------------------------------------------- feedback

    @Test
    void feedback_delegatesToServiceAndReturnsId() {
        UUID id = UUID.randomUUID();
        when(service.recordFeedback(any(), any())).thenReturn(id);

        FeedbackRequest req = new FeedbackRequest("ctx-1", "doc-1", "ask", true, null);
        Map<String, String> body = controller.feedback(req);

        assertThat(body).containsEntry("id", id.toString());
        ArgumentCaptor<FeedbackRequest> cap = ArgumentCaptor.forClass(FeedbackRequest.class);
        verify(service).recordFeedback(cap.capture(), any());
        assertThat(cap.getValue()).isSameAs(req);
    }
}
