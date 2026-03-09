# Koda Feature Roadmap

_Generated: 2026-03-09_

## High Impact — Core Gaps

### 1. Database Persistence ✅ planned
All data is in-memory; restarting the backend loses everything.
- Add SQLite via C FFI (`linkSystemLibrary("sqlite3")`)
- Write-through strategy: reads from memory (fast), every write also goes to SQLite
- Persist: rooms, messages, users, sessions, streams, reactions
- On startup: open DB, CREATE TABLE IF NOT EXISTS, load all rows into State

### 2. Typing Indicators ✅ planned
Classic for chat apps. WebSocket is already in place.
- Change chat WS protocol from raw text → JSON `{type:"message"|"typing",body?:"..."}`
- Backend: on "typing" event, store TypingEvent (room_id, user_id, expires_at_ms), notifyUpdate
- Backend: broadcast `{type:"chat.typing", room_id, user_id, username, expires_at_ms}` to room
- Frontend: debounce-send typing events on input; show "X is typing…" indicator
- Auto-expire typing state after 3 s client-side

### 3. User Presence / Online Status ✅ planned
Track who is currently connected to a room.
- Add `presence` to State: per-room set of connected user_ids (StringHashMap of ArrayLists)
- On chat WS connect: add user → broadcast `{type:"presence.update", room_id, user_ids:[]}`
- On chat WS disconnect: remove user → broadcast presence update
- Frontend: show online user chips in ChatPanel footer or sidebar

### 4. Message Reactions ✅ planned
Emoji reactions on messages — small UX boost, infrastructure already supports broadcasts.
- Add `Reaction { id, message_id, room_id, user_id, emoji }` to store
- `POST /api/reactions { message_id, room_id, emoji }` — toggles (add or remove)
- On mutation: notifyUpdate → chat socket broadcasts `{type:"reaction.update", message_id, reactions:[{emoji,count,reacted_by_me}]}`
- Frontend: render reaction chips under each message; click to toggle; preset emoji palette

---

## Medium Impact — UX Polish

### 5. Complete "Coming Soon" items
- Profile editing panel (username change, avatar placeholder)
- Settings panel (notification preferences, theme toggle)

### 6. Room Member List
VoiceService already tracks participants — surface as a sidebar panel for all room kinds.

### 7. Notifications
Browser `Notification` API for @mentions and new messages when tab is backgrounded.

### 8. Search
Room name filter in sidebar + message search via query param on `GET /api/messages?q=`.

### 9. Message Pagination
Add `?limit=50&before=<msg-id>` to `GET /api/messages` to avoid loading thousands at once.

---

## Performance / Code Quality

### 10. Split `useRoomRealtime.ts` (1063 lines)
Extract into: `useWebRTC.ts`, `useStreamHost.ts`, `useStreamViewer.ts`

### 11. Rate Limiting
Sliding-window counter per IP/user_id in the Zig server.

### 12. WebSocket Reconnection — Exponential Backoff with Jitter
Add jitter to the current backoff to prevent thundering herd.

### 13. Backend Input Validation
Room names: max length, character allow-list. Message body: max 4000 chars. Username rules.

---

## Ambitious / Longer Term

### 14. Screen Sharing
`getDisplayMedia` via WebRTC — signaling infrastructure is already there.

### 15. Stream Recording / VOD Archive
MediaMTX supports HLS recording to disk; wire up a `/api/vods` route.

### 16. Direct Messages
New room kind `dm` or separate concept with 1:1 participant enforcement.

### 17. Horizontal Scaling
Redis pub/sub to fan out WebSocket events across multiple backend instances.
