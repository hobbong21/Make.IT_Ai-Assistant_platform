# pwa API

## 엔드포인트

### N/A N/A (웹 표준)

웹 표준 manifest와 Service Worker로 PWA 기능을 제공합니다.

**인증**: Required (Bearer JWT) (생략 가능)

**요청 필드**:
| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|


**응답 (200 OK)**:
```json
manifest.webmanifest + Service Worker offline 지원
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
curl -X N/A http://localhost:8080N/A (웹 표준) \
  -H "Authorization: Bearer {access_token}" \
  -H "Content-Type: application/json" \
  -d '{}'
```

### JavaScript 예제

```javascript
const response = await fetch('N/A (웹 표준)', {
  method: 'N/A',
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
