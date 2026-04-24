package com.humanad.makit.ai.bedrock;

import com.humanad.makit.ai.prompt.PromptVariantProperties;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import software.amazon.awssdk.auth.credentials.DefaultCredentialsProvider;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.bedrockruntime.BedrockRuntimeAsyncClient;
import software.amazon.awssdk.services.bedrockruntime.BedrockRuntimeClient;

import java.time.Duration;

/**
 * Wires the Bedrock runtime clients (sync + async) only when aws.bedrock.enabled=true.
 * Credentials come from DefaultCredentialsProvider (IAM role -> env -> ~/.aws).
 */
@Configuration
@EnableConfigurationProperties({BedrockProperties.class, BedrockFallbackProperties.class, PromptVariantProperties.class})
@ConditionalOnProperty(name = "aws.bedrock.enabled", havingValue = "true", matchIfMissing = true)
public class BedrockConfig {

    @Bean
    public BedrockRuntimeClient bedrockRuntimeClient(BedrockProperties props) {
        return BedrockRuntimeClient.builder()
                .region(Region.of(props.region()))
                .credentialsProvider(DefaultCredentialsProvider.create())
                .overrideConfiguration(cfg -> cfg
                        .apiCallTimeout(Duration.ofSeconds(90))
                        .apiCallAttemptTimeout(Duration.ofSeconds(30)))
                .build();
    }

    /**
     * Async client for streaming via {@code invokeModelWithResponseStream}.
     * Uses longer per-attempt timeout because streaming sessions outlast the
     * single-call budget of the sync client.
     */
    @Bean
    public BedrockRuntimeAsyncClient bedrockRuntimeAsyncClient(BedrockProperties props) {
        return BedrockRuntimeAsyncClient.builder()
                .region(Region.of(props.region()))
                .credentialsProvider(DefaultCredentialsProvider.create())
                .overrideConfiguration(cfg -> cfg
                        .apiCallTimeout(Duration.ofSeconds(120))
                        .apiCallAttemptTimeout(Duration.ofSeconds(60)))
                .build();
    }
}
