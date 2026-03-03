const std = @import("std");
const server = @import("server.zig");

pub fn main() !void {
    var gpa = std.heap.GeneralPurposeAllocator(.{}){};
    defer _ = gpa.deinit();

    var punch_server = try server.PunchServer.init(gpa.allocator());
    defer punch_server.deinit();

    try punch_server.run();
}
