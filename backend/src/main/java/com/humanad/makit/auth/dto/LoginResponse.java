package com.humanad.makit.auth.dto;

public record LoginResponse(
        String token,
        String refreshToken,
        String tokenType,
        long expiresInSec,
        UserDto user
) {}
