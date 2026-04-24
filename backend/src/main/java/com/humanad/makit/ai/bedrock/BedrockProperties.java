package com.humanad.makit.ai.bedrock;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.util.Map;

/**
 * Type-safe binding for aws.bedrock.* in application.yml.
 * Never hardcode model ids — always go through this.
 */
@ConfigurationProperties(prefix = "aws.bedrock")
public record BedrockProperties(
        boolean enabled,
        String region,
        Models models,
        Defaults defaults,
        /** USD per 1k tokens, keyed by modelId. Used for cost metrics. */
        Map<String, Tariff> tariff,
        S3 s3
) {
    public record Models(
            String claudeHaiku,
            String claudeSonnet,
            String titanEmbed,
            String stableDiffusion,
            String titanImage
    ) {}

    public record Defaults(
            int maxTokensText,
            int maxTokensAnalysis,
            double temperature,
            double temperatureAnalysis,
            int imageSteps,
            double imageCfgScale
    ) {}

    public record Tariff(double inputPer1k, double outputPer1k) {}

    public record S3(String bucket, String assetPrefix) {}
}
