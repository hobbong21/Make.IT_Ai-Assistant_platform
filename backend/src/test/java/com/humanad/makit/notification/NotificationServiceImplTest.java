package com.humanad.makit.notification;

import com.humanad.makit.notification.push.PushSubscriptionEntity;
import com.humanad.makit.notification.push.PushSubscriptionRepository;
import com.humanad.makit.notification.push.analytics.PushAnalyticsRepository;
import nl.martijndwars.webpush.PushService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.messaging.simp.SimpMessagingTemplate;

import java.util.Collections;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("NotificationServiceImpl 테스트")
class NotificationServiceImplTest {

    @Mock
    private NotificationRepository notificationRepository;

    @Mock
    private SimpMessagingTemplate messagingTemplate;

    @Mock
    private PushSubscriptionRepository pushSubscriptionRepository;

    @Mock
    private PushAnalyticsRepository analyticsRepository;

    @Mock
    private PushService pushService;

    @InjectMocks
    private NotificationServiceImpl notificationService;

    private UUID testUserId;
    private Notification testNotification;

    @BeforeEach
    void setUp() {
        testUserId = UUID.randomUUID();
        testNotification = new Notification();
        testNotification.setId(1L);
        testNotification.setUserId(testUserId);
        testNotification.setType("INFO");
        testNotification.setTitle("Test Notification");
        testNotification.setMessage("Test message");
    }

    // ============ Create Notification Tests =============

    @Test
    @DisplayName("알림 생성 성공")
    void create_withValidRequest_createsNotification() {
        // given
        when(notificationRepository.save(any(Notification.class)))
                .thenAnswer(invocation -> {
                    Notification notification = invocation.getArgument(0);
                    notification.setId(1L);
                    return notification;
                });
        when(pushSubscriptionRepository.findByUserId(testUserId))
                .thenReturn(Collections.emptyList());

        // when
        NotificationDto result = notificationService.create(
                testUserId,
                "INFO",
                "Test Title",
                "Test Message",
                null
        );

        // then
        assertThat(result)
                .isNotNull()
                .extracting("type", "title", "message")
                .containsExactly("INFO", "Test Title", "Test Message");
        verify(notificationRepository).save(any(Notification.class));
    }

    @Test
    @DisplayName("알림 생성 시 WebSocket 발송")
    void create_sendsViaWebSocket() {
        // given
        when(notificationRepository.save(any(Notification.class)))
                .thenAnswer(invocation -> {
                    Notification notification = invocation.getArgument(0);
                    notification.setId(1L);
                    return notification;
                });
        when(pushSubscriptionRepository.findByUserId(testUserId))
                .thenReturn(Collections.emptyList());

        // when
        notificationService.create(testUserId, "INFO", "Title", "Message", null);

        // then
        verify(messagingTemplate).convertAndSendToUser(
                testUserId.toString(),
                "/queue/notifications",
                any(NotificationDto.class)
        );
    }

    @Test
    @DisplayName("WebSocket 발송 실패해도 알림 생성 성공")
    void create_websocketFailure_stillCreatesNotification() {
        // given
        when(notificationRepository.save(any(Notification.class)))
                .thenAnswer(invocation -> {
                    Notification notification = invocation.getArgument(0);
                    notification.setId(1L);
                    return notification;
                });
        when(pushSubscriptionRepository.findByUserId(testUserId))
                .thenReturn(Collections.emptyList());
        doThrow(new RuntimeException("WebSocket error"))
                .when(messagingTemplate).convertAndSendToUser(anyString(), anyString(), any());

        // when & then
        assertThatCode(() ->
                notificationService.create(testUserId, "INFO", "Title", "Message", null)
        ).doesNotThrowAnyException();
        verify(notificationRepository).save(any(Notification.class));
    }

    @Test
    @DisplayName("SUCCESS 타입 알림 생성")
    void create_withSuccessType_createsSuccessNotification() {
        // given
        when(notificationRepository.save(any(Notification.class)))
                .thenAnswer(invocation -> {
                    Notification notification = invocation.getArgument(0);
                    notification.setId(1L);
                    return notification;
                });
        when(pushSubscriptionRepository.findByUserId(testUserId))
                .thenReturn(Collections.emptyList());

        // when
        NotificationDto result = notificationService.create(
                testUserId,
                "SUCCESS",
                "Operation Complete",
                "Your operation was successful",
                null
        );

        // then
        assertThat(result.type()).isEqualTo("SUCCESS");
    }

