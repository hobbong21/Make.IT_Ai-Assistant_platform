package com.humanad.makit.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.concurrent.Executor;
import java.util.concurrent.Executors;

/**
 * Project-wide async executors.
 *
 * NOTE: {@code aiExecutor} is intentionally NOT declared here.
 * The AI module owns it (see {@link com.humanad.makit.ai.config.AsyncConfig})
 * — declaring it here caused QA-002 (duplicate bean definition). This class keeps
 * only the non-AI executors used by backend domain services.
 */
@Configuration
public class AsyncConfig {

    @Bean("jobExecutor")
    public Executor jobExecutor() {
        return Executors.newThreadPerTaskExecutor(Thread.ofVirtual().name("job-vt-", 0).factory());
    }
}
