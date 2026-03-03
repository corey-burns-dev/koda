const std = @import("std");
const http = std.http;

const app_mod = @import("app.zig");
const config_mod = @import("config.zig");
const store = @import("store.zig");
const types = @import("types.zig");

pub const PunchServer = struct {
    allocator: std.mem.Allocator,
    config: config_mod.Config,
    app: app_mod.App,
    state_mutex: std.Thread.Mutex = .{},
    update_id: std.atomic.Value(u32) = .init(0),

    const default_room_id = "room-1";

    pub fn init(allocator: std.mem.Allocator) !PunchServer {
        var cfg = try config_mod.load(allocator);
        errdefer cfg.deinit(allocator);

        var app = try app_mod.App.init(allocator);
        errdefer app.deinit();

        var server = PunchServer{
            .allocator = allocator,
            .config = cfg,
            .app = app,
        };

        try server.seedData();
        return server;
    }

    pub fn deinit(self: *PunchServer) void {
        self.app.deinit();
        self.config.deinit(self.allocator);
    }

    pub fn run(self: *PunchServer) !void {
        const address = try std.net.Address.parseIp(self.config.host, self.config.port);
        var tcp = try address.listen(.{ .reuse_address = true });
        defer tcp.deinit();

        std.debug.print("Punch backend listening at http://{f}\n", .{tcp.listen_address});

        while (true) {
            const connection = tcp.accept() catch |err| {
                std.log.err("failed to accept connection: {s}", .{@errorName(err)});
                continue;
            };
            const thread = std.Thread.spawn(.{}, acceptConnection, .{ self, connection }) catch |err| {
                std.log.err("failed to spawn connection thread: {s}", .{@errorName(err)});
                connection.stream.close();
                continue;
            };
            thread.detach();
        }
    }

    fn seedData(self: *PunchServer) !void {
        self.state_mutex.lock();
        defer self.state_mutex.unlock();

        if (self.app.state.rooms.items.len > 0) return;

        var rooms = self.app.roomService();
        const lobby = try rooms.createRoom("lobby", .text);
        const stage = try rooms.createRoom("stage", .stream);

        var chat = self.app.chatService();
        _ = try chat.sendMessage(lobby.id, "system", "Punch backend is online.");

        var streams = self.app.streamService();
        _ = try streams.startStream(stage.id, "system", "Welcome to Punch");

        var voice = self.app.voiceService();
        try voice.joinVoice(stage.id, "system");
    }

    fn acceptConnection(self: *PunchServer, connection: std.net.Server.Connection) void {
        defer connection.stream.close();

        var send_buffer: [8192]u8 = undefined;
        var recv_buffer: [8192]u8 = undefined;

        var connection_reader = connection.stream.reader(&recv_buffer);
        var connection_writer = connection.stream.writer(&send_buffer);
        var server: http.Server = .init(connection_reader.interface(), &connection_writer.interface);

        while (true) {
            var request = server.receiveHead() catch |err| switch (err) {
                error.HttpConnectionClosing => return,
                else => {
                    std.log.err("failed to receive request: {s}", .{@errorName(err)});
                    return;
                },
            };

            switch (request.upgradeRequested()) {
                .websocket => |opt_key| {
                    self.handleWebSocketUpgrade(&request, opt_key) catch |err| {
                        std.log.err("websocket upgrade failed: {s}", .{@errorName(err)});
                    };
                    return;
                },
                .other => {
                    self.respondText(&request, .bad_request, "unsupported upgrade request") catch {};
                    return;
                },
                .none => {
                    self.serveHttp(&request) catch |err| {
                        std.log.err("route error {s} {s}: {s}", .{ @tagName(request.head.method), request.head.target, @errorName(err) });
                        self.respondRouteError(&request, err) catch {};
                        return;
                    };
                },
            }
        }
    }

    fn serveHttp(self: *PunchServer, request: *http.Server.Request) !void {
        const target = splitTarget(request.head.target);

        if (request.head.method == .OPTIONS) {
            return self.respondOptions(request);
        }

        if (std.mem.eql(u8, target.path, "/") and request.head.method == .GET) {
            return self.respondText(request, .ok, "Punch backend\n");
        }

        if (std.mem.eql(u8, target.path, "/health") and request.head.method == .GET) {
            return self.respondJson(request, .ok, "{\"ok\":true,\"service\":\"punch-backend\"}");
        }

        if (std.mem.eql(u8, target.path, "/api/rooms")) {
            switch (request.head.method) {
                .GET => {
                    const payload = try self.buildRoomsJson();
                    defer self.allocator.free(payload);
                    return self.respondJson(request, .ok, payload);
                },
                .POST => {
                    const payload = try self.handleCreateRoom(request);
                    defer self.allocator.free(payload);
                    return self.respondJson(request, .created, payload);
                },
                else => return self.respondText(request, .method_not_allowed, "method not allowed"),
            }
        }

        if (std.mem.eql(u8, target.path, "/api/messages")) {
            switch (request.head.method) {
                .GET => {
                    const room_id = queryValue(target.query, "room_id") orelse default_room_id;
                    const payload = try self.buildMessagesJson(room_id);
                    defer self.allocator.free(payload);
                    return self.respondJson(request, .ok, payload);
                },
                .POST => {
                    const payload = try self.handleCreateMessage(request);
                    defer self.allocator.free(payload);
                    return self.respondJson(request, .created, payload);
                },
                else => return self.respondText(request, .method_not_allowed, "method not allowed"),
            }
        }

        if (std.mem.eql(u8, target.path, "/api/streams")) {
            switch (request.head.method) {
                .GET => {
                    const payload = try self.buildStreamsJson();
                    defer self.allocator.free(payload);
                    return self.respondJson(request, .ok, payload);
                },
                .POST => {
                    const payload = try self.handleStartStream(request);
                    defer self.allocator.free(payload);
                    return self.respondJson(request, .created, payload);
                },
                else => return self.respondText(request, .method_not_allowed, "method not allowed"),
            }
        }

        if (std.mem.eql(u8, target.path, "/api/streams/stop")) {
            switch (request.head.method) {
                .POST => {
                    const payload = try self.handleStopStream(request);
                    defer self.allocator.free(payload);
                    return self.respondJson(request, .ok, payload);
                },
                else => return self.respondText(request, .method_not_allowed, "method not allowed"),
            }
        }

        if (std.mem.eql(u8, target.path, "/api/auth/register") and request.head.method == .POST) {
            const payload = try self.handleRegister(request);
            defer self.allocator.free(payload);
            return self.respondJson(request, .created, payload);
        }

        if (std.mem.eql(u8, target.path, "/api/auth/login") and request.head.method == .POST) {
            const payload = try self.handleLogin(request);
            defer self.allocator.free(payload);
            return self.respondJson(request, .ok, payload);
        }

        return self.respondText(request, .not_found, "not found");
    }

    fn handleRegister(self: *PunchServer, request: *http.Server.Request) ![]u8 {
        const body = try self.readBody(request, 16 * 1024);
        defer self.allocator.free(body);

        const UserRegister = struct {
            username: []const u8,
            email: []const u8,
            password: []const u8,
        };

        var parsed = std.json.parseFromSlice(UserRegister, self.allocator, body, .{ .ignore_unknown_fields = true }) catch return error.InvalidJson;
        defer parsed.deinit();

        const username = std.mem.trim(u8, parsed.value.username, " \t\r\n");
        const email = std.mem.trim(u8, parsed.value.email, " \t\r\n");
        const password = std.mem.trim(u8, parsed.value.password, " \t\r\n");

        if (username.len == 0 or email.len == 0 or password.len == 0) return error.InvalidRegistration;

        self.state_mutex.lock();
        defer self.state_mutex.unlock();

        var users = self.app.userService();
        const user = try users.register(username, email, password);
        return try self.buildUserJson(user);
    }

    fn handleLogin(self: *PunchServer, request: *http.Server.Request) ![]u8 {
        const body = try self.readBody(request, 16 * 1024);
        defer self.allocator.free(body);

        const UserLogin = struct {
            email: []const u8,
            password: []const u8,
        };

        var parsed = std.json.parseFromSlice(UserLogin, self.allocator, body, .{ .ignore_unknown_fields = true }) catch return error.InvalidJson;
        defer parsed.deinit();

        const email = std.mem.trim(u8, parsed.value.email, " \t\r\n");
        const password = std.mem.trim(u8, parsed.value.password, " \t\r\n");

        if (email.len == 0 or password.len == 0) return error.InvalidLogin;

        self.state_mutex.lock();
        defer self.state_mutex.unlock();

        var users = self.app.userService();
        const user = try users.login(email, password);
        return try self.buildUserJson(user);
    }

    fn buildUserJson(self: *PunchServer, user: store.User) ![]u8 {
        var out: std.ArrayList(u8) = .empty;
        errdefer out.deinit(self.allocator);

        var writer = out.writer(self.allocator);
        try self.writeUserObject(&writer, user);
        return try out.toOwnedSlice(self.allocator);
    }

    fn writeUserObject(self: *PunchServer, writer: anytype, user: store.User) !void {
        _ = self;
        try writer.writeByte('{');
        try writer.writeAll("\"id\":");
        try writeJsonString(writer, user.id);
        try writer.writeAll(",\"username\":");
        try writeJsonString(writer, user.username);
        try writer.writeAll(",\"email\":");
        try writeJsonString(writer, user.email);
        try writer.writeByte('}');
    }

    fn handleCreateRoom(self: *PunchServer, request: *http.Server.Request) ![]u8 {
        const body = try self.readBody(request, 16 * 1024);
        defer self.allocator.free(body);

        const RoomCreate = struct {
            name: []const u8,
            kind: ?[]const u8 = null,
        };

        var parsed = try std.json.parseFromSlice(RoomCreate, self.allocator, body, .{ .ignore_unknown_fields = true });
        defer parsed.deinit();

        const name = std.mem.trim(u8, parsed.value.name, " \t\r\n");
        if (name.len == 0) return error.InvalidRoomName;

        const kind = parseRoomKind(parsed.value.kind orelse "text");

        self.state_mutex.lock();
        defer self.state_mutex.unlock();

        var rooms = self.app.roomService();
        const room = try rooms.createRoom(name, kind);
        return try self.buildRoomJson(room);
    }

    fn handleCreateMessage(self: *PunchServer, request: *http.Server.Request) ![]u8 {
        const body = try self.readBody(request, 64 * 1024);
        defer self.allocator.free(body);

        const MessageCreate = struct {
            room_id: []const u8,
            user_id: []const u8,
            body: []const u8,
        };

        var parsed = try std.json.parseFromSlice(MessageCreate, self.allocator, body, .{ .ignore_unknown_fields = true });
        defer parsed.deinit();

        const room_id = std.mem.trim(u8, parsed.value.room_id, " \t\r\n");
        const user_id = std.mem.trim(u8, parsed.value.user_id, " \t\r\n");
        const message_body = std.mem.trim(u8, parsed.value.body, " \t\r\n");

        if (room_id.len == 0 or user_id.len == 0 or message_body.len == 0) {
            return error.InvalidMessage;
        }

        const message = try self.appendMessage(room_id, user_id, message_body);
        return try self.buildChatEventJson(message);
    }

    fn handleStartStream(self: *PunchServer, request: *http.Server.Request) ![]u8 {
        const body = try self.readBody(request, 64 * 1024);
        defer self.allocator.free(body);

        const StreamStart = struct {
            room_id: []const u8,
            user_id: []const u8,
            title: []const u8,
        };

        var parsed = try std.json.parseFromSlice(StreamStart, self.allocator, body, .{ .ignore_unknown_fields = true });
        defer parsed.deinit();

        const room_id = std.mem.trim(u8, parsed.value.room_id, " \t\r\n");
        const user_id = std.mem.trim(u8, parsed.value.user_id, " \t\r\n");
        const title = std.mem.trim(u8, parsed.value.title, " \t\r\n");

        if (room_id.len == 0 or user_id.len == 0 or title.len == 0) {
            return error.InvalidStreamStart;
        }

        self.state_mutex.lock();
        defer self.state_mutex.unlock();

        var streams = self.app.streamService();
        const stream = try streams.startStream(room_id, user_id, title);
        self.notifyUpdate();
        return try self.buildStreamJson(stream);
    }

    fn handleStopStream(self: *PunchServer, request: *http.Server.Request) ![]u8 {
        const body = try self.readBody(request, 32 * 1024);
        defer self.allocator.free(body);

        const StreamStop = struct {
            stream_id: []const u8,
        };

        var parsed = try std.json.parseFromSlice(StreamStop, self.allocator, body, .{ .ignore_unknown_fields = true });
        defer parsed.deinit();

        const stream_id = std.mem.trim(u8, parsed.value.stream_id, " \t\r\n");
        if (stream_id.len == 0) return error.InvalidStreamId;

        self.state_mutex.lock();
        defer self.state_mutex.unlock();

        var streams = self.app.streamService();
        try streams.stopStream(stream_id);
        self.notifyUpdate();

        for (self.app.state.streams.items) |stream| {
            if (std.mem.eql(u8, stream.id, stream_id)) {
                return try self.buildStreamJson(stream);
            }
        }

        return error.StreamNotFound;
    }

    fn readBody(self: *PunchServer, request: *http.Server.Request, max_len: usize) ![]u8 {
        const len_u64 = request.head.content_length orelse return error.MissingContentLength;
        const len: usize = std.math.cast(usize, len_u64) orelse return error.BodyTooLarge;
        if (len > max_len) return error.BodyTooLarge;

        var body_buffer: [2048]u8 = undefined;
        const reader = try request.readerExpectContinue(&body_buffer);
        return try reader.readAlloc(self.allocator, len);
    }

    fn handleWebSocketUpgrade(self: *PunchServer, request: *http.Server.Request, opt_key: ?[]const u8) !void {
        const target = splitTarget(request.head.target);
        const is_chat = std.mem.eql(u8, target.path, "/ws/chat");
        const is_signal = std.mem.eql(u8, target.path, "/ws/signal");
        if (!is_chat and !is_signal) {
            return self.respondText(request, .not_found, "ws route not found");
        }

        const key = opt_key orelse return error.MissingWebSocketKey;

        const room_param = queryValue(target.query, "room_id") orelse default_room_id;
        const user_param = queryValue(target.query, "user_id") orelse "guest";

        const room_id = try self.allocator.dupe(u8, room_param);
        defer self.allocator.free(room_id);

        const user_id = try self.allocator.dupe(u8, user_param);
        defer self.allocator.free(user_id);

        const headers = [_]http.Header{
            .{ .name = "Access-Control-Allow-Origin", .value = self.config.cors_origin },
        };

        var socket = try request.respondWebSocket(.{
            .key = key,
            .extra_headers = &headers,
        });
        try socket.flush();

        if (is_chat) {
            try self.serveChatSocket(&socket, room_id, user_id);
            return;
        }

        try self.serveSignalSocket(&socket, room_id, user_id);
    }

    fn serveChatSocket(self: *PunchServer, socket: *http.Server.WebSocket, room_id: []const u8, user_id: []const u8) !void {
        var closed = std.atomic.Value(bool).init(false);
        var ctx = WebSocketRecvContext{
            .server = self,
            .socket = socket,
            .room_id = room_id,
            .user_id = user_id,
            .closed = &closed,
        };

        const recv_thread = try std.Thread.spawn(.{}, receiveSocketMessages, .{&ctx});
        defer recv_thread.join();

        var last_seen: usize = 0;
        self.state_mutex.lock();
        last_seen = self.app.state.messages.items.len;
        self.state_mutex.unlock();

        while (true) {
            if (closed.load(.acquire)) return;

            const update_before = self.update_id.load(.acquire);

            var pending: std.ArrayList(store.Message) = .empty;
            defer pending.deinit(self.allocator);

            self.state_mutex.lock();
            const messages = self.app.state.messages.items;
            if (last_seen < messages.len) {
                for (messages[last_seen..]) |message| {
                    if (!std.mem.eql(u8, message.room_id, room_id)) continue;
                    try pending.append(self.allocator, message);
                }
                last_seen = messages.len;
            }
            self.state_mutex.unlock();

            for (pending.items) |message| {
                const event = try self.buildChatEventJson(message);
                defer self.allocator.free(event);
                socket.writeMessage(event, .text) catch {
                    return;
                };
            }

            if (pending.items.len == 0) {
                std.Thread.Futex.timedWait(&self.update_id, update_before, 250 * std.time.ns_per_ms) catch {};
            }
        }
    }

    fn serveSignalSocket(self: *PunchServer, socket: *http.Server.WebSocket, room_id: []const u8, user_id: []const u8) !void {
        var closed = std.atomic.Value(bool).init(false);
        var ctx = SignalWebSocketRecvContext{
            .server = self,
            .socket = socket,
            .room_id = room_id,
            .user_id = user_id,
            .closed = &closed,
        };

        const recv_thread = try std.Thread.spawn(.{}, receiveSignalSocketMessages, .{&ctx});
        defer recv_thread.join();

        var last_seen: usize = 0;
        self.state_mutex.lock();
        last_seen = self.app.state.signal_events.items.len;
        self.state_mutex.unlock();

        while (true) {
            if (closed.load(.acquire)) return;

            const update_before = self.update_id.load(.acquire);

            var pending: std.ArrayList(store.SignalEvent) = .empty;
            defer pending.deinit(self.allocator);

            self.state_mutex.lock();
            const events = self.app.state.signal_events.items;
            if (last_seen < events.len) {
                for (events[last_seen..]) |event| {
                    if (!std.mem.eql(u8, event.room_id, room_id)) continue;
                    if (std.mem.eql(u8, event.user_id, user_id)) continue;
                    try pending.append(self.allocator, event);
                }
                last_seen = events.len;
            }
            self.state_mutex.unlock();

            for (pending.items) |event| {
                const payload = try self.buildSignalEventJson(event);
                defer self.allocator.free(payload);
                socket.writeMessage(payload, .text) catch {
                    return;
                };
            }

            if (pending.items.len == 0) {
                std.Thread.Futex.timedWait(&self.update_id, update_before, 250 * std.time.ns_per_ms) catch {};
            }
        }
    }

    fn appendMessage(self: *PunchServer, room_id: []const u8, user_id: []const u8, body: []const u8) !store.Message {
        self.state_mutex.lock();
        defer self.state_mutex.unlock();

        var chat = self.app.chatService();
        const message = try chat.sendMessage(room_id, user_id, body);
        self.notifyUpdate();
        return message;
    }

    fn appendSignalEvent(self: *PunchServer, room_id: []const u8, user_id: []const u8, payload: []const u8) !store.SignalEvent {
        self.state_mutex.lock();
        defer self.state_mutex.unlock();

        const event = store.SignalEvent{
            .id = try self.app.state.nextSignalId(self.allocator),
            .room_id = try self.allocator.dupe(u8, room_id),
            .user_id = try self.allocator.dupe(u8, user_id),
            .payload = try self.allocator.dupe(u8, payload),
            .sent_at_unix_ms = std.time.milliTimestamp(),
        };

        try self.app.state.signal_events.append(self.allocator, event);
        self.notifyUpdate();
        return event;
    }

    fn buildRoomsJson(self: *PunchServer) ![]u8 {
        var out: std.ArrayList(u8) = .empty;
        errdefer out.deinit(self.allocator);

        var writer = out.writer(self.allocator);

        self.state_mutex.lock();
        defer self.state_mutex.unlock();

        try writer.writeByte('[');
        for (self.app.state.rooms.items, 0..) |room, idx| {
            if (idx != 0) try writer.writeByte(',');
            try self.writeRoomObject(&writer, room);
        }
        try writer.writeByte(']');

        return try out.toOwnedSlice(self.allocator);
    }

    fn buildMessagesJson(self: *PunchServer, room_id: []const u8) ![]u8 {
        var out: std.ArrayList(u8) = .empty;
        errdefer out.deinit(self.allocator);

        var writer = out.writer(self.allocator);

        self.state_mutex.lock();
        defer self.state_mutex.unlock();

        try writer.writeByte('[');
        var first = true;
        for (self.app.state.messages.items) |message| {
            if (!std.mem.eql(u8, message.room_id, room_id)) continue;
            if (!first) try writer.writeByte(',');
            first = false;
            try self.writeMessageObject(&writer, message);
        }
        try writer.writeByte(']');

        return try out.toOwnedSlice(self.allocator);
    }

    fn buildStreamsJson(self: *PunchServer) ![]u8 {
        var out: std.ArrayList(u8) = .empty;
        errdefer out.deinit(self.allocator);

        var writer = out.writer(self.allocator);

        self.state_mutex.lock();
        defer self.state_mutex.unlock();

        try writer.writeByte('[');
        for (self.app.state.streams.items, 0..) |stream, idx| {
            if (idx != 0) try writer.writeByte(',');
            try self.writeStreamObject(&writer, stream);
        }
        try writer.writeByte(']');

        return try out.toOwnedSlice(self.allocator);
    }

    fn buildRoomJson(self: *PunchServer, room: store.Room) ![]u8 {
        var out: std.ArrayList(u8) = .empty;
        errdefer out.deinit(self.allocator);

        var writer = out.writer(self.allocator);
        try self.writeRoomObject(&writer, room);
        return try out.toOwnedSlice(self.allocator);
    }

    fn buildChatEventJson(self: *PunchServer, message: store.Message) ![]u8 {
        var out: std.ArrayList(u8) = .empty;
        errdefer out.deinit(self.allocator);

        var writer = out.writer(self.allocator);
        try writer.writeAll("{\"type\":\"chat.message\",\"message\":");
        try self.writeMessageObject(&writer, message);
        try writer.writeByte('}');

        return try out.toOwnedSlice(self.allocator);
    }

    fn buildStreamJson(self: *PunchServer, stream: store.StreamSession) ![]u8 {
        var out: std.ArrayList(u8) = .empty;
        errdefer out.deinit(self.allocator);

        var writer = out.writer(self.allocator);
        try self.writeStreamObject(&writer, stream);
        return try out.toOwnedSlice(self.allocator);
    }

    fn buildSignalEventJson(self: *PunchServer, signal: store.SignalEvent) ![]u8 {
        var out: std.ArrayList(u8) = .empty;
        errdefer out.deinit(self.allocator);

        var writer = out.writer(self.allocator);
        try writer.writeAll("{\"type\":\"signal.message\",\"event\":{");
        try writer.writeAll("\"id\":");
        try writeJsonString(&writer, signal.id);
        try writer.writeAll(",\"room_id\":");
        try writeJsonString(&writer, signal.room_id);
        try writer.writeAll(",\"user_id\":");
        try writeJsonString(&writer, signal.user_id);
        try writer.writeAll(",\"payload\":");
        try writer.writeAll(signal.payload);
        try writer.print(",\"sent_at_unix_ms\":{d}", .{signal.sent_at_unix_ms});
        try writer.writeAll("}}");

        return try out.toOwnedSlice(self.allocator);
    }

    fn writeRoomObject(self: *PunchServer, writer: anytype, room: store.Room) !void {
        _ = self;
        try writer.writeByte('{');
        try writer.writeAll("\"id\":");
        try writeJsonString(writer, room.id);
        try writer.writeAll(",\"name\":");
        try writeJsonString(writer, room.name);
        try writer.writeAll(",\"kind\":");
        try writeJsonString(writer, roomKindString(room.kind));
        try writer.writeByte('}');
    }

    fn writeMessageObject(self: *PunchServer, writer: anytype, message: store.Message) !void {
        _ = self;
        try writer.writeByte('{');
        try writer.writeAll("\"id\":");
        try writeJsonString(writer, message.id);
        try writer.writeAll(",\"room_id\":");
        try writeJsonString(writer, message.room_id);
        try writer.writeAll(",\"user_id\":");
        try writeJsonString(writer, message.user_id);
        try writer.writeAll(",\"body\":");
        try writeJsonString(writer, message.body);
        try writer.print(",\"sent_at_unix_ms\":{d}", .{message.sent_at_unix_ms});
        try writer.writeByte('}');
    }

    fn writeStreamObject(self: *PunchServer, writer: anytype, stream: store.StreamSession) !void {
        _ = self;
        try writer.writeByte('{');
        try writer.writeAll("\"id\":");
        try writeJsonString(writer, stream.id);
        try writer.writeAll(",\"room_id\":");
        try writeJsonString(writer, stream.room_id);
        try writer.writeAll(",\"host_user_id\":");
        try writeJsonString(writer, stream.host_user_id);
        try writer.writeAll(",\"title\":");
        try writeJsonString(writer, stream.title);
        try writer.print(",\"live\":{s}", .{if (stream.live) "true" else "false"});
        try writer.writeByte('}');
    }

    fn notifyUpdate(self: *PunchServer) void {
        _ = self.update_id.rmw(.Add, 1, .release);
        std.Thread.Futex.wake(&self.update_id, 32);
    }

    fn respondJson(self: *PunchServer, request: *http.Server.Request, status: http.Status, body: []const u8) !void {
        const headers = [_]http.Header{
            .{ .name = "Content-Type", .value = "application/json; charset=utf-8" },
            .{ .name = "Access-Control-Allow-Origin", .value = self.config.cors_origin },
            .{ .name = "Access-Control-Allow-Headers", .value = "Content-Type" },
            .{ .name = "Access-Control-Allow-Methods", .value = "GET,POST,OPTIONS" },
        };
        try request.respond(body, .{ .status = status, .extra_headers = &headers });
    }

    fn respondText(self: *PunchServer, request: *http.Server.Request, status: http.Status, body: []const u8) !void {
        const headers = [_]http.Header{
            .{ .name = "Content-Type", .value = "text/plain; charset=utf-8" },
            .{ .name = "Access-Control-Allow-Origin", .value = self.config.cors_origin },
            .{ .name = "Access-Control-Allow-Headers", .value = "Content-Type" },
            .{ .name = "Access-Control-Allow-Methods", .value = "GET,POST,OPTIONS" },
        };
        try request.respond(body, .{ .status = status, .extra_headers = &headers });
    }

    fn respondOptions(self: *PunchServer, request: *http.Server.Request) !void {
        const headers = [_]http.Header{
            .{ .name = "Content-Type", .value = "text/plain; charset=utf-8" },
            .{ .name = "Access-Control-Allow-Origin", .value = self.config.cors_origin },
            .{ .name = "Access-Control-Allow-Headers", .value = "Content-Type" },
            .{ .name = "Access-Control-Allow-Methods", .value = "GET,POST,OPTIONS" },
        };
        try request.respond("", .{ .status = .no_content, .extra_headers = &headers });
    }

    fn respondRouteError(self: *PunchServer, request: *http.Server.Request, err: anyerror) !void {
        return switch (err) {
            error.InvalidRegistration => self.respondText(request, .bad_request, "username, email, and password are required"),
            error.InvalidLogin => self.respondText(request, .bad_request, "email and password are required"),
            error.InvalidJson => self.respondText(request, .bad_request, "invalid json payload"),
            error.UsernameTaken => self.respondText(request, .conflict, "username already taken"),
            error.EmailTaken => self.respondText(request, .conflict, "email already registered"),
            error.InvalidPassword, error.UserNotFound => self.respondText(request, .unauthorized, "invalid email or password"),
            error.MissingContentLength => self.respondText(request, .length_required, "content-length header is required"),
            error.BodyTooLarge => self.respondText(request, .payload_too_large, "request body too large"),
            else => self.respondText(request, .internal_server_error, "internal server error"),
        };
    }
};