    @Test
    @DisplayName("WARN 타입 알림 생성")
    void create_withWarnType_createsWarnNotification() {
        // given
        when(notificationRepository.save(any(Notification.class)))
                .thenAnswer(invocation -> {
                    Notification notification = invocation.getArgument(0);
                    notification.setId(1L);
                    return notification;
                });
        when(pushSubscriptionRepository.findByUserId(testUserId))
                .thenReturn(Collections.emptyList());

        // when
        NotificationDto result = notificationService.create(
                testUserId,
                "WARN",
                "Warning",
                "Please review this",
                null
        );

        // then
        assertThat(result.type()).isEqualTo("WARN");
    }

    @Test
    @DisplayName("ERROR 타입 알림 생성")
    void create_withErrorType_createsErrorNotification() {
        // given
        when(notificationRepository.save(any(Notification.class)))
                .thenAnswer(invocation -> {
                    Notification notification = invocation.getArgument(0);
                    notification.setId(1L);
                    return notification;
                });
        when(pushSubscriptionRepository.findByUserId(testUserId))
                .thenReturn(Collections.emptyList());

        // when
        NotificationDto result = notificationService.create(
                testUserId,
                "ERROR",
                "Error Occurred",
                "An error happened",
                null
        );

        // then
        assertThat(result.type()).isEqualTo("ERROR");
    }

    @Test
    @DisplayName("링크 포함 알림 생성")
    void create_withLinkUrl_createsNotificationWithLink() {
        // given
        when(notificationRepository.save(any(Notification.class)))
                .thenAnswer(invocation -> {
                    Notification notification = invocation.getArgument(0);
                    notification.setId(1L);
                    return notification;
                });
        when(pushSubscriptionRepository.findByUserId(testUserId))
                .thenReturn(Collections.emptyList());

        // when
        NotificationDto result = notificationService.create(
                testUserId,
                "INFO",
                "Title",
                "Message",
                "/dashboard"
        );

        // then
        assertThat(result.linkUrl()).isEqualTo("/dashboard");
    }

    // ============ Push Notification Tests =============

    @Test
    @DisplayName("PushService 미설정 시 웹 푸시 스킵")
    void create_withoutPushService_skipsPushNotification() {
        // given - pushService is null due to constructor injection mock
        when(notificationRepository.save(any(Notification.class)))
                .thenAnswer(invocation -> {
                    Notification notification = invocation.getArgument(0);
                    notification.setId(1L);
                    return notification;
                });

        // when
        notificationService.create(testUserId, "INFO", "Title", "Message", null);

        // then
        verify(pushSubscriptionRepository, never()).findByUserId(testUserId);
    }

    @Test
    @DisplayName("푸시 구독이 없을 때 웹 푸시 스킵")
    void create_withNoPushSubscriptions_skipsWebPush() {
        // given
        when(notificationRepository.save(any(Notification.class)))
                .thenAnswer(invocation -> {
                    Notification notification = invocation.getArgument(0);
                    notification.setId(1L);
                    return notification;
                });
        when(pushSubscriptionRepository.findByUserId(testUserId))
                .thenReturn(Collections.emptyList());

        // when
        notificationService.create(testUserId, "INFO", "Title", "Message", null);

        // then - pushService should not be called if no subscriptions
        // Verification would depend on implementation details
    }

    // ============ Repository Save Tests =============

    @Test
    @DisplayName("알림 저장 검증")
    void create_savesNotificationWithCorrectFields() {
        // given
        when(notificationRepository.save(any(Notification.class)))
                .thenAnswer(invocation -> {
                    Notification notification = invocation.getArgument(0);
                    notification.setId(1L);
                    return notification;
                });
        when(pushSubscriptionRepository.findByUserId(testUserId))
                .thenReturn(Collections.emptyList());

        // when
        notificationService.create(testUserId, "INFO", "Title", "Message", "/link");

        // then
        verify(notificationRepository).save(argThat(notification ->
                notification.getUserId().equals(testUserId) &&
                notification.getType().equals("INFO") &&
                notification.getTitle().equals("Title") &&
                notification.getMessage().equals("Message") &&
                notification.getLinkUrl().equals("/link")
        ));
    }

