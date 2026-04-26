# modelshot API

## 엔드포인트

### POST POST /api/commerce/modelshot

상품 설명으로 모델 이미지를 AI 생성합니다.

**인증**: Required (Bearer JWT)

**요청 필드**:
| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `description` | string | Yes | 상품 설명 (예: 여름 셔츠, 검은색) |
| `count` | integer | No | 생성할 이미지 수 (기본값: 5) |


**응답 (200 OK)**:
```json
{"jobId": "modelshot-uuid", "status": "completed", "imageUrls": ["https://s3.../modelshot1.jpg", "https://s3.../modelshot2.jpg"], "createdAt": "2026-04-26T12:30:00+09:00"}
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
curl -X POST http://localhost:8080POST /api/commerce/modelshot \
  -H "Authorization: Bearer {access_token}" \
  -H "Content-Type: application/json" \
  -d '{}'
```

### JavaScript 예제

```javascript
const response = await fetch('POST /api/commerce/modelshot', {
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
