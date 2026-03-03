FROM debian:bookworm-slim AS build
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends xz-utils curl ca-certificates && rm -rf /var/lib/apt/lists/*
RUN mkdir -p /opt/zig && \
    curl -fsSL https://ziglang.org/download/0.15.2/zig-x86_64-linux-0.15.2.tar.xz | tar -xJ --strip-components=1 -C /opt/zig && \
    ln -s /opt/zig/zig /usr/local/bin/zig

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
