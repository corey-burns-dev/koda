# Koda

Koda is a full-stack Twitch/Discord-style app scaffold:

- `backend/` Zig backend with HTTP routes and a WebSocket chat gateway
- `frontend/` Next.js (React + TypeScript) frontend managed with Bun

## Stack

- Bun 1.3.10
- Zig 0.15.2
- Next.js 16 + React 19

## Quick Start

```bash
make run
```

For local (non-Docker) development:

```bash
make install
make run-local
```

- frontend: `http://localhost:3000`
- backend: `http://localhost:8080`

`make install` also configures repo Git hooks (`core.hooksPath=.githooks`) so commits are blocked unless lint and format checks pass.

## Backend API

- `GET /health`
- `GET /api/rooms`
- `POST /api/rooms` with `{ "name": "...", "kind": "text|voice|video|stream" }`
- `GET /api/messages?room_id=<id>`
- `POST /api/messages` with `{ "room_id": "...", "user_id": "...", "body": "..." }`
- `GET /api/streams`
- `POST /api/streams` with `{ "room_id": "...", "user_id": "...", "title": "..." }`
- `POST /api/streams/stop` with `{ "stream_id": "..." }`
- WebSocket: `ws://localhost:8080/ws/chat?room_id=<id>&user_id=<id>`
- WebSocket: `ws://localhost:8080/ws/signal?room_id=<id>&user_id=<id>`

WebSocket protocol:

- Client sends text frames as chat messages.
- Server broadcasts `{"type":"chat.message","message":{...}}` per room.
- Signal websocket relays JSON payloads for WebRTC as `{"type":"signal.message","event":{...}}`.

## Lint + Format + Tests

```bash
make lint
make format-check
make test
make build
make check
```

## Docker

```bash
docker compose up --build
```

## CI

GitHub Actions runs `make check` on push and pull request.
