# MaKIT — API Contracts (OpenAPI 3.0)

**Author**: architect agent
**Date**: 2026-04-20
**Status**: Accepted (v1 baseline)

All endpoints use camelCase JSON, Bearer JWT auth (except login/register/health), and the common `ApiErrorResponse` on failure. `X-Request-Id` header is echoed on every response.

Port: **8083** (matches `login.html` hardcoded base URL).

## Conventions

- All request/response bodies are JSON unless noted (`multipart/form-data` for image upload).
- Field nullability is explicit. `required: [...]` lists mandatory fields. Anything not required is nullable.
- Dates: ISO-8601 UTC (`2026-04-20T12:00:00Z`).
- Pagination: `?page=0&size=20&sort=createdAt,desc`.
- Async endpoints return `202 Accepted` with `{jobId, statusUrl}`. Poll the status URL.
- Error codes follow `DOMAIN_ERROR_NAME`, e.g. `AUTH_INVALID_CREDENTIALS`, `AI_BEDROCK_TIMEOUT`, `VALIDATION_FAILED`.

## HTTP Status usage

| Status | When |
|---|---|
| 200 | Successful GET / sync POST returning a resource |
| 201 | Resource created (register) |
| 202 | Async job accepted |
| 400 | Validation or malformed body |
| 401 | Missing/invalid JWT |
| 403 | Authenticated but lacks role |
| 404 | Resource or job not found |
| 409 | Conflict (duplicate email on register) |
| 429 | Rate limit exceeded — includes `Retry-After` |
| 500 | Unhandled server error |

---

## OpenAPI 3.0

