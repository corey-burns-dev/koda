const std = @import("std");
const store = @import("../store.zig");
const types = @import("../types.zig");

pub const RoomService = struct {
    state: *store.State,
    allocator: std.mem.Allocator,

    pub fn init(state: *store.State, allocator: std.mem.Allocator) RoomService {
        return .{ .state = state, .allocator = allocator };
    }

    pub fn createRoom(self: *RoomService, name: []const u8, kind: types.RoomKind) !store.Room {
        const room = store.Room{
            .id = try self.state.nextRoomId(self.allocator),
            .name = try self.allocator.dupe(u8, name),
            .kind = kind,
        };
        try self.state.rooms.append(self.allocator, room);
        return room;
    }

    pub fn listRooms(self: *RoomService) []const store.Room {
        return self.state.rooms.items;
    }
};