const WebSocketRecvContext = struct {
    server: *PunchServer,
    socket: *http.Server.WebSocket,
    room_id: []const u8,
    user_id: []const u8,
    closed: *std.atomic.Value(bool),
};

fn receiveSocketMessages(ctx: *WebSocketRecvContext) void {
    defer {
        ctx.closed.store(true, .release);
        ctx.server.notifyUpdate();
    }

    while (true) {
        const packet = ctx.socket.readSmallMessage() catch return;
        if (packet.opcode != .text and packet.opcode != .binary) continue;

        const text = std.mem.trim(u8, packet.data, " \t\r\n");
        if (text.len == 0) continue;

        _ = ctx.server.appendMessage(ctx.room_id, ctx.user_id, text) catch {};
    }
}

const SignalWebSocketRecvContext = struct {
    server: *PunchServer,
    socket: *http.Server.WebSocket,
    room_id: []const u8,
    user_id: []const u8,
    closed: *std.atomic.Value(bool),
};

fn receiveSignalSocketMessages(ctx: *SignalWebSocketRecvContext) void {
    defer {
        ctx.closed.store(true, .release);
        ctx.server.notifyUpdate();
    }

    while (true) {
        const packet = ctx.socket.readSmallMessage() catch return;
        if (packet.opcode != .text and packet.opcode != .binary) continue;

        const payload = std.mem.trim(u8, packet.data, " \t\r\n");
        if (payload.len == 0) continue;

        _ = ctx.server.appendSignalEvent(ctx.room_id, ctx.user_id, payload) catch {};
    }
}

