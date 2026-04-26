package com.humanad.makit.job;

import com.humanad.makit.common.ResourceNotFoundException;
import com.humanad.makit.notification.NotificationService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.OffsetDateTime;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("JobService 테스트")
class JobServiceTest {

    @Mock
    private JobExecutionRepository jobExecutionRepository;

    @Mock
    private NotificationService notificationService;

    @InjectMocks
    private JobService jobService;

    private UUID testUserId;
    private UUID testJobId;
    private JobExecution testJob;

    @BeforeEach
    void setUp() {
        testUserId = UUID.randomUUID();
        testJobId = UUID.randomUUID();

        testJob = new JobExecution();
        testJob.setJobId(testJobId);
        testJob.setUserId(testUserId);
        testJob.setDomain("commerce");
        testJob.setOperation("modelshot.execute");
        testJob.setStatus(JobStatus.PENDING);
        testJob.setInput(Map.of("type", "test"));
    }

    // ============ Create Job Tests =============

    @Test
    @DisplayName("새로운 작업 생성 성공")
    void create_withValidInput_createsJobExecution() {
        // given
        Map<String, Object> input = Map.of("param1", "value1", "param2", 123);
        when(jobExecutionRepository.save(any(JobExecution.class)))
                .thenAnswer(invocation -> {
                    JobExecution job = invocation.getArgument(0);
                    job.setJobId(UUID.randomUUID());
                    return job;
                });

        // when
        JobExecution result = jobService.create(testUserId, "commerce", "modelshot.execute", input);

        // then
        assertThat(result)
                .isNotNull()
                .extracting("userId", "domain", "operation", "status")
                .containsExactly(testUserId, "commerce", "modelshot.execute", JobStatus.PENDING);
        assertThat(result.getInput()).containsEntry("param1", "value1");
    }

