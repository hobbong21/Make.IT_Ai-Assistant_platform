# url-analyze API

## 엔드포인트

### POST POST /api/data/url/analyze

웹페이지 URL의 SEO 점수 및 개선 사항을 제시합니다.

**인증**: Required (Bearer JWT)

**요청 필드**:
| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `url` | string | Yes | 분석할 웹페이지 URL |
| `depth` | integer | No | 내부 링크 추출 깊이 (기본값: 1) |


**응답 (200 OK)**:
```json
{"url": "https://example.com/page", "title": "페이지 제목", "metaDescription": "메타 설명", "keywords": ["키워드1", "키워드2"], "headingStructure": {"h1": 1, "h2": 5, "h3": 12}, "seoScore": 85, "improvements": ["메타 키워드 추가", "내부 링크 강화"]}
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
curl -X POST http://localhost:8080POST /api/data/url/analyze \
  -H "Authorization: Bearer {access_token}" \
  -H "Content-Type: application/json" \
  -d '{}'
```

### JavaScript 예제

```javascript
const response = await fetch('POST /api/data/url/analyze', {
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
