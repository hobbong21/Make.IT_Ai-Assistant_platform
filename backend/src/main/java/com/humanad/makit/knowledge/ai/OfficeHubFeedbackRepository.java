package com.humanad.makit.knowledge.ai;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.UUID;

@Repository
public interface OfficeHubFeedbackRepository extends JpaRepository<OfficeHubFeedback, UUID> {
    long countByActionAndHelpful(String action, boolean helpful);
}
