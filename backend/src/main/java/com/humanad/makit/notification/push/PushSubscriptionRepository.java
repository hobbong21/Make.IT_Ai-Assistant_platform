package com.humanad.makit.notification.push;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface PushSubscriptionRepository extends JpaRepository<PushSubscriptionEntity, Long> {
    List<PushSubscriptionEntity> findByUserId(UUID userId);
    Optional<PushSubscriptionEntity> findByEndpoint(String endpoint);
    void deleteByEndpoint(String endpoint);
}
