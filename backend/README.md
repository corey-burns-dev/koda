# Punch Backend (Zig)

Realtime backend scaffold with in-memory room/chat/stream/voice state.

## Run

```bash
cd backend
zig build run
```

## Environment

- `PUNCH_HOST` (default: `0.0.0.0`)
- `PUNCH_PORT` (default: `8080`)
- `PUNCH_CORS_ORIGIN` (default: `http://localhost:3000`)

## Routes

- `GET /health`
- `GET /api/rooms`
- `POST /api/rooms`
- `GET /api/messages?room_id=<id>`
- `POST /api/messages`
- `GET /ws/chat` (WebSocket upgrade)

## Notes

- Persistence is in-memory only right now.
- WebSocket clients publish plain text frames.
- Broadcast events are JSON objects with message metadata.
