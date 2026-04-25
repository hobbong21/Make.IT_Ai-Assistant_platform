package com.humanad.makit.job;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.UUID;

@Repository
public interface JobExecutionRepository extends JpaRepository<JobExecution, UUID> {

    /**
     * Count jobs in PENDING or RUNNING status for a user.
     */
    int countByUserIdAndStatusIn(UUID userId, Collection<String> statuses);
}
