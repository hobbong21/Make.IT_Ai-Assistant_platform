package com.humanad.makit.common;

import java.time.OffsetDateTime;
import java.util.Map;

public record ApiErrorResponse(
        String errorCode,
        String message,
        String details,
        OffsetDateTime timestamp,
        String requestId,
        Map<String, Object> metadata
) {}
