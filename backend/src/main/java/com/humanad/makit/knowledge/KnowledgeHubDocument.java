package com.humanad.makit.knowledge;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.OffsetDateTime;
import java.util.HashSet;
import java.util.Set;
import java.util.UUID;

@Entity
@Table(name = "knowledge_hub_documents")
@Getter
@Setter
@NoArgsConstructor
public class KnowledgeHubDocument {

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    @Column(name = "collection_id", nullable = false, columnDefinition = "uuid")
    private UUID collectionId;

    @Column(name = "owner_id", nullable = false, columnDefinition = "uuid")
    private UUID ownerId;

    @Column(nullable = false, length = 255)
    private String title;

    @Column(length = 16)
    private String emoji;

    @Column(name = "body_md", nullable = false, columnDefinition = "TEXT")
    private String bodyMd = "";

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private DocStatus status = DocStatus.PUBLISHED;

    @Column(name = "deleted_at")
    private OffsetDateTime deletedAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;

    @Version
    @Column(nullable = false)
    private int version;

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(
            name = "knowledge_hub_doc_tags",
            joinColumns = @JoinColumn(name = "document_id")
    )
    @Column(name = "tag", length = 64, nullable = false)
    private Set<String> tags = new HashSet<>();

    @PrePersist
    void onCreate() {
        OffsetDateTime now = OffsetDateTime.now();
        this.createdAt = now;
        this.updatedAt = now;
    }

    @PreUpdate
    void onUpdate() {
        this.updatedAt = OffsetDateTime.now();
    }
}
