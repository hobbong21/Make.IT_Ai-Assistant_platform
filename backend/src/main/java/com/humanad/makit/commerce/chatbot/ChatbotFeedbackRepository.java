package com.humanad.makit.commerce.chatbot;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.UUID;

/**
 * Repository for chatbot feedback persistence and retrieval.
 */
@Repository
public interface ChatbotFeedbackRepository extends JpaRepository<ChatbotFeedback, Long> {

    /**
     * Count helpful/unhelpful feedback for a user.
     *
     * @param userId    the user ID
     * @param helpful   true for helpful feedback, false for unhelpful
     * @return count of matching feedback records
     */
    long countByUserIdAndHelpful(UUID userId, boolean helpful);
}
