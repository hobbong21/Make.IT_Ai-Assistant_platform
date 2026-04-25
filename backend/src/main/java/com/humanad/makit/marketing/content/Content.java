package com.humanad.makit.marketing.content;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "contents", indexes = {
        @Index(name = "idx_contents_user_created", columnList = "user_id, created_at DESC"),
        @Index(name = "idx_contents_campaign", columnList = "campaign_id"),
        @Index(name = "idx_contents_prompt_hash", columnList = "prompt_hash")
})
@Getter @Setter @NoArgsConstructor
public class Content {

    public enum Status { DRAFT, PUBLISHED, ARCHIVED }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false, columnDefinition = "uuid")
    private UUID userId;

    @Column(name = "campaign_id")
    private Long campaignId;

    @Column(nullable = false, length = 32)
    private String type;

    @Column(length = 256)
    private String title;

    @Column(columnDefinition = "text")
    private String body;

    @Column(name = "image_url", length = 512)
    private String imageUrl;

    @Column(name = "model_id", length = 64)
    private String modelId;

    @Column(name = "prompt_hash", length = 64)
    private String promptHash;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private Status status;

    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    @PrePersist
    void onCreate() {
        OffsetDateTime now = OffsetDateTime.now();
        createdAt = now;
        if (status == null) status = Status.DRAFT;
    }
}
