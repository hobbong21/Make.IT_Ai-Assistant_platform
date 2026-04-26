# remove-bg API

## 엔드포인트

### POST POST /api/marketing/remove-bg

이미지의 배경을 제거하여 투명 배경 PNG를 생성합니다.

**인증**: Required (Bearer JWT)

**요청 필드**:
| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `imageUrl` | string | Yes | 제거할 이미지 URL |
| `outputFormat` | string | No | 출력 형식 (png, jpg) |


**응답 (200 OK)**:
```json
{"jobId": "remove-bg-uuid", "status": "completed", "outputUrl": "https://s3.../output.png", "processingTime": 2500}
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
curl -X POST http://localhost:8080POST /api/marketing/remove-bg \
  -H "Authorization: Bearer {access_token}" \
  -H "Content-Type: application/json" \
  -d '{}'
```

### JavaScript 예제

```javascript
const response = await fetch('POST /api/marketing/remove-bg', {
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
