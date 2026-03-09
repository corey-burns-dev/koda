FROM debian:bookworm-slim AS build
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends xz-utils curl ca-certificates libsqlite3-dev && rm -rf /var/lib/apt/lists/*
RUN mkdir -p /opt/zig && \
    curl -fsSL https://ziglang.org/download/0.15.2/zig-x86_64-linux-0.15.2.tar.xz | tar -xJ --strip-components=1 -C /opt/zig && \
    ln -s /opt/zig/zig /usr/local/bin/zig

COPY backend/build.zig backend/build.zig.zon ./
COPY backend/src ./src

RUN zig build -Doptimize=ReleaseSafe

FROM debian:bookworm-slim AS runtime
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends libsqlite3-0 && rm -rf /var/lib/apt/lists/*
RUN useradd --create-home --shell /usr/sbin/nologin koda && mkdir -p /app/data && chown koda:koda /app/data
COPY --from=build /app/zig-out/bin/koda-backend /usr/local/bin/koda-backend

USER koda
EXPOSE 8080

ENV KODA_HOST=0.0.0.0
ENV KODA_PORT=8080
ENV KODA_CORS_ORIGIN=http://localhost:3000
ENV KODA_MEDIA_RTMP_BASE_URL=rtmp://localhost:1935/live
ENV KODA_MEDIA_HLS_BASE_URL=http://localhost:8888/live
ENV KODA_DB_PATH=/app/data/koda.db

CMD ["/usr/local/bin/koda-backend"]
