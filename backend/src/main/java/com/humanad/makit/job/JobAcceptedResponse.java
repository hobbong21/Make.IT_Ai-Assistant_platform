package com.humanad.makit.job;

import java.util.UUID;

public record JobAcceptedResponse(
        UUID jobId,
        String statusUrl,
        JobStatus status
) {}
