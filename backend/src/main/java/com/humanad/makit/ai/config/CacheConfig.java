package com.humanad.makit.ai.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.cache.RedisCacheConfiguration;
import org.springframework.data.redis.cache.RedisCacheManager;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.serializer.GenericJackson2JsonRedisSerializer;
import org.springframework.data.redis.serializer.RedisSerializationContext;
import org.springframework.data.redis.serializer.StringRedisSerializer;

import java.time.Duration;
import java.util.Map;

/**
 * Redis-backed @Cacheable for deterministic AI reads (NLP, URL analyze, SEO).
 *
 * Cache names used across the ai module:
 *  - ai:nlp             (1h)  deterministic sentiment/keyword extraction
 *  - ai:url             (30m) URL summary
 *  - ai:sentiment       (1h)  review/comment sentiment
 *  - ai:rag:retrieval   (5m)  short TTL; underlying index may change
 *
 * @ConditionalOnMissingBean so backend-engineer can override without conflict.
 */
@Configuration
@EnableCaching
public class CacheConfig {

    @Bean("aiCacheManager")
    @ConditionalOnMissingBean(name = "aiCacheManager")
    public RedisCacheManager aiCacheManager(RedisConnectionFactory connectionFactory,
                                            ObjectMapper objectMapper) {
        GenericJackson2JsonRedisSerializer valueSerializer =
                new GenericJackson2JsonRedisSerializer(objectMapper);

        RedisCacheConfiguration base = RedisCacheConfiguration.defaultCacheConfig()
                .disableCachingNullValues()
                .serializeKeysWith(RedisSerializationContext.SerializationPair.fromSerializer(
                        new StringRedisSerializer()))
                .serializeValuesWith(RedisSerializationContext.SerializationPair.fromSerializer(
                        valueSerializer));

        Map<String, RedisCacheConfiguration> perCache = Map.of(
                "ai:nlp",           base.entryTtl(Duration.ofHours(1)),
                "ai:url",           base.entryTtl(Duration.ofMinutes(30)),
                "ai:sentiment",     base.entryTtl(Duration.ofHours(1)),
                "ai:rag:retrieval", base.entryTtl(Duration.ofMinutes(5))
        );

        return RedisCacheManager.builder(connectionFactory)
                .cacheDefaults(base.entryTtl(Duration.ofHours(1)))
                .withInitialCacheConfigurations(perCache)
                .build();
    }
}
