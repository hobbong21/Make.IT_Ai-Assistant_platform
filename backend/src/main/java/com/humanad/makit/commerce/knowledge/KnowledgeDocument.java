package com.humanad.makit.commerce.knowledge;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.OffsetDateTime;

@Entity
@Table(name = "knowledge_documents", indexes = {
        @Index(name = "idx_kdocs_type", columnList = "document_type")
})
@Getter @Setter @NoArgsConstructor
public class KnowledgeDocument {

    public enum Status { DRAFT, INDEXED, STALE }

    @Id
    @Column(name = "document_id", length = 64)
    private String documentId;

    @Column(nullable = false, length = 256)
    private String title;

    @Column(nullable = false, columnDefinition = "text")
    private String content;

    @Column(name = "document_type", nullable = false, length = 32)
    private String documentType;

    @Column(length = 256)
    private String source;

    @Column(columnDefinition = "text[]")
    private String[] tags;

    @Column(name = "indexed_at")
    private OffsetDateTime indexedAt;

    @Column(name = "last_updated", nullable = false)
    private OffsetDateTime lastUpdated;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private Status status;

    @PrePersist
    void onCreate() {
        if (lastUpdated == null) lastUpdated = OffsetDateTime.now();
        if (status == null) status = Status.DRAFT;
    }

    @PreUpdate
    void onUpdate() {
        lastUpdated = OffsetDateTime.now();
    }
}
