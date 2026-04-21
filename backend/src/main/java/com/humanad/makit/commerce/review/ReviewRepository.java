package com.humanad.makit.commerce.review;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.OffsetDateTime;
import java.util.List;

@Repository
public interface ReviewRepository extends JpaRepository<Review, Long> {
    List<Review> findByProductIdOrderByCreatedAtDesc(String productId);
    List<Review> findByProductIdAndCreatedAtAfter(String productId, OffsetDateTime since);
}
