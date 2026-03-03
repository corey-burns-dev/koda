const std = @import("std");
const store = @import("../store.zig");

pub const StreamService = struct {
    state: *store.State,
    allocator: std.mem.Allocator,

    pub fn init(state: *store.State, allocator: std.mem.Allocator) StreamService {
        return .{ .state = state, .allocator = allocator };
    }

    pub fn startStream(self: *StreamService, room_id: []const u8, host_user_id: []const u8, title: []const u8) !store.StreamSession {
        const stream = store.StreamSession{
            .id = try self.state.nextStreamId(self.allocator),
            .room_id = try self.allocator.dupe(u8, room_id),
            .host_user_id = try self.allocator.dupe(u8, host_user_id),
            .title = try self.allocator.dupe(u8, title),
            .live = true,
        };
        try self.state.streams.append(self.allocator, stream);
        return stream;
    }

    pub fn stopStream(self: *StreamService, stream_id: []const u8) !void {
        for (self.state.streams.items) |*stream| {
            if (std.mem.eql(u8, stream.id, stream_id)) {
                stream.live = false;
                return;
            }
        }
        return error.StreamNotFound;
    }
};
