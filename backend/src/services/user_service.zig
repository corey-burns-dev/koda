const std = @import("std");
const store = @import("../store.zig");

pub const UserService = struct {
    state: *store.State,
    allocator: std.mem.Allocator,

    pub fn init(state: *store.State, allocator: std.mem.Allocator) UserService {
        return .{
            .state = state,
            .allocator = allocator,
        };
    }

    pub fn register(self: *UserService, username: []const u8, email: []const u8, password: []const u8) !store.User {
        for (self.state.users.items) |user| {
            if (std.mem.eql(u8, user.username, username)) return error.UsernameTaken;
            if (std.mem.eql(u8, user.email, email)) return error.EmailTaken;
        }

        const password_hash = try self.hashPassword(password);
        errdefer self.allocator.free(password_hash);

        const user = store.User{
            .id = try self.state.nextUserId(self.allocator),
            .username = try self.allocator.dupe(u8, username),
            .email = try self.allocator.dupe(u8, email),
            .password_hash = password_hash,
        };

        try self.state.users.append(self.allocator, user);
        return user;
    }

    pub fn login(self: *UserService, email: []const u8, password: []const u8) !store.User {
        const password_hash = try self.hashPassword(password);
        defer self.allocator.free(password_hash);

        for (self.state.users.items) |user| {
            if (std.mem.eql(u8, user.email, email)) {
                if (std.mem.eql(u8, user.password_hash, password_hash)) {
                    return user;
                }
                return error.InvalidPassword;
            }
        }

        return error.UserNotFound;
    }

    fn hashPassword(self: *UserService, password: []const u8) ![]const u8 {
        var hash: [std.crypto.hash.sha2.Sha256.digest_length]u8 = undefined;
        std.crypto.hash.sha2.Sha256.hash(password, &hash, .{});
        
        const hex_hash = try self.allocator.alloc(u8, hash.len * 2);
        for (hash, 0..) |b, i| {
            _ = std.fmt.bufPrint(hex_hash[i * 2 ..], "{x:0>2}", .{b}) catch unreachable;
        }
        return hex_hash;
    }
};
