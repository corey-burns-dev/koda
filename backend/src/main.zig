const std = @import("std");
const server = @import("server.zig");

pub fn main() !void {
    var gpa = std.heap.GeneralPurposeAllocator(.{}){};
    defer _ = gpa.deinit();

    var koda_server = try server.KodaServer.init(gpa.allocator());
    defer koda_server.deinit();

    try koda_server.run();
}