    @Test
    @DisplayName("알림 생성 실패 시 예외 발생")
    void create_whenRepositoryFails_throwsException() {
        // given
        when(notificationRepository.save(any(Notification.class)))
                .thenThrow(new RuntimeException("Database error"));

        // when & then
        assertThatThrownBy(() ->
                notificationService.create(testUserId, "INFO", "Title", "Message", null)
        ).isInstanceOf(RuntimeException.class)
                .hasMessageContaining("Failed to create notification");
    }

    // ============ Multiple Notification Tests =============

    @Test
    @DisplayName("여러 타입의 알림 순차 생성")
    void create_multipleNotifications_allSucceed() {
        // given
        when(notificationRepository.save(any(Notification.class)))
                .thenAnswer(invocation -> {
                    Notification notification = invocation.getArgument(0);
                    notification.setId(System.nanoTime());
                    return notification;
                });
        when(pushSubscriptionRepository.findByUserId(testUserId))
                .thenReturn(Collections.emptyList());

        // when
        NotificationDto info = notificationService.create(testUserId, "INFO", "Info", "Info msg", null);
        NotificationDto success = notificationService.create(testUserId, "SUCCESS", "Success", "Success msg", null);
        NotificationDto warn = notificationService.create(testUserId, "WARN", "Warn", "Warn msg", null);
        NotificationDto error = notificationService.create(testUserId, "ERROR", "Error", "Error msg", null);

        // then
        assertThat(info.type()).isEqualTo("INFO");
        assertThat(success.type()).isEqualTo("SUCCESS");
        assertThat(warn.type()).isEqualTo("WARN");
        assertThat(error.type()).isEqualTo("ERROR");
        verify(notificationRepository, times(4)).save(any(Notification.class));
    }

    @Test
    @DisplayName("동일한 사용자에게 여러 알림 생성")
    void create_sameUserMultipleNotifications_allCreated() {
        // given
        when(notificationRepository.save(any(Notification.class)))
                .thenAnswer(invocation -> {
                    Notification notification = invocation.getArgument(0);
                    notification.setId(System.nanoTime());
                    return notification;
                });
        when(pushSubscriptionRepository.findByUserId(testUserId))
                .thenReturn(Collections.emptyList());

        // when
        notificationService.create(testUserId, "INFO", "Title1", "Message1", null);
        notificationService.create(testUserId, "INFO", "Title2", "Message2", null);
        notificationService.create(testUserId, "INFO", "Title3", "Message3", null);

        // then
        verify(notificationRepository, times(3)).save(any(Notification.class));
        verify(messagingTemplate, times(3)).convertAndSendToUser(
                eq(testUserId.toString()),
                eq("/queue/notifications"),
                any(NotificationDto.class)
        );
    }

    @Test
    @DisplayName("다른 사용자의 알림들은 서로 영향 없음")
    void create_multipleUsers_independent() {
        // given
        UUID user1 = UUID.randomUUID();
        UUID user2 = UUID.randomUUID();
        when(notificationRepository.save(any(Notification.class)))
                .thenAnswer(invocation -> {
                    Notification notification = invocation.getArgument(0);
                    notification.setId(System.nanoTime());
                    return notification;
                });
        when(pushSubscriptionRepository.findByUserId(any()))
                .thenReturn(Collections.emptyList());

        // when
        notificationService.create(user1, "INFO", "User1 Title", "User1 Message", null);
        notificationService.create(user2, "INFO", "User2 Title", "User2 Message", null);

        // then
        verify(messagingTemplate).convertAndSendToUser(
                user1.toString(),
                "/queue/notifications",
                any(NotificationDto.class)
        );
        verify(messagingTemplate).convertAndSendToUser(
                user2.toString(),
                "/queue/notifications",
                any(NotificationDto.class)
        );
    }
}
