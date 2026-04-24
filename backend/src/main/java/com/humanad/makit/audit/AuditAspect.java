package com.humanad.makit.audit;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.aspectj.lang.JoinPoint;
import org.aspectj.lang.annotation.AfterReturning;
import org.aspectj.lang.annotation.Aspect;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

import java.util.Map;
import java.util.UUID;

@Slf4j
@Aspect
@Component
@RequiredArgsConstructor
public class AuditAspect {

    private final AuditLogRepository repo;

    @AfterReturning("execution(* com.humanad.makit.auth.AuthServiceImpl.login(..))")
    public void logLogin(JoinPoint jp) {
        write("LOGIN", null, Map.of("args", jp.getArgs().length));
    }

    @AfterReturning("execution(* com.humanad.makit.auth.AuthServiceImpl.register(..))")
    public void logRegister(JoinPoint jp) {
        write("REGISTER", null, Map.of());
    }

    @AfterReturning("execution(* com.humanad.makit.marketing.feed.FeedGenerationService.generate(..))")
    public void logFeedGen(JoinPoint jp) {
        write("GEN_CONTENT", "instagram_feed", Map.of());
    }

    @AfterReturning("execution(* com.humanad.makit.commerce.modelshot.ModelshotService.generate(..))")
    public void logModelshot(JoinPoint jp) {
        write("GEN_CONTENT", "modelshot", Map.of());
    }

    private void write(String action, String resource, Map<String, Object> meta) {
        try {
            AuditLog l = new AuditLog();
            l.setAction(action);
            l.setResource(resource);
            l.setMetadata(meta);
            Authentication auth = SecurityContextHolder.getContext().getAuthentication();
            if (auth != null && auth.getName() != null) {
                try {
                    l.setUserId(UUID.fromString(auth.getName()));
                } catch (Exception ignored) {}
            }
            repo.save(l);
        } catch (Exception ex) {
            log.warn("Audit write failed: {}", ex.getMessage());
        }
    }
}
