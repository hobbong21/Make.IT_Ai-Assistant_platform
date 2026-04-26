package com.humanad.makit.admin;

import com.humanad.makit.admin.dto.AdminOverviewDto;
import com.humanad.makit.admin.dto.AdminUserDto;
import com.humanad.makit.admin.dto.NotificationBreakdownDto;
import com.humanad.makit.admin.dto.UsageDto;
import com.humanad.makit.audit.AuditLogRepository;
import com.humanad.makit.auth.User;
import com.humanad.makit.auth.UserRepository;
import com.humanad.makit.auth.UserRole;
import com.humanad.makit.job.JobExecutionRepository;
import com.humanad.makit.notification.NotificationRepository;
import com.humanad.makit.observability.MetricsAspect;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;

import java.time.OffsetDateTime;
import java.util.*;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("AdminServiceImpl 테스트")
class AdminServiceImplTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private AuditLogRepository auditLogRepository;

    @Mock
    private NotificationRepository notificationRepository;

    @Mock
    private JobExecutionRepository jobExecutionRepository;

    @Mock
    private FeatureCatalogService featureCatalogService;

    @Mock
    private MetricsAspect metricsAspect;

    @InjectMocks
    private AdminServiceImpl adminService;

    private List<User> testUsers;

    @BeforeEach
    void setUp() {
        testUsers = new ArrayList<>();

        User user1 = new User();
        user1.setId(UUID.randomUUID());
        user1.setEmail("admin@makit.local");
        user1.setName("Admin User");
        user1.setRole(UserRole.ADMIN);
        user1.setActive(true);
        testUsers.add(user1);

        User user2 = new User();
        user2.setId(UUID.randomUUID());
        user2.setEmail("viewer@makit.local");
        user2.setName("Viewer User");
        user2.setRole(UserRole.VIEWER);
        user2.setActive(true);
        testUsers.add(user2);
    }

    // ============ Get Overview Tests =============

    @Test
    @DisplayName("관리자 대시보드 개요 조회 성공")
    void getOverview_returnsAdminOverviewDto() {
        // given
        when(userRepository.count()).thenReturn(150L);
        when(userRepository.countActiveUsersSince(any(OffsetDateTime.class)))
                .thenReturn(75L);
        when(auditLogRepository.countRequestsSince(any(OffsetDateTime.class)))
                .thenReturn(2500L);
        when(notificationRepository.countSince(any(OffsetDateTime.class)))
                .thenReturn(1200L);

        // when
        AdminOverviewDto result = adminService.getOverview();

        // then
        assertThat(result)
                .isNotNull()
                .extracting("totalUsers", "activeUsersLast7Days", "totalRequestsLast7Days")
                .containsExactly(150L, 75L, 2500L);
        assertThat(result.totalNotificationsLast7Days()).isEqualTo(1200L);
    }

    @Test
    @DisplayName("7일 기간이 올바르게 계산됨")
    void getOverview_usesCorrectedDateRange() {
        // given
        when(userRepository.count()).thenReturn(100L);
        when(userRepository.countActiveUsersSince(any(OffsetDateTime.class)))
                .thenReturn(50L);
        when(auditLogRepository.countRequestsSince(any(OffsetDateTime.class)))
                .thenReturn(1000L);
        when(notificationRepository.countSince(any(OffsetDateTime.class)))
                .thenReturn(500L);

        // when
        adminService.getOverview();

        // then
        verify(userRepository).countActiveUsersSince(argThat(dateTime ->
                dateTime.isBefore(OffsetDateTime.now())
        ));
    }

    // ============ Get Users Tests =============

    @Test
    @DisplayName("모든 사용자 목록 조회 성공")
    void getUsers_returnsPagedUserList() {
        // given
        when(userRepository.findAllForAdmin()).thenReturn(testUsers);
        when(auditLogRepository.countByUserId(any(UUID.class)))
                .thenReturn(100L);

        // when
        Page<AdminUserDto> result = adminService.getUsers(0, 10);

        // then
        assertThat(result)
                .isNotNull()
                .hasSize(2);
        assertThat(result.getContent())
                .extracting("email")
                .containsExactly("admin@makit.local", "viewer@makit.local");
    }

    @Test
    @DisplayName("사용자 페이지네이션 정확성")
    void getUsers_paginationWorks() {
        // given
        List<User> manyUsers = new ArrayList<>();
        for (int i = 0; i < 25; i++) {
            User u = new User();
            u.setId(UUID.randomUUID());
            u.setEmail("user" + i + "@makit.local");
            u.setName("User " + i);
            u.setRole(UserRole.VIEWER);
            manyUsers.add(u);
        }
        when(userRepository.findAllForAdmin()).thenReturn(manyUsers);
        when(auditLogRepository.countByUserId(any(UUID.class)))
                .thenReturn(50L);

        // when
        Page<AdminUserDto> page1 = adminService.getUsers(0, 10);
        Page<AdminUserDto> page2 = adminService.getUsers(1, 10);

        // then
        assertThat(page1).hasSize(10);
        assertThat(page2).hasSize(10);
        assertThat(page1.getTotalElements()).isEqualTo(25);
        assertThat(page2.getNumber()).isEqualTo(1);
    }

    @Test
    @DisplayName("사용자별 요청 수 계산")
    void getUsers_includesRequestCount() {
        // given
        when(userRepository.findAllForAdmin()).thenReturn(testUsers);
        when(auditLogRepository.countByUserId(testUsers.get(0).getId()))
                .thenReturn(150L);
        when(auditLogRepository.countByUserId(testUsers.get(1).getId()))
                .thenReturn(75L);

        // when
        Page<AdminUserDto> result = adminService.getUsers(0, 10);

        // then
        List<AdminUserDto> users = result.getContent();
        assertThat(users.get(0).requestCount()).isEqualTo(150L);
        assertThat(users.get(1).requestCount()).isEqualTo(75L);
    }

    // ============ Get Usage Tests =============

    @Test
    @DisplayName("사용량 통계 조회 성공")
    void getUsage_returnsUsageByDay() {
        // given
        List<Object[]> rawData = List.of(
                new Object[]{"2026-04-20", 500L, 10L, 50L},
                new Object[]{"2026-04-21", 600L, 5L, 60L},
                new Object[]{"2026-04-22", 700L, 15L, 70L}
        );
        when(auditLogRepository.findUsageByDay(7))
                .thenReturn(rawData);

        // when
        List<UsageDto> result = adminService.getUsage(7);

        // then
        assertThat(result)
                .hasSize(3)
                .extracting("requests", "errors")
                .containsExactly(
                        tuple(500L, 10L),
                        tuple(600L, 5L),
                        tuple(700L, 15L)
                );
    }

    @Test
    @DisplayName("에러 수 포함 사용량 통계")
    void getUsage_includesErrors() {
        // given
        List<Object[]> rawData = List.of(
                new Object[]{"2026-04-20", 100L, 5L}
        );
        when(auditLogRepository.findUsageByDay(1))
                .thenReturn(rawData);

        // when
        List<UsageDto> result = adminService.getUsage(1);

        // then
        assertThat(result.get(0))
                .extracting("errors")
                .isEqualTo(5L);
    }

    // ============ Get Notification Breakdown Tests =============

    @Test
    @DisplayName("알림 분류 통계 조회 성공")
    void getNotificationBreakdown_returnsTypeBreakdown() {
        // given
        List<Object[]> typeData = List.of(
                new Object[]{"INFO", 500L},
                new Object[]{"SUCCESS", 300L},
                new Object[]{"WARN", 150L},
                new Object[]{"ERROR", 50L}
        );
        when(notificationRepository.countByTypeLastDays(7))
                .thenReturn(typeData);
        when(notificationRepository.countSince(any(OffsetDateTime.class)))
                .thenReturn(1000L);
        when(notificationRepository.countUnreadSince(any(OffsetDateTime.class)))
                .thenReturn(250L);

        // when
        NotificationBreakdownDto result = adminService.getNotificationBreakdown(7);

        // then
        assertThat(result)
                .isNotNull();
        assertThat(result.byType())
                .hasSize(4)
                .containsEntry("INFO", 500L)
                .containsEntry("SUCCESS", 300L);
        assertThat(result.ctr()).isCloseTo(0.75, within(0.01));
    }

    @Test
    @DisplayName("클릭율(CTR) 계산 정확성")
    void getNotificationBreakdown_calculatesCtrCorrectly() {
        // given
        when(notificationRepository.countByTypeLastDays(30))
                .thenReturn(Collections.emptyList());
        when(notificationRepository.countSince(any(OffsetDateTime.class)))
                .thenReturn(1000L);
        when(notificationRepository.countUnreadSince(any(OffsetDateTime.class)))
                .thenReturn(200L);

        // when
        NotificationBreakdownDto result = adminService.getNotificationBreakdown(30);

        // then
        // clicked = 1000 - 200 = 800, ctr = 800/1000 = 0.8
        assertThat(result.ctr()).isCloseTo(0.8, within(0.01));
    }

    // ============ Feature Status Update Tests =============

    @Test
    @DisplayName("기능 상태 업데이트 성공")
    void updateFeatureStatus_succeeds() {
        // given
        Map<String, Object> detail = new HashMap<>();
        Map<String, Object> manifest = new HashMap<>();
        manifest.put("status", "beta");
        detail.put("manifest", manifest);

        when(featureCatalogService.getFeatureDetail("nlp-analyze"))
                .thenReturn(detail);

        // when
        adminService.updateFeatureStatus("nlp-analyze", "stable");

        // then
        verify(featureCatalogService).updateFeatureStatus("nlp-analyze", "stable");
    }

    @Test
    @DisplayName("기능 상태 업데이트 실패 시 예외 발생")
    void updateFeatureStatus_onFailure_throwsException() {
        // given
        when(featureCatalogService.getFeatureDetail("invalid-feature"))
                .thenThrow(new RuntimeException("Feature not found"));

        // when & then
        assertThatThrownBy(() ->
                adminService.updateFeatureStatus("invalid-feature", "stable")
        ).isInstanceOf(RuntimeException.class);
    }

    // ============ List Features Tests =============

    @Test
    @DisplayName("기능 목록 조회 성공")
    void listFeatures_returnsFeatureList() {
        // given
        List<Map<String, Object>> features = new ArrayList<>();
        when(featureCatalogService.listFeatures())
                .thenReturn(new ArrayList<>());

        // when
        adminService.listFeatures();

        // then
        verify(featureCatalogService).listFeatures();
    }

    // ============ Get Feature Detail Tests =============

    @Test
    @DisplayName("기능 상세 정보 조회 성공")
    void getFeatureDetail_returnsManifestand Details() {
        // given
        Map<String, Object> detail = new HashMap<>();
        detail.put("manifest", new HashMap<>());
        when(featureCatalogService.getFeatureDetail("chatbot"))
                .thenReturn(detail);

        // when
        Map<String, Object> result = adminService.getFeatureDetail("chatbot");

        // then
        assertThat(result).isNotNull();
        verify(featureCatalogService).getFeatureDetail("chatbot");
    }

    // ============ Helper Methods =============

    private static <T> T tuple(T... values) {
        return (T) values;
    }

    private static org.assertj.core.api.Offset<Double> within(double offset) {
        return org.assertj.core.api.Offset.offset(offset);
    }
}
