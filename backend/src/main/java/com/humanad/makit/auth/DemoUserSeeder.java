package com.humanad.makit.auth;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.annotation.Profile;
import org.springframework.context.event.EventListener;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * Runtime seeding of demo accounts. Replaces the previous
 * {@code V202604201208__seed_demo_user.sql} migration which hard-coded a
 * placeholder BCrypt hash that could drift from the {@link PasswordEncoder}
 * configuration (QA-M09).
 *
 * <p>Active only for non-production profiles: {@code dev}, {@code docker},
 * {@code mock}. Prod deployments seed users through ops tooling (not code).</p>
 *
 * <p>Idempotent: skips insertion when a user with the same e-mail already exists.</p>
 */
@Slf4j
@Component
@Profile({"dev", "docker", "mock"})
@RequiredArgsConstructor
public class DemoUserSeeder {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    private static final List<DemoAccount> ACCOUNTS = List.of(
            new DemoAccount("demo@Human.Ai.D.com",       "password123", "Demo Admin",     UserRole.ADMIN),
            new DemoAccount("marketer@example.com",      "password123", "Demo Marketer",  UserRole.MARKETING_MANAGER)
    );

    @EventListener(ApplicationReadyEvent.class)
    @Transactional
    public void seedOnStartup() {
        int seeded = 0;
        for (DemoAccount acct : ACCOUNTS) {
            if (userRepository.existsByEmailIgnoreCase(acct.email())) {
                log.debug("Demo user already present, skipping: {}", acct.email());
                continue;
            }
            User u = new User();
            u.setEmail(acct.email().toLowerCase());
            u.setName(acct.name());
            u.setRole(acct.role());
            u.setPasswordHash(passwordEncoder.encode(acct.rawPassword()));
            u.setActive(true);
            userRepository.save(u);
            seeded++;
            log.info("Seeded demo user: {} [{}]", acct.email(), acct.role());
        }
        log.info("Seeded demo users: {}", seeded);
    }

    private record DemoAccount(String email, String rawPassword, String name, UserRole role) {}
}
