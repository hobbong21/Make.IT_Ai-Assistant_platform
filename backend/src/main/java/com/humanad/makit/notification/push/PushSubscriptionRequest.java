package com.humanad.makit.notification.push;

/**
 * Push subscription request DTO from browser pushManager.subscribe() result.
 * Keys must contain p256dh and auth base64-encoded values.
 */
public record PushSubscriptionRequest(
    String endpoint,
    Keys keys
) {
    public record Keys(String p256dh, String auth) {}
}
