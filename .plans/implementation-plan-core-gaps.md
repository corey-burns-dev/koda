# Implementation Plan: Core Gaps (Features 1–4)

_Generated: 2026-03-09_

## Overview

Implement the four highest-impact features in order of dependency:

1. **SQLite Persistence** — foundational, enables all data to survive restarts
2. **Typing Indicators** — requires WS protocol change (JSON), frontend hook update
3. **User Presence** — requires backend per-room connection tracking
4. **Message Reactions** — requires new store type, API endpoint, WS broadcast

---

## 1. SQLite Persistence

### Backend changes

**`backend/build.zig`**
- Add `exe.linkSystemLibrary("sqlite3")` and `exe.linkLibC()`

**`backend/src/db.zig`** (new file)
- `@cImport({ @cInclude("sqlite3.h"); })`
- `Db` struct wrapping `*c.sqlite3`
- `Db.open(path)` — opens/creates file, runs `CREATE TABLE IF NOT EXISTS` for all tables
- Schema:
  ```sql
  CREATE TABLE IF NOT EXISTS rooms (id TEXT PRIMARY KEY, name TEXT, kind TEXT);
  CREATE TABLE IF NOT EXISTS messages (id TEXT PRIMARY KEY, room_id TEXT, user_id TEXT, body TEXT, sent_at_unix_ms INTEGER);
  CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, username TEXT UNIQUE, email TEXT UNIQUE, password_hash TEXT);
  CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, user_id TEXT);
  CREATE TABLE IF NOT EXISTS streams (id TEXT PRIMARY KEY, room_id TEXT, host_user_id TEXT, title TEXT, stream_key TEXT, ingest_server_url TEXT, playback_url TEXT, live INTEGER);
  CREATE TABLE IF NOT EXISTS reactions (id TEXT PRIMARY KEY, message_id TEXT, room_id TEXT, user_id TEXT, emoji TEXT);
  ```
- `Db.loadInto(state)` — SELECT all rows, allocate strings, append to State arrays, set next_*_id counters
- `Db.insertRoom`, `Db.insertMessage`, `Db.insertUser`, `Db.insertSession`, `Db.insertStream`, `Db.updateStreamLive`
- `Db.insertReaction`, `Db.deleteReaction`

**`backend/src/store.zig`**
- Add `Reaction { id, message_id, room_id, user_id, emoji }` struct
- Add `reactions: std.ArrayList(Reaction)` to State
- Add `next_reaction_id: u64` and `nextReactionId`

**`backend/src/app.zig`**
- Add `db: db_mod.Db` field
- `init`: open DB at path from env (default `./koda.db`), load into state

**`backend/src/server.zig`** — write-through on mutations:
- `appendMessage` → also call `self.app.db.insertMessage`
- `handleCreateRoom` → also `self.app.db.insertRoom`
- `handleRegister` → also `self.app.db.insertUser`
- `createSessionLocked` → also `self.app.db.insertSession`
- `handleStartStream` → also `self.app.db.insertStream`
- `handleStopStream` (set live=false) → also `self.app.db.updateStreamLive`

**`backend/src/config.zig`**
- Add `db_path: []const u8` (env `KODA_DB_PATH`, default `./koda.db`)

---

## 2. Typing Indicators

### Protocol change

Chat WebSocket currently uses raw text. Change to JSON envelope:
- Send message: `{"type":"message","body":"hello"}`
- Send typing: `{"type":"typing"}`
- Server sends: `{"type":"chat.message","message":{...}}` (unchanged)
- Server sends: `{"type":"chat.typing","room_id":"...","user_id":"...","username":"...","expires_at_ms":1234}`

### Backend changes

**`backend/src/store.zig`**
- Add `TypingEvent { room_id: []const u8, user_id: []const u8, expires_at_ms: i64 }`
- Add `typing_events: std.ArrayList(TypingEvent)` to State
- Add `last_typing_seq: usize` (for broadcast tracking, same pattern as messages)

**`backend/src/server.zig`**
- `receiveSocketMessages`: parse JSON envelope instead of raw text
  - `type == "message"` → call `appendMessage`
  - `type == "typing"` → call `appendTypingEvent`
- `appendTypingEvent`: upsert TypingEvent (update expires_at if user already typing), notifyUpdate
- `serveChatSocket` broadcast loop: also check for new typing events, send them
- Typing events are NOT persisted to DB (ephemeral)

