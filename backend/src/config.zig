const std = @import("std");

pub const Config = struct {
    host: []const u8,
    port: u16,
    cors_origin: []const u8,
    media_rtmp_base_url: []const u8,
    media_hls_base_url: []const u8,
    db_path: []const u8,

    pub fn deinit(self: *Config, allocator: std.mem.Allocator) void {
        allocator.free(self.host);
        allocator.free(self.cors_origin);
        allocator.free(self.media_rtmp_base_url);
        allocator.free(self.media_hls_base_url);
        allocator.free(self.db_path);
    }
};

pub fn load(allocator: std.mem.Allocator) !Config {
    const host = try envOrDefault(allocator, "KODA_HOST", "0.0.0.0");
    errdefer allocator.free(host);

    const port_raw = try envOrDefault(allocator, "KODA_PORT", "8080");
    defer allocator.free(port_raw);
    const port = std.fmt.parseInt(u16, port_raw, 10) catch 8080;

    const cors_origin = try envOrDefault(allocator, "KODA_CORS_ORIGIN", "http://localhost:5173");
    errdefer allocator.free(cors_origin);

    const media_rtmp_base_url = try envOrDefault(allocator, "KODA_MEDIA_RTMP_BASE_URL", "rtmp://localhost:1935/live");
    errdefer allocator.free(media_rtmp_base_url);

    const media_hls_base_url = try envOrDefault(allocator, "KODA_MEDIA_HLS_BASE_URL", "http://localhost:8888/live");
    errdefer allocator.free(media_hls_base_url);

    const db_path = try envOrDefault(allocator, "KODA_DB_PATH", "./koda.db");

    return .{
        .host = host,
        .port = port,
        .cors_origin = cors_origin,
        .media_rtmp_base_url = media_rtmp_base_url,
        .media_hls_base_url = media_hls_base_url,
        .db_path = db_path,
    };
}

fn envOrDefault(allocator: std.mem.Allocator, key: []const u8, fallback: []const u8) ![]u8 {
    return std.process.getEnvVarOwned(allocator, key) catch |err| switch (err) {
        error.EnvironmentVariableNotFound => allocator.dupe(u8, fallback),
        else => err,
    };
}
