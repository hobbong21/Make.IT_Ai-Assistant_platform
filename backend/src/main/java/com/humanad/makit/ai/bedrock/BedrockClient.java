package com.humanad.makit.ai.bedrock;

/**
 * Narrow, test-friendly surface used by strategies and the RAG engine.
 * Both {@link BedrockService} (real) and {@link MockBedrockService} (dev)
 * implement it. Controllers and domain services must NOT depend on this.
 */
public interface BedrockClient {

    /** Text completion — used for Claude and Titan text models. */
    BedrockInvocation invokeText(String modelId, String prompt, String systemPrompt,
                                 Integer maxTokens, Double temperature);

    /** Image generation — returns raw response JSON; caller extracts base64 + uploads to S3. */
    BedrockInvocation invokeImage(String modelId, String requestJson);

    /** Embedding — caller parses the float[] out of rawResponseJson. */
    BedrockInvocation invokeEmbedding(String modelId, String text);
}
