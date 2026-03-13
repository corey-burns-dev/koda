const std = @import("std");
const types = @import("types.zig");

pub const Room = struct {
    id: []const u8,
    name: []const u8,
    kind: types.RoomKind,
};

pub const Message = struct {
    id: []const u8,
    room_id: []const u8,
    user_id: []const u8,
    body: []const u8,
    sent_at_unix_ms: i64,
};

pub const StreamSession = struct {
    id: []const u8,
    room_id: []const u8,
    host_user_id: []const u8,
    title: []const u8,
    stream_key: []const u8,
    ingest_server_url: []const u8,
    playback_url: []const u8,
    live: bool,
};

pub fn deinitStreamSession(allocator: std.mem.Allocator, stream: StreamSession) void {
    allocator.free(stream.id);
    allocator.free(stream.room_id);
    allocator.free(stream.host_user_id);
    allocator.free(stream.title);
    allocator.free(stream.stream_key);
    allocator.free(stream.ingest_server_url);
    allocator.free(stream.playback_url);
}

pub const VoiceParticipant = struct {
    room_id: []const u8,
    user_id: []const u8,
    muted: bool,
    deafened: bool,
};

pub const SignalEvent = struct {
    id: []const u8,
    room_id: []const u8,
    user_id: []const u8,
    payload: []const u8,
    sent_at_unix_ms: i64,
};

pub const User = struct {
    id: []const u8,
    username: []const u8,
    email: []const u8,
    password_hash: []const u8,
};

pub const Reaction = struct {
    id: []const u8,
    message_id: []const u8,
    room_id: []const u8,
    user_id: []const u8,
    emoji: []const u8,
};

pub const TypingUser = struct {
    room_id: []const u8,
    user_id: []const u8,
    username: []const u8,
    expires_at_ms: i64,
};

pub const PresenceEntry = struct {
    room_id: []const u8,
    user_id: []const u8,
    username: []const u8,
};

pub const Session = struct {
    token: []const u8,
    user_id: []const u8,
};

