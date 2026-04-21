package com.humanad.makit.ai.config;

import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.task.AsyncTaskExecutor;
import org.springframework.core.task.support.TaskExecutorAdapter;
import org.springframework.scheduling.annotation.EnableAsync;

import java.util.concurrent.Executors;

/**
 * Virtual-thread executor used by all CompletableFuture returning AI calls.
 *
 * Named bean: {@code aiExecutor}.
 *
 * Defensive: guarded with @ConditionalOnMissingBean in case backend-engineer
 * already defines a project-wide aiExecutor.
 */
@Configuration
@EnableAsync
public class AsyncConfig {

    @Bean(name = "aiExecutor")
    @ConditionalOnMissingBean(name = "aiExecutor")
    public AsyncTaskExecutor aiExecutor() {
        // Bedrock calls are blocking IO; virtual threads are ideal, no pool size to tune.
        return new TaskExecutorAdapter(Executors.newVirtualThreadPerTaskExecutor());
    }
}
