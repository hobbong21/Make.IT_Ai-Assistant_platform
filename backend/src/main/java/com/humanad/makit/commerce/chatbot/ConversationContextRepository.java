package com.humanad.makit.commerce.chatbot;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface ConversationContextRepository extends JpaRepository<ConversationContext, String> {
}
