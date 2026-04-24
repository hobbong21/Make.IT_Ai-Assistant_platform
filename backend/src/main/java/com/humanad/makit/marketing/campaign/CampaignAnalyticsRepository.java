package com.humanad.makit.marketing.campaign;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;

@Repository
public interface CampaignAnalyticsRepository extends JpaRepository<CampaignAnalytics, Long> {
    List<CampaignAnalytics> findByCampaignIdAndReportDateBetweenOrderByReportDateAsc(Long campaignId, LocalDate from, LocalDate to);
}