### Frontend changes

**`frontend/app/hooks/useRoomChat.ts`**
- Change `socket.send(text)` → `socket.send(JSON.stringify({type:"message",body:text}))`
- Add `sendTypingSignal()`: `socket.send(JSON.stringify({type:"typing"}))` — debounced 1 s
- Call `sendTypingSignal` on every `onDraftChange`
- Handle new `chat.typing` WS event: maintain `typingUsers: Map<user_id, {username, expiresAt}>`
- Auto-clear typing state after expiry (useEffect with setTimeout)
- Return `typingUsers` from hook

**`frontend/app/components/ChatPanel.tsx`**
- Accept `typingUsers` prop
- Render "Alice is typing…" below the message list when typingUsers has entries

**`frontend/app/types.ts`**
- Add `TypingEvent` type and `ChatTypingEvent` WS event type

---

## 3. User Presence

### Backend changes

**`backend/src/store.zig`**
- Add `room_presence: std.StringHashMap(std.ArrayList([]const u8))` to State
  - Maps room_id → list of currently-connected user_ids
- Add `presence_seq: u64` (incremented on every presence change, for broadcast)

**`backend/src/server.zig`**
- `serveChatSocket`:
  - On enter: call `addPresence(room_id, user_id)` under mutex, notifyUpdate
  - On exit (deferred): call `removePresence(room_id, user_id)` under mutex, notifyUpdate
- Add `addPresence` / `removePresence` helpers
- Broadcast loop: track `last_presence_seq`, if changed emit `{type:"presence.update", room_id, user_ids:[...]}`
- Build JSON helper: `buildPresenceJson(room_id)`

### Frontend changes

**`frontend/app/hooks/useRoomChat.ts`**
- Handle `presence.update` WS event: `setPresenceUserIds(payload.user_ids)`
- Return `presenceUserIds: string[]` from hook

**`frontend/app/types.ts`**
- Add `PresenceUpdateEvent` type

**`frontend/app/components/ChatPanel.tsx`**
- Accept `presenceUserIds` prop
- Show a compact "N online" indicator or user chips above the input

---

## 4. Message Reactions

### Backend changes

Already covered in SQLite section (reactions table, Reaction store type).

**`backend/src/server.zig`**
- Add route `POST /api/reactions` → `handleToggleReaction`
  - Requires auth token
  - Body: `{ message_id, room_id, emoji }`
  - Toggle: if (message_id, user_id, emoji) exists → delete; else insert
  - notifyUpdate after change
- Chat socket broadcast loop: track `last_reactions_seen`, emit `{type:"reaction.update", message_id, reactions:[{emoji,users:[]}]}` for changed messages
- `buildReactionsForMessage(message_id)` helper

### Frontend changes

**`frontend/app/types.ts`**
- Add `Reaction { emoji: string; count: number; reacted_by_me: boolean }`
- Add `ReactionUpdateEvent` WS event type

**`frontend/app/hooks/useRoomChat.ts`**
- Handle `reaction.update` WS event: maintain `reactionsById: Map<message_id, Reaction[]>`
- Export `reactionsById`, `toggleReaction(messageId, emoji)`
- `toggleReaction` calls `POST /api/reactions` (optimistic update)

**`frontend/app/components/ChatPanel.tsx`**
- Accept `reactionsById`, `onToggleReaction` props
- Render reaction chips `😀 2` below message body
- On hover message: show preset emoji picker (👍 ❤️ 😂 🔥 👀 ✅)
- Click chip or picker emoji → call `onToggleReaction`

---

## File Change Summary

| File | Change type |
|------|-------------|
| `backend/build.zig` | Modify — link sqlite3 |
| `backend/src/db.zig` | New — SQLite wrapper |
| `backend/src/store.zig` | Modify — add Reaction, TypingEvent, presence map |
| `backend/src/app.zig` | Modify — add db field |
| `backend/src/config.zig` | Modify — add db_path |
| `backend/src/server.zig` | Modify — write-through, new routes, new WS events |
| `frontend/app/types.ts` | Modify — new event types |
| `frontend/app/hooks/useRoomChat.ts` | Modify — JSON protocol, typing/presence/reactions |
| `frontend/app/components/ChatPanel.tsx` | Modify — typing indicator, presence, reaction UI |
| `frontend/app/page.tsx` | Modify — pass new props from hook to ChatPanel |
