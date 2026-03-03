const std = @import("std");
const store = @import("../store.zig");
const bcrypt = std.crypto.pwhash.bcrypt;

const bcrypt_params = bcrypt.Params{
    .rounds_log = 8,
    .silently_truncate_password = false,
};

const PasswordVerification = enum {
    invalid,
    valid,
    valid_legacy,
};

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
        for (self.state.users.items) |*user| {
            if (std.mem.eql(u8, user.email, email)) {
                switch (try self.verifyPassword(user.password_hash, password)) {
                    .valid => return user.*,
                    .valid_legacy => {
                        const upgraded_hash = try self.hashPassword(password);
                        self.allocator.free(user.password_hash);
                        user.password_hash = upgraded_hash;
                        return user.*;
                    },
                    .invalid => return error.InvalidPassword,
                }
            }
        }

        return error.UserNotFound;
    }

    fn hashPassword(self: *UserService, password: []const u8) ![]const u8 {
        var hash_buffer: [bcrypt.hash_length]u8 = undefined;
        const hash = try bcrypt.strHash(password, .{
            .params = bcrypt_params,
            .encoding = .crypt,
        }, &hash_buffer);

        return try self.allocator.dupe(u8, hash);
    }

    fn verifyPassword(self: *UserService, password_hash: []const u8, password: []const u8) !PasswordVerification {
        _ = self;

        bcrypt.strVerify(password_hash, password, .{ .silently_truncate_password = false }) catch |err| switch (err) {
            error.PasswordVerificationFailed => {
                if (isLegacySha256Hash(password_hash) and verifyLegacySha256Password(password_hash, password)) {
                    return .valid_legacy;
                }
                return .invalid;
            },
            error.InvalidEncoding => {
                if (isLegacySha256Hash(password_hash) and verifyLegacySha256Password(password_hash, password)) {
                    return .valid_legacy;
                }
                return .invalid;
            },
            else => return err,
        };
        return .valid;
    }

    fn verifyLegacySha256Password(password_hash: []const u8, password: []const u8) bool {
        var hash: [std.crypto.hash.sha2.Sha256.digest_length]u8 = undefined;
        std.crypto.hash.sha2.Sha256.hash(password, &hash, .{});

        const legacy_hash = std.fmt.bytesToHex(hash, .lower);
        return std.mem.eql(u8, password_hash, &legacy_hash);
    }

    fn isLegacySha256Hash(password_hash: []const u8) bool {
        if (password_hash.len != std.crypto.hash.sha2.Sha256.digest_length * 2) return false;
        for (password_hash) |ch| {
            const is_num = ch >= '0' and ch <= '9';
            const is_lower_hex = ch >= 'a' and ch <= 'f';
            const is_upper_hex = ch >= 'A' and ch <= 'F';
            if (!is_num and !is_lower_hex and !is_upper_hex) return false;
        }
        return true;
    }
};

test "register stores bcrypt hash and login verifies password" {
    var state = store.State.init(std.testing.allocator);
    defer state.deinit(std.testing.allocator);

    var users = UserService.init(&state, std.testing.allocator);

    const created = try users.register("alice", "alice@example.com", "secret123");
    try std.testing.expectEqual(@as(usize, bcrypt.hash_length), created.password_hash.len);
    try std.testing.expect(std.mem.startsWith(u8, created.password_hash, "$2"));

    const authenticated = try users.login("alice@example.com", "secret123");
    try std.testing.expectEqualStrings(created.id, authenticated.id);
    try std.testing.expectError(
        error.InvalidPassword,
        users.login("alice@example.com", "wrong-password"),
    );
}

test "login upgrades legacy sha256 password hashes to bcrypt" {
    var state = store.State.init(std.testing.allocator);
    defer state.deinit(std.testing.allocator);

    var users = UserService.init(&state, std.testing.allocator);

    var legacy_sha: [std.crypto.hash.sha2.Sha256.digest_length]u8 = undefined;
    std.crypto.hash.sha2.Sha256.hash("legacy-pass", &legacy_sha, .{});
    const legacy_hash = std.fmt.bytesToHex(legacy_sha, .lower);
    const original_hash_copy = try std.testing.allocator.dupe(u8, &legacy_hash);
    defer std.testing.allocator.free(original_hash_copy);

    try state.users.append(std.testing.allocator, .{
        .id = try std.testing.allocator.dupe(u8, "user-legacy"),
        .username = try std.testing.allocator.dupe(u8, "legacy-user"),
        .email = try std.testing.allocator.dupe(u8, "legacy@example.com"),
        .password_hash = try std.testing.allocator.dupe(u8, &legacy_hash),
    });

    _ = try users.login("legacy@example.com", "legacy-pass");
    try std.testing.expectEqual(@as(usize, bcrypt.hash_length), state.users.items[0].password_hash.len);
    try std.testing.expect(std.mem.startsWith(u8, state.users.items[0].password_hash, "$2"));
    try std.testing.expect(!std.mem.eql(u8, state.users.items[0].password_hash, original_hash_copy));
}
