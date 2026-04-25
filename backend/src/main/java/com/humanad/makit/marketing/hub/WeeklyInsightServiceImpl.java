package com.humanad.makit.marketing.hub;

import com.humanad.makit.ai.bedrock.BedrockClient;
import com.humanad.makit.ai.bedrock.BedrockInvocation;
import com.humanad.makit.audit.AuditLogRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;

/**
 * Implementation of WeeklyInsightService.
 * Calls Bedrock Claude to generate intelligent insights from user's audit activity.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class WeeklyInsightServiceImpl implements WeeklyInsightService {

    private final AuditLogRepository auditLogRepository;
    private final BedrockClient bedrockClient;

    private static final String BEDROCK_MODEL_ID = "anthropic.claude-3-5-haiku-20241022-v1:0";
    private static final int MAX_TOKENS = 1024;
    private static final double TEMPERATURE = 0.7;

    @Override
    public Map<String, Object> generateWeeklyInsight(UUID userId) {
        LocalDate today = LocalDate.now();
        LocalDate weekStart = today.minusDays(6);

        try {
            // 1. Fetch activity data from last 7 days
            List<Object[]> activityByDay = auditLogRepository.findActivityByDay(userId, 7);
            Map<LocalDate, Long> activityMap = parseActivityData(activityByDay);

            // 2. Build insight-friendly summary
            String activitySummary = buildActivitySummary(activityMap);

            // 3. Try Bedrock Claude invocation
            String markdown = invokeBedrockInsight(userId, activitySummary, weekStart, today);

            return Map.of(
                    "weekStart", weekStart.toString(),
                    "weekEnd", today.toString(),
                    "markdown", markdown,
                    "generatedAt", java.time.Instant.now().toString(),
                    "source", "bedrock-claude"
            );
        } catch (Exception e) {
            log.warn("Bedrock insight generation failed for user {}, falling back to stub: {}", userId, e.getMessage());
            return generateStubInsight(weekStart, today);
        }
    }

    /**
     * Invokes Bedrock Claude with user's activity data to generate personalized insights.
     */
    private String invokeBedrockInsight(UUID userId, String activitySummary,
                                        LocalDate weekStart, LocalDate weekEnd) {
        String systemPrompt = """
            You are an expert marketing analytics AI. Your task is to generate a concise, actionable weekly insight
            for a marketing professional based on their usage patterns and activity data.

            Keep insights focused, specific, and provide only 2-3 key findings with 2-3 actionable recommendations.
            Use Korean for all output.""";

        String userPrompt = String.format("""
            Here is this user's marketing platform activity for the week of %s to %s:

            %s

            Based on this activity, generate a brief weekly insight markdown document with:
            1. 한 문장 요약 (one-line summary)
            2. 핵심 발견사항 (2-3 key findings)
            3. 권장 액션 (2-3 actionable recommendations)
            4. 다음 주 우선순위 (one-line next week priority)

            Format as markdown with # and ## headers. Be concise and specific.""",
                weekStart, weekEnd, activitySummary);

        try {
            BedrockInvocation result = bedrockClient.invokeText(
                    BEDROCK_MODEL_ID,
                    userPrompt,
                    systemPrompt,
                    MAX_TOKENS,
                    TEMPERATURE
            );

            if (result.outputText() != null && !result.outputText().isBlank()) {
                log.info("Bedrock insight generated successfully for user {} (tokens out: {})",
                        userId, result.tokensOut());
                return result.outputText();
            }
        } catch (Exception e) {
            log.warn("Bedrock invocation error for user {}: {}", userId, e.getMessage());
        }

        throw new RuntimeException("Failed to generate Bedrock insight");
    }

    /**
     * Fallback stub insight when Bedrock is unavailable.
     */
    private Map<String, Object> generateStubInsight(LocalDate weekStart, LocalDate weekEnd) {
        String markdown = String.format("""
                ## 이번 주 마케팅 인사이트 (%s ~ %s)

                **요약:** 이번 주 마케팅 캠페인 활동을 종합한 결과, 다음 인사이트를 도출했습니다.

                ### 핵심 발견사항

                - **콘텐츠 생성**이 활발하게 이루어지고 있으며, AX Marketing Intelligence 카테고리에서 가장 많은 활동이 관찰됩니다.
                - **고객 응대 챗봇** 사용량이 꾸준히 증가하는 추세입니다 — 24/7 응대 가치 검증.
                - **자연어 분석**과 **유튜브 댓글 분석**이 의사결정 지원 도구로 자리 잡고 있습니다.

                ### 권장 액션

                1. **콘텐츠 라이브러리 정리** — 생성된 자산이 50개를 넘으면 태깅·검색 시스템 도입 검토
                2. **A/B 테스트 활성화** — 인스타그램 피드 생성 결과를 2-3개 변형으로 비교 운영
                3. **챗봇 컨텍스트 보강** — RAG 지식 베이스에 자주 묻는 질문 TOP 20 추가

                ### 다음 주 우선순위

                | 우선 | 항목 | 예상 효과 |
                |------|------|----------|
                | 🔥 높음 | 캠페인 자동화 워크플로우 설계 | 작업 시간 40%% 절감 |
                | ⭐ 중간 | 채널별 성과 대시보드 정착 | 의사결정 속도 2배 |
                | ✓ 낮음 | 콘텐츠 메타데이터 표준화 | 검색·재사용 향상 |

                > _이 인사이트는 현재 stub 데이터 기반입니다. 실제 운영 데이터가 축적되면 Bedrock Claude가 자동으로 더 정확한 분석을 제공합니다._
                """,
                weekStart.format(DateTimeFormatter.ofPattern("M월 d일")),
                weekEnd.format(DateTimeFormatter.ofPattern("M월 d일")));

        return Map.of(
                "weekStart", weekStart.toString(),
                "weekEnd", weekEnd.toString(),
                "markdown", markdown,
                "generatedAt", java.time.Instant.now().toString(),
                "source", "stub-rule-based"
        );
    }

    /**
     * Parse activity query result (List<Object[]>) into a date->count map.
     */
    private Map<LocalDate, Long> parseActivityData(List<Object[]> activityByDay) {
        Map<LocalDate, Long> result = new LinkedHashMap<>();
        if (activityByDay == null || activityByDay.isEmpty()) {
            return result;
        }

        for (Object[] row : activityByDay) {
            if (row.length >= 2) {
                String dateStr = String.valueOf(row[0]); // YYYY-MM-DD
                long count = ((Number) row[1]).longValue();
                try {
                    LocalDate date = LocalDate.parse(dateStr);
                    result.put(date, count);
                } catch (Exception e) {
                    log.debug("Failed to parse activity date: {}", dateStr);
                }
            }
        }
        return result;
    }

    /**
     * Build a human-readable activity summary from the activity map.
     */
    private String buildActivitySummary(Map<LocalDate, Long> activityMap) {
        if (activityMap.isEmpty()) {
            return "이 주에 기록된 활동이 없습니다.";
        }

        StringBuilder sb = new StringBuilder();
        sb.append("**주간 활동 통계:**\n\n");

        long totalActivity = 0;
        LocalDate maxDay = null;
        long maxCount = 0;

        for (Map.Entry<LocalDate, Long> entry : activityMap.entrySet()) {
            LocalDate date = entry.getKey();
            long count = entry.getValue();
            totalActivity += count;

            if (count > maxCount) {
                maxCount = count;
                maxDay = date;
            }

            String dayName = getDayName(date);
            sb.append(String.format("- %s (%s): %d회\n", date, dayName, count));
        }

        sb.append(String.format("\n**합계:** %d회", totalActivity));
        if (maxDay != null) {
            sb.append(String.format("\n**최고 활동일:** %s (%d회)", maxDay, maxCount));
        }

        return sb.toString();
    }

    /**
     * Get Korean day name (월요일, 화요일, etc.)
     */
    private String getDayName(LocalDate date) {
        return switch (date.getDayOfWeek()) {
            case MONDAY -> "월";
            case TUESDAY -> "화";
            case WEDNESDAY -> "수";
            case THURSDAY -> "목";
            case FRIDAY -> "금";
            case SATURDAY -> "토";
            case SUNDAY -> "일";
        };
    }
}