    @Test
    @DisplayName("null input으로 작업 생성")
    void create_withNullInput_createsJobWithEmptyMap() {
        // given
        when(jobExecutionRepository.save(any(JobExecution.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        // when
        JobExecution result = jobService.create(testUserId, "data", "nlp-analyze.run", null);

        // then
        assertThat(result.getInput()).isEmpty();
    }

    @Test
    @DisplayName("작업 상태는 항상 PENDING으로 생성")
    void create_alwaysCreatesPendingStatus() {
        // given
        when(jobExecutionRepository.save(any(JobExecution.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        // when
        JobExecution result = jobService.create(testUserId, "domain", "operation", Map.of());

        // then
        assertThat(result.getStatus()).isEqualTo(JobStatus.PENDING);
    }

    // ============ Mark Running Tests =============

    @Test
    @DisplayName("작업을 RUNNING으로 표시")
    void markRunning_updatesStatusToRunning() {
        // given
        when(jobExecutionRepository.findById(testJobId))
                .thenReturn(Optional.of(testJob));

        // when
        jobService.markRunning(testJobId);

        // then
        assertThat(testJob.getStatus()).isEqualTo(JobStatus.RUNNING);
    }

    @Test
    @DisplayName("RUNNING 알림 전송")
    void markRunning_sendsNotification() {
        // given
        when(jobExecutionRepository.findById(testJobId))
                .thenReturn(Optional.of(testJob));

        // when
        jobService.markRunning(testJobId);

        // then
        verify(notificationService).create(
                eq(testUserId),
                eq("INFO"),
                argThat(title -> title.contains("시작") || title.contains("작업")),
                any(),
                any()
        );
    }

    @Test
    @DisplayName("존재하지 않는 작업 RUNNING 표시 무시")
    void markRunning_withNonexistentJob_doesNothing() {
        // given
        when(jobExecutionRepository.findById(testJobId))
                .thenReturn(Optional.empty());

        // when & then
        assertThatCode(() -> jobService.markRunning(testJobId))
                .doesNotThrowAnyException();
        verify(notificationService, never()).create(any(), any(), any(), any(), any());
    }

    @Test
    @DisplayName("RUNNING 알림 실패해도 상태 변경 진행")
    void markRunning_notificationFailure_stillUpdatesStatus() {
        // given
        when(jobExecutionRepository.findById(testJobId))
                .thenReturn(Optional.of(testJob));
        doThrow(new RuntimeException("Notification service down"))
                .when(notificationService).create(any(), any(), any(), any(), any());

        // when & then
        assertThatCode(() -> jobService.markRunning(testJobId))
                .doesNotThrowAnyException();
        assertThat(testJob.getStatus()).isEqualTo(JobStatus.RUNNING);
    }

    // ============ Mark Success Tests =============

    @Test
    @DisplayName("작업을 SUCCESS로 표시 및 출력 저장")
    void markSuccess_updatesStatusAndOutput() {
        // given
        testJob.setStatus(JobStatus.RUNNING);
        Map<String, Object> output = Map.of("result", "success", "data", "test-output");
        when(jobExecutionRepository.findById(testJobId))
                .thenReturn(Optional.of(testJob));

        // when
        jobService.markSuccess(testJobId, output);

        // then
        assertThat(testJob.getStatus()).isEqualTo(JobStatus.SUCCESS);
        assertThat(testJob.getOutput()).containsEntry("result", "success");
        assertThat(testJob.getCompletedAt()).isNotNull();
    }

    @Test
    @DisplayName("SUCCESS 알림 전송")
    void markSuccess_sendsSuccessNotification() {
        // given
        when(jobExecutionRepository.findById(testJobId))
                .thenReturn(Optional.of(testJob));

        // when
        jobService.markSuccess(testJobId, Map.of());

        // then
        verify(notificationService).create(
                eq(testUserId),
                eq("SUCCESS"),
                argThat(title -> title.contains("완료") || title.contains("작업")),
                any(),
                any()
        );
    }

    @Test
    @DisplayName("null output으로 성공 표시")
    void markSuccess_withNullOutput_succeeds() {
        // given
        when(jobExecutionRepository.findById(testJobId))
                .thenReturn(Optional.of(testJob));

        // when
        jobService.markSuccess(testJobId, null);

        // then
        assertThat(testJob.getStatus()).isEqualTo(JobStatus.SUCCESS);
    }

    // ============ Mark Failed Tests =============

    @Test
    @DisplayName("작업을 FAILED로 표시 및 에러 메시지 저장")
    void markFailed_updatesStatusAndError() {
        // given
        testJob.setStatus(JobStatus.RUNNING);
        String errorMsg = "Processing failed: invalid input";
        when(jobExecutionRepository.findById(testJobId))
                .thenReturn(Optional.of(testJob));

        // when
        jobService.markFailed(testJobId, errorMsg);

        // then
        assertThat(testJob.getStatus()).isEqualTo(JobStatus.FAILED);
        assertThat(testJob.getErrorMessage()).isEqualTo(errorMsg);
        assertThat(testJob.getCompletedAt()).isNotNull();
    }

    @Test
    @DisplayName("ERROR 알림 전송")
    void markFailed_sendsErrorNotification() {
        // given
        when(jobExecutionRepository.findById(testJobId))
                .thenReturn(Optional.of(testJob));

        // when
        jobService.markFailed(testJobId, "Something went wrong");

        // then
        verify(notificationService).create(
                eq(testUserId),
                eq("ERROR"),
                argThat(title -> title.contains("실패") || title.contains("작업")),
                argThat(msg -> msg.contains("Something went wrong") || msg.contains("알 수 없는")),
                any()
        );
    }

    @Test
    @DisplayName("긴 에러 메시지 자동 절단")
    void markFailed_truncatesLongErrorMessage() {
        // given
        String longError = "A".repeat(150);
        when(jobExecutionRepository.findById(testJobId))
                .thenReturn(Optional.of(testJob));

        // when
        jobService.markFailed(testJobId, longError);

        // then
        verify(notificationService).create(
                any(),
                any(),
                any(),
                argThat(msg -> msg.length() <= 105), // 100 char + " - " + "..."
                any()
        );
    }

    @Test
    @DisplayName("null 에러 메시지 처리")
    void markFailed_withNullError_succeeds() {
        // given
        when(jobExecutionRepository.findById(testJobId))
                .thenReturn(Optional.of(testJob));

        // when & then
        assertThatCode(() -> jobService.markFailed(testJobId, null))
                .doesNotThrowAnyException();
        assertThat(testJob.getStatus()).isEqualTo(JobStatus.FAILED);
    }

    // ============ Get Job Tests =============

    @Test
    @DisplayName("작업 상태 조회 성공")
    void get_withValidJobId_returnsJobStatus() {
        // given
        testJob.setStatus(JobStatus.SUCCESS);
        testJob.setOutput(Map.of("result", "done"));
        when(jobExecutionRepository.findById(testJobId))
                .thenReturn(Optional.of(testJob));

        // when
        JobStatusResponse result = jobService.get(testJobId, null);

        // then
        assertThat(result)
                .isNotNull()
                .extracting("jobId", "status", "domain", "operation")
                .containsExactly(testJobId, JobStatus.SUCCESS, "commerce", "modelshot.execute");
    }

    @Test
    @DisplayName("도메인 힌트로 검증")
    void get_withCorrectDomainHint_succeeds() {
        // given
        when(jobExecutionRepository.findById(testJobId))
                .thenReturn(Optional.of(testJob));

        // when
        JobStatusResponse result = jobService.get(testJobId, "commerce");

        // then
        assertThat(result).isNotNull();
    }

    @Test
    @DisplayName("잘못된 도메인 힌트로 조회 실패")
    void get_withWrongDomainHint_throwsResourceNotFoundException() {
        // given
        when(jobExecutionRepository.findById(testJobId))
                .thenReturn(Optional.of(testJob));

        // when & then
        assertThatThrownBy(() -> jobService.get(testJobId, "data"))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    @DisplayName("존재하지 않는 작업 조회 실패")
    void get_withNonexistentJobId_throwsResourceNotFoundException() {
        // given
        when(jobExecutionRepository.findById(testJobId))
                .thenReturn(Optional.empty());

        // when & then
        assertThatThrownBy(() -> jobService.get(testJobId, null))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    // ============ To Accepted Response Tests =============

    @Test
    @DisplayName("작업을 Accepted 응답으로 변환")
    void toAccepted_createsCorrectResponse() {
        // given
        testJob.setStatus(JobStatus.PENDING);

        // when
        JobAcceptedResponse result = jobService.toAccepted(testJob);

        // then
        assertThat(result)
                .isNotNull()
                .extracting("jobId", "status")
                .containsExactly(testJobId, JobStatus.PENDING);
        assertThat(result.statusUrl()).contains("/api/commerce/jobs/").contains(testJobId.toString());
    }

    // ============ Job Lifecycle Tests =============

    @Test
    @DisplayName("작업 생명주기: PENDING → RUNNING → SUCCESS")
    void jobLifecycle_pendingToRunningToSuccess() {
        // given
        when(jobExecutionRepository.save(any(JobExecution.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));
        when(jobExecutionRepository.findById(testJobId))
                .thenReturn(Optional.of(testJob));

        // when
        JobExecution created = jobService.create(testUserId, "domain", "operation", Map.of());
        created.setJobId(testJobId);

        jobService.markRunning(testJobId);
        jobService.markSuccess(testJobId, Map.of("output", "data"));

        // then
        assertThat(testJob.getStatus()).isEqualTo(JobStatus.SUCCESS);
        assertThat(testJob.getCompletedAt()).isNotNull();
    }

    @Test
    @DisplayName("작업 생명주기: PENDING → RUNNING → FAILED")
    void jobLifecycle_pendingToRunningToFailed() {
        // given
        when(jobExecutionRepository.findById(testJobId))
                .thenReturn(Optional.of(testJob));

        // when
        jobService.markRunning(testJobId);
        jobService.markFailed(testJobId, "Error occurred");

        // then
        assertThat(testJob.getStatus()).isEqualTo(JobStatus.FAILED);
        assertThat(testJob.getErrorMessage()).isEqualTo("Error occurred");
        assertThat(testJob.getCompletedAt()).isNotNull();
    }
}
