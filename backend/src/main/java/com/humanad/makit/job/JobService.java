package com.humanad.makit.job;

import com.humanad.makit.common.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.Map;
import java.util.UUID;

@Service
@Transactional
@RequiredArgsConstructor
public class JobService {

    private final JobExecutionRepository repo;

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
        repo.findById(jobId).ifPresent(j -> j.setStatus(JobStatus.RUNNING));
    }

    public void markSuccess(UUID jobId, Map<String, Object> output) {
        repo.findById(jobId).ifPresent(j -> {
            j.setStatus(JobStatus.SUCCESS);
            j.setOutput(output);
            j.setCompletedAt(OffsetDateTime.now());
        });
    }

    public void markFailed(UUID jobId, String errorMessage) {
        repo.findById(jobId).ifPresent(j -> {
            j.setStatus(JobStatus.FAILED);
            j.setErrorMessage(errorMessage);
            j.setCompletedAt(OffsetDateTime.now());
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
}
