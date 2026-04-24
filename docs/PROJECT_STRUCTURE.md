# MaKIT 프로젝트 구조

## 📁 디렉토리 구조

```
Make.IT_Ai-Assistant_platform/
├── backend/                    # Spring Boot 백엔드 애플리케이션
│   ├── src/
│   │   ├── main/
│   │   │   ├── java/com/Human/Ai/D/makit/
│   │   │   │   ├── annotation/     # 커스텀 어노테이션
│   │   │   │   ├── aspect/         # AOP 관련 클래스
│   │   │   │   ├── config/         # 설정 클래스들
│   │   │   │   ├── controller/     # REST 컨트롤러
│   │   │   │   ├── domain/         # JPA 엔티티
│   │   │   │   ├── dto/            # 데이터 전송 객체
│   │   │   │   ├── model/          # 비즈니스 모델
│   │   │   │   ├── repository/     # 데이터 접근 계층
│   │   │   │   ├── service/        # 비즈니스 로직
│   │   │   │   └── MakitApplication.java
│   │   │   └── resources/
│   │   │       ├── application.yml
│   │   │       ├── application-docker.yml
│   │   │       └── db/migration/   # 데이터베이스 마이그레이션
│   │   └── test/                   # 테스트 코드 (57개 파일)
│   ├── Dockerfile
│   └── pom.xml
├── frontend/                   # 프론트엔드 웹 애플리케이션
│   ├── css/                    # 스타일시트
│   │   ├── styles.css
│   │   ├── all-services-styles.css
│   │   ├── service-detail-styles.css
│   │   └── intro-styles.css
│   ├── js/                     # JavaScript 파일
│   ├── assets/                 # 이미지, 폰트 등 정적 자원
│   ├── index.html              # 메인 대시보드
│   ├── login.html              # 로그인 페이지
│   ├── all-services.html       # 전체 서비스 목록
│   ├── service-detail.html     # 서비스 상세 페이지
│   └── intro.html              # 제품 소개 페이지
├── docs/                       # 프로젝트 문서
│   └── PROJECT_STRUCTURE.md
├── docker-compose.yml          # Docker Compose 설정
├── Dockerfile                  # 프론트엔드 Docker 설정
├── .dockerignore
├── .gitignore
└── README.md                   # 프로젝트 개요 및 설계 문서
```

## 🏗️ 아키텍처 개요

### 백엔드 (Spring Boot)
- **Java 21** 기반
- **Spring Boot 3.2.0** 프레임워크
- **PostgreSQL** 데이터베이스 (개발시 H2)
- **AWS SDK** 통합 (Bedrock, S3, Cognito)
- **Redis** 캐싱
- **JWT** 인증

### 프론트엔드 (Static Web)
- **HTML5/CSS3/JavaScript**
- **반응형 디자인**
- **Nginx** 서버

### 인프라
- **Docker & Docker Compose**
- **AWS 클라우드 서비스**
- **PostgreSQL 데이터베이스**

## 📊 코드 통계

- **백엔드 Java 클래스**: 124개
- **테스트 클래스**: 57개
- **REST 컨트롤러**: 15개
- **서비스 클래스**: 30개+
- **JPA 엔티티**: 15개
- **프론트엔드 페이지**: 5개

## 🚀 실행 방법

### Docker Compose 사용 (권장)
```bash
docker-compose up --build
```

### 개별 실행
```bash
# 백엔드
cd backend
mvn spring-boot:run

# 프론트엔드 (별도 웹서버 필요)
cd frontend
python -m http.server 8000
```

## 📝 주요 기능

### 1. AX Data Intelligence
- 자연어 분석
- 유튜브 댓글 분석
- 웹사이트 URL 분석
- 키워드 채널 검색

### 2. AX Marketing Intelligence
- 인스타그램 피드 생성
- 배경 제거
- 콘텐츠 최적화

### 3. AX Commerce Brain
- AI 챗봇
- 상품 리뷰 분석
- 이미지 + 모델컷 생성

## 🔧 개발 환경 설정

### 필수 요구사항
- Java 21
- Maven 3.6+
- Docker & Docker Compose
- PostgreSQL (프로덕션)

### 환경 변수
```bash
# AWS 설정
AWS_REGION=ap-northeast-2
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key

# 데이터베이스 설정
SPRING_DATASOURCE_URL=jdbc:postgresql://localhost:5432/makit
SPRING_DATASOURCE_USERNAME=makit_user
SPRING_DATASOURCE_PASSWORD=makit_password
```