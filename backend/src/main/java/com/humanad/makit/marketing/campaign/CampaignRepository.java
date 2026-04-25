package com.humanad.makit.marketing.campaign;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface CampaignRepository extends JpaRepository<Campaign, Long> {

    List<Campaign> findByUserIdOrderByCreatedAtDesc(UUID userId);

    List<Campaign> findByUserIdAndStatusOrderByCreatedAtDesc(UUID userId, Campaign.Status status);

    int countByUserIdAndStatus(UUID userId, Campaign.Status status);

    @Query("SELECT COUNT(c) FROM Campaign c WHERE c.userId = :userId AND c.status IN ('ACTIVE', 'PAUSED')")
    int countActiveCampaigns(@Param("userId") UUID userId);

    /**
     * Find campaign by id and userId (ownership verification).
     */
    Optional<Campaign> findByIdAndUserId(Long id, UUID userId);
}
