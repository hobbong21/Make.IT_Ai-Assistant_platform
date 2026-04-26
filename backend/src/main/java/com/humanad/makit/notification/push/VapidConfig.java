package com.humanad.makit.notification.push;

import lombok.extern.slf4j.Slf4j;
import nl.martijndwars.webpush.PushService;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * VAPID (Voluntary Application Server Identification) configuration for Web Push.
 * Generate keys via: npx web-push generate-vapid-keys
 * Then set VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT env vars.
 */
@Slf4j
@Configuration
@ConfigurationProperties(prefix = "vapid")
public class VapidConfig {

    private String publicKey;
    private String privateKey;
    private String subject;

    public String getPublicKey() { return publicKey; }
    public void setPublicKey(String publicKey) { this.publicKey = publicKey; }

    public String getPrivateKey() { return privateKey; }
    public void setPrivateKey(String privateKey) { this.privateKey = privateKey; }

    public String getSubject() { return subject; }
    public void setSubject(String subject) { this.subject = subject; }

    /**
     * Create PushService bean if VAPID keys are configured.
     * If not configured, push notifications are disabled (graceful degradation).
     */
    @Bean
    @ConditionalOnProperty(prefix = "vapid", name = "public-key")
    public PushService pushService() {
        if (publicKey == null || publicKey.isBlank() ||
            privateKey == null || privateKey.isBlank() ||
            subject == null || subject.isBlank()) {
            log.warn("[VAPID] Keys not fully configured; push notifications disabled");
            return null;
        }

        try {
            PushService pushService = new PushService(publicKey, privateKey, subject);
            log.info("[VAPID] PushService initialized; public key length={}", publicKey.length());
            return pushService;
        } catch (Exception e) {
            log.error("[VAPID] Failed to initialize PushService", e);
            return null;
        }
    }
}
