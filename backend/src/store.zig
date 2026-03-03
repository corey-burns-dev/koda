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
    live: bool,
};

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

pub const State = struct {
    rooms: std.ArrayList(Room),
    messages: std.ArrayList(Message),
    streams: std.ArrayList(StreamSession),
    voice_participants: std.ArrayList(VoiceParticipant),
    signal_events: std.ArrayList(SignalEvent),
    next_room_id: u64,
    next_message_id: u64,
    next_stream_id: u64,
    next_signal_id: u64,

    pub fn init(allocator: std.mem.Allocator) State {
        _ = allocator;
        return .{
            .rooms = .empty,
            .messages = .empty,
            .streams = .empty,
            .voice_participants = .empty,
            .signal_events = .empty,
            .next_room_id = 1,
            .next_message_id = 1,
            .next_stream_id = 1,
            .next_signal_id = 1,
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

        for (self.streams.items) |stream| {
            allocator.free(stream.id);
            allocator.free(stream.room_id);
            allocator.free(stream.host_user_id);
            allocator.free(stream.title);
        }
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
