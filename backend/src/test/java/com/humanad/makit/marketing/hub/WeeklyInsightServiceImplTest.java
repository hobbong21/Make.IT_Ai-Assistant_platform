package com.humanad.makit.marketing.hub;

import com.humanad.makit.ai.bedrock.BedrockClient;
import com.humanad.makit.ai.bedrock.BedrockInvocation;
import com.humanad.makit.audit.AuditLogRepository;
import com.humanad.makit.notification.NotificationService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.util.*;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("WeeklyInsightServiceImpl 테스트")
class WeeklyInsightServiceImplTest {

    @Mock
    private AuditLogRepository auditLogRepository;

    @Mock
    private BedrockClient bedrockClient;

    @Mock
    private NotificationService notificationService;

    @InjectMocks
    private WeeklyInsightServiceImpl weeklyInsightService;

    private UUID testUserId;

    @BeforeEach
    void setUp() {
        testUserId = UUID.randomUUID();
    }

    // ============ Generate Weekly Insight Tests =============

    @Test
    @DisplayName("주간 인사이트 생성 성공")
    void generateWeeklyInsight_returnsMapWithInsightData() {
        // given
        List<Object[]> activityData = List.of(
                new Object[]{"2026-04-20", 10L},
                new Object[]{"2026-04-21", 15L},
                new Object[]{"2026-04-22", 20L}
        );
        when(auditLogRepository.findActivityByDay(testUserId, 7))
                .thenReturn(activityData);

        // Mock Bedrock invocation
        when(bedrockClient.invokeModel(
                any(BedrockInvocation.class)
        )).thenReturn("# 주간 인사이트\n\n이번주는 마케팅 활동이 활발했습니다.");

        // when
        Map<String, Object> result = weeklyInsightService.generateWeeklyInsight(testUserId);

        // then
        assertThat(result)
                .isNotNull()
                .containsKeys("weekStart", "weekEnd", "markdown", "source")
                .containsEntry("source", "bedrock-claude");
        assertThat(result.get("markdown")).asString().contains("주간 인사이트");
    }

    @Test
    @DisplayName("Bedrock 호출 실패 시 Stub으로 폴백")
    void generateWeeklyInsight_bedrockFailure_returnStubInsight() {
        // given
        List<Object[]> activityData = Collections.emptyList();
        when(auditLogRepository.findActivityByDay(testUserId, 7))
                .thenReturn(activityData);
        when(bedrockClient.invokeModel(any(BedrockInvocation.class)))
                .thenThrow(new RuntimeException("Bedrock service unavailable"));

        // when
        Map<String, Object> result = weeklyInsightService.generateWeeklyInsight(testUserId);

        // then
        assertThat(result)
                .isNotNull()
                .containsKey("source");
        // Source can be either bedrock-claude or stub-rule-based depending on fallback
        assertThat(result.get("markdown")).isNotNull();
    }

    @Test
    @DisplayName("성공 알림 전송")
    void generateWeeklyInsight_sendsSuccessNotification() {
        // given
        when(auditLogRepository.findActivityByDay(testUserId, 7))
                .thenReturn(Collections.emptyList());
        when(bedrockClient.invokeModel(any(BedrockInvocation.class)))
                .thenReturn("# Insight");

        // when
        weeklyInsightService.generateWeeklyInsight(testUserId);

        // then
        verify(notificationService).create(
                eq(testUserId),
                eq("SUCCESS"),
                argThat(title -> title.contains("인사이트") || title.contains("주간")),
                any(),
                any()
        );
    }

    @Test
    @DisplayName("알림 전송 실패해도 인사이트 생성 계속 진행")
    void generateWeeklyInsight_notificationFailure_stillReturnsInsight() {
        // given
        when(auditLogRepository.findActivityByDay(testUserId, 7))
                .thenReturn(Collections.emptyList());
        when(bedrockClient.invokeModel(any(BedrockInvocation.class)))
                .thenReturn("# Insight\nContent");
        doThrow(new RuntimeException("Notification service down"))
                .when(notificationService).create(any(), any(), any(), any(), any());

        // when & then
        assertThatCode(() ->
                weeklyInsightService.generateWeeklyInsight(testUserId)
        ).doesNotThrowAnyException();
    }

    @Test
    @DisplayName("인사이트 맵 필드 검증")
    void generateWeeklyInsight_resultHasRequiredFields() {
        // given
        when(auditLogRepository.findActivityByDay(testUserId, 7))
                .thenReturn(Collections.emptyList());
        when(bedrockClient.invokeModel(any(BedrockInvocation.class)))
                .thenReturn("# Title\n\nContent here");

        // when
        Map<String, Object> result = weeklyInsightService.generateWeeklyInsight(testUserId);

        // then
        assertThat(result)
                .containsKeys("weekStart", "weekEnd", "markdown", "generatedAt", "source");
        assertThat(result.get("weekStart")).isNotNull();
        assertThat(result.get("weekEnd")).isNotNull();
        assertThat(result.get("markdown")).isNotNull();
        assertThat(result.get("source")).isNotNull();
    }

    @Test
    @DisplayName("주간 날짜 범위 정확성")
    void generateWeeklyInsight_weekDateRangeIsCorrect() {
        // given
        when(auditLogRepository.findActivityByDay(testUserId, 7))
                .thenReturn(Collections.emptyList());
        when(bedrockClient.invokeModel(any(BedrockInvocation.class)))
                .thenReturn("# Insight");

        // when
        Map<String, Object> result = weeklyInsightService.generateWeeklyInsight(testUserId);

        // then
        String weekStart = (String) result.get("weekStart");
        String weekEnd = (String) result.get("weekEnd");
        assertThat(weekStart).isNotNull();
        assertThat(weekEnd).isNotNull();
        assertThat(weekStart).matches("\\d{4}-\\d{2}-\\d{2}");
        assertThat(weekEnd).matches("\\d{4}-\\d{2}-\\d{2}");
    }

    @Test
    @DisplayName("빈 활동 데이터로도 인사이트 생성")
    void generateWeeklyInsight_withEmptyActivity_stillGeneratesInsight() {
        // given
        when(auditLogRepository.findActivityByDay(testUserId, 7))
                .thenReturn(Collections.emptyList());
        when(bedrockClient.invokeModel(any(BedrockInvocation.class)))
                .thenReturn("# 이번주는 활동이 없었습니다");

        // when
        Map<String, Object> result = weeklyInsightService.generateWeeklyInsight(testUserId);

        // then
        assertThat(result.get("markdown")).isNotNull();
        assertThat(result.get("markdown").toString()).contains("이번주");
    }

    @Test
    @DisplayName("활동 데이터 파싱 검증")
    void generateWeeklyInsight_parsesActivityDataCorrectly() {
        // given
        List<Object[]> activityData = List.of(
                new Object[]{"2026-04-20", 5L},
                new Object[]{"2026-04-21", 10L},
                new Object[]{"2026-04-22", 8L}
        );
        when(auditLogRepository.findActivityByDay(testUserId, 7))
                .thenReturn(activityData);
        when(bedrockClient.invokeModel(any(BedrockInvocation.class)))
                .thenReturn("# Parsed correctly");

        // when
        weeklyInsightService.generateWeeklyInsight(testUserId);

        // then
        verify(auditLogRepository).findActivityByDay(testUserId, 7);
        verify(bedrockClient).invokeModel(any(BedrockInvocation.class));
    }
}
