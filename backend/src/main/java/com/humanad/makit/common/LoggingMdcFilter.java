package com.humanad.makit.common;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.MDC;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

/**
 * Populates MDC with {@code userId} once the Spring Security context has been
 * established (i.e. after {@code JwtAuthenticationFilter}). Every log statement
 * emitted during the request — including those from the controller, service,
 * and AI layers — then carries {@code userId} automatically via the configured
 * logback encoders ({@code logback-spring.xml}).
 *
 * <p>{@code requestId} is set by {@link RequestIdFilter} at the very top of the
 * chain.</p>
 */
@Component
@Order(Ordered.LOWEST_PRECEDENCE - 100)
public class LoggingMdcFilter extends OncePerRequestFilter {

    public static final String MDC_USER_ID = "userId";

    @Override
    protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res, FilterChain chain)
            throws ServletException, IOException {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        boolean set = false;
        if (auth != null && auth.isAuthenticated()
                && auth.getPrincipal() != null
                && !"anonymousUser".equals(auth.getPrincipal())) {
            MDC.put(MDC_USER_ID, String.valueOf(auth.getPrincipal()));
            set = true;
        }
        try {
            chain.doFilter(req, res);
        } finally {
            if (set) MDC.remove(MDC_USER_ID);
        }
    }
}
