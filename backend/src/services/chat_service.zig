const std = @import("std");
const store = @import("../store.zig");

pub const ChatService = struct {
    state: *store.State,
    allocator: std.mem.Allocator,

    pub fn init(state: *store.State, allocator: std.mem.Allocator) ChatService {
        return .{ .state = state, .allocator = allocator };
    }

    pub fn sendMessage(self: *ChatService, room_id: []const u8, user_id: []const u8, body: []const u8) !store.Message {
        const message = store.Message{
            .id = try self.state.nextMessageId(self.allocator),
            .room_id = try self.allocator.dupe(u8, room_id),
            .user_id = try self.allocator.dupe(u8, user_id),
            .body = try self.allocator.dupe(u8, body),
            .sent_at_unix_ms = std.time.milliTimestamp(),
        };
        try self.state.messages.append(self.allocator, message);
        return message;
    }

    pub fn listByRoom(self: *ChatService, room_id: []const u8) !std.ArrayList(store.Message) {
        var result: std.ArrayList(store.Message) = .empty;
        for (self.state.messages.items) |message| {
            if (!std.mem.eql(u8, message.room_id, room_id)) continue;
            try result.append(self.allocator, message);
        }
        return result;
    }
};
