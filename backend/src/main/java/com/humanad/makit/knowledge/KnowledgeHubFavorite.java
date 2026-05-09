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
@Table(name = "knowledge_hub_favorites")
@IdClass(KnowledgeHubFavorite.PK.class)
@Getter
@Setter
@NoArgsConstructor
public class KnowledgeHubFavorite {

    @Id
    @Column(name = "user_id", nullable = false, columnDefinition = "uuid")
    private UUID userId;

    @Id
    @Column(name = "document_id", nullable = false, columnDefinition = "uuid")
    private UUID documentId;

    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    @PrePersist
    void onCreate() { this.createdAt = OffsetDateTime.now(); }

    public static class PK implements Serializable {
        private UUID userId;
        private UUID documentId;
        public PK() {}
        public PK(UUID userId, UUID documentId) { this.userId = userId; this.documentId = documentId; }
        @Override public boolean equals(Object o) {
            if (!(o instanceof PK p)) return false;
            return Objects.equals(userId, p.userId) && Objects.equals(documentId, p.documentId);
        }
        @Override public int hashCode() { return Objects.hash(userId, documentId); }
    }
}
