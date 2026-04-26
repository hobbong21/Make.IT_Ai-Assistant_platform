# chatbot API

## 엔드포인트

### POST POST /api/commerce/chatbot/stream

RAG 기반 고객 상담 챗봇과 실시간 스트리밍 답변을 제공합니다.

**인증**: Required (Bearer JWT)

**요청 필드**:
| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `message` | string | Yes | 사용자 질문 |
| `context` | string | No | 페이지 컨텍스트 (상품, 주문 등) |


**응답 (200 OK)**:
```json
실시간 스트리밍 (Server-Sent Events) — 답변이 부분적으로 전송됨
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
curl -X POST http://localhost:8080POST /api/commerce/chatbot/stream \
  -H "Authorization: Bearer {access_token}" \
  -H "Content-Type: application/json" \
  -d '{}'
```

### JavaScript 예제

```javascript
const response = await fetch('POST /api/commerce/chatbot/stream', {
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
