package com.humanad.makit.job;

import java.time.OffsetDateTime;
import java.util.Map;
import java.util.UUID;

public record JobStatusResponse(
        UUID jobId,
        JobStatus status,
        String domain,
        String operation,
        OffsetDateTime startedAt,
        OffsetDateTime completedAt,
        Map<String, Object> result,
        String errorMessage
) {}
