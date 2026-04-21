# ADR-002 — Authentication: self-issued JWT vs AWS Cognito

- **Status**: Accepted
- **Date**: 2026-04-20
- **Deciders**: architect, backend-engineer consulted
- **Supersedes**: The README hint at Cognito integration (informative only)

## Context

The existing frontend (`login.html`) already posts to `POST /api/auth/login` and expects a JSON `{ token, user }` response, stores the token in `localStorage`, and sends it as `Authorization: Bearer` on subsequent calls. The README mentions AWS Cognito as a possible identity provider.

We must decide between:
1. **Self-issued JWT** — Spring Boot issues, signs, and validates tokens itself. Users stored in `users` table with BCrypt password hashes.
2. **AWS Cognito** — user pool hosts identities; Spring Boot validates Cognito-issued JWTs via JWKS.

Constraints:
- Existing frontend contract is fixed (orchestrator plan, R3: contract matches FE, not the reverse).
- v1 ships to a single env with one small user set; a Cognito user pool is disproportionate operational overhead.
- AWS credentials for Cognito configuration are not guaranteed at setup time (R5).

## Decision

**Use self-issued JWT for v1.** Keep Cognito as a declared v2 migration path.

Specifics:
- Algorithm: **HS256** with 32-byte secret from env (`JWT_SECRET`). RS256/JWKS is the v2 move and is a drop-in swap because we already use the `JwtParser.verifyWith(key)` abstraction.
- Access token TTL: **15 minutes**.
- Refresh token TTL: **7 days**, rotated on each refresh, `jti` tracked in Redis.
- Logout blacklists the `jti` in Redis until the original `exp`.
- Password hashing: **BCrypt cost 12**.
- Claims: `sub` (userId UUID), `email`, `role`, `companyId`, standard `iat` `exp` `jti`.

Issuer: `https://makit.example.com` (config-driven). Audience: `makit-web`.

## Consequences

Positive:
- Zero external dependency at login time — frontend contract already matches (`/api/auth/login -> {token, user}`).
- Full control over claims, refresh strategy, revocation (blacklist in Redis).
- Dev and QA run fully offline without AWS credentials.
- One code path for users, roles, audit — no drift between a Cognito attribute and a local `users` row.

Negative / risks:
- We own password storage, breach risk, and reset flows (in scope for v1.1, not v1).
- No MFA, no federated SSO for v1. Added in v2 via Cognito.
- HS256 secret rotation requires coordinated restart; mitigated by supporting key rotation via `kid` header when we move to RS256 in v2.

## Alternatives considered

**AWS Cognito User Pool**
- Pro: MFA, password policy, federated identity, compliance posture.
- Con: Requires AWS credentials and user-pool provisioning before any end-to-end login works. Adds vendor lock-in to cognito-specific claim shape. Retrofits the existing FE contract (Cognito issues different response body).
- Verdict: correct choice at v2 once the platform has real users.

**Session cookies with server-side session store**
- Pro: Trivially revocable.
- Con: The FE already assumes Bearer token in `localStorage`. Would require FE rewrite. Rejected.

**Keycloak / Auth0**
- Pro: Feature-rich OIDC.
- Con: New service to run or new paid dependency. Rejected for v1.

## Migration path to Cognito (v2)

1. Provision Cognito user pool, import existing users (email + forced password reset).
2. Switch signature algorithm to RS256, fetch JWKS from Cognito issuer.
3. Update `JwtAuthFilter` to validate against JWKS instead of HMAC secret. The filter interface is stable; only the key source changes.
4. Keep `users` table as the domain profile store — user pool holds only credentials + MFA state.
5. Deprecate `/api/auth/register`, redirect to hosted Cognito sign-up.

No controller code above the filter should need changes.

## Security notes

- Tokens are not stored in cookies for v1 — prevents CSRF automatically. XSS risk remains; mitigation is strict CSP on the static site (frontend-engineer task).
- Every login writes an `audit_logs` row with `action=LOGIN`, result, IP.
- Login endpoint itself is rate-limited to 10 req/min per IP (separate bucket from the global per-user limit).