fn splitTarget(target: []const u8) struct {
    path: []const u8,
    query: ?[]const u8,
} {
    if (std.mem.indexOfScalar(u8, target, '?')) |idx| {
        return .{ .path = target[0..idx], .query = target[idx + 1 ..] };
    }
    return .{ .path = target, .query = null };
}

fn queryValue(query: ?[]const u8, key: []const u8) ?[]const u8 {
    const q = query orelse return null;

    var it = std.mem.splitScalar(u8, q, '&');
    while (it.next()) |pair| {
        if (pair.len == 0) continue;

        if (std.mem.indexOfScalar(u8, pair, '=')) |eq| {
            if (std.mem.eql(u8, pair[0..eq], key)) {
                return pair[eq + 1 ..];
            }
            continue;
        }

        if (std.mem.eql(u8, pair, key)) return "";
    }

    return null;
}

fn parseRoomKind(raw: []const u8) types.RoomKind {
    if (std.ascii.eqlIgnoreCase(raw, "voice")) return .voice;
    if (std.ascii.eqlIgnoreCase(raw, "video")) return .video;
    if (std.ascii.eqlIgnoreCase(raw, "stream")) return .stream;
    return .text;
}

fn roomKindString(kind: types.RoomKind) []const u8 {
    return switch (kind) {
        .text => "text",
        .voice => "voice",
        .video => "video",
        .stream => "stream",
    };
}

