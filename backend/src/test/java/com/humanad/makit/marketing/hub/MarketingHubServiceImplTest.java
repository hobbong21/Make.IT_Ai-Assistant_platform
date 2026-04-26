package com.humanad.makit.marketing.hub;

import com.humanad.makit.audit.AuditLogRepository;
import com.humanad.makit.marketing.campaign.Campaign;
import com.humanad.makit.marketing.campaign.CampaignRepository;
import com.humanad.makit.marketing.content.Content;
import com.humanad.makit.marketing.content.ContentRepository;
import com.humanad.makit.marketing.hub.dto.*;
import com.humanad.makit.notification.NotificationService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Pageable;
import org.springframework.security.access.AccessDeniedException;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.*;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("MarketingHubServiceImpl 테스트")
class MarketingHubServiceImplTest {

    @Mock
    private CampaignRepository campaignRepository;

    @Mock
    private ContentRepository contentRepository;

    @Mock
    private AuditLogRepository auditLogRepository;

    @Mock
    private NotificationService notificationService;

    @InjectMocks
    private MarketingHubServiceImpl marketingHubService;

    private UUID testUserId;
    private Campaign testCampaign;
    private Content testContent;

    @BeforeEach
    void setUp() {
        testUserId = UUID.randomUUID();

        testCampaign = new Campaign();
        testCampaign.setId(1L);
        testCampaign.setUserId(testUserId);
        testCampaign.setName("Test Campaign");
        testCampaign.setChannel(Campaign.Channel.INSTAGRAM);
        testCampaign.setStatus(Campaign.Status.DRAFT);
        testCampaign.setStartDate(OffsetDateTime.now());
        testCampaign.setEndDate(OffsetDateTime.now().plusDays(7));

        testContent = new Content();
        testContent.setId(1L);
        testContent.setUserId(testUserId);
        testContent.setTitle("Test Content");
        testContent.setType("TEXT");
        testContent.setStatus(Content.Status.DRAFT);
    }

    // ============ Hub Summary Tests =============

    @Test
    @DisplayName("마케팅 허브 요약 조회 성공")
    void getSummary_withValidUserId_returnsHubSummaryResponse() {
        // given
        when(campaignRepository.countActiveCampaigns(testUserId)).thenReturn(3);
        when(contentRepository.countByUserId(testUserId)).thenReturn(15);
        when(contentRepository.countPublishedSince(eq(testUserId), any(OffsetDateTime.class)))
                .thenReturn(2);

        // when
        HubSummaryResponse result = marketingHubService.getSummary(testUserId);

        // then
        assertThat(result)
                .isNotNull()
                .extracting("activeCampaigns", "totalContents", "publishedThisWeek")
                .containsExactly(3, 15, 2);
    }

    @Test
    @DisplayName("마케팅 허브 요약 조회 실패 시 기본값 반환")
    void getSummary_onException_returnsDefaultValues() {
        // given
        when(campaignRepository.countActiveCampaigns(testUserId))
                .thenThrow(new RuntimeException("Database error"));

        // when
        HubSummaryResponse result = marketingHubService.getSummary(testUserId);

        // then
        assertThat(result)
                .isNotNull()
                .extracting("activeCampaigns", "totalContents", "publishedThisWeek")
                .containsExactly(0, 0, 0);
    }

    // ============ Campaign List Tests =============

    @Test
    @DisplayName("모든 캠페인 조회 성공")
    void listCampaigns_withoutStatusFilter_returnsAllCampaigns() {
        // given
        List<Campaign> campaigns = List.of(testCampaign);
        when(campaignRepository.findByUserIdOrderByCreatedAtDesc(testUserId))
                .thenReturn(campaigns);

        // when
        List<CampaignDto> result = marketingHubService.listCampaigns(testUserId, null);

        // then
        assertThat(result)
                .isNotEmpty()
                .hasSize(1)
                .extracting("id", "name")
                .containsExactly(tuple(1L, "Test Campaign"));
    }

    @Test
    @DisplayName("상태별 캠페인 조회 성공")
    void listCampaigns_withStatusFilter_returnsCampaignsByStatus() {
        // given
        testCampaign.setStatus(Campaign.Status.ACTIVE);
        List<Campaign> campaigns = List.of(testCampaign);
        when(campaignRepository.findByUserIdAndStatusOrderByCreatedAtDesc(testUserId, Campaign.Status.ACTIVE))
                .thenReturn(campaigns);

        // when
        List<CampaignDto> result = marketingHubService.listCampaigns(testUserId, "ACTIVE");

        // then
        assertThat(result)
                .hasSize(1)
                .extracting("status")
                .containsExactly("ACTIVE");
    }

