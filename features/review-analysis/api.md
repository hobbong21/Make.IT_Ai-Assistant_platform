# review-analysis API

## 엔드포인트

### POST POST /api/commerce/review-analysis

상품 리뷰의 감정 분석 및 개선 사항을 도출합니다.

**인증**: Required (Bearer JWT)

**요청 필드**:
| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `productId` | string | Yes | 상품 ID |
| `limit` | integer | No | 분석할 리뷰 수 (기본값: 50) |


**응답 (200 OK)**:
```json
{"totalReviews": 150, "sentiment": {"positive": 0.72, "neutral": 0.18, "negative": 0.1}, "mainComplaints": ["배송 느림", "크기 작음"], "mainPraise": ["좋은 품질", "맞는 사이즈"], "improvements": ["배송 방식 개선", "사이즈 가이드 보강"]}
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
curl -X POST http://localhost:8080POST /api/commerce/review-analysis \
  -H "Authorization: Bearer {access_token}" \
  -H "Content-Type: application/json" \
  -d '{}'
```

### JavaScript 예제

```javascript
const response = await fetch('POST /api/commerce/review-analysis', {
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
