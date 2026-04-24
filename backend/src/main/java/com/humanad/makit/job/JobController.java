package com.humanad.makit.job;

import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
@RequiredArgsConstructor
@Tag(name = "jobs")
@RequestMapping("/api")
public class JobController {

    private final JobService jobService;

    @GetMapping("/data/jobs/{jobId}")
    public JobStatusResponse dataJob(@PathVariable UUID jobId) {
        return jobService.get(jobId, "data");
    }

    @GetMapping("/marketing/jobs/{jobId}")
    public JobStatusResponse marketingJob(@PathVariable UUID jobId) {
        return jobService.get(jobId, "marketing");
    }

    @GetMapping("/commerce/jobs/{jobId}")
    public JobStatusResponse commerceJob(@PathVariable UUID jobId) {
        return jobService.get(jobId, "commerce");
    }
}
