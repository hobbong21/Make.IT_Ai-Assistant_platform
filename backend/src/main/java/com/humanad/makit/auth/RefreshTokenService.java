package com.humanad.makit.auth;

import lombok.RequiredArgsConstructor;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.UUID;

/**
 * Redis-backed refresh-token store and jti blacklist.
 *
 * Keys:
 *  - makit:refresh:{jti} -> userId (ttl = refresh TTL). Presence means "active".
 *  - makit:blacklist:{jti} -> "1" (ttl = remaining exp). Blocks an access token.
 */
@Service
@RequiredArgsConstructor
public class RefreshTokenService {

    private static final String REFRESH_PREFIX = "makit:refresh:";
    private static final String BLACKLIST_PREFIX = "makit:blacklist:";

    private final RedisTemplate<String, Object> redis;

    public void storeRefresh(String jti, UUID userId, Duration ttl) {
        redis.opsForValue().set(REFRESH_PREFIX + jti, userId.toString(), ttl);
    }

    public boolean isRefreshValid(String jti) {
        return Boolean.TRUE.equals(redis.hasKey(REFRESH_PREFIX + jti));
    }

    public void revokeRefresh(String jti) {
        redis.delete(REFRESH_PREFIX + jti);
    }

    public void blacklistAccess(String jti, Duration ttl) {
        redis.opsForValue().set(BLACKLIST_PREFIX + jti, "1", ttl);
    }

    public boolean isAccessBlacklisted(String jti) {
        return Boolean.TRUE.equals(redis.hasKey(BLACKLIST_PREFIX + jti));
    }
}
