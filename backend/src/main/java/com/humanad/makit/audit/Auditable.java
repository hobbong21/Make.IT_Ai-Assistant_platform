package com.humanad.makit.audit;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * Marker annotation for service methods that should be automatically audited.
 * When applied to a method or class, the AuditAspect will intercept execution
 * and log the call to the audit_logs table.
 */
@Target({ElementType.METHOD, ElementType.TYPE})
@Retention(RetentionPolicy.RUNTIME)
public @interface Auditable {

    /**
     * Action type for audit log. Defaults to "SERVICE_CALL".
     */
    String action() default "SERVICE_CALL";

    /**
     * Resource identifier (e.g., service key like "nlp-analyze").
     * If empty, defaults to the declaring class simple name + "." + method name.
     */
    String resource() default "";
}
