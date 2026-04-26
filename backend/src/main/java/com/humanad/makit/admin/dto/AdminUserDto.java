package com.humanad.makit.admin.dto;

import java.time.OffsetDateTime;
import java.util.UUID;

public record AdminUserDto(
    UUID id,
    String email,
    String name,
    String role,
    OffsetDateTime createdAt,
    OffsetDateTime lastLoginAt,
    long requestCount
) {}
