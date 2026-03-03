FROM oven/bun:1.3.10 AS deps
WORKDIR /app

COPY frontend/package.json ./package.json
RUN bun install

FROM oven/bun:1.3.10 AS build
WORKDIR /app

ARG NEXT_PUBLIC_BACKEND_HTTP_URL=http://localhost:8080
ARG NEXT_PUBLIC_BACKEND_WS_URL=ws://localhost:8080

ENV NEXT_PUBLIC_BACKEND_HTTP_URL=${NEXT_PUBLIC_BACKEND_HTTP_URL}
ENV NEXT_PUBLIC_BACKEND_WS_URL=${NEXT_PUBLIC_BACKEND_WS_URL}

COPY --from=deps /app/node_modules ./node_modules
COPY frontend ./
RUN bun run build

FROM oven/bun:1.3.10-slim AS runtime
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

COPY --from=build /app/.next/standalone ./
COPY --from=build /app/public ./public
COPY --from=build /app/.next/static ./.next/static

EXPOSE 3000
CMD ["bun", "server.js"]
