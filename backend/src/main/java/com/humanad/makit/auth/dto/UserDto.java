package com.humanad.makit.auth.dto;

import com.humanad.makit.auth.UserRole;

import java.time.OffsetDateTime;
import java.util.UUID;

public record UserDto(
        UUID id,
        String email,
        String name,
        UserRole role,
        String companyId,
        boolean isActive,
        OffsetDateTime lastLoginAt,
        OffsetDateTime createdAt
) {}
