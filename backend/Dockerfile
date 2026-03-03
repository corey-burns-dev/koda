FROM ziglang/zig:0.15.2 AS build
WORKDIR /app

COPY backend/build.zig backend/build.zig.zon ./
COPY backend/src ./src

RUN zig build -Doptimize=ReleaseSafe

FROM debian:bookworm-slim AS runtime
WORKDIR /app

RUN useradd --create-home --shell /usr/sbin/nologin punch
COPY --from=build /app/zig-out/bin/punch-backend /usr/local/bin/punch-backend

USER punch
EXPOSE 8080

ENV PUNCH_HOST=0.0.0.0
ENV PUNCH_PORT=8080
ENV PUNCH_CORS_ORIGIN=http://localhost:3000

CMD ["/usr/local/bin/punch-backend"]
