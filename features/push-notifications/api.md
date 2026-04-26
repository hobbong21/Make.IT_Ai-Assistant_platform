# push-notifications API

## 엔드포인트

### POST POST /api/notifications/push/subscribe

Web Push API를 통한 OS 레벨 푸시 알림을 등록합니다.

**인증**: Required (Bearer JWT)

**요청 필드**:
| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `subscription` | object | Yes | Web Push 구독 객체 (endpoint, keys) |
| `userAgent` | string | No | 브라우저 정보 |


**응답 (200 OK)**:
```json
{"id": "subscription-uuid", "userId": "user-id", "subscriptionEndpoint": "https://...", "status": "active", "createdAt": "2026-04-26T12:30:00+09:00"}
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
curl -X POST http://localhost:8080POST /api/notifications/push/subscribe \
  -H "Authorization: Bearer {access_token}" \
  -H "Content-Type: application/json" \
  -d '{}'
```

### JavaScript 예제

```javascript
const response = await fetch('POST /api/notifications/push/subscribe', {
  method: 'POST',
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
