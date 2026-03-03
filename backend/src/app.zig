const std = @import("std");
const store = @import("store.zig");
const chat_service = @import("services/chat_service.zig");
const room_service = @import("services/room_service.zig");
const stream_service = @import("services/stream_service.zig");
const voice_service = @import("services/voice_service.zig");
const user_service = @import("services/user_service.zig");

pub const App = struct {
    allocator: std.mem.Allocator,
    state: store.State,

    pub fn init(allocator: std.mem.Allocator) !App {
        return .{
            .allocator = allocator,
            .state = store.State.init(allocator),
        };
    }

    pub fn deinit(self: *App) void {
        self.state.deinit(self.allocator);
    }

    pub fn roomService(self: *App) room_service.RoomService {
        return room_service.RoomService.init(&self.state, self.allocator);
    }

    pub fn chatService(self: *App) chat_service.ChatService {
        return chat_service.ChatService.init(&self.state, self.allocator);
    }

    pub fn streamService(self: *App) stream_service.StreamService {
        return stream_service.StreamService.init(&self.state, self.allocator);
    }

    pub fn voiceService(self: *App) voice_service.VoiceService {
        return voice_service.VoiceService.init(&self.state, self.allocator);
    }

    pub fn userService(self: *App) user_service.UserService {
        return user_service.UserService.init(&self.state, self.allocator);
    }
};