```yaml
openapi: 3.0.3
info:
  title: MaKIT AI Marketing Platform API
  version: 1.0.0
  description: Unified REST API for AX Data Intelligence, AX Marketing Intelligence, AX Commerce Brain.
servers:
  - url: http://localhost:8083
    description: Local dev
  - url: https://api.makit.example.com
    description: Production

tags:
  - name: auth
  - name: data
  - name: marketing
  - name: commerce
  - name: jobs
  - name: health

security:
  - bearerAuth: []

paths:

  # ============================================================
  # AUTH
  # ============================================================
  /api/auth/login:
    post:
      tags: [auth]
      security: []
      summary: Password login, returns JWT access + refresh tokens
      requestBody:
        required: true
        content:
          application/json:
            schema: { $ref: '#/components/schemas/LoginRequest' }
      responses:
        '200':
          description: OK
          content:
            application/json:
              schema: { $ref: '#/components/schemas/LoginResponse' }
        '400': { $ref: '#/components/responses/BadRequest' }
        '401': { $ref: '#/components/responses/Unauthorized' }
        '429': { $ref: '#/components/responses/TooManyRequests' }

  /api/auth/register:
    post:
      tags: [auth]
      security: []
      summary: Create a new user account
      requestBody:
        required: true
        content:
          application/json:
            schema: { $ref: '#/components/schemas/RegisterRequest' }
      responses:
        '201':
          description: Created
          content:
            application/json:
              schema: { $ref: '#/components/schemas/UserDto' }
        '400': { $ref: '#/components/responses/BadRequest' }
        '409': { $ref: '#/components/responses/Conflict' }

  /api/auth/me:
    get:
      tags: [auth]
      summary: Current user from JWT
      responses:
        '200':
          description: OK
          content:
            application/json:
              schema: { $ref: '#/components/schemas/UserDto' }
        '401': { $ref: '#/components/responses/Unauthorized' }

  /api/auth/logout:
    post:
      tags: [auth]
      summary: Invalidate access + refresh tokens (blacklist jti)
      responses:
        '204': { description: No Content }
        '401': { $ref: '#/components/responses/Unauthorized' }

  /api/auth/refresh:
    post:
      tags: [auth]
      security: []
      summary: Exchange refresh token for new access token
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [refreshToken]
              properties:
                refreshToken: { type: string }
      responses:
        '200':
          description: OK
          content:
            application/json:
              schema: { $ref: '#/components/schemas/LoginResponse' }
        '401': { $ref: '#/components/responses/Unauthorized' }

  # ============================================================
  # DATA INTELLIGENCE
  # ============================================================
  /api/data/nlp/analyze:
    post:
      tags: [data]
      summary: Natural-language analysis (sentiment, entities, summary)
      requestBody:
        required: true
        content:
          application/json:
            schema: { $ref: '#/components/schemas/NlpAnalyzeRequest' }
      responses:
        '200':
          description: OK
          content:
            application/json:
              schema: { $ref: '#/components/schemas/NlpAnalyzeResponse' }
        '400': { $ref: '#/components/responses/BadRequest' }
        '401': { $ref: '#/components/responses/Unauthorized' }
        '429': { $ref: '#/components/responses/TooManyRequests' }

  /api/data/youtube/comments:
    post:
      tags: [data]
      summary: Analyze comments of a YouTube video
      requestBody:
        required: true
        content:
          application/json:
            schema: { $ref: '#/components/schemas/YoutubeCommentsRequest' }
      responses:
        '200':
          description: OK
          content:
            application/json:
              schema: { $ref: '#/components/schemas/YoutubeCommentsResponse' }
        '202': { $ref: '#/components/responses/JobAccepted' }
        '400': { $ref: '#/components/responses/BadRequest' }
        '401': { $ref: '#/components/responses/Unauthorized' }

  /api/data/youtube/influence:
    post:
      tags: [data]
      summary: Compute influence metrics of a channel/video
      requestBody:
        required: true
        content:
          application/json:
            schema: { $ref: '#/components/schemas/YoutubeInfluenceRequest' }
      responses:
        '200':
          description: OK
          content:
            application/json:
              schema: { $ref: '#/components/schemas/YoutubeInfluenceResponse' }
        '400': { $ref: '#/components/responses/BadRequest' }

  /api/data/url/analyze:
    post:
      tags: [data]
      summary: Fetch a URL and analyze page content
      requestBody:
        required: true
        content:
          application/json:
            schema: { $ref: '#/components/schemas/UrlAnalyzeRequest' }
      responses:
        '200':
          description: OK
          content:
            application/json:
              schema: { $ref: '#/components/schemas/UrlAnalyzeResponse' }

  /api/data/youtube/keyword-search:
    post:
      tags: [data]
      summary: Find channels matching keyword set
      requestBody:
        required: true
        content:
          application/json:
            schema: { $ref: '#/components/schemas/YoutubeKeywordSearchRequest' }
      responses:
        '200':
          description: OK
          content:
            application/json:
              schema: { $ref: '#/components/schemas/YoutubeKeywordSearchResponse' }

  /api/data/jobs/{jobId}:
    get:
      tags: [jobs]
      summary: Job status (data domain)
      parameters:
        - { in: path, name: jobId, required: true, schema: { type: string, format: uuid } }
      responses:
        '200':
          description: OK
          content: { application/json: { schema: { $ref: '#/components/schemas/JobStatusResponse' } } }
        '404': { $ref: '#/components/responses/NotFound' }

  # ============================================================
  # MARKETING INTELLIGENCE
  # ============================================================
  /api/marketing/feed/generate:
    post:
      tags: [marketing]
      summary: Generate Instagram feed post (caption + hashtags + image prompt)
      requestBody:
        required: true
        content:
          application/json:
            schema: { $ref: '#/components/schemas/InstagramFeedRequest' }
      responses:
        '200':
          description: OK (sync mode, text only)
          content:
            application/json:
              schema: { $ref: '#/components/schemas/InstagramFeedResponse' }
        '202':
          description: Accepted (when includeImage=true)
          content:
            application/json:
              schema: { $ref: '#/components/schemas/JobAcceptedResponse' }
        '400': { $ref: '#/components/responses/BadRequest' }
        '429': { $ref: '#/components/responses/TooManyRequests' }

  /api/marketing/image/remove-bg:
    post:
      tags: [marketing]
      summary: Remove background from uploaded image
      requestBody:
        required: true
        content:
          multipart/form-data:
            schema:
              type: object
              required: [file]
              properties:
                file:
                  type: string
                  format: binary
                outputFormat:
                  type: string
                  enum: [png, webp]
                  default: png
      responses:
        '200':
          description: OK
          content:
            application/json:
              schema: { $ref: '#/components/schemas/ImageResultResponse' }
        '400': { $ref: '#/components/responses/BadRequest' }

  /api/marketing/jobs/{jobId}:
    get:
      tags: [jobs]
      summary: Job status (marketing domain)
      parameters:
        - { in: path, name: jobId, required: true, schema: { type: string, format: uuid } }
      responses:
        '200': { description: OK, content: { application/json: { schema: { $ref: '#/components/schemas/JobStatusResponse' } } } }
        '404': { $ref: '#/components/responses/NotFound' }

  # ============================================================
  # COMMERCE BRAIN
  # ============================================================
  /api/commerce/chatbot/message:
    post:
      tags: [commerce]
      summary: Send a chatbot message (sync, non-streaming)
      requestBody:
        required: true
        content:
          application/json:
            schema: { $ref: '#/components/schemas/ChatMessageRequest' }
      responses:
        '200':
          description: OK
          content:
            application/json:
              schema: { $ref: '#/components/schemas/ChatMessageResponse' }
        '400': { $ref: '#/components/responses/BadRequest' }
        '401': { $ref: '#/components/responses/Unauthorized' }

  /api/commerce/chatbot/stream:
    post:
      tags: [commerce]
      summary: Stream chatbot tokens via SSE
      requestBody:
        required: true
        content:
          application/json:
            schema: { $ref: '#/components/schemas/ChatMessageRequest' }
      responses:
        '200':
          description: SSE stream of ChatStreamChunk events
          content:
            text/event-stream:
              schema: { $ref: '#/components/schemas/ChatStreamChunk' }

  /api/commerce/reviews/{productId}/analyze:
    post:
      tags: [commerce]
      summary: Analyze all reviews for a product (sentiment + themes + improvements)
      parameters:
        - { in: path, name: productId, required: true, schema: { type: string } }
      requestBody:
        required: false
        content:
          application/json:
            schema: { $ref: '#/components/schemas/ReviewAnalysisRequest' }
      responses:
        '200':
          description: OK
          content:
            application/json:
              schema: { $ref: '#/components/schemas/ReviewAnalysisResponse' }
        '202': { $ref: '#/components/responses/JobAccepted' }
        '404': { $ref: '#/components/responses/NotFound' }

  /api/commerce/modelshot/generate:
    post:
      tags: [commerce]
      summary: Generate product + model-shot composite image (async)
      requestBody:
        required: true
        content:
          application/json:
            schema: { $ref: '#/components/schemas/ModelshotRequest' }
      responses:
        '202':
          description: Accepted
          content:
            application/json:
              schema: { $ref: '#/components/schemas/JobAcceptedResponse' }
        '400': { $ref: '#/components/responses/BadRequest' }
        '429': { $ref: '#/components/responses/TooManyRequests' }

  /api/commerce/jobs/{jobId}:
    get:
      tags: [jobs]
      summary: Job status (commerce domain)
      parameters:
        - { in: path, name: jobId, required: true, schema: { type: string, format: uuid } }
      responses:
        '200': { description: OK, content: { application/json: { schema: { $ref: '#/components/schemas/JobStatusResponse' } } } }
        '404': { $ref: '#/components/responses/NotFound' }

  # ============================================================
  # HEALTH
  # ============================================================
  /actuator/health:
    get:
      tags: [health]
      security: []
      summary: Liveness
      responses:
        '200': { description: UP }

  /actuator/info:
    get:
      tags: [health]
      security: []
      summary: Build info
      responses:
        '200': { description: OK }

components:
  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT

  responses:
    BadRequest:
      description: Validation failed
      content:
        application/json:
          schema: { $ref: '#/components/schemas/ApiErrorResponse' }
    Unauthorized:
      description: Missing or invalid credentials
      content:
        application/json:
          schema: { $ref: '#/components/schemas/ApiErrorResponse' }
    Forbidden:
      description: Authenticated but lacks role
      content:
        application/json:
          schema: { $ref: '#/components/schemas/ApiErrorResponse' }
    NotFound:
      description: Resource not found
      content:
        application/json:
          schema: { $ref: '#/components/schemas/ApiErrorResponse' }
    Conflict:
      description: Conflict with existing resource
      content:
        application/json:
          schema: { $ref: '#/components/schemas/ApiErrorResponse' }
    TooManyRequests:
      description: Rate limited
      headers:
        Retry-After: { schema: { type: integer } }
      content:
        application/json:
          schema: { $ref: '#/components/schemas/ApiErrorResponse' }
    JobAccepted:
      description: Long-running; poll statusUrl
      content:
        application/json:
          schema: { $ref: '#/components/schemas/JobAcceptedResponse' }

  schemas:

    # ---- Common ------------------------------------------------
    ApiErrorResponse:
      type: object
      required: [errorCode, message, timestamp, requestId]
      properties:
        errorCode: { type: string, example: VALIDATION_FAILED }
        message: { type: string, example: "email must be a valid email" }
        details: { type: string, nullable: true }
        timestamp: { type: string, format: date-time }
        requestId: { type: string, format: uuid }
        metadata:
          type: object
          additionalProperties: true
          nullable: true

    PageResponse:
      type: object
      required: [page, size, totalElements, totalPages, content]
      properties:
        page: { type: integer, example: 0 }
        size: { type: integer, example: 20 }
        totalElements: { type: integer, format: int64, example: 137 }
        totalPages: { type: integer, example: 7 }
        content:
          type: array
          items: { type: object }

    JobAcceptedResponse:
      type: object
      required: [jobId, statusUrl, status]
      properties:
        jobId: { type: string, format: uuid }
        statusUrl: { type: string, example: "/api/commerce/jobs/7f...-..." }
        status: { type: string, enum: [PENDING, RUNNING] }

    JobStatusResponse:
      type: object
      required: [jobId, status, domain, operation, startedAt]
      properties:
        jobId: { type: string, format: uuid }
        status: { type: string, enum: [PENDING, RUNNING, SUCCESS, FAILED] }
        domain: { type: string, enum: [data, marketing, commerce] }
        operation: { type: string }
        startedAt: { type: string, format: date-time }
        completedAt: { type: string, format: date-time, nullable: true }
        result:
          type: object
          additionalProperties: true
          nullable: true
        errorMessage: { type: string, nullable: true }

    # ---- Auth --------------------------------------------------
    LoginRequest:
      type: object
      required: [email, password]
      properties:
        email: { type: string, format: email, example: marketer@example.com }
        password: { type: string, minLength: 8, example: password123 }

    LoginResponse:
      type: object
      required: [token, refreshToken, tokenType, expiresInSec, user]
      properties:
        token: { type: string }
        refreshToken: { type: string }
        tokenType: { type: string, example: Bearer }
        expiresInSec: { type: integer, example: 900 }
        user: { $ref: '#/components/schemas/UserDto' }

    RegisterRequest:
      type: object
      required: [email, password, name]
      properties:
        email: { type: string, format: email }
        password: { type: string, minLength: 8 }
        name: { type: string, maxLength: 80 }
        companyId: { type: string, nullable: true }
        role:
          type: string
          enum: [ADMIN, MARKETING_MANAGER, CONTENT_CREATOR, ANALYST, VIEWER]
          default: VIEWER

    UserDto:
      type: object
      required: [id, email, name, role, isActive, createdAt]
      properties:
        id: { type: string, format: uuid }
        email: { type: string, format: email }
        name: { type: string }
        role: { type: string, enum: [ADMIN, MARKETING_MANAGER, CONTENT_CREATOR, ANALYST, VIEWER] }
        companyId: { type: string, nullable: true }
        isActive: { type: boolean }
        lastLoginAt: { type: string, format: date-time, nullable: true }
        createdAt: { type: string, format: date-time }

    # ---- Data --------------------------------------------------
    NlpAnalyzeRequest:
      type: object
      required: [text]
      properties:
        text: { type: string, minLength: 1, maxLength: 20000 }
        tasks:
          type: array
          items: { type: string, enum: [SENTIMENT, ENTITIES, KEYWORDS, SUMMARY, CATEGORY] }
          default: [SENTIMENT, KEYWORDS, SUMMARY]
        language: { type: string, default: ko }

    NlpAnalyzeResponse:
      type: object
      required: [sentiment, keywords, summary]
      properties:
        sentiment:
          type: object
          required: [label, score]
          properties:
            label: { type: string, enum: [POSITIVE, NEGATIVE, NEUTRAL, MIXED] }
            score: { type: number, format: float }
        entities:
          type: array
          nullable: true
          items:
            type: object
            properties:
              text: { type: string }
              type: { type: string }
              score: { type: number }
        keywords:
          type: array
          items: { type: string }
        summary: { type: string }
        category: { type: string, nullable: true }
        model: { type: string, example: "anthropic.claude-3-haiku-20240307" }

    YoutubeCommentsRequest:
      type: object
      required: [videoUrl]
      properties:
        videoUrl: { type: string, format: uri }
        maxComments: { type: integer, default: 200, maximum: 2000 }
        async: { type: boolean, default: false }

    YoutubeCommentsResponse:
      type: object
      required: [videoId, totalAnalyzed, sentimentDistribution, topThemes]
      properties:
        videoId: { type: string }
        totalAnalyzed: { type: integer }
        sentimentDistribution:
          type: object
          properties:
            positive: { type: number }
            negative: { type: number }
            neutral: { type: number }
        topThemes:
          type: array
          items:
            type: object
            properties:
              theme: { type: string }
              count: { type: integer }
              sampleComments: { type: array, items: { type: string } }
        toxicity: { type: number, nullable: true }

    YoutubeInfluenceRequest:
      type: object
      required: [channelId]
      properties:
        channelId: { type: string }
        windowDays: { type: integer, default: 30 }

    YoutubeInfluenceResponse:
      type: object
      required: [channelId, influenceScore, metrics]
      properties:
        channelId: { type: string }
        influenceScore: { type: number, format: float, minimum: 0, maximum: 100 }
        tier: { type: string, enum: [MEGA, MACRO, MID, MICRO, NANO] }
        metrics:
          type: object
          properties:
            subscribers: { type: integer }
            avgViews: { type: number }
            avgEngagementRate: { type: number }
            uploadCadenceDays: { type: number }

    UrlAnalyzeRequest:
      type: object
      required: [url]
      properties:
        url: { type: string, format: uri }
        extractMode: { type: string, enum: [READER, FULL_HTML], default: READER }

    UrlAnalyzeResponse:
      type: object
      required: [url, title, summary]
      properties:
        url: { type: string }
        title: { type: string }
        summary: { type: string }
        keywords: { type: array, items: { type: string } }
        wordCount: { type: integer }
        language: { type: string, nullable: true }

    YoutubeKeywordSearchRequest:
      type: object
      required: [keywords]
      properties:
        keywords:
          type: array
          items: { type: string }
          minItems: 1
          maxItems: 10
        regionCode: { type: string, default: KR }
        maxResults: { type: integer, default: 20, maximum: 50 }

    YoutubeKeywordSearchResponse:
      type: object
      required: [keywords, channels]
      properties:
        keywords: { type: array, items: { type: string } }
        channels:
          type: array
          items:
            type: object
            properties:
              channelId: { type: string }
              title: { type: string }
              subscriberCount: { type: integer }
              relevanceScore: { type: number }
              sampleVideoTitles: { type: array, items: { type: string } }

    # ---- Marketing --------------------------------------------
    InstagramFeedRequest:
      type: object
      required: [brief]
      properties:
        brief: { type: string, maxLength: 4000 }
        brandTone: { type: string, enum: [FRIENDLY, LUXURY, PLAYFUL, FORMAL, CASUAL], default: FRIENDLY }
        targetAudience: { type: string, nullable: true }
        locale: { type: string, default: ko-KR }
        hashtagCount: { type: integer, default: 10, maximum: 30 }
        includeImage: { type: boolean, default: false }

    InstagramFeedResponse:
      type: object
      required: [caption, hashtags]
      properties:
        caption: { type: string }
        hashtags: { type: array, items: { type: string } }
        imagePrompt: { type: string, nullable: true }
        imageUrl: { type: string, format: uri, nullable: true }

    ImageResultResponse:
      type: object
      required: [imageUrl, mimeType]
      properties:
        imageUrl: { type: string, format: uri }
        mimeType: { type: string, example: image/png }
        widthPx: { type: integer, nullable: true }
        heightPx: { type: integer, nullable: true }
        sizeBytes: { type: integer, nullable: true }

    # ---- Commerce ---------------------------------------------
    ChatMessageRequest:
      type: object
      required: [message]
      properties:
        message: { type: string, minLength: 1, maxLength: 8000 }
        contextId: { type: string, nullable: true, description: "Omit to open new context" }
        useRag: { type: boolean, default: true }
        temperature: { type: number, format: float, default: 0.3, minimum: 0, maximum: 1 }

    ChatMessageResponse:
      type: object
      required: [contextId, reply, role]
      properties:
        contextId: { type: string }
        reply: { type: string }
        role: { type: string, enum: [ASSISTANT] }
        citations:
          type: array
          nullable: true
          items:
            type: object
            properties:
              documentId: { type: string }
              chunkIndex: { type: integer }
              score: { type: number }
              snippet: { type: string }
        usage:
          type: object
          properties:
            tokensIn: { type: integer }
            tokensOut: { type: integer }

    ChatStreamChunk:
      type: object
      required: [event, data]
      properties:
        event: { type: string, enum: [delta, citation, done, error] }
        data: { type: string, description: "For delta: token fragment. For citation: JSON string. For done: final usage JSON. For error: message." }

    ReviewAnalysisRequest:
      type: object
      properties:
        since: { type: string, format: date, nullable: true }
        includeImprovementPoints: { type: boolean, default: true }

    ReviewAnalysisResponse:
      type: object
      required: [productId, reviewCount, overallSentiment, themes]
      properties:
        productId: { type: string }
        reviewCount: { type: integer }
        overallSentiment:
          type: object
          properties:
            score: { type: number }
            label: { type: string, enum: [POSITIVE, NEGATIVE, NEUTRAL, MIXED] }
        themes:
          type: array
          items:
            type: object
            properties:
              theme: { type: string }
              frequency: { type: integer }
              sentiment: { type: string, enum: [POSITIVE, NEGATIVE, NEUTRAL] }
        improvementPoints:
          type: array
          nullable: true
          items: { type: string }

    ModelshotRequest:
      type: object
      required: [productImageUrl, modelAttributes]
      properties:
        productImageUrl: { type: string, format: uri }
        modelAttributes:
          type: object
          properties:
            gender: { type: string, enum: [FEMALE, MALE, NEUTRAL] }
            ageRange: { type: string, example: "25-34" }
            ethnicity: { type: string, nullable: true }
            pose: { type: string, nullable: true }
        background:
          type: string
          enum: [STUDIO_WHITE, OUTDOOR, LIFESTYLE, CUSTOM]
          default: STUDIO_WHITE
        customPrompt: { type: string, nullable: true }
        resolution:
          type: string
          enum: ["512x512", "1024x1024", "1024x1792"]
          default: "1024x1024"
```

---

## Notes for implementers

- **frontend-engineer**: Replace hardcoded `http://localhost:8083/api` in `login.html` with a runtime-configurable base in `api.js`. All calls must attach `Authorization: Bearer ${localStorage.makit_token}` header except `/auth/login`, `/auth/register`, `/auth/refresh`.
- **backend-engineer**: Use `@Valid` + `jakarta.validation` annotations on DTOs matching the `required` lists above. Global `@ControllerAdvice` maps exceptions to `ApiErrorResponse`.
- **ai-engineer**: Streaming endpoint emits `ServerSentEvent<ChatStreamChunk>`; heartbeat every 15s as `event: ping`.
- **devops-engineer**: Expose Springdoc at `/swagger-ui.html` and `/v3/api-docs`. Rate-limit `/api/auth/login` at 10/min per IP independent of user rules.