    @Test
    @DisplayName("캠페인 조회 실패 시 빈 리스트 반환")
    void listCampaigns_onException_returnsEmptyList() {
        // given
        when(campaignRepository.findByUserIdOrderByCreatedAtDesc(testUserId))
                .thenThrow(new RuntimeException("Database error"));

        // when
        List<CampaignDto> result = marketingHubService.listCampaigns(testUserId, null);

        // then
        assertThat(result).isEmpty();
    }

    // ============ Content Create Tests =============

    @Test
    @DisplayName("새로운 콘텐츠 생성 성공")
    void createContent_withValidRequest_createsContent() {
        // given
        ContentCreateRequest request = new ContentCreateRequest(
                "New Content",
                "TEXT",
                "http://example.com/image.jpg",
                "Content body",
                "nlp-analyze"
        );
        when(contentRepository.save(any(Content.class)))
                .thenAnswer(invocation -> {
                    Content content = invocation.getArgument(0);
                    content.setId(1L);
                    return content;
                });

        // when
        ContentDto result = marketingHubService.createContent(testUserId, request);

        // then
        assertThat(result)
                .isNotNull()
                .extracting("title", "type")
                .containsExactly("New Content", "TEXT");
        verify(contentRepository).save(any(Content.class));
        verify(notificationService).create(testUserId, "INFO", "새 콘텐츠 추가",
                argThat(msg -> msg.contains("New Content")), null);
    }

    @Test
    @DisplayName("콘텐츠 생성 시 알림 실패해도 계속 진행")
    void createContent_notificationFailure_stillSucceeds() {
        // given
        ContentCreateRequest request = new ContentCreateRequest("New Content", "TEXT", null, null, "nlp-analyze");
        when(contentRepository.save(any(Content.class)))
                .thenAnswer(invocation -> {
                    Content content = invocation.getArgument(0);
                    content.setId(1L);
                    return content;
                });
        doThrow(new RuntimeException("Notification service down"))
                .when(notificationService).create(any(), any(), any(), any(), any());

        // when & then
        assertThatCode(() -> marketingHubService.createContent(testUserId, request))
                .doesNotThrowAnyException();
    }

    // ============ Content Get Tests =============

    @Test
    @DisplayName("콘텐츠 조회 성공")
    void getContent_withValidId_returnsContent() {
        // given
        when(contentRepository.findByIdAndUserId(1L, testUserId))
                .thenReturn(Optional.of(testContent));

        // when
        ContentDto result = marketingHubService.getContent(testUserId, 1L);

        // then
        assertThat(result)
                .isNotNull()
                .extracting("id", "title")
                .containsExactly(1L, "Test Content");
    }

    @Test
    @DisplayName("다른 사용자의 콘텐츠 접근 실패")
    void getContent_withUnauthorizedUser_throwsAccessDeniedException() {
        // given
        when(contentRepository.findByIdAndUserId(1L, testUserId))
                .thenReturn(Optional.empty());

        // when & then
        assertThatThrownBy(() -> marketingHubService.getContent(testUserId, 1L))
                .isInstanceOf(AccessDeniedException.class);
    }

    // ============ Content Update Tests =============

