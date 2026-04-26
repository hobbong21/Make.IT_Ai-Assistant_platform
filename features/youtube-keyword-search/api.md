# API 명세

## 엔드포인트 목록

### {엔드포인트 그룹명}

#### {메서드} {경로}

> {설명}

**인증**: {required/optional} Bearer JWT

**요청**:
```json
{
  "field": "값",
  "description": "필드 설명"
}
```

**응답 (200 OK)**:
```json
{
  "id": "uuid",
  "status": "success",
  "data": {}
}
```

**오류 응답**:
| 상태 | 설명 | 예시 |
|------|------|------|
| 400 | 잘못된 요청 | Invalid input |
| 401 | 인증 필요 | Missing/expired token |
| 403 | 권한 거부 | Access denied |
| 404 | 찾을 수 없음 | Resource not found |
| 429 | 속도 제한 | Rate limit exceeded |

---

## 요청/응답 예시

### 예시 1: {시나리오}

**요청**:
```bash
curl -X POST http://localhost:8080/api/{path} \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{ "field": "value" }'
```

**응답**:
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "created",
  "data": {
    "field": "value"
  }
}
```

---

## 데이터 타입

| 이름 | 설명 | 예시 |
|------|------|------|
| `UUID` | 고유 식별자 | `550e8400-e29b-41d4-a716-446655440000` |
| `ISO8601` | 타임스탬프 | `2026-04-26T12:00:00+09:00` |
| `Enum` | 열거형 | `DRAFT \| ACTIVE \| COMPLETED` |

---

## 페이지네이션

쿼리 파라미터: `page=0&size=20&sort=createdAt,desc`

응답:
```json
{
  "content": [...],
  "page": 0,
  "size": 20,
  "totalPages": 5,
  "totalElements": 100
}
```

---

## 인증 & 권한

- **필수 헤더**: `Authorization: Bearer {access_token}`
- **토큰 갱신**: POST `/api/auth/refresh` + `RefreshToken` 쿠키
- **역할 기반 접근 (RBAC)**:
  - `ROLE_USER` — 기본 사용자
  - `ROLE_ADMIN` — 관리자 전용 엔드포인트

---

## 속도 제한

- 기본: 100 requests/min
- 인증된 사용자: 300 requests/min
- 관리자: unlimited

초과 시 429 Too Many Requests 응답.

---

## 웹소켓 (실시간)

### 구독 메시지

```javascript
stompClient.subscribe('/user/queue/notifications', (message) => {
  const notification = JSON.parse(message.body);
  console.log('새로운 알림:', notification);
});
```

### 발행 메시지

```javascript
stompClient.send('/app/{topic}', {}, JSON.stringify(payload));
```

---

## 파일 업로드

**Content-Type**: `multipart/form-data`

```bash
curl -X POST http://localhost:8080/api/{path}/upload \
  -H "Authorization: Bearer {token}" \
  -F "file=@/path/to/file"
```

응답:
```json
{
  "id": "file-uuid",
  "filename": "example.jpg",
  "size": 102400,
  "url": "https://s3.amazonaws.com/bucket/path/example.jpg"
}
```
