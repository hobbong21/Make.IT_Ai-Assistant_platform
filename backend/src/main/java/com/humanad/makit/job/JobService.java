package com.humanad.makit.job;

import com.humanad.makit.common.ResourceNotFoundException;
import com.humanad.makit.notification.NotificationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.Map;
import java.util.UUID;

@Slf4j
@Service
@Transactional
@RequiredArgsConstructor
public class JobService {

    private final JobExecutionRepository repo;
    private final NotificationService notificationService;

    public JobExecution create(UUID userId, String domain, String operation, Map<String, Object> input) {
        JobExecution j = new JobExecution();
        j.setUserId(userId);
        j.setDomain(domain);
        j.setOperation(operation);
        j.setStatus(JobStatus.PENDING);
        j.setInput(input == null ? Map.of() : input);
        return repo.save(j);
    }

    public void markRunning(UUID jobId) {
        repo.findById(jobId).ifPresent(j -> {
            j.setStatus(JobStatus.RUNNING);
            try {
                String serviceKey = j.getOperation().split("\\.")[0];
                String serviceName = mapServiceKeyToName(serviceKey);
                notificationService.create(
                    j.getUserId(),
                    "INFO",
                    "작업이 시작되었습니다",
                    serviceName,
                    null
                );
            } catch (Exception e) {
                log.warn("Failed to send job running notification for job {}: {}", jobId, e.getMessage());
            }
        });
    }

    public void markSuccess(UUID jobId, Map<String, Object> output) {
        repo.findById(jobId).ifPresent(j -> {
            j.setStatus(JobStatus.SUCCESS);
            j.setOutput(output);
            j.setCompletedAt(OffsetDateTime.now());
            try {
                String serviceKey = j.getOperation().split("\\.")[0];
                String serviceName = mapServiceKeyToName(serviceKey);
                notificationService.create(
                    j.getUserId(),
                    "SUCCESS",
                    "작업이 완료되었습니다",
                    serviceName,
                    null
                );
            } catch (Exception e) {
                log.warn("Failed to send job success notification for job {}: {}", jobId, e.getMessage());
            }
        });
    }

    public void markFailed(UUID jobId, String errorMessage) {
        repo.findById(jobId).ifPresent(j -> {
            j.setStatus(JobStatus.FAILED);
            j.setErrorMessage(errorMessage);
            j.setCompletedAt(OffsetDateTime.now());
            try {
                String serviceKey = j.getOperation().split("\\.")[0];
                String serviceName = mapServiceKeyToName(serviceKey);
                String errorPreview = errorMessage != null && errorMessage.length() > 100
                    ? errorMessage.substring(0, 100) + "..."
                    : errorMessage;
                notificationService.create(
                    j.getUserId(),
                    "ERROR",
                    "작업이 실패했습니다",
                    serviceName + " - " + (errorPreview != null ? errorPreview : "알 수 없는 오류"),
                    null
                );
            } catch (Exception e) {
                log.warn("Failed to send job failed notification for job {}: {}", jobId, e.getMessage());
            }
        });
    }

    @Transactional(readOnly = true)
    public JobStatusResponse get(UUID jobId, String domainHint) {
        JobExecution j = repo.findById(jobId).orElseThrow(() -> new ResourceNotFoundException("Job", jobId));
        if (domainHint != null && !j.getDomain().equalsIgnoreCase(domainHint)) {
            throw new ResourceNotFoundException("Job", jobId);
        }
        return new JobStatusResponse(
                j.getJobId(), j.getStatus(), j.getDomain(), j.getOperation(),
                j.getStartedAt(), j.getCompletedAt(), j.getOutput(), j.getErrorMessage()
        );
    }

    public JobAcceptedResponse toAccepted(JobExecution j) {
        return new JobAcceptedResponse(
                j.getJobId(),
                "/api/" + j.getDomain() + "/jobs/" + j.getJobId(),
                j.getStatus()
        );
    }

    /**
     * Map operation service key to Korean name for notifications.
     * Examples: "modelshot" -> "모델컷 생성", "feed" -> "인스타그램 피드 생성"
     */
    private String mapServiceKeyToName(String serviceKey) {
        return switch (serviceKey) {
            case "modelshot" -> "모델컷 생성";
            case "feed" -> "인스타그램 피드 생성";
            case "nlp-analyze" -> "자연어 분석";
            case "youtube-comments", "youtube-influence", "youtube-keyword-search" -> "유튜브 분석";
            case "remove-bg" -> "배경 제거";
            case "chatbot" -> "AI 챗봇";
            case "review-analysis" -> "리뷰 분석";
            case "url-analyze" -> "URL 분석";
            default -> "작업";
        };
    }
}