    @Test
    @DisplayName("콘텐츠 업데이트 성공")
    void updateContent_withValidRequest_updatesContent() {
        // given
        ContentUpdateRequest request = new ContentUpdateRequest(
                "Updated Title",
                null,
                null,
                null,
                "nlp-analyze"
        );
        when(contentRepository.findByIdAndUserId(1L, testUserId))
                .thenReturn(Optional.of(testContent));
        when(contentRepository.save(any(Content.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        // when
        ContentDto result = marketingHubService.updateContent(testUserId, 1L, request);

        // then
        assertThat(result.title()).isEqualTo("Updated Title");
        verify(contentRepository).save(argThat(content ->
                content.getTitle().equals("Updated Title")
        ));
    }

    @Test
    @DisplayName("다른 사용자의 콘텐츠 업데이트 실패")
    void updateContent_withUnauthorizedUser_throwsAccessDeniedException() {
        // given
        ContentUpdateRequest request = new ContentUpdateRequest("Updated", null, null, null, "nlp-analyze");
        when(contentRepository.findByIdAndUserId(1L, testUserId))
                .thenReturn(Optional.empty());

        // when & then
        assertThatThrownBy(() -> marketingHubService.updateContent(testUserId, 1L, request))
                .isInstanceOf(AccessDeniedException.class);
    }

    // ============ Content Delete Tests =============

    @Test
    @DisplayName("콘텐츠 삭제 성공")
    void deleteContent_withValidId_deletesContent() {
        // given
        when(contentRepository.findByIdAndUserId(1L, testUserId))
                .thenReturn(Optional.of(testContent));

        // when
        marketingHubService.deleteContent(testUserId, 1L);

        // then
        verify(contentRepository).delete(testContent);
        verify(notificationService).create(testUserId, "WARN", "콘텐츠 삭제됨",
                argThat(msg -> msg.contains("Test Content")), null);
    }

    @Test
    @DisplayName("다른 사용자의 콘텐츠 삭제 실패")
    void deleteContent_withUnauthorizedUser_throwsAccessDeniedException() {
        // given
        when(contentRepository.findByIdAndUserId(1L, testUserId))
                .thenReturn(Optional.empty());

        // when & then
        assertThatThrownBy(() -> marketingHubService.deleteContent(testUserId, 1L))
                .isInstanceOf(AccessDeniedException.class);
    }

    // ============ Campaign Create Tests =============

    @Test
    @DisplayName("새로운 캠페인 생성 성공")
    void createCampaign_withValidRequest_createsCampaign() {
        // given
        CampaignCreateRequest request = new CampaignCreateRequest(
                "New Campaign",
                "Test description",
                "INSTAGRAM",
                OffsetDateTime.now(),
                OffsetDateTime.now().plusDays(7)
        );
        when(campaignRepository.save(any(Campaign.class)))
                .thenAnswer(invocation -> {
                    Campaign campaign = invocation.getArgument(0);
                    campaign.setId(1L);
                    return campaign;
                });

        // when
        CampaignDto result = marketingHubService.createCampaign(testUserId, request);

        // then
        assertThat(result)
                .isNotNull()
                .extracting("name", "channel")
                .containsExactly("New Campaign", "INSTAGRAM");
        verify(campaignRepository).save(any(Campaign.class));
        verify(notificationService).create(testUserId, "INFO", "캠페인이 생성되었습니다",
                argThat(msg -> msg.contains("New Campaign")), null);
    }

    // ============ Campaign Status Change Tests =============

    @Test
    @DisplayName("DRAFT에서 SCHEDULED로 상태 변경 성공")
    void changeCampaignStatus_draftToScheduled_succeeds() {
        // given
        testCampaign.setStatus(Campaign.Status.DRAFT);
        when(campaignRepository.findByIdAndUserId(1L, testUserId))
                .thenReturn(Optional.of(testCampaign));
        when(campaignRepository.save(any(Campaign.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        // when
        marketingHubService.changeCampaignStatus(testUserId, 1L, Campaign.Status.SCHEDULED);

        // then
        assertThat(testCampaign.getStatus()).isEqualTo(Campaign.Status.SCHEDULED);
        verify(campaignRepository).save(testCampaign);
    }

    @Test
    @DisplayName("COMPLETED에서 상태 변경 불가")
    void changeCampaignStatus_completedToOther_throwsIllegalStateException() {
        // given
        testCampaign.setStatus(Campaign.Status.COMPLETED);
        when(campaignRepository.findByIdAndUserId(1L, testUserId))
                .thenReturn(Optional.of(testCampaign));

        // when & then
        assertThatThrownBy(() ->
                marketingHubService.changeCampaignStatus(testUserId, 1L, Campaign.Status.ACTIVE))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("Cannot transition");
    }

    @Test
    @DisplayName("DRAFT에서 COMPLETED로 직접 변경 불가")
    void changeCampaignStatus_draftToCompleted_throwsIllegalStateException() {
        // given
        testCampaign.setStatus(Campaign.Status.DRAFT);
        when(campaignRepository.findByIdAndUserId(1L, testUserId))
                .thenReturn(Optional.of(testCampaign));

        // when & then
        assertThatThrownBy(() ->
                marketingHubService.changeCampaignStatus(testUserId, 1L, Campaign.Status.COMPLETED))
                .isInstanceOf(IllegalStateException.class);
    }

    // ============ Campaign Delete Tests =============

    @Test
    @DisplayName("캠페인 삭제 성공")
    void deleteCampaign_withValidId_deletesCampaign() {
        // given
        when(campaignRepository.findByIdAndUserId(1L, testUserId))
                .thenReturn(Optional.of(testCampaign));

        // when
        marketingHubService.deleteCampaign(testUserId, 1L);

        // then
        verify(campaignRepository).delete(testCampaign);
        verify(notificationService).create(testUserId, "WARN", "캠페인이 삭제되었습니다",
                argThat(msg -> msg.contains("Test Campaign")), null);
    }

    @Test
    @DisplayName("다른 사용자의 캠페인 삭제 실패")
    void deleteCampaign_withUnauthorizedUser_throwsAccessDeniedException() {
        // given
        when(campaignRepository.findByIdAndUserId(1L, testUserId))
                .thenReturn(Optional.empty());

        // when & then
        assertThatThrownBy(() -> marketingHubService.deleteCampaign(testUserId, 1L))
                .isInstanceOf(AccessDeniedException.class);
    }

    // ============ Helper Methods =============

    static class tuple {
        final Object[] values;

        tuple(Object... values) {
            this.values = values;
        }

        @Override
        public boolean equals(Object obj) {
            return Arrays.equals(values, (Object[]) obj);
        }

        @Override
        public int hashCode() {
            return Arrays.hashCode(values);
        }
    }
}
