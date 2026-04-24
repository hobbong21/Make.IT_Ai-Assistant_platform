package com.humanad.makit.commerce.review;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "reviews", indexes = {
        @Index(name = "idx_reviews_product_created", columnList = "product_id, created_at DESC"),
        @Index(name = "idx_reviews_sentiment", columnList = "sentiment")
})
@Getter @Setter @NoArgsConstructor
public class Review {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "product_id", nullable = false, length = 64)
    private String productId;

    @Column(name = "user_id", columnDefinition = "uuid")
    private UUID userId;

    @Column(nullable = false)
    private Short rating;

    @Column(nullable = false, columnDefinition = "text")
    private String body;

    @Column(length = 16)
    private String sentiment;

    @Column(name = "sentiment_score", precision = 6, scale = 4)
    private BigDecimal sentimentScore;

    @Column(columnDefinition = "text[]")
    private String[] keywords;

    @Column(name = "improvement_points", columnDefinition = "text[]")
    private String[] improvementPoints;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt;

    @PrePersist
    void onCreate() {
        if (createdAt == null) createdAt = OffsetDateTime.now();
    }
}
