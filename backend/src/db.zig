const std = @import("std");
const store = @import("store.zig");

const c = @cImport({
    @cInclude("sqlite3.h");
});

pub const Db = struct {
    db: *c.sqlite3,
    allocator: std.mem.Allocator,

    pub fn open(allocator: std.mem.Allocator, path: []const u8) !Db {
        const path_z = try allocator.dupeZ(u8, path);
        defer allocator.free(path_z);

        var db_ptr: ?*c.sqlite3 = null;
        const rc = c.sqlite3_open(path_z.ptr, &db_ptr);
        if (rc != c.SQLITE_OK) {
            if (db_ptr) |p| _ = c.sqlite3_close(p);
            std.log.err("sqlite3_open failed: rc={d}", .{rc});
            return error.DbOpenFailed;
        }

        // Enable WAL mode for better concurrent read performance.
        var wal_err: [*c]u8 = null;
        _ = c.sqlite3_exec(db_ptr.?, "PRAGMA journal_mode=WAL;", null, null, &wal_err);
        if (wal_err) |e| c.sqlite3_free(e);

        return .{ .db = db_ptr.?, .allocator = allocator };
    }

    pub fn close(self: *Db) void {
        _ = c.sqlite3_close(self.db);
    }

    pub fn createSchema(self: *Db) !void {
        const schema =
            \\CREATE TABLE IF NOT EXISTS rooms (
            \\  id TEXT PRIMARY KEY,
            \\  name TEXT NOT NULL,
            \\  kind TEXT NOT NULL
            \\);
            \\CREATE TABLE IF NOT EXISTS messages (
            \\  id TEXT PRIMARY KEY,
            \\  room_id TEXT NOT NULL,
            \\  user_id TEXT NOT NULL,
            \\  body TEXT NOT NULL,
            \\  sent_at_unix_ms INTEGER NOT NULL
            \\);
            \\CREATE TABLE IF NOT EXISTS users (
            \\  id TEXT PRIMARY KEY,
            \\  username TEXT NOT NULL UNIQUE,
            \\  email TEXT NOT NULL UNIQUE,
            \\  password_hash TEXT NOT NULL
            \\);
            \\CREATE TABLE IF NOT EXISTS sessions (
            \\  token TEXT PRIMARY KEY,
            \\  user_id TEXT NOT NULL
            \\);
            \\CREATE TABLE IF NOT EXISTS streams (
            \\  id TEXT PRIMARY KEY,
            \\  room_id TEXT NOT NULL,
            \\  host_user_id TEXT NOT NULL,
            \\  title TEXT NOT NULL,
            \\  stream_key TEXT NOT NULL,
            \\  ingest_server_url TEXT NOT NULL,
            \\  playback_url TEXT NOT NULL,
            \\  live INTEGER NOT NULL DEFAULT 0
            \\);
            \\CREATE TABLE IF NOT EXISTS reactions (
            \\  id TEXT PRIMARY KEY,
            \\  message_id TEXT NOT NULL,
            \\  room_id TEXT NOT NULL,
            \\  user_id TEXT NOT NULL,
            \\  emoji TEXT NOT NULL,
            \\  UNIQUE(message_id, user_id, emoji)
            \\);
        ;

        var err_msg: [*c]u8 = null;
        const rc = c.sqlite3_exec(self.db, schema, null, null, &err_msg);
        if (rc != c.SQLITE_OK) {
            if (err_msg) |msg| {
                std.log.err("schema creation failed: {s}", .{msg});
                c.sqlite3_free(msg);
            }
            return error.SchemaCreationFailed;
        }
    }

    // -------------------------------------------------------------------------
    // Load all persisted data into the in-memory State.
    // -------------------------------------------------------------------------

    pub fn loadInto(self: *Db, state: *store.State) !void {
        try self.loadUsers(state);
        try self.loadSessions(state);
        try self.loadRooms(state);
        try self.loadMessages(state);
        try self.loadStreams(state);
        try self.loadReactions(state);
    }

    fn loadRooms(self: *Db, state: *store.State) !void {
        const sql = "SELECT id, name, kind FROM rooms ORDER BY rowid;";
        var stmt: ?*c.sqlite3_stmt = null;
        if (c.sqlite3_prepare_v2(self.db, sql, -1, &stmt, null) != c.SQLITE_OK) return error.PrepareError;
        defer _ = c.sqlite3_finalize(stmt);

        while (c.sqlite3_step(stmt) == c.SQLITE_ROW) {
            const id = try dupCol(self.allocator, stmt, 0);
            errdefer self.allocator.free(id);
            const name = try dupCol(self.allocator, stmt, 1);
            errdefer self.allocator.free(name);
            const kind_str = try dupCol(self.allocator, stmt, 2);
            defer self.allocator.free(kind_str);

            const kind = parseRoomKind(kind_str);
            try state.rooms.append(self.allocator, .{ .id = id, .name = name, .kind = kind });

            // Keep next_room_id ahead of all loaded ids.
            if (parseNumericSuffix(id)) |n| {
                if (n >= state.next_room_id) state.next_room_id = n + 1;
            }
        }
    }

    fn loadMessages(self: *Db, state: *store.State) !void {
        const sql = "SELECT id, room_id, user_id, body, sent_at_unix_ms FROM messages ORDER BY rowid;";
        var stmt: ?*c.sqlite3_stmt = null;
        if (c.sqlite3_prepare_v2(self.db, sql, -1, &stmt, null) != c.SQLITE_OK) return error.PrepareError;
        defer _ = c.sqlite3_finalize(stmt);

        while (c.sqlite3_step(stmt) == c.SQLITE_ROW) {
            const id = try dupCol(self.allocator, stmt, 0);
            errdefer self.allocator.free(id);
            const room_id = try dupCol(self.allocator, stmt, 1);
            errdefer self.allocator.free(room_id);
            const user_id = try dupCol(self.allocator, stmt, 2);
            errdefer self.allocator.free(user_id);
            const body = try dupCol(self.allocator, stmt, 3);
            errdefer self.allocator.free(body);
            const sent_at = c.sqlite3_column_int64(stmt, 4);

            try state.messages.append(self.allocator, .{
                .id = id,
                .room_id = room_id,
                .user_id = user_id,
                .body = body,
                .sent_at_unix_ms = sent_at,
            });

            if (parseNumericSuffix(id)) |n| {
                if (n >= state.next_message_id) state.next_message_id = n + 1;
            }
        }
    }

    fn loadUsers(self: *Db, state: *store.State) !void {
        const sql = "SELECT id, username, email, password_hash FROM users ORDER BY rowid;";
        var stmt: ?*c.sqlite3_stmt = null;
        if (c.sqlite3_prepare_v2(self.db, sql, -1, &stmt, null) != c.SQLITE_OK) return error.PrepareError;
        defer _ = c.sqlite3_finalize(stmt);

        while (c.sqlite3_step(stmt) == c.SQLITE_ROW) {
            const id = try dupCol(self.allocator, stmt, 0);
            errdefer self.allocator.free(id);
            const username = try dupCol(self.allocator, stmt, 1);
            errdefer self.allocator.free(username);
            const email = try dupCol(self.allocator, stmt, 2);
            errdefer self.allocator.free(email);
            const password_hash = try dupCol(self.allocator, stmt, 3);
            errdefer self.allocator.free(password_hash);

            try state.users.append(self.allocator, .{
                .id = id,
                .username = username,
                .email = email,
                .password_hash = password_hash,
            });

            if (parseNumericSuffix(id)) |n| {
                if (n >= state.next_user_id) state.next_user_id = n + 1;
            }
        }
    }

    fn loadSessions(self: *Db, state: *store.State) !void {
        const sql = "SELECT token, user_id FROM sessions;";
        var stmt: ?*c.sqlite3_stmt = null;
        if (c.sqlite3_prepare_v2(self.db, sql, -1, &stmt, null) != c.SQLITE_OK) return error.PrepareError;
        defer _ = c.sqlite3_finalize(stmt);

        while (c.sqlite3_step(stmt) == c.SQLITE_ROW) {
            const token = try dupCol(self.allocator, stmt, 0);
            errdefer self.allocator.free(token);
            const user_id = try dupCol(self.allocator, stmt, 1);
            errdefer self.allocator.free(user_id);

            try state.sessions.append(self.allocator, .{ .token = token, .user_id = user_id });
        }
    }

    fn loadStreams(self: *Db, state: *store.State) !void {
        const sql =
            \\SELECT id, room_id, host_user_id, title, stream_key, ingest_server_url, playback_url, live
            \\FROM streams ORDER BY rowid;
        ;
        var stmt: ?*c.sqlite3_stmt = null;
        if (c.sqlite3_prepare_v2(self.db, sql, -1, &stmt, null) != c.SQLITE_OK) return error.PrepareError;
        defer _ = c.sqlite3_finalize(stmt);

        while (c.sqlite3_step(stmt) == c.SQLITE_ROW) {
            const id = try dupCol(self.allocator, stmt, 0);
            errdefer self.allocator.free(id);
            const room_id = try dupCol(self.allocator, stmt, 1);
            errdefer self.allocator.free(room_id);
            const host_user_id = try dupCol(self.allocator, stmt, 2);
            errdefer self.allocator.free(host_user_id);
            const title = try dupCol(self.allocator, stmt, 3);
            errdefer self.allocator.free(title);
            const stream_key = try dupCol(self.allocator, stmt, 4);
            errdefer self.allocator.free(stream_key);
            const ingest_server_url = try dupCol(self.allocator, stmt, 5);
            errdefer self.allocator.free(ingest_server_url);
            const playback_url = try dupCol(self.allocator, stmt, 6);
            errdefer self.allocator.free(playback_url);
            const live = c.sqlite3_column_int64(stmt, 7) != 0;

            try state.streams.append(self.allocator, .{
                .id = id,
                .room_id = room_id,
                .host_user_id = host_user_id,
                .title = title,
                .stream_key = stream_key,
                .ingest_server_url = ingest_server_url,
                .playback_url = playback_url,
                .live = live,
            });

            if (parseNumericSuffix(id)) |n| {
                if (n >= state.next_stream_id) state.next_stream_id = n + 1;
            }
        }
    }

    fn loadReactions(self: *Db, state: *store.State) !void {
        const sql = "SELECT id, message_id, room_id, user_id, emoji FROM reactions ORDER BY rowid;";
        var stmt: ?*c.sqlite3_stmt = null;
        if (c.sqlite3_prepare_v2(self.db, sql, -1, &stmt, null) != c.SQLITE_OK) return error.PrepareError;
        defer _ = c.sqlite3_finalize(stmt);

        while (c.sqlite3_step(stmt) == c.SQLITE_ROW) {
            const id = try dupCol(self.allocator, stmt, 0);
            errdefer self.allocator.free(id);
            const message_id = try dupCol(self.allocator, stmt, 1);
            errdefer self.allocator.free(message_id);
            const room_id = try dupCol(self.allocator, stmt, 2);
            errdefer self.allocator.free(room_id);
            const user_id = try dupCol(self.allocator, stmt, 3);
            errdefer self.allocator.free(user_id);
            const emoji = try dupCol(self.allocator, stmt, 4);
            errdefer self.allocator.free(emoji);

            try state.reactions.append(self.allocator, .{
                .id = id,
                .message_id = message_id,
                .room_id = room_id,
                .user_id = user_id,
                .emoji = emoji,
            });

            if (parseNumericSuffix(id)) |n| {
                if (n >= state.next_reaction_id) state.next_reaction_id = n + 1;
            }
        }
    }

    // -------------------------------------------------------------------------
    // Write-through helpers — called after every mutation.
    // Errors are logged but do not crash the server (in-memory state is source of truth).
    // -------------------------------------------------------------------------

    pub fn insertRoom(self: *Db, room: store.Room) void {
        const sql = "INSERT OR IGNORE INTO rooms (id, name, kind) VALUES (?, ?, ?);";
        var stmt: ?*c.sqlite3_stmt = null;
        if (c.sqlite3_prepare_v2(self.db, sql, -1, &stmt, null) != c.SQLITE_OK) return;
        defer _ = c.sqlite3_finalize(stmt);

        bindText(stmt, 1, room.id);
        bindText(stmt, 2, room.name);
        bindText(stmt, 3, roomKindString(room.kind));
        _ = c.sqlite3_step(stmt);
    }

    pub fn insertMessage(self: *Db, msg: store.Message) void {
        const sql = "INSERT OR IGNORE INTO messages (id, room_id, user_id, body, sent_at_unix_ms) VALUES (?, ?, ?, ?, ?);";
        var stmt: ?*c.sqlite3_stmt = null;
        if (c.sqlite3_prepare_v2(self.db, sql, -1, &stmt, null) != c.SQLITE_OK) return;
        defer _ = c.sqlite3_finalize(stmt);

        bindText(stmt, 1, msg.id);
        bindText(stmt, 2, msg.room_id);
        bindText(stmt, 3, msg.user_id);
        bindText(stmt, 4, msg.body);
        _ = c.sqlite3_bind_int64(stmt, 5, msg.sent_at_unix_ms);
        _ = c.sqlite3_step(stmt);
    }

    pub fn insertUser(self: *Db, user: store.User) void {
        const sql = "INSERT OR IGNORE INTO users (id, username, email, password_hash) VALUES (?, ?, ?, ?);";
        var stmt: ?*c.sqlite3_stmt = null;
        if (c.sqlite3_prepare_v2(self.db, sql, -1, &stmt, null) != c.SQLITE_OK) return;
        defer _ = c.sqlite3_finalize(stmt);

        bindText(stmt, 1, user.id);
        bindText(stmt, 2, user.username);
        bindText(stmt, 3, user.email);
        bindText(stmt, 4, user.password_hash);
        _ = c.sqlite3_step(stmt);
    }

    pub fn insertSession(self: *Db, session: store.Session) void {
        const sql = "INSERT OR REPLACE INTO sessions (token, user_id) VALUES (?, ?);";
        var stmt: ?*c.sqlite3_stmt = null;
        if (c.sqlite3_prepare_v2(self.db, sql, -1, &stmt, null) != c.SQLITE_OK) return;
        defer _ = c.sqlite3_finalize(stmt);

        bindText(stmt, 1, session.token);
        bindText(stmt, 2, session.user_id);
        _ = c.sqlite3_step(stmt);
    }

    pub fn insertStream(self: *Db, stream: store.StreamSession) void {
        const sql =
            \\INSERT OR REPLACE INTO streams
            \\  (id, room_id, host_user_id, title, stream_key, ingest_server_url, playback_url, live)
            \\VALUES (?, ?, ?, ?, ?, ?, ?, ?);
        ;
        var stmt: ?*c.sqlite3_stmt = null;
        if (c.sqlite3_prepare_v2(self.db, sql, -1, &stmt, null) != c.SQLITE_OK) return;
        defer _ = c.sqlite3_finalize(stmt);

        bindText(stmt, 1, stream.id);
        bindText(stmt, 2, stream.room_id);
        bindText(stmt, 3, stream.host_user_id);
        bindText(stmt, 4, stream.title);
        bindText(stmt, 5, stream.stream_key);
        bindText(stmt, 6, stream.ingest_server_url);
        bindText(stmt, 7, stream.playback_url);
        _ = c.sqlite3_bind_int64(stmt, 8, if (stream.live) 1 else 0);
        _ = c.sqlite3_step(stmt);
    }

    pub fn updateStreamLive(self: *Db, stream_id: []const u8, live: bool) void {
        const sql = "UPDATE streams SET live = ? WHERE id = ?;";
        var stmt: ?*c.sqlite3_stmt = null;
        if (c.sqlite3_prepare_v2(self.db, sql, -1, &stmt, null) != c.SQLITE_OK) return;
        defer _ = c.sqlite3_finalize(stmt);

        _ = c.sqlite3_bind_int64(stmt, 1, if (live) 1 else 0);
        bindText(stmt, 2, stream_id);
        _ = c.sqlite3_step(stmt);
    }

    pub fn insertReaction(self: *Db, reaction: store.Reaction) void {
        const sql =
            \\INSERT OR IGNORE INTO reactions (id, message_id, room_id, user_id, emoji)
            \\VALUES (?, ?, ?, ?, ?);
        ;
        var stmt: ?*c.sqlite3_stmt = null;
        if (c.sqlite3_prepare_v2(self.db, sql, -1, &stmt, null) != c.SQLITE_OK) return;
        defer _ = c.sqlite3_finalize(stmt);

        bindText(stmt, 1, reaction.id);
        bindText(stmt, 2, reaction.message_id);
        bindText(stmt, 3, reaction.room_id);
        bindText(stmt, 4, reaction.user_id);
        bindText(stmt, 5, reaction.emoji);
        _ = c.sqlite3_step(stmt);
    }

    pub fn deleteReaction(self: *Db, message_id: []const u8, user_id: []const u8, emoji: []const u8) void {
        const sql = "DELETE FROM reactions WHERE message_id = ? AND user_id = ? AND emoji = ?;";
        var stmt: ?*c.sqlite3_stmt = null;
        if (c.sqlite3_prepare_v2(self.db, sql, -1, &stmt, null) != c.SQLITE_OK) return;
        defer _ = c.sqlite3_finalize(stmt);

        bindText(stmt, 1, message_id);
        bindText(stmt, 2, user_id);
        bindText(stmt, 3, emoji);
        _ = c.sqlite3_step(stmt);
    }
};

