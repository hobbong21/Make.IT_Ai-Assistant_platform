package com.humanad.makit.auth;

import com.humanad.makit.auth.dto.LoginRequest;
import com.humanad.makit.auth.dto.LoginResponse;
import com.humanad.makit.auth.dto.RegisterRequest;
import com.humanad.makit.common.AuthenticationException;
import com.humanad.makit.common.ConflictException;
import io.jsonwebtoken.Claims;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.time.Duration;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AuthServiceTest {

    @Mock UserRepository userRepository;
    @Mock PasswordEncoder encoder;
    @Mock JwtTokenProvider tokenProvider;
    @Mock RefreshTokenService refreshTokens;
    @Mock Claims claims;

    @InjectMocks AuthServiceImpl service;

    @Test
    void loginFailsOnMissingUser() {
        when(userRepository.findByEmailIgnoreCase("u@x.com")).thenReturn(Optional.empty());
        assertThatThrownBy(() -> service.login(new LoginRequest("u@x.com", "password1"))).isInstanceOf(AuthenticationException.class);
    }

    @Test
    void loginFailsOnBadPassword() {
        User u = new User();
        u.setEmail("u@x.com");
        u.setPasswordHash("hash");
        u.setActive(true);
        u.setRole(UserRole.VIEWER);
        when(userRepository.findByEmailIgnoreCase("u@x.com")).thenReturn(Optional.of(u));
        when(encoder.matches("password1", "hash")).thenReturn(false);
        assertThatThrownBy(() -> service.login(new LoginRequest("u@x.com", "password1"))).isInstanceOf(AuthenticationException.class);
    }

    @Test
    void loginSucceedsIssuesTokens() {
        User u = new User();
        u.setId(UUID.randomUUID());
        u.setEmail("u@x.com");
        u.setPasswordHash("hash");
        u.setActive(true);
        u.setRole(UserRole.MARKETING_MANAGER);
        when(userRepository.findByEmailIgnoreCase("u@x.com")).thenReturn(Optional.of(u));
        when(encoder.matches("password1", "hash")).thenReturn(true);
        when(tokenProvider.generateAccessToken(any(), anyString(), any(), any())).thenReturn("access.jwt");
        when(tokenProvider.generateRefreshToken(any())).thenReturn("refresh.jwt");
        when(tokenProvider.parse("refresh.jwt")).thenReturn(claims);
        when(claims.getId()).thenReturn("jti1");
        when(tokenProvider.refreshTtlSeconds()).thenReturn(Duration.ofDays(7).toSeconds());
        when(tokenProvider.accessTtlSeconds()).thenReturn(900L);

        LoginResponse res = service.login(new LoginRequest("u@x.com", "password1"));
        assertThat(res.token()).isEqualTo("access.jwt");
        assertThat(res.refreshToken()).isEqualTo("refresh.jwt");
        assertThat(res.tokenType()).isEqualTo("Bearer");
        assertThat(res.expiresInSec()).isEqualTo(900);
    }

    @Test
    void registerConflictOnExistingEmail() {
        when(userRepository.existsByEmailIgnoreCase("u@x.com")).thenReturn(true);
        assertThatThrownBy(() -> service.register(new RegisterRequest("u@x.com", "password1", "N", null, null)))
                .isInstanceOf(ConflictException.class);
    }
}
