# 유튜브 댓글 분석 API

## 엔드포인트

### POST /api/data/youtube/comments

YouTube 비디오의 댓글을 분석하고 감정 분석 결과를 반환합니다.

**인증**: Required (Bearer JWT)

**요청**:
```json
{
  "videoUrl": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  "maxComments": 100,
  "async": false
}
```

**요청 필드**:
| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `videoUrl` | string | Yes | YouTube 비디오 URL (v= 파라미터 포함) |
| `maxComments` | integer | No | 수집할 최대 댓글 수 (기본값: 100) |
| `async` | boolean | No | 비동기 처리 여부 (기본값: false) |

**응답 (200 OK)**:
```json
{
  "videoId": "dQw4w9WgXcQ",
  "totalComments": 150,
  "sentiment": {
    "positive": 0.65,
    "neutral": 0.20,
    "negative": 0.15
  },
  "themes": [
    "UI/UX 피드백",
    "기능 요청",
    "버그 리포트"
  ],
  "summary": "사용자들이 주로 새로운 대시보드 UI를 긍정적으로 평가하고 있으며, 다크모드 기능 추가를 요청하는 댓글이 많습니다.",
  "analyzedAt": "2026-04-26T12:30:45+09:00"
}
```

**오류 응답**:
| 상태 | 설명 | 예시 |
|------|------|------|
| 400 | 잘못된 URL 형식 | "Invalid YouTube URL format" |
| 401 | 인증 필요 | "Missing or expired token" |
| 429 | 요청 초과 | "Bedrock API rate limit exceeded" |
| 500 | 서버 오류 | "Bedrock service unavailable" |

---

## 사용 예시

### cURL 예제

```bash
curl -X POST http://localhost:8080/api/data/youtube/comments \
  -H "Authorization: Bearer {access_token}" \
  -H "Content-Type: application/json" \
  -d '{
    "videoUrl": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    "maxComments": 100,
    "async": false
  }'
```

### JavaScript 예제

```javascript
const response = await fetch('/api/data/youtube/comments', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    videoUrl: 'https://www.youtube.com/watch?v=...',
    maxComments: 100,
    async: false
  })
});

const result = await response.json();
console.log('감정 분석:', result.sentiment);
```

---

## 응답 필드 설명

| 필드 | 타입 | 설명 |
|------|------|------|
| `videoId` | string | 추출된 YouTube 비디오 ID |
| `totalComments` | integer | 분석된 댓글의 총 개수 |
| `sentiment.positive` | number | 긍정 댓글 비율 (0.0~1.0) |
| `sentiment.neutral` | number | 중립 댓글 비율 (0.0~1.0) |
| `sentiment.negative` | number | 부정 댓글 비율 (0.0~1.0) |
| `themes` | array | 주요 주제 또는 클러스터 |
| `summary` | string | AI 생성 분석 요약 (Bedrock Claude) |
| `analyzedAt` | ISO8601 | 분석 수행 시간 |

---

## 인증

모든 엔드포인트는 JWT Bearer 토큰이 필수입니다.

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

토큰 갱신: POST `/api/auth/refresh`

---

## 속도 제한

- 기본 사용자: 100 requests/min
- 인증된 사용자: 300 requests/min

초과 시 429 Too Many Requests 응답.

---

## 제약사항

- YouTube Data API v3 통합은 향후 라운드에서 구현 예정
- 현재는 stub 응답 반환 (실제 댓글 수집 미지원)
- Bedrock Claude 통합은 prompt 정의 및 RAG 벡터 저장소 필요
