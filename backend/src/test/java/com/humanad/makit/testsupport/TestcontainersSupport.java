package com.humanad.makit.testsupport;

import org.testcontainers.DockerClientFactory;

import static org.junit.jupiter.api.Assumptions.assumeTrue;

/**
 * Testcontainers 기반 통합 테스트의 Docker 가용성 게이트.
 *
 * <p>로컬에서는 Docker가 없으면 graceful skip 하지만, CI 빌드에서는
 * 환경 변수 {@code REQUIRE_DOCKER_TESTS=true}가 설정된 경우
 * skip 대신 즉시 실패시켜 회귀 보호 공백을 막는다.
 *
 * <p>새로 추가되는 Testcontainers 테스트는 {@code @BeforeAll} 등에서
 * {@link #requireDockerOrSkip(String)} 한 줄만 호출하면
 * 일관된 정책이 적용된다.
 */
public final class TestcontainersSupport {

    /** CI 등에서 "Docker가 반드시 있어야 한다"고 강제하는 스위치. */
    public static final String REQUIRE_ENV = "REQUIRE_DOCKER_TESTS";

    private TestcontainersSupport() {}

    /**
     * Docker 데몬이 사용 가능하면 통과. 그렇지 않으면:
     * <ul>
     *   <li>{@code REQUIRE_DOCKER_TESTS=true} → {@link IllegalStateException}로 빌드 실패</li>
     *   <li>그 외 → {@code Assumptions.assumeTrue}로 skip</li>
     * </ul>
     *
     * @param reason skip/fail 메시지에 포함될 사람이 읽을 설명
     */
    public static void requireDockerOrSkip(String reason) {
        boolean dockerAvailable;
        try {
            dockerAvailable = DockerClientFactory.instance().isDockerAvailable();
        } catch (Exception e) {
            dockerAvailable = false;
        }

        if (dockerAvailable) {
            return;
        }

        if (isDockerRequired()) {
            throw new IllegalStateException(
                    "Docker is required for this test (" + REQUIRE_ENV + "=true) but no Docker daemon was found: "
                            + reason);
        }

        assumeTrue(false, "Docker not available — skipping: " + reason);
    }

    /** {@code REQUIRE_DOCKER_TESTS} 가 true 인지 확인. (env 우선, 없으면 system property) */
    public static boolean isDockerRequired() {
        String env = System.getenv(REQUIRE_ENV);
        if (env != null && !env.isBlank()) {
            return Boolean.parseBoolean(env.trim());
        }
        String prop = System.getProperty(REQUIRE_ENV);
        return prop != null && Boolean.parseBoolean(prop.trim());
    }
}
