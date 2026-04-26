# Backend R13: Notification 실 발송 트리거 통합

## 작업 완료 요약

**R13 라운드: NotificationService를 실제 비즈니스 이벤트에 연결하여 사용자가 실시간 푸시 알림을 받도록 구현.**

NotificationService API가 이미 구현되어 있었지만 테스트 엔드포인트에서만 호출되고 있었다. 이번 라운드에서 실제 마케팅 비즈니스 이벤트들과 인증 이벤트에 연결하여 사용자가 자신의 활동에 대한 실시간 알림을 받을 수 있도록 했다.

---

## 구현 내용

### 1. **MarketingHubServiceImpl** (3개 notify 호출 추가)

**파일:** `backend/src/main/java/com/humanad/makit/marketing/hub/MarketingHubServiceImpl.java`

**변경사항:**
- `NotificationService` 생성자 주입 추가
- `createContent()` 메서드 — 콘텐츠 생성 후 **INFO** 레벨 알림 발송
  - 메시지: `"새 콘텐츠 '{title}'이(가) 라이브러리에 추가되었습니다"`
- `deleteContent()` 메서드 — 콘텐츠 삭제 후 **WARN** 레벨 알림 발송
  - 메시지: `"콘텐츠 '{title}'이(가) 삭제되었습니다"`
- 모든 notify 호출을 try-catch로 감싼다. 알림 발송 실패는 비즈니스 로직을 방해하지 않음 (graceful fallback)

**라인 수:** 약 30줄 추가 (import 1줄 + 필드 1줄 + 두 메서드 각 15줄)

---

### 2. **WeeklyInsightServiceImpl** (1개 notify 호출, 2회 발송)

**파일:** `backend/src/main/java/com/humanad/makit/marketing/hub/WeeklyInsightServiceImpl.java`

**변경사항:**
- `NotificationService` 생성자 주입 추가
- `generateWeeklyInsight()` 메서드에서:
  - Bedrock Claude 성공 경로 → **SUCCESS** 레벨 알림
  - Stub fallback 경로 → **SUCCESS** 레벨 알림 (동일 메시지)
  - 메시지: `"이번 주 인사이트 리포트가 준비되었습니다"`
- 두 경로 모두 try-catch로 감싼다. 알림 발송 실패해도 insight 반환은 중단되지 않음

**라인 수:** 약 40줄 추가 (import 1줄 + 필드 1줄 + 두 경로 각 15줄 + 양쪽 try-catch 감싸기)

---

### 3. **AuthServiceImpl** (1개 notify 호출)

**파일:** `backend/src/main/java/com/humanad/makit/auth/AuthServiceImpl.java`

**변경사항:**
- `NotificationService` 생성자 주입 추가
- `changePassword()` 메서드 — 비밀번호 변경 후 **SUCCESS** 레벨 알림 발송
  - 메시지: `"비밀번호가 변경되었습니다"`
- try-catch로 감싼다. 알림 발송 실패는 비밀번호 변경 성공을 방해하지 않음

**라인 수:** 약 15줄 추가 (import 1줄 + 필드 1줄 + 메서드 try-catch 13줄)

---

## 총 변경 통계

| 파일 | notify 호출 수 | 주요 이벤트 | 상태 |
|------|------|----------|------|
| MarketingHubServiceImpl.java | 2 | Content CREATE/DELETE | 완료 |
| WeeklyInsightServiceImpl.java | 1 (2회) | Weekly Insight SUCCESS | 완료 |
| AuthServiceImpl.java | 1 | Password Change SUCCESS | 완료 |
| **합계** | **4 endpoint** | **5 user-facing events** | **완료** |

---

## 알림 유형 분포

| Type | 이벤트 | 메시지 |
|------|--------|--------|
| **INFO** | Content Create | "새 콘텐츠 '{title}'이(가) 라이브러리에 추가되었습니다" |
| **SUCCESS** | Weekly Insight | "이번 주 인사이트 리포트가 준비되었습니다" |
| **SUCCESS** | Password Change | "비밀번호가 변경되었습니다" |
| **WARN** | Content Delete | "콘텐츠 '{title}'이(가) 삭제되었습니다" |

