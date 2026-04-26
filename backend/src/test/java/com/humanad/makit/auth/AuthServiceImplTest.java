package com.humanad.makit.auth;

import com.humanad.makit.auth.dto.*;
import com.humanad.makit.common.AuthenticationException;
import com.humanad.makit.common.ConflictException;
import com.humanad.makit.common.ResourceNotFoundException;
import com.humanad.makit.notification.NotificationService;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.SignatureAlgorithm;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("AuthServiceImpl 테스트")
class AuthServiceImplTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private PasswordEncoder encoder;

    @Mock
    private JwtTokenProvider tokenProvider;

    @Mock
    private RefreshTokenService refreshTokens;

    @Mock
    private NotificationService notificationService;

    @InjectMocks
    private AuthServiceImpl authService;

    private User testUser;
    private UUID testUserId;

    @BeforeEach
    void setUp() {
        testUserId = UUID.randomUUID();
        testUser = new User();
        testUser.setId(testUserId);
        testUser.setEmail("test@makit.local");
        testUser.setPasswordHash("encoded-password");
        testUser.setName("Test User");
        testUser.setRole(UserRole.ADMIN);
        testUser.setActive(true);
        testUser.setCompanyId(UUID.randomUUID());
    }

    // ============ Login Tests =============

    @Test
    @DisplayName("올바른 자격증명으로 로그인 성공")
    void login_withValidCredentials_returnsLoginResponse() {
        // given
        LoginRequest request = new LoginRequest("test@makit.local", "password123");
        when(userRepository.findByEmailIgnoreCase("test@makit.local"))
                .thenReturn(Optional.of(testUser));
        when(encoder.matches("password123", "encoded-password"))
                .thenReturn(true);
        when(tokenProvider.generateAccessToken(testUserId, testUser.getEmail(), testUser.getRole(), testUser.getCompanyId()))
                .thenReturn("access-token-value");
        when(tokenProvider.generateRefreshToken(testUserId))
                .thenReturn("refresh-token-value");
        when(tokenProvider.parse("refresh-token-value"))
                .thenReturn(createMockClaims("jti-123", testUserId.toString()));
        when(tokenProvider.accessTtlSeconds()).thenReturn(3600);
        when(tokenProvider.refreshTtlSeconds()).thenReturn(86400);

        // when
        LoginResponse result = authService.login(request);

        // then
        assertThat(result)
                .isNotNull()
                .extracting("accessToken", "refreshToken", "tokenType")
                .containsExactly("access-token-value", "refresh-token-value", "Bearer");
        assertThat(result.expiresIn()).isEqualTo(3600);
        verify(userRepository).findByEmailIgnoreCase("test@makit.local");
        verify(encoder).matches("password123", "encoded-password");
        verify(refreshTokens).storeRefresh("jti-123", testUserId, Duration.ofSeconds(86400));
    }

    @Test
    @DisplayName("존재하지 않는 사용자로 로그인 실패")
    void login_withNonexistentUser_throwsAuthenticationException() {
        // given
        LoginRequest request = new LoginRequest("unknown@makit.local", "password123");
        when(userRepository.findByEmailIgnoreCase("unknown@makit.local"))
                .thenReturn(Optional.empty());

        // when & then
        assertThatThrownBy(() -> authService.login(request))
                .isInstanceOf(AuthenticationException.class)
                .hasMessageContaining("Invalid credentials");
    }

    @Test
    @DisplayName("잘못된 비밀번호로 로그인 실패")
    void login_withWrongPassword_throwsAuthenticationException() {
        // given
        LoginRequest request = new LoginRequest("test@makit.local", "wrong-password");
        when(userRepository.findByEmailIgnoreCase("test@makit.local"))
                .thenReturn(Optional.of(testUser));
        when(encoder.matches("wrong-password", "encoded-password"))
                .thenReturn(false);

        // when & then
        assertThatThrownBy(() -> authService.login(request))
                .isInstanceOf(AuthenticationException.class)
                .hasMessageContaining("Invalid credentials");
    }

    @Test
    @DisplayName("비활성화된 사용자로 로그인 실패")
    void login_withDisabledAccount_throwsAuthenticationException() {
        // given
        testUser.setActive(false);
        LoginRequest request = new LoginRequest("test@makit.local", "password123");
        when(userRepository.findByEmailIgnoreCase("test@makit.local"))
                .thenReturn(Optional.of(testUser));
        when(encoder.matches("password123", "encoded-password"))
                .thenReturn(true);

        // when & then
        assertThatThrownBy(() -> authService.login(request))
                .isInstanceOf(AuthenticationException.class)
                .hasMessageContaining("Account is disabled");
    }

    // ============ Register Tests =============

    @Test
    @DisplayName("새로운 사용자 등록 성공")
    void register_withNewEmail_succeeds() {
        // given
        RegisterRequest request = new RegisterRequest(
                "newuser@makit.local",
                "NewPassword123!",
                "New User",
                testUser.getCompanyId(),
                null
        );
        when(userRepository.existsByEmailIgnoreCase("newuser@makit.local"))
                .thenReturn(false);
        when(encoder.encode("NewPassword123!"))
                .thenReturn("encoded-new-password");
        when(userRepository.save(any(User.class)))
                .thenAnswer(invocation -> {
                    User user = invocation.getArgument(0);
                    user.setId(UUID.randomUUID());
                    return user;
                });

        // when
        UserDto result = authService.register(request);

        // then
        assertThat(result)
                .isNotNull()
                .extracting("email", "name")
                .containsExactly("newuser@makit.local", "New User");
        verify(userRepository).existsByEmailIgnoreCase("newuser@makit.local");
        verify(encoder).encode("NewPassword123!");
        verify(userRepository).save(any(User.class));
    }

    @Test
    @DisplayName("이미 존재하는 이메일로 등록 실패")
    void register_withExistingEmail_throwsConflictException() {
        // given
        RegisterRequest request = new RegisterRequest(
                "test@makit.local",
                "password",
                "Duplicate User",
                testUser.getCompanyId(),
                null
        );
        when(userRepository.existsByEmailIgnoreCase("test@makit.local"))
                .thenReturn(true);

        // when & then
        assertThatThrownBy(() -> authService.register(request))
                .isInstanceOf(ConflictException.class)
                .hasMessageContaining("Email already registered");
    }

    @Test
    @DisplayName("기본 역할(VIEWER)로 등록 성공")
    void register_withNullRole_defaultsToViewer() {
        // given
        RegisterRequest request = new RegisterRequest(
                "newuser@makit.local",
                "password",
                "New User",
                testUser.getCompanyId(),
                null
        );
        when(userRepository.existsByEmailIgnoreCase("newuser@makit.local"))
                .thenReturn(false);
        when(encoder.encode("password"))
                .thenReturn("encoded-password");
        when(userRepository.save(any(User.class)))
                .thenAnswer(invocation -> {
                    User user = invocation.getArgument(0);
                    user.setId(UUID.randomUUID());
                    return user;
                });

        // when
        authService.register(request);

        // then
        verify(userRepository).save(argThat(user ->
                user.getRole() == UserRole.VIEWER
        ));
    }

    // ============ Me (Get Profile) Tests =============

    @Test
    @DisplayName("사용자 프로필 조회 성공")
    void me_withValidUserId_returnsUserDto() {
        // given
        when(userRepository.findById(testUserId))
                .thenReturn(Optional.of(testUser));

        // when
        UserDto result = authService.me(testUserId);

        // then
        assertThat(result)
                .isNotNull()
                .extracting("id", "email", "name", "role")
                .containsExactly(testUserId, "test@makit.local", "Test User", UserRole.ADMIN);
    }

    @Test
    @DisplayName("존재하지 않는 사용자 프로필 조회 실패")
    void me_withInvalidUserId_throwsResourceNotFoundException() {
        // given
        when(userRepository.findById(testUserId))
                .thenReturn(Optional.empty());

        // when & then
        assertThatThrownBy(() -> authService.me(testUserId))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    // ============ Refresh Token Tests =============

    @Test
    @DisplayName("유효한 리프레시 토큰으로 토큰 갱신 성공")
    void refresh_withValidRefreshToken_returnsNewTokens() {
        // given
        RefreshRequest request = new RefreshRequest("valid-refresh-token");
        Claims claims = createMockClaims("jti-456", testUserId.toString());

        when(tokenProvider.parse("valid-refresh-token"))
                .thenReturn(claims);
        when(refreshTokens.isRefreshValid("jti-456"))
                .thenReturn(true);
        when(userRepository.findById(testUserId))
                .thenReturn(Optional.of(testUser));
        when(tokenProvider.generateAccessToken(testUserId, testUser.getEmail(), testUser.getRole(), testUser.getCompanyId()))
                .thenReturn("new-access-token");
        when(tokenProvider.generateRefreshToken(testUserId))
                .thenReturn("new-refresh-token");
        when(tokenProvider.parse("new-refresh-token"))
                .thenReturn(createMockClaims("jti-789", testUserId.toString()));
        when(tokenProvider.accessTtlSeconds()).thenReturn(3600);
        when(tokenProvider.refreshTtlSeconds()).thenReturn(86400);

        // when
        LoginResponse result = authService.refresh(request);

        // then
        assertThat(result)
                .isNotNull()
                .extracting("accessToken")
                .isEqualTo("new-access-token");
        verify(refreshTokens).revokeRefresh("jti-456");
        verify(refreshTokens).storeRefresh("jti-789", testUserId, Duration.ofSeconds(86400));
    }

    @Test
    @DisplayName("유효하지 않은 리프레시 토큰으로 갱신 실패")
    void refresh_withInvalidToken_throwsAuthenticationException() {
        // given
        RefreshRequest request = new RefreshRequest("invalid-refresh-token");
        when(tokenProvider.parse("invalid-refresh-token"))
                .thenThrow(new io.jsonwebtoken.JwtException("Invalid token"));

        // when & then
        assertThatThrownBy(() -> authService.refresh(request))
                .isInstanceOf(AuthenticationException.class)
                .hasMessageContaining("Invalid refresh token");
    }

    @Test
    @DisplayName("리프레시 토큰이 아닌 액세스 토큰으로 갱신 실패")
    void refresh_withAccessToken_throwsAuthenticationException() {
        // given
        RefreshRequest request = new RefreshRequest("access-token-not-refresh");
        Claims claims = createMockClaims("jti-000", testUserId.toString());
        claims.put("type", "access");

        when(tokenProvider.parse("access-token-not-refresh"))
                .thenReturn(claims);

        // when & then
        assertThatThrownBy(() -> authService.refresh(request))
                .isInstanceOf(AuthenticationException.class)
                .hasMessageContaining("Not a refresh token");
    }

    @Test
    @DisplayName("폐기된 리프레시 토큰으로 갱신 실패")
    void refresh_withRevokedToken_throwsAuthenticationException() {
        // given
        RefreshRequest request = new RefreshRequest("revoked-refresh-token");
        Claims claims = createMockClaims("jti-revoked", testUserId.toString());

        when(tokenProvider.parse("revoked-refresh-token"))
                .thenReturn(claims);
        when(refreshTokens.isRefreshValid("jti-revoked"))
                .thenReturn(false);

        // when & then
        assertThatThrownBy(() -> authService.refresh(request))
                .isInstanceOf(AuthenticationException.class)
                .hasMessageContaining("Refresh token revoked");
    }

    // ============ Logout Tests =============

    @Test
    @DisplayName("로그아웃 성공")
    void logout_withValidToken_blacklistsAccessToken() {
        // given
        String accessJti = "jti-access-123";
        Duration remaining = Duration.ofMinutes(30);

        // when
        authService.logout(accessJti, remaining);

        // then
        verify(refreshTokens).blacklistAccess(accessJti, remaining);
    }

    @Test
    @DisplayName("로그아웃 시 null jti 무시")
    void logout_withNullJti_doesNothing() {
        // when
        authService.logout(null, Duration.ofMinutes(30));

        // then
        verify(refreshTokens, never()).blacklistAccess(anyString(), any());
    }

    // ============ Update Profile Tests =============

    @Test
    @DisplayName("사용자 프로필 업데이트 성공")
    void updateProfile_withValidRequest_updatesUser() {
        // given
        UpdateProfileRequest request = new UpdateProfileRequest("newemail@makit.local", "Updated Name");
        when(userRepository.findById(testUserId))
                .thenReturn(Optional.of(testUser));
        when(userRepository.existsByEmailIgnoreCase("newemail@makit.local"))
                .thenReturn(false);
        when(userRepository.save(any(User.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        // when
        UserDto result = authService.updateProfile(testUserId, request);

        // then
        assertThat(result)
                .isNotNull()
                .extracting("email", "name")
                .containsExactly("newemail@makit.local", "Updated Name");
    }

    @Test
    @DisplayName("같은 이메일로 업데이트 성공")
    void updateProfile_withSameEmail_succeeds() {
        // given
        UpdateProfileRequest request = new UpdateProfileRequest("test@makit.local", "Updated Name");
        when(userRepository.findById(testUserId))
                .thenReturn(Optional.of(testUser));
        when(userRepository.save(any(User.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        // when
        UserDto result = authService.updateProfile(testUserId, request);

        // then
        assertThat(result.email()).isEqualTo("test@makit.local");
        verify(userRepository).save(any());
    }

    @Test
    @DisplayName("이미 존재하는 이메일로 업데이트 실패")
    void updateProfile_withExistingEmail_throwsConflictException() {
        // given
        UpdateProfileRequest request = new UpdateProfileRequest("existing@makit.local", "Name");
        when(userRepository.findById(testUserId))
                .thenReturn(Optional.of(testUser));
        when(userRepository.existsByEmailIgnoreCase("existing@makit.local"))
                .thenReturn(true);

        // when & then
        assertThatThrownBy(() -> authService.updateProfile(testUserId, request))
                .isInstanceOf(ConflictException.class)
                .hasMessageContaining("Email already registered");
    }

    // ============ Change Password Tests =============

    @Test
    @DisplayName("비밀번호 변경 성공")
    void changePassword_withCorrectOldPassword_succeeds() {
        // given
        ChangePasswordRequest request = new ChangePasswordRequest("password123", "newpassword456");
        when(userRepository.findById(testUserId))
                .thenReturn(Optional.of(testUser));
        when(encoder.matches("password123", "encoded-password"))
                .thenReturn(true);
        when(encoder.encode("newpassword456"))
                .thenReturn("encoded-new-password");
        when(userRepository.save(any(User.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        // when
        authService.changePassword(testUserId, request);

        // then
        verify(userRepository).save(argThat(user ->
                user.getPasswordHash().equals("encoded-new-password")
        ));
        verify(notificationService).create(testUserId, "SUCCESS", "비밀번호 변경",
                "비밀번호가 변경되었습니다", null);
    }

    @Test
    @DisplayName("잘못된 기존 비밀번호로 변경 실패")
    void changePassword_withWrongOldPassword_throwsIllegalArgumentException() {
        // given
        ChangePasswordRequest request = new ChangePasswordRequest("wrong-password", "newpassword456");
        when(userRepository.findById(testUserId))
                .thenReturn(Optional.of(testUser));
        when(encoder.matches("wrong-password", "encoded-password"))
                .thenReturn(false);

        // when & then
        assertThatThrownBy(() -> authService.changePassword(testUserId, request))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("CURRENT_PASSWORD_MISMATCH");
    }

    @Test
    @DisplayName("비밀번호 변경 시 알림 전송 실패해도 계속 진행")
    void changePassword_notificationFailure_stillSucceeds() {
        // given
        ChangePasswordRequest request = new ChangePasswordRequest("password123", "newpassword456");
        when(userRepository.findById(testUserId))
                .thenReturn(Optional.of(testUser));
        when(encoder.matches("password123", "encoded-password"))
                .thenReturn(true);
        when(encoder.encode("newpassword456"))
                .thenReturn("encoded-new-password");
        when(userRepository.save(any(User.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));
        doThrow(new RuntimeException("Notification service down"))
                .when(notificationService).create(any(), any(), any(), any(), any());

        // when & then (should not throw)
        assertThatCode(() -> authService.changePassword(testUserId, request))
                .doesNotThrowAnyException();
        verify(userRepository).save(any());
    }

    // ============ Helper Methods =============

    private Claims createMockClaims(String jti, String subject) {
        return Jwts.parserBuilder()
                .build()
                .parseClaimsJws(Jwts.builder()
                        .setId(jti)
                        .setSubject(subject)
                        .claim("type", "refresh")
                        .signWith(SignatureAlgorithm.HS256, "test-secret-key")
                        .compact())
                .getBody();
    }
}
