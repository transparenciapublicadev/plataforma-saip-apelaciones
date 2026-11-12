# syntax=docker/dockerfile:1
FROM eclipse-temurin:25-jdk-noble AS build
WORKDIR /build
RUN set -eux; \
    for attempt in 1 2 3; do \
      apt-get update && apt-get install -y --no-install-recommends curl && break; \
      if [ "$attempt" = 3 ]; then exit 1; fi; \
      sleep 8; \
    done; \
    rm -rf /var/lib/apt/lists/*
COPY .mvn/ .mvn/
COPY mvnw pom.xml ./
RUN sed -i 's/\r$//' mvnw && chmod +x mvnw
COPY src/main/ src/main/
# This production artifact has no development JWT fallback (source stays intact).
RUN sed -i '/^jwt.secret=/d' src/main/resources/application.properties
# Tests run on the reviewed candidate outside this image; no local test fixtures.
RUN --mount=type=cache,target=/root/.m2 ./mvnw -B -Dmaven.test.skip=true package

FROM eclipse-temurin:25-jre-noble AS runtime
RUN set -eux; \
    for attempt in 1 2 3; do \
      apt-get update && apt-get install -y --no-install-recommends curl && break; \
      if [ "$attempt" = 3 ]; then exit 1; fi; \
      sleep 8; \
    done; \
    rm -rf /var/lib/apt/lists/*; \
    groupadd --gid 10001 yaiku && useradd --uid 10001 --gid 10001 --no-create-home yaiku
WORKDIR /app
COPY --from=build --chown=10001:10001 /build/target/saip-backend-0.0.1-SNAPSHOT.jar app.jar
USER 10001:10001
ENV SPRING_PROFILES_ACTIVE=prod TZ=America/Lima
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=120s --retries=5 \
  CMD curl --fail --silent --output /dev/null http://127.0.0.1:8080/api/public/ayuda || exit 1
ENTRYPOINT ["java", "-XX:MaxRAMPercentage=60", "-jar", "/app/app.jar"]