fn writeJsonString(writer: anytype, value: []const u8) !void {
    try writer.writeByte('"');
    for (value) |c| {
        switch (c) {
            '"' => try writer.writeAll("\\\""),
            '\\' => try writer.writeAll("\\\\"),
            '\n' => try writer.writeAll("\\n"),
            '\r' => try writer.writeAll("\\r"),
            '\t' => try writer.writeAll("\\t"),
            else => {
                if (c < 0x20) {
                    try writer.print("\\u00{x:0>2}", .{c});
                } else {
                    try writer.writeByte(c);
                }
            },
        }
    }
    try writer.writeByte('"');
}

test "splitTarget separates path and query" {
    const with_query = splitTarget("/api/messages?room_id=room-1&limit=10");
    try std.testing.expectEqualStrings("/api/messages", with_query.path);
    try std.testing.expect(with_query.query != null);
    try std.testing.expectEqualStrings("room_id=room-1&limit=10", with_query.query.?);

    const without_query = splitTarget("/health");
    try std.testing.expectEqualStrings("/health", without_query.path);
    try std.testing.expect(without_query.query == null);
}

test "queryValue finds key values and handles missing keys" {
    const query = "room_id=room-2&empty=&flag";
    try std.testing.expectEqualStrings("room-2", queryValue(query, "room_id").?);
    try std.testing.expectEqualStrings("", queryValue(query, "empty").?);
    try std.testing.expectEqualStrings("", queryValue(query, "flag").?);
    try std.testing.expect(queryValue(query, "missing") == null);
}

test "parseRoomKind is case-insensitive and defaults to text" {
    try std.testing.expectEqual(types.RoomKind.voice, parseRoomKind("Voice"));
    try std.testing.expectEqual(types.RoomKind.video, parseRoomKind("VIDEO"));
    try std.testing.expectEqual(types.RoomKind.stream, parseRoomKind("stream"));
    try std.testing.expectEqual(types.RoomKind.text, parseRoomKind("unknown"));
}

test "writeJsonString escapes control and quote characters" {
    var out: std.ArrayList(u8) = .empty;
    defer out.deinit(std.testing.allocator);

    var writer = out.writer(std.testing.allocator);
    try writeJsonString(&writer, "a\"\\\n\t\r\x01");

    try std.testing.expectEqualStrings("\"a\\\"\\\\\\n\\t\\r\\u0001\"", out.items);
}
