# notifications API

## 엔드포인트

### POST POST /api/notifications/create

사용자에게 실시간 알림을 생성하고 전송합니다.

**인증**: Required (Bearer JWT)

**요청 필드**:
| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `userId` | string | Yes | 알림 대상 사용자 ID |
| `type` | string | No | 알림 타입 (INFO, SUCCESS, WARN, ERROR) |
| `message` | string | Yes | 알림 메시지 |


**응답 (200 OK)**:
```json
{"id": "notif-uuid", "userId": "user-id", "type": "SUCCESS", "message": "작업 완료", "createdAt": "2026-04-26T12:30:00+09:00", "readAt": None}
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
curl -X POST http://localhost:8080POST /api/notifications/create \
  -H "Authorization: Bearer {access_token}" \
  -H "Content-Type: application/json" \
  -d '{}'
```

### JavaScript 예제

```javascript
const response = await fetch('POST /api/notifications/create', {
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
