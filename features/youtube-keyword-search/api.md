# youtube-keyword-search API

## 엔드포인트

### POST POST /api/data/youtube/keyword-search

YouTube에서 키워드별 트렌드 및 경쟁도를 분석합니다.

**인증**: Required (Bearer JWT)

**요청 필드**:
| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `keyword` | string | Yes | 검색 키워드 |
| `region` | string | No | 지역 코드 (기본값: KR) |


**응답 (200 OK)**:
```json
{"keyword": "AI 마케팅", "monthlySearchVolume": 5400, "competitionLevel": "medium", "trendDirection": "up", "topicsRelated": ["AI 챗봇", "자동 마케팅", "머신러닝"], "topVideos": [{"title": "...", "views": 1000000}]}
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
curl -X POST http://localhost:8080POST /api/data/youtube/keyword-search \
  -H "Authorization: Bearer {access_token}" \
  -H "Content-Type: application/json" \
  -d '{}'
```

### JavaScript 예제

```javascript
const response = await fetch('POST /api/data/youtube/keyword-search', {
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
