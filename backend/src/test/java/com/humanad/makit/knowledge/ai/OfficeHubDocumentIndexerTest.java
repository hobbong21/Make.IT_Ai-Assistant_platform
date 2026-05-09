package com.humanad.makit.knowledge.ai;

import com.humanad.makit.ai.KnowledgeRetriever;
import com.humanad.makit.ai.dto.KnowledgeDocumentRef;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;

/**
 * Confirms the async indexer fires {@code indexDocument} exactly once per save
 * event, skips empty content, defaults the {@code sourceType} to
 * {@code office_hub}, and never lets a retriever failure escape the listener
 * (otherwise the failure would propagate into Spring's async executor and
 * silently kill subsequent indexing tasks).
 */
@ExtendWith(MockitoExtension.class)
class OfficeHubDocumentIndexerTest {

    @Mock KnowledgeRetriever retriever;
    @InjectMocks OfficeHubDocumentIndexer indexer;

    @Test
    void onSaved_callsIndexDocumentExactlyOnce() {
        indexer.onSaved(new KnowledgeDocumentSavedEvent(
                "doc-1", "제목", "본문 내용", "office_hub", "co-1"));

        ArgumentCaptor<KnowledgeDocumentRef> cap =
                ArgumentCaptor.forClass(KnowledgeDocumentRef.class);
        verify(retriever, times(1))
                .indexDocument(cap.capture(), eq("본문 내용"), eq(Map.of()));
        KnowledgeDocumentRef ref = cap.getValue();
        assertThat(ref.documentId()).isEqualTo("doc-1");
        assertThat(ref.title()).isEqualTo("제목");
        assertThat(ref.sourceType()).isEqualTo("office_hub");
        assertThat(ref.companyId()).isEqualTo("co-1");
    }

    @Test
    void onSaved_defaultsSourceTypeWhenNull() {
        indexer.onSaved(new KnowledgeDocumentSavedEvent(
                "doc-1", "제목", "본문", null, null));

        ArgumentCaptor<KnowledgeDocumentRef> cap =
                ArgumentCaptor.forClass(KnowledgeDocumentRef.class);
        verify(retriever).indexDocument(cap.capture(), any(), any());
        assertThat(cap.getValue().sourceType()).isEqualTo("office_hub");
    }

    @Test
    void onSaved_skipsBlankContent() {
        indexer.onSaved(new KnowledgeDocumentSavedEvent(
                "doc-1", "제목", "   ", null, null));

        verifyNoInteractions(retriever);
    }

    @Test
    void onSaved_skipsNullContent() {
        indexer.onSaved(new KnowledgeDocumentSavedEvent(
                "doc-1", "제목", null, null, null));

        verifyNoInteractions(retriever);
    }

    @Test
    void onSaved_swallowsRetrieverException() {
        doThrow(new RuntimeException("bedrock down"))
                .when(retriever).indexDocument(any(), any(), any());

        assertThatCode(() -> indexer.onSaved(new KnowledgeDocumentSavedEvent(
                "doc-1", "제목", "본문", null, null)))
                .doesNotThrowAnyException();
    }
}
