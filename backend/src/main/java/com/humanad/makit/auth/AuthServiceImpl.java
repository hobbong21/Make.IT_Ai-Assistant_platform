package com.humanad.makit.auth;

import com.humanad.makit.auth.dto.*;
import com.humanad.makit.common.AuthenticationException;
import com.humanad.makit.common.ConflictException;
import com.humanad.makit.common.ResourceNotFoundException;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.UUID;

@Slf4j
@Service
@Transactional
@RequiredArgsConstructor
public class AuthServiceImpl implements AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder encoder;
    private final JwtTokenProvider tokenProvider;
    private final RefreshTokenService refreshTokens;

    @Override
    public LoginResponse login(LoginRequest request) {
        User user = userRepository.findByEmailIgnoreCase(request.email())
                .orElseThrow(() -> new AuthenticationException("Invalid credentials"));
        if (!user.isActive()) {
            throw new AuthenticationException("AUTH_ACCOUNT_DISABLED", "Account is disabled");
        }
        if (!encoder.matches(request.password(), user.getPasswordHash())) {
            throw new AuthenticationException("Invalid credentials");
        }
        user.setLastLoginAt(OffsetDateTime.now());
        return issueTokens(user);
    }

    @Override
    public UserDto register(RegisterRequest request) {
        if (userRepository.existsByEmailIgnoreCase(request.email())) {
            throw new ConflictException("AUTH_EMAIL_EXISTS", "Email already registered");
        }
        User u = new User();
        u.setEmail(request.email());
        u.setPasswordHash(encoder.encode(request.password()));
        u.setName(request.name());
        u.setCompanyId(request.companyId());
        u.setRole(request.role() == null ? UserRole.VIEWER : request.role());
        u.setActive(true);
        userRepository.save(u);
        return toDto(u);
    }

    @Override
    @Transactional(readOnly = true)
    public UserDto me(UUID userId) {
        User u = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User", userId));
        return toDto(u);
    }

    @Override
    public LoginResponse refresh(RefreshRequest request) {
        Claims claims;
        try {
            claims = tokenProvider.parse(request.refreshToken());
        } catch (JwtException | IllegalArgumentException ex) {
            throw new AuthenticationException("AUTH_INVALID_REFRESH", "Invalid refresh token");
        }
        if (!"refresh".equals(claims.get("type", String.class))) {
            throw new AuthenticationException("AUTH_INVALID_REFRESH", "Not a refresh token");
        }
        String jti = claims.getId();
        if (!refreshTokens.isRefreshValid(jti)) {
            throw new AuthenticationException("AUTH_REFRESH_REVOKED", "Refresh token revoked");
        }
        refreshTokens.revokeRefresh(jti); // rotate
        UUID userId = UUID.fromString(claims.getSubject());
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new AuthenticationException("AUTH_USER_NOT_FOUND", "User no longer exists"));
        return issueTokens(user);
    }

    @Override
    public void logout(String accessJti, Duration remaining) {
        if (accessJti != null && remaining != null && !remaining.isNegative()) {
            refreshTokens.blacklistAccess(accessJti, remaining);
        }
    }

    @Override
    public UserDto updateProfile(UUID userId, UpdateProfileRequest request) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User", userId));

        // Check if email is being changed and already exists
        if (!user.getEmail().equalsIgnoreCase(request.email()) &&
                userRepository.existsByEmailIgnoreCase(request.email())) {
            throw new ConflictException("AUTH_EMAIL_EXISTS", "Email already registered");
        }

        user.setName(request.name());
        user.setEmail(request.email().toLowerCase());
        userRepository.save(user);
        return toDto(user);
    }

    @Override
    public void changePassword(UUID userId, ChangePasswordRequest request) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User", userId));

        if (!encoder.matches(request.oldPassword(), user.getPasswordHash())) {
            throw new IllegalArgumentException("CURRENT_PASSWORD_MISMATCH");
        }

        user.setPasswordHash(encoder.encode(request.newPassword()));
        userRepository.save(user);
        log.info("Password changed for user: {}", userId);
    }

    private LoginResponse issueTokens(User user) {
        String access = tokenProvider.generateAccessToken(user.getId(), user.getEmail(), user.getRole(), user.getCompanyId());
        String refresh = tokenProvider.generateRefreshToken(user.getId());
        Claims refreshClaims = tokenProvider.parse(refresh);
        refreshTokens.storeRefresh(refreshClaims.getId(), user.getId(), Duration.ofSeconds(tokenProvider.refreshTtlSeconds()));
        return new LoginResponse(access, refresh, "Bearer", tokenProvider.accessTtlSeconds(), toDto(user));
    }

    private UserDto toDto(User u) {
        return new UserDto(u.getId(), u.getEmail(), u.getName(), u.getRole(), u.getCompanyId(),
                u.isActive(), u.getLastLoginAt(), u.getCreatedAt());
    }
}
