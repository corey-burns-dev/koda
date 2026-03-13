# Koda Backend
Koda's Zig-based backend provides a fast, efficient server for real-time messaging, WebRTC signaling, and OBS stream management.

## Features
- Zig 0.13.0 for high-performance and safety
- SQLite for persistence
- WebSocket support for real-time chat and signaling
- Simple, custom HTTP server implementation

## Getting Started
### Prerequisites
- [Zig 0.13.0](https://ziglang.org/download/)
- [Make](https://www.gnu.org/software/make/)

### Development
1. Clone the repository
2. From the project root, run:
```bash
make backend
```

## API Reference
### Streams
- `GET /api/streams`
- `POST /api/streams` (returns `obs.server_url`, `obs.stream_key`, `obs.ingest_url`)
- `POST /api/streams/stop`
- `POST /api/streams/delete`
- `GET /ws/chat` (WebSocket upgrade)
- `GET /ws/signal` (WebSocket upgrade for WebRTC signaling)

### Authentication
- `POST /api/auth/signin`
- `POST /api/auth/signup`
- `POST /api/auth/signout`
