package com.humanad.makit.ai.dto;

/**
 * SSE event carrier. The `event` decides how `data` is interpreted:
 *   delta    -> partial token string
 *   citation -> JSON string of a Citation object
 *   done     -> JSON string of final Usage
 *   error    -> user-safe error message
 *   ping     -> heartbeat (data empty)
 */
public record ChatStreamChunk(
        EventType event,
        String data
) {
    public enum EventType {
        delta,
        citation,
        done,
        error,
        ping
    }
}
