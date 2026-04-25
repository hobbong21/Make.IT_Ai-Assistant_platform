package com.humanad.makit.auth;

import com.humanad.makit.auth.dto.*;

import java.util.UUID;

public interface AuthService {
    LoginResponse login(LoginRequest request);
    UserDto register(RegisterRequest request);
    UserDto me(UUID userId);
    LoginResponse refresh(RefreshRequest request);
    void logout(String accessJti, java.time.Duration remaining);
    UserDto updateProfile(UUID userId, UpdateProfileRequest request);
    void changePassword(UUID userId, ChangePasswordRequest request);
}
