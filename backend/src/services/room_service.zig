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

test "createRoom generates ids and listRooms returns created rooms" {
    var state = store.State.init(std.testing.allocator);
    defer state.deinit(std.testing.allocator);

    var rooms = RoomService.init(&state, std.testing.allocator);

    const lobby = try rooms.createRoom("Lobby", .text);
    const stage = try rooms.createRoom("Stage", .stream);

    try std.testing.expectEqualStrings("room-1", lobby.id);
    try std.testing.expectEqualStrings("room-2", stage.id);
    try std.testing.expectEqual(types.RoomKind.text, lobby.kind);
    try std.testing.expectEqual(types.RoomKind.stream, stage.kind);

    const all_rooms = rooms.listRooms();
    try std.testing.expectEqual(@as(usize, 2), all_rooms.len);
    try std.testing.expectEqualStrings("Lobby", all_rooms[0].name);
    try std.testing.expectEqualStrings("Stage", all_rooms[1].name);
}
