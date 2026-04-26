package com.humanad.makit.auth;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface UserRepository extends JpaRepository<User, UUID> {
    Optional<User> findByEmailIgnoreCase(String email);
    boolean existsByEmailIgnoreCase(String email);

    /**
     * Count total users in the system.
     */
    long count();

    /**
     * Count users who logged in within the last N days.
     */
    @Query("""
        SELECT COUNT(DISTINCT u) FROM User u
        WHERE u.lastLoginAt IS NOT NULL
        AND u.lastLoginAt >= :since
    """)
    long countActiveUsersSince(@Param("since") OffsetDateTime since);

    /**
     * Find all users with pagination (admin dashboard).
     */
    @Query("""
        SELECT u FROM User u
        ORDER BY u.createdAt DESC
    """)
    List<User> findAllForAdmin();
}
