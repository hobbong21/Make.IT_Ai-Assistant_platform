package com.humanad.makit.ai.bedrock;

/**
 * Wraps any Bedrock-originating failure. Backend's @ControllerAdvice maps this
 * to an AI_BEDROCK_* error code in ApiErrorResponse.
 */
public class BedrockInvocationException extends RuntimeException {
    public BedrockInvocationException(String message) {
        super(message);
    }
    public BedrockInvocationException(String message, Throwable cause) {
        super(message, cause);
    }
}
