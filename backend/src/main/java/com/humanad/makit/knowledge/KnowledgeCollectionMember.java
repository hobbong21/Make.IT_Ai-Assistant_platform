package com.humanad.makit.knowledge;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.io.Serializable;
import java.time.OffsetDateTime;
import java.util.Objects;
import java.util.UUID;

@Entity
@Table(name = "knowledge_collection_members")
@IdClass(KnowledgeCollectionMember.PK.class)
@Getter
@Setter
@NoArgsConstructor
public class KnowledgeCollectionMember {

    @Id
    @Column(name = "collection_id", nullable = false, columnDefinition = "uuid")
    private UUID collectionId;

    @Id
    @Column(name = "user_id", nullable = false, columnDefinition = "uuid")
    private UUID userId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private CollectionRole role;

    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    @PrePersist
    void onCreate() { this.createdAt = OffsetDateTime.now(); }

    public static class PK implements Serializable {
        private UUID collectionId;
        private UUID userId;
        public PK() {}
        public PK(UUID collectionId, UUID userId) { this.collectionId = collectionId; this.userId = userId; }
        @Override public boolean equals(Object o) {
            if (!(o instanceof PK p)) return false;
            return Objects.equals(collectionId, p.collectionId) && Objects.equals(userId, p.userId);
        }
        @Override public int hashCode() { return Objects.hash(collectionId, userId); }
    }
}
