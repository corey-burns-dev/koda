# Punch

Punch is a full-stack Twitch/Discord-style app scaffold with a Bun monorepo:

- `backend/` Zig backend with HTTP routes and a WebSocket chat gateway
- `frontend/` Next.js (React + TypeScript) frontend

## Stack

- Bun 1.3.10
- Zig 0.15.2
- Next.js 16 + React 19

## Quick Start

```bash
bun install
bun run dev:back
bun run dev:front
```

- frontend: `http://localhost:3000`
- backend: `http://localhost:8080`

## Backend API

- `GET /health`
- `GET /api/rooms`
- `POST /api/rooms` with `{ "name": "...", "kind": "text|voice|video|stream" }`
- `GET /api/messages?room_id=<id>`
- `POST /api/messages` with `{ "room_id": "...", "user_id": "...", "body": "..." }`
- WebSocket: `ws://localhost:8080/ws/chat?room_id=<id>&user_id=<id>`

WebSocket protocol:

- Client sends text frames as chat messages.
- Server broadcasts `{"type":"chat.message","message":{...}}` per room.

## Lint + Format + Tests

```bash
bun run lint
bun run format:check
bun run test:back
bun run build:front
bun run check
```

## Docker

```bash
docker compose up --build
```

## CI

GitHub Actions runs `bun run check` on push and pull request.
