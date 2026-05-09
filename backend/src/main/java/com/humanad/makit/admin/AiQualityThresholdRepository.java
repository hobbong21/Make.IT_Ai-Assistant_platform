package com.humanad.makit.admin;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface AiQualityThresholdRepository extends JpaRepository<AiQualityThreshold, Long> {

    /** Most-recent change = currently effective values. */
    Optional<AiQualityThreshold> findFirstByOrderByChangedAtDescIdDesc();

    /** Recent change history, newest first. */
    List<AiQualityThreshold> findAllByOrderByChangedAtDescIdDesc(Pageable pageable);
}
