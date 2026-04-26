# admin-dashboard API

## 엔드포인트

### GET GET /api/admin/stats/overview

플랫폼의 전체 통계 및 지표를 조회합니다.

**인증**: Required (Bearer JWT)

**요청 필드**:
| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `days` | integer | No | 조회 기간 (기본값: 30) |


**응답 (200 OK)**:
```json
{"activeUsers": 1250, "totalRequests": 45000, "jobsInProgress": 23, "notificationBreakdown": {"info": 340, "success": 1200, "warn": 89, "error": 12}, "topServices": ["nlp-analyze", "chatbot", "feed-generate"]}
```

**오류 응답**:
| 상태 | 설명 |
|------|------|
| 400 | 잘못된 요청 |
| 401 | 인증 필요 |
| 429 | 요청 초과 |
| 500 | 서버 오류 |

## 사용 예시

### cURL 예제

```bash
curl -X GET http://localhost:8080GET /api/admin/stats/overview \
  -H "Authorization: Bearer {access_token}" \
  -H "Content-Type: application/json" \
  -d '{}'
```

### JavaScript 예제

```javascript
const response = await fetch('GET /api/admin/stats/overview', {
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({})
});
const result = await response.json();
```

## 참고 문서

- [README.md](./README.md) — 기능 설명
- [manifest.json](./manifest.json) — 파일 매핑
