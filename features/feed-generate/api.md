# feed-generate API

## 엔드포인트

### POST POST /api/marketing/feed-generate

텍스트 주제에서 소셜 미디어 피드 콘텐츠를 생성합니다.

**인증**: Required (Bearer JWT)

**요청 필드**:
| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `topic` | string | Yes | 콘텐츠 주제 |
| `platform` | string | No | 플랫폼 (instagram, tiktok, facebook) |
| `count` | integer | No | 생성할 콘텐츠 수 (기본값: 3) |


**응답 (200 OK)**:
```json
{"jobId": "feed-uuid", "status": "in_progress", "captions": ["캡션1", "캡션2", "캡션3"], "imageUrls": ["https://s3.../img1.jpg", "https://s3.../img2.jpg"], "completedAt": "2026-04-26T12:30:00+09:00"}
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
curl -X POST http://localhost:8080POST /api/marketing/feed-generate \
  -H "Authorization: Bearer {access_token}" \
  -H "Content-Type: application/json" \
  -d '{}'
```

### JavaScript 예제

```javascript
const response = await fetch('POST /api/marketing/feed-generate', {
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
