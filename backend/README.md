# MaKIT Backend

Spring Boot 3.2 + Java 21 backend for the MaKIT AI Marketing Platform.

## Run locally (dev)

```bash
export JWT_SECRET=$(openssl rand -base64 48)
export SPRING_DATASOURCE_URL=jdbc:postgresql://localhost:5432/makit
export SPRING_DATASOURCE_USERNAME=makit_user
export SPRING_DATASOURCE_PASSWORD=makit_pwd
mvn spring-boot:run
```

API: `http://localhost:8083`
Swagger UI: `http://localhost:8083/swagger-ui.html`

## Profiles

- `default` — local dev
- `docker` — compose
- `prod` — AWS
- `mock` — AI disabled, stubs return deterministic data

## Build

```bash
mvn clean package
java -jar target/makit.jar
```
