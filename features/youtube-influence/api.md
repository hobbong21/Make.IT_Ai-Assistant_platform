# youtube-influence API

## 엔드포인트

### POST POST /api/data/youtube/influence

YouTube 채널의 영향력 지표를 분석합니다.

**인증**: Required (Bearer JWT)

**요청 필드**:
| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `channelUrl` | string | Yes | YouTube 채널 URL |
| `includeMetrics` | array | No | 수집할 메트릭 (subscribers, views, engagement) |


**응답 (200 OK)**:
```json
{"channelId": "UCXXXXXX", "subscribers": 150000, "totalViews": 25000000, "avgViews": 45000, "engagementRate": 0.087, "influenceIndex": 8.7}
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
curl -X POST http://localhost:8080POST /api/data/youtube/influence \
  -H "Authorization: Bearer {access_token}" \
  -H "Content-Type: application/json" \
  -d '{}'
```

### JavaScript 예제

```javascript
const response = await fetch('POST /api/data/youtube/influence', {
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