pub const State = struct {
    rooms: std.ArrayList(Room),
    messages: std.ArrayList(Message),
    streams: std.ArrayList(StreamSession),
    voice_participants: std.ArrayList(VoiceParticipant),
    signal_events: std.ArrayList(SignalEvent),
    users: std.ArrayList(User),
    sessions: std.ArrayList(Session),
    reactions: std.ArrayList(Reaction),
    typing: std.ArrayList(TypingUser),
    presence: std.ArrayList(PresenceEntry),
    next_room_id: u64,
    next_message_id: u64,
    next_stream_id: u64,
    next_signal_id: u64,
    next_user_id: u64,
    next_reaction_id: u64,
    typing_seq: u64,
    presence_seq: u64,
    reaction_seq: u64,

    pub fn init(allocator: std.mem.Allocator) State {
        _ = allocator;
        return .{
            .rooms = .empty,
            .messages = .empty,
            .streams = .empty,
            .voice_participants = .empty,
            .signal_events = .empty,
            .users = .empty,
            .sessions = .empty,
            .reactions = .empty,
            .typing = .empty,
            .presence = .empty,
            .next_room_id = 1,
            .next_message_id = 1,
            .next_stream_id = 1,
            .next_signal_id = 1,
            .next_user_id = 1,
            .next_reaction_id = 1,
            .typing_seq = 0,
            .presence_seq = 0,
            .reaction_seq = 0,
        };
    }

    pub fn deinit(self: *State, allocator: std.mem.Allocator) void {
        for (self.rooms.items) |room| {
            allocator.free(room.id);
            allocator.free(room.name);
        }
        self.rooms.deinit(allocator);

        for (self.messages.items) |msg| {
            allocator.free(msg.id);
            allocator.free(msg.room_id);
            allocator.free(msg.user_id);
            allocator.free(msg.body);
        }
        self.messages.deinit(allocator);

        for (self.streams.items) |stream| deinitStreamSession(allocator, stream);
        self.streams.deinit(allocator);

        for (self.voice_participants.items) |participant| {
            allocator.free(participant.room_id);
            allocator.free(participant.user_id);
        }
        self.voice_participants.deinit(allocator);

        for (self.signal_events.items) |event| {
            allocator.free(event.id);
            allocator.free(event.room_id);
            allocator.free(event.user_id);
            allocator.free(event.payload);
        }
        self.signal_events.deinit(allocator);

        for (self.users.items) |user| {
            allocator.free(user.id);
            allocator.free(user.username);
            allocator.free(user.email);
            allocator.free(user.password_hash);
        }
        self.users.deinit(allocator);

        for (self.sessions.items) |session| {
            allocator.free(session.token);
            allocator.free(session.user_id);
        }
        self.sessions.deinit(allocator);

        for (self.reactions.items) |r| {
            allocator.free(r.id);
            allocator.free(r.message_id);
            allocator.free(r.room_id);
            allocator.free(r.user_id);
            allocator.free(r.emoji);
        }
        self.reactions.deinit(allocator);

        for (self.typing.items) |t| {
            allocator.free(t.room_id);
            allocator.free(t.user_id);
            allocator.free(t.username);
        }
        self.typing.deinit(allocator);

        for (self.presence.items) |p| {
            allocator.free(p.room_id);
            allocator.free(p.user_id);
            allocator.free(p.username);
        }
        self.presence.deinit(allocator);
    }

    pub fn nextRoomId(self: *State, allocator: std.mem.Allocator) ![]const u8 {
        const id = try std.fmt.allocPrint(allocator, "room-{d}", .{self.next_room_id});
        self.next_room_id += 1;
        return id;
    }

    pub fn nextMessageId(self: *State, allocator: std.mem.Allocator) ![]const u8 {
        const id = try std.fmt.allocPrint(allocator, "msg-{d}", .{self.next_message_id});
        self.next_message_id += 1;
        return id;
    }

    pub fn nextStreamId(self: *State, allocator: std.mem.Allocator) ![]const u8 {
        const id = try std.fmt.allocPrint(allocator, "stream-{d}", .{self.next_stream_id});
        self.next_stream_id += 1;
        return id;
    }

    pub fn nextSignalId(self: *State, allocator: std.mem.Allocator) ![]const u8 {
        const id = try std.fmt.allocPrint(allocator, "signal-{d}", .{self.next_signal_id});
        self.next_signal_id += 1;
        return id;
    }

    pub fn nextUserId(self: *State, allocator: std.mem.Allocator) ![]const u8 {
        const id = try std.fmt.allocPrint(allocator, "user-{d}", .{self.next_user_id});
        self.next_user_id += 1;
        return id;
    }

    pub fn nextReactionId(self: *State, allocator: std.mem.Allocator) ![]const u8 {
        const id = try std.fmt.allocPrint(allocator, "rxn-{d}", .{self.next_reaction_id});
        self.next_reaction_id += 1;
        return id;
    }

    pub fn nextSessionToken(_: *State, allocator: std.mem.Allocator) ![]const u8 {
        var bytes: [32]u8 = undefined;
        std.crypto.random.bytes(&bytes);
        const hex = std.fmt.bytesToHex(bytes, .lower);
        return try allocator.dupe(u8, &hex);
    }
};

test "state id generators increment independently" {
    var state = State.init(std.testing.allocator);
    defer state.deinit(std.testing.allocator);

    const room_id = try state.nextRoomId(std.testing.allocator);
    defer std.testing.allocator.free(room_id);
    const message_id = try state.nextMessageId(std.testing.allocator);
    defer std.testing.allocator.free(message_id);
    const stream_id = try state.nextStreamId(std.testing.allocator);
    defer std.testing.allocator.free(stream_id);
    const signal_id = try state.nextSignalId(std.testing.allocator);
    defer std.testing.allocator.free(signal_id);

    try std.testing.expectEqualStrings("room-1", room_id);
    try std.testing.expectEqualStrings("msg-1", message_id);
    try std.testing.expectEqualStrings("stream-1", stream_id);
    try std.testing.expectEqualStrings("signal-1", signal_id);
}
