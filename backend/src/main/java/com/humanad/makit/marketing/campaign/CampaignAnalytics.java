package com.humanad.makit.marketing.campaign;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;

@Entity
@Table(name = "campaign_analytics", uniqueConstraints = {
        @UniqueConstraint(name = "uk_campaign_analytics_campaign_date", columnNames = {"campaign_id", "report_date"})
}, indexes = {
        @Index(name = "idx_campaign_analytics_report_date", columnList = "report_date DESC")
})
@Getter @Setter @NoArgsConstructor
public class CampaignAnalytics {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "campaign_id", nullable = false)
    private Long campaignId;

    @Column(name = "report_date", nullable = false)
    private LocalDate reportDate;

    @Column(nullable = false, precision = 14, scale = 2)
    private BigDecimal impressions = BigDecimal.ZERO;

    @Column(nullable = false, precision = 14, scale = 2)
    private BigDecimal clicks = BigDecimal.ZERO;

    @Column(nullable = false, precision = 14, scale = 2)
    private BigDecimal conversions = BigDecimal.ZERO;

    @Column(nullable = false, precision = 14, scale = 2)
    private BigDecimal cost = BigDecimal.ZERO;

    @Column(nullable = false, precision = 14, scale = 2)
    private BigDecimal revenue = BigDecimal.ZERO;

    @Column(precision = 8, scale = 4)
    private BigDecimal ctr;

    @Column(precision = 8, scale = 4)
    private BigDecimal cvr;

    @Column(precision = 10, scale = 4)
    private BigDecimal roas;

    @Column(name = "calculated_at", nullable = false)
    private OffsetDateTime calculatedAt;

    @PrePersist
    void onCreate() {
        if (calculatedAt == null) calculatedAt = OffsetDateTime.now();
    }
}
