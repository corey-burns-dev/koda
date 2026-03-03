const std = @import("std");
const store = @import("../store.zig");

pub const VoiceService = struct {
    state: *store.State,
    allocator: std.mem.Allocator,

    pub fn init(state: *store.State, allocator: std.mem.Allocator) VoiceService {
        return .{ .state = state, .allocator = allocator };
    }

    pub fn joinVoice(self: *VoiceService, room_id: []const u8, user_id: []const u8) !void {
        for (self.state.voice_participants.items) |participant| {
            if (std.mem.eql(u8, participant.room_id, room_id) and std.mem.eql(u8, participant.user_id, user_id)) {
                return;
            }
        }

        try self.state.voice_participants.append(self.allocator, .{
            .room_id = try self.allocator.dupe(u8, room_id),
            .user_id = try self.allocator.dupe(u8, user_id),
            .muted = false,
            .deafened = false,
        });
    }

    pub fn setMuted(self: *VoiceService, room_id: []const u8, user_id: []const u8, muted: bool) !void {
        for (self.state.voice_participants.items) |*participant| {
            if (std.mem.eql(u8, participant.room_id, room_id) and std.mem.eql(u8, participant.user_id, user_id)) {
                participant.muted = muted;
                return;
            }
        }
        return error.ParticipantNotFound;
    }
};
