# ---- Build stage ----
FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /build

# Dependency cache layer
COPY pom.xml .
RUN mvn -B dependency:go-offline

# Source & build
COPY src ./src
RUN mvn -B clean package -DskipTests

# ---- Runtime stage ----
FROM eclipse-temurin:21-jre-alpine
WORKDIR /app

RUN apk add --no-cache wget curl && \
    addgroup -S spring && adduser -S spring -G spring

COPY --from=build /build/target/*.jar app.jar
RUN chown spring:spring app.jar

USER spring

EXPOSE 8083

HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD wget -qO- http://localhost:8083/actuator/health | grep -q '"status":"UP"' || exit 1

ENV JAVA_OPTS="-XX:+UseContainerSupport -XX:MaxRAMPercentage=75.0"
ENV SERVER_PORT=8083

ENTRYPOINT ["sh","-c","java $JAVA_OPTS -jar app.jar"]
