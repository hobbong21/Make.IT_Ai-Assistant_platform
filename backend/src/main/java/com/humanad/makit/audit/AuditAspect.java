package com.humanad.makit.audit;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.aspectj.lang.JoinPoint;
import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.annotation.AfterReturning;
import org.aspectj.lang.annotation.Around;
import org.aspectj.lang.annotation.Aspect;
import org.aspectj.lang.reflect.MethodSignature;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.lang.reflect.Method;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

@Slf4j
@Aspect
@Component
@RequiredArgsConstructor
public class AuditAspect {

    private final AuditLogRepository repo;

    /**
     * Intercept methods annotated with @Auditable and log their execution.
     * Uses @Around to capture both success and failure, with separate transaction.
     */
    @Around("@annotation(auditable)")
    public Object auditableMethodCall(ProceedingJoinPoint pjp, Auditable auditable) throws Throwable {
        long startTime = System.currentTimeMillis();
        String action = auditable.action();
        String resource = auditable.resource();

        // If resource is empty, derive from class + method name
        if (resource == null || resource.isBlank()) {
            MethodSignature sig = (MethodSignature) pjp.getSignature();
            String className = pjp.getTarget().getClass().getSimpleName();
            String methodName = sig.getName();
            resource = className + "." + methodName;
        }

        Throwable capturedEx = null;
        try {
            return pjp.proceed();
        } catch (Throwable ex) {
            capturedEx = ex;
            throw ex;
        } finally {
            long duration = System.currentTimeMillis() - startTime;
            String status = capturedEx == null ? "SUCCESS" : "FAILED";

            Map<String, Object> metadata = new HashMap<>();
            metadata.put("status", status);
            metadata.put("duration_ms", duration);
            if (capturedEx != null) {
                metadata.put("exception", capturedEx.getClass().getSimpleName());
                metadata.put("message", capturedEx.getMessage());
            }

            writeAuditLog(action, resource, metadata);
        }
    }

    /**
     * Fallback: intercept methods on classes annotated with @Auditable.
     * Uses the annotation's action/resource with defaults.
     */
    @Around("@within(auditable) && !@annotation(auditable)")
    public Object auditableClassCall(ProceedingJoinPoint pjp, Auditable auditable) throws Throwable {
        long startTime = System.currentTimeMillis();
        String action = auditable.action();
        String resource = auditable.resource();

        if (resource == null || resource.isBlank()) {
            MethodSignature sig = (MethodSignature) pjp.getSignature();
            String className = pjp.getTarget().getClass().getSimpleName();
            String methodName = sig.getName();
            resource = className + "." + methodName;
        }

        Throwable capturedEx = null;
        try {
            return pjp.proceed();
        } catch (Throwable ex) {
            capturedEx = ex;
            throw ex;
        } finally {
            long duration = System.currentTimeMillis() - startTime;
            String status = capturedEx == null ? "SUCCESS" : "FAILED";

            Map<String, Object> metadata = new HashMap<>();
            metadata.put("status", status);
            metadata.put("duration_ms", duration);
            if (capturedEx != null) {
                metadata.put("exception", capturedEx.getClass().getSimpleName());
                metadata.put("message", capturedEx.getMessage());
            }

            writeAuditLog(action, resource, metadata);
        }
    }

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

    /**
     * Write audit log in a separate transaction so it persists even if the business transaction rolls back.
     */
    @Transactional(propagation = org.springframework.transaction.annotation.Propagation.REQUIRES_NEW)
    private void writeAuditLog(String action, String resource, Map<String, Object> metadata) {
        try {
            AuditLog l = new AuditLog();
            l.setAction(action);
            l.setResource(resource);
            l.setMetadata(metadata);

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

    private void write(String action, String resource, Map<String, Object> meta) {
        writeAuditLog(action, resource, meta);
    }
}