// -------------------------------------------------------------------------
// Internal helpers
// -------------------------------------------------------------------------

fn dupCol(allocator: std.mem.Allocator, stmt: ?*c.sqlite3_stmt, col: c_int) ![]u8 {
    const ptr = c.sqlite3_column_text(stmt, col);
    if (ptr == null) return try allocator.dupe(u8, "");
    const len = @as(usize, @intCast(c.sqlite3_column_bytes(stmt, col)));
    return try allocator.dupe(u8, ptr[0..len]);
}

fn bindText(stmt: ?*c.sqlite3_stmt, col: c_int, value: []const u8) void {
    _ = c.sqlite3_bind_text(stmt, col, value.ptr, @intCast(value.len), c.SQLITE_TRANSIENT);
}

fn parseRoomKind(kind_str: []const u8) @import("types.zig").RoomKind {
    if (std.mem.eql(u8, kind_str, "voice")) return .voice;
    if (std.mem.eql(u8, kind_str, "video")) return .video;
    if (std.mem.eql(u8, kind_str, "stream")) return .stream;
    return .text;
}

fn roomKindString(kind: @import("types.zig").RoomKind) []const u8 {
    return switch (kind) {
        .text => "text",
        .voice => "voice",
        .video => "video",
        .stream => "stream",
    };
}

/// Parses the numeric suffix from ids like "room-7" → 7, "msg-42" → 42.
fn parseNumericSuffix(id: []const u8) ?u64 {
    const dash = std.mem.lastIndexOfScalar(u8, id, '-') orelse return null;
    return std.fmt.parseUnsigned(u64, id[dash + 1 ..], 10) catch null;
}
