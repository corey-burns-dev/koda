FROM oven/bun:1.3.10 AS deps
WORKDIR /app

# Set user to non-root during dependency installation
USER 1000:1000

COPY frontend/package.json ./package.json
RUN bun install

FROM oven/bun:1.3.10 AS build
WORKDIR /app

# Ensure we have the right ownership
COPY --from=deps --chown=1000:1000 /app/node_modules ./node_modules
COPY --chown=1000:1000 frontend ./

ARG NEXT_PUBLIC_BACKEND_HTTP_URL=http://localhost:8080
ARG NEXT_PUBLIC_BACKEND_WS_URL=ws://localhost:8080

ENV NEXT_PUBLIC_BACKEND_HTTP_URL=${NEXT_PUBLIC_BACKEND_HTTP_URL}
ENV NEXT_PUBLIC_BACKEND_WS_URL=${NEXT_PUBLIC_BACKEND_WS_URL}

# Run build as non-root
USER 1000:1000
RUN bun run build

FROM oven/bun:1.3.10-slim AS runtime
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

# Set up user for runtime
RUN useradd -u 1000 -m bunuser
USER bunuser

COPY --from=build --chown=bunuser:bunuser /app/.next/standalone ./
COPY --from=build --chown=bunuser:bunuser /app/public ./public
COPY --from=build --chown=bunuser:bunuser /app/.next/static ./.next/static

EXPOSE 3000
CMD ["bun", "server.js"]
