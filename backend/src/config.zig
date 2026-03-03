const std = @import("std");

pub const Config = struct {
    host: []const u8,
    port: u16,
    cors_origin: []const u8,

    pub fn deinit(self: *Config, allocator: std.mem.Allocator) void {
        allocator.free(self.host);
        allocator.free(self.cors_origin);
    }
};

pub fn load(allocator: std.mem.Allocator) !Config {
    const host = try envOrDefault(allocator, "KODA_HOST", "0.0.0.0");
    errdefer allocator.free(host);

    const port_raw = try envOrDefault(allocator, "KODA_PORT", "8080");
    defer allocator.free(port_raw);
    const port = std.fmt.parseInt(u16, port_raw, 10) catch 8080;

    const cors_origin = try envOrDefault(allocator, "KODA_CORS_ORIGIN", "http://localhost:5173");

    return .{
        .host = host,
        .port = port,
        .cors_origin = cors_origin,
    };
}

fn envOrDefault(allocator: std.mem.Allocator, key: []const u8, fallback: []const u8) ![]u8 {
    return std.process.getEnvVarOwned(allocator, key) catch |err| switch (err) {
        error.EnvironmentVariableNotFound => allocator.dupe(u8, fallback),
        else => err,
    };
}
