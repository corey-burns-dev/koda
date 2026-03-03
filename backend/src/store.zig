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

pub const State = struct {
    rooms: std.ArrayList(Room),
    messages: std.ArrayList(Message),
    streams: std.ArrayList(StreamSession),
    voice_participants: std.ArrayList(VoiceParticipant),
    next_room_id: u64,
    next_message_id: u64,
    next_stream_id: u64,

    pub fn init(allocator: std.mem.Allocator) State {
        _ = allocator;
        return .{
            .rooms = .empty,
            .messages = .empty,
            .streams = .empty,
            .voice_participants = .empty,
            .next_room_id = 1,
            .next_message_id = 1,
            .next_stream_id = 1,
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
};