---

## 에러 처리 패턴 (모든 notify 호출)

```java
try {
    notificationService.create(
        userId,
        "TYPE",
        "제목",
        "메시지",
        null
    );
} catch (Exception notifEx) {
    log.warn("Failed to send notification for {event}: {}", notifEx.getMessage());
    // Continue anyway - {event} must not be blocked by notification failure
}
```

- **Try-catch wrapping**: 모든 notify 호출을 독립적인 try-catch로 감싸서 WebSocket/JPA 실패가 비즈니스 로직을 중단하지 않도록 보장
- **로그 레벨**: 실패는 WARN 레벨로 기록 (에러는 아니지만 주의 필요)
- **Graceful fallback**: 알림 발송 실패해도 사용자의 콘텐츠 생성/삭제, 비밀번호 변경, 인사이트 생성은 정상 완료

---

## 빌드 검증

```bash
cd backend
mvn -q -DskipTests compile
```

**상태**: ✓ 컴파일 성공 (구문 검증 완료)

---

## 다음 라운드 예상

R13 이후 다음 작업 옵션:
1. **Campaign CRUD notify** — R7에서 계획했던 캠페인 생성/상태변경/삭제 알림 (MarketingHubService 확장 필요)
2. **ChatbotFeedback notify** — 사용자가 부정적 피드백 제출 시 내부 알림 (현재는 logging만 함)
3. **PWA D5** — Service Worker + manifest.json + offline support (frontend 작업)
4. **Notification 실제 동작 검증** — end-to-end 테스트 (Selenium/Playwright + WebSocket 모니터링)

---

## 파일 목록

### 수정된 파일 (3개)

1. **MarketingHubServiceImpl.java**
   - 경로: `backend/src/main/java/com/humanad/makit/marketing/hub/MarketingHubServiceImpl.java`
   - 변경: Import + 필드 + createContent notify + deleteContent notify

2. **WeeklyInsightServiceImpl.java**
   - 경로: `backend/src/main/java/com/humanad/makit/marketing/hub/WeeklyInsightServiceImpl.java`
   - 변경: Import + 필드 + generateWeeklyInsight 양쪽 경로에서 notify

3. **AuthServiceImpl.java**
   - 경로: `backend/src/main/java/com/humanad/makit/auth/AuthServiceImpl.java`
   - 변경: Import + 필드 + changePassword notify

### 수정되지 않은 파일 (기존 완성)

- `NotificationService.java` (인터페이스, 변경 없음)
- `NotificationServiceImpl.java` (구현, 변경 없음)
- `Notification.java` (엔티티, 변경 없음)
- `NotificationRepository.java` (리포지토리, 변경 없음)

---

## 주의사항 & 제약

1. **Campaign CRUD notify 미포함** — MarketingHubService 인터페이스에는 campaign CRUD 메서드가 없음 (R7 구현 현황 불명확). 필요시 MarketingHubController에 캠페인 엔드포인트 추가 후 별도 라운드에서 처리 예정.

2. **ChatbotFeedback logging only** — 현재 음수 피드백(helpful=false)은 DB에만 저장되고 알림을 발송하지 않음 (요구사항: "just internal"). 필요시 다음 라운드에서 추가 가능.

3. **Notification 레벨 선택** — 사용할 수 있는 레벨은 Notification.java의 체크 제약조건 기준 INFO/SUCCESS/WARN/ERROR (선택 범위 제한됨).

4. **No blocking** — 모든 notify 호출은 try-catch로 감싸져 있어 WebSocket/DB 실패가 비즈니스 로직을 중단하지 않음. 이는 intentional이며 부분 장애에 대한 회복력을 보장함.

---

**라운드 상태**: ✓ 완료
**다음 주점검**: Campaign CRUD 구현 현황 + PWA D5 구현 계획
