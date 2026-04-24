package com.humanad.makit.job;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.OffsetDateTime;
import java.util.Map;
import java.util.UUID;

@Entity
@Table(name = "job_executions", indexes = {
        @Index(name = "idx_jobs_user_started", columnList = "user_id, started_at DESC"),
        @Index(name = "idx_jobs_domain_op", columnList = "domain, operation")
})
@Getter
@Setter
@NoArgsConstructor
public class JobExecution {

    @Id
    @Column(name = "job_id", columnDefinition = "uuid")
    private UUID jobId;

    @Column(name = "user_id", nullable = false, columnDefinition = "uuid")
    private UUID userId;

    @Column(nullable = false, length = 16)
    private String domain;

    @Column(nullable = false, length = 64)
    private String operation;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private JobStatus status;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(nullable = false, columnDefinition = "jsonb")
    private Map<String, Object> input;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    private Map<String, Object> output;

    @Column(name = "error_message", columnDefinition = "text")
    private String errorMessage;

    @Column(name = "started_at", nullable = false)
    private OffsetDateTime startedAt;

    @Column(name = "completed_at")
    private OffsetDateTime completedAt;

    @PrePersist
    void onCreate() {
        if (jobId == null) jobId = UUID.randomUUID();
        if (startedAt == null) startedAt = OffsetDateTime.now();
        if (status == null) status = JobStatus.PENDING;
    }
}
