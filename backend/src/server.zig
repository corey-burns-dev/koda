const std = @import("std");
const http = std.http;

const app_mod = @import("app.zig");
const config_mod = @import("config.zig");
const store = @import("store.zig");
const types = @import("types.zig");

const max_signal_payload_len = 16 * 1024;

pub const KodaServer = struct {
    allocator: std.mem.Allocator,
    config: config_mod.Config,
    app: app_mod.App,
    state_mutex: std.Thread.Mutex = .{},
    update_id: std.atomic.Value(u32) = .init(0),

    const default_room_id = "room-1";

    pub fn init(allocator: std.mem.Allocator) !KodaServer {
        var cfg = try config_mod.load(allocator);
        errdefer cfg.deinit(allocator);

        var app = try app_mod.App.init(allocator);
        errdefer app.deinit();

        var server = KodaServer{
            .allocator = allocator,
            .config = cfg,
            .app = app,
        };

        try server.seedData();
        return server;
    }

    pub fn deinit(self: *KodaServer) void {
        self.app.deinit();
        self.config.deinit(self.allocator);
    }

    pub fn run(self: *KodaServer) !void {
        const address = try std.net.Address.parseIp(self.config.host, self.config.port);
        var tcp = try address.listen(.{ .reuse_address = true });
        defer tcp.deinit();

        std.debug.print("Koda backend listening at http://{f}\n", .{tcp.listen_address});

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

    fn seedData(self: *KodaServer) !void {
        self.state_mutex.lock();
        defer self.state_mutex.unlock();

        if (self.app.state.rooms.items.len > 0) return;

        var rooms = self.app.roomService();
        const lobby = try rooms.createRoom("lobby", .text);
        const stage = try rooms.createRoom("stage", .stream);

        var chat = self.app.chatService();
        _ = try chat.sendMessage(lobby.id, "system", "Koda backend is online.");

        var streams = self.app.streamService();
        const seed_key = try self.generateStreamKey();
        defer self.allocator.free(seed_key);
        const seed_playback_url = try self.buildPlaybackUrl(seed_key);
        defer self.allocator.free(seed_playback_url);
        _ = try streams.startStream(
            stage.id,
            "system",
            "Welcome to Koda",
            seed_key,
            self.config.media_rtmp_base_url,
            seed_playback_url,
        );

        var voice = self.app.voiceService();
        try voice.joinVoice(stage.id, "system");
    }

    fn acceptConnection(self: *KodaServer, connection: std.net.Server.Connection) void {
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

    fn serveHttp(self: *KodaServer, request: *http.Server.Request) !void {
        const target = splitTarget(request.head.target);

        if (request.head.method == .OPTIONS) {
            return self.respondOptions(request);
        }

        if (std.mem.eql(u8, target.path, "/") and request.head.method == .GET) {
            return self.respondText(request, .ok, "Koda backend\n");
        }

        if (std.mem.eql(u8, target.path, "/health") and request.head.method == .GET) {
            return self.respondJson(request, .ok, "{\"ok\":true,\"service\":\"koda-backend\"}");
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

    fn handleRegister(self: *KodaServer, request: *http.Server.Request) ![]u8 {
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
        const token = try self.createSessionLocked(user.id);
        return try self.buildUserJson(user, token);
    }

    fn handleLogin(self: *KodaServer, request: *http.Server.Request) ![]u8 {
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
        const token = try self.createSessionLocked(user.id);
        return try self.buildUserJson(user, token);
    }

    fn buildUserJson(self: *KodaServer, user: store.User, token: []const u8) ![]u8 {
        var out: std.ArrayList(u8) = .empty;
        errdefer out.deinit(self.allocator);

        var writer = out.writer(self.allocator);
        try self.writeUserObject(&writer, user, token);
        return try out.toOwnedSlice(self.allocator);
    }

    fn writeUserObject(self: *KodaServer, writer: anytype, user: store.User, token: []const u8) !void {
        _ = self;
        try writer.writeByte('{');
        try writer.writeAll("\"id\":");
        try writeJsonString(writer, user.id);
        try writer.writeAll(",\"username\":");
        try writeJsonString(writer, user.username);
        try writer.writeAll(",\"email\":");
        try writeJsonString(writer, user.email);
        try writer.writeAll(",\"token\":");
        try writeJsonString(writer, token);
        try writer.writeByte('}');
    }

    fn handleCreateRoom(self: *KodaServer, request: *http.Server.Request) ![]u8 {
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

    fn handleCreateMessage(self: *KodaServer, request: *http.Server.Request) ![]u8 {
        const token = extractBearerToken(request) orelse return error.InvalidToken;

        self.state_mutex.lock();
        const maybe_uid = self.validateTokenLocked(token);
        const auth_user_id = if (maybe_uid) |uid| try self.allocator.dupe(u8, uid) else null;
        self.state_mutex.unlock();

        const user_id = auth_user_id orelse return error.InvalidToken;
        defer self.allocator.free(user_id);

        const body = try self.readBody(request, 64 * 1024);
        defer self.allocator.free(body);

        const MessageCreate = struct {
            room_id: []const u8,
            body: []const u8,
        };

        var parsed = try std.json.parseFromSlice(MessageCreate, self.allocator, body, .{ .ignore_unknown_fields = true });
        defer parsed.deinit();

        const room_id = std.mem.trim(u8, parsed.value.room_id, " \t\r\n");
        const message_body = std.mem.trim(u8, parsed.value.body, " \t\r\n");

        if (room_id.len == 0 or message_body.len == 0) {
            return error.InvalidMessage;
        }

        const message = try self.appendMessage(room_id, user_id, message_body);
        return try self.buildChatEventJson(message);
    }

    fn handleStartStream(self: *KodaServer, request: *http.Server.Request) ![]u8 {
        const token = extractBearerToken(request) orelse return error.InvalidToken;

        self.state_mutex.lock();
        const maybe_uid = self.validateTokenLocked(token);
        const auth_user_id = if (maybe_uid) |uid| try self.allocator.dupe(u8, uid) else null;
        self.state_mutex.unlock();

        const user_id = auth_user_id orelse return error.InvalidToken;
        defer self.allocator.free(user_id);

        const body = try self.readBody(request, 64 * 1024);
        defer self.allocator.free(body);

        const StreamStart = struct {
            room_id: []const u8,
            title: []const u8,
            ingest_server_url: ?[]const u8 = null,
            stream_key: ?[]const u8 = null,
        };

        var parsed = try std.json.parseFromSlice(StreamStart, self.allocator, body, .{ .ignore_unknown_fields = true });
        defer parsed.deinit();

        const room_id = std.mem.trim(u8, parsed.value.room_id, " \t\r\n");
        const title = std.mem.trim(u8, parsed.value.title, " \t\r\n");
        const ingest_server_url_input = std.mem.trim(u8, parsed.value.ingest_server_url orelse "", " \t\r\n");
        const stream_key_input = std.mem.trim(u8, parsed.value.stream_key orelse "", " \t\r\n");

        if (room_id.len == 0 or title.len == 0) {
            return error.InvalidStreamStart;
        }

        if ((ingest_server_url_input.len > 0) != (stream_key_input.len > 0)) {
            return error.InvalidObsConfig;
        }
        if (stream_key_input.len > 0 and !isValidStreamKey(stream_key_input)) {
            return error.InvalidObsConfig;
        }
        if (ingest_server_url_input.len > 0 and !isValidIngestServerUrl(ingest_server_url_input)) {
            return error.InvalidObsConfig;
        }

        const stream_key = if (stream_key_input.len > 0)
            try self.allocator.dupe(u8, stream_key_input)
        else
            try self.generateStreamKey();
        defer self.allocator.free(stream_key);

        const ingest_server_url = if (ingest_server_url_input.len > 0)
            ingest_server_url_input
        else
            self.config.media_rtmp_base_url;
        const playback_url = try self.buildPlaybackUrl(stream_key);
        defer self.allocator.free(playback_url);

        self.state_mutex.lock();
        defer self.state_mutex.unlock();

        if (!self.roomExistsLocked(room_id)) {
            return error.RoomNotFound;
        }

        var streams = self.app.streamService();
        streams.stopLiveStreamsInRoom(room_id);
        const stream = try streams.startStream(
            room_id,
            user_id,
            title,
            stream_key,
            ingest_server_url,
            playback_url,
        );
        self.notifyUpdate();
        return try self.buildStreamJson(stream, true);
    }

    fn handleStopStream(self: *KodaServer, request: *http.Server.Request) ![]u8 {
        const token = extractBearerToken(request) orelse return error.InvalidToken;

        self.state_mutex.lock();
        const maybe_uid = self.validateTokenLocked(token);
        const auth_user_id = if (maybe_uid) |uid| try self.allocator.dupe(u8, uid) else null;
        self.state_mutex.unlock();

        const user_id = auth_user_id orelse return error.InvalidToken;
        defer self.allocator.free(user_id);

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

        for (self.app.state.streams.items) |*stream| {
            if (std.mem.eql(u8, stream.id, stream_id)) {
                if (!std.mem.eql(u8, stream.host_user_id, user_id)) {
                    return error.UnauthorizedUser;
                }

                stream.live = false;
                self.notifyUpdate();
                return try self.buildStreamJson(stream.*, false);
            }
        }

        return error.StreamNotFound;
    }

    fn readBody(self: *KodaServer, request: *http.Server.Request, max_len: usize) ![]u8 {
        const len_u64 = request.head.content_length orelse return error.MissingContentLength;
        const len: usize = std.math.cast(usize, len_u64) orelse return error.BodyTooLarge;
        if (len > max_len) return error.BodyTooLarge;

        var body_buffer: [2048]u8 = undefined;
        const reader = try request.readerExpectContinue(&body_buffer);
        return try reader.readAlloc(self.allocator, len);
    }

    fn handleWebSocketUpgrade(self: *KodaServer, request: *http.Server.Request, opt_key: ?[]const u8) !void {
        const target = splitTarget(request.head.target);
        const is_chat = std.mem.eql(u8, target.path, "/ws/chat");
        const is_signal = std.mem.eql(u8, target.path, "/ws/signal");
        if (!is_chat and !is_signal) {
            return self.respondText(request, .not_found, "ws route not found");
        }

        const key = opt_key orelse return error.MissingWebSocketKey;

        const room_param = queryValue(target.query, "room_id") orelse default_room_id;
        const token_param = queryValue(target.query, "token") orelse "";

        const room_id = try self.allocator.dupe(u8, room_param);
        defer self.allocator.free(room_id);

        self.state_mutex.lock();
        const room_exists = self.roomExistsLocked(room_id);
        self.state_mutex.unlock();
        if (!room_exists) {
            return self.respondText(request, .not_found, "room not found");
        }

        // Resolve the user_id from the session token.
        // Chat requires a valid token; signal falls back to "guest" for unauthenticated viewers.
        const user_id = blk: {
            if (token_param.len > 0) {
                self.state_mutex.lock();
                const maybe_uid = self.validateTokenLocked(token_param);
                const owned = if (maybe_uid) |uid| try self.allocator.dupe(u8, uid) else null;
                self.state_mutex.unlock();

                if (owned) |uid| break :blk uid;

                if (is_chat) {
                    return self.respondText(request, .unauthorized, "invalid or expired session");
                }
            } else if (is_chat) {
                return self.respondText(request, .unauthorized, "login required for chat");
            }
            break :blk try self.allocator.dupe(u8, "guest");
        };
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

    fn serveChatSocket(self: *KodaServer, socket: *http.Server.WebSocket, room_id: []const u8, user_id: []const u8) !void {
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

    fn serveSignalSocket(self: *KodaServer, socket: *http.Server.WebSocket, room_id: []const u8, user_id: []const u8) !void {
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

    fn appendMessage(self: *KodaServer, room_id: []const u8, user_id: []const u8, body: []const u8) !store.Message {
        self.state_mutex.lock();
        defer self.state_mutex.unlock();

        if (!self.roomExistsLocked(room_id)) {
            return error.RoomNotFound;
        }

        var chat = self.app.chatService();
        const message = try chat.sendMessage(room_id, user_id, body);
        self.notifyUpdate();
        return message;
    }

    fn appendSignalEvent(self: *KodaServer, room_id: []const u8, user_id: []const u8, payload: []const u8) !store.SignalEvent {
        if (!(try isValidSignalPayloadJson(self.allocator, payload))) {
            return error.InvalidSignalPayload;
        }

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

    fn buildRoomsJson(self: *KodaServer) ![]u8 {
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

    fn buildMessagesJson(self: *KodaServer, room_id: []const u8) ![]u8 {
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
            try self.writeMessageObjectLocked(&writer, message);
        }
        try writer.writeByte(']');

        return try out.toOwnedSlice(self.allocator);
    }

    fn buildStreamsJson(self: *KodaServer) ![]u8 {
        var out: std.ArrayList(u8) = .empty;
        errdefer out.deinit(self.allocator);

        var writer = out.writer(self.allocator);

        self.state_mutex.lock();
        defer self.state_mutex.unlock();

        try writer.writeByte('[');
        for (self.app.state.streams.items, 0..) |stream, idx| {
            if (idx != 0) try writer.writeByte(',');
            try self.writeStreamObject(&writer, stream, false);
        }
        try writer.writeByte(']');

        return try out.toOwnedSlice(self.allocator);
    }

    fn buildRoomJson(self: *KodaServer, room: store.Room) ![]u8 {
        var out: std.ArrayList(u8) = .empty;
        errdefer out.deinit(self.allocator);

        var writer = out.writer(self.allocator);
        try self.writeRoomObject(&writer, room);
        return try out.toOwnedSlice(self.allocator);
    }

    fn buildChatEventJson(self: *KodaServer, message: store.Message) ![]u8 {
        var out: std.ArrayList(u8) = .empty;
        errdefer out.deinit(self.allocator);

        var writer = out.writer(self.allocator);
        self.state_mutex.lock();
        defer self.state_mutex.unlock();
        try writer.writeAll("{\"type\":\"chat.message\",\"message\":");
        try self.writeMessageObjectLocked(&writer, message);
        try writer.writeByte('}');

        return try out.toOwnedSlice(self.allocator);
    }

    fn buildStreamJson(self: *KodaServer, stream: store.StreamSession, include_obs_credentials: bool) ![]u8 {
        var out: std.ArrayList(u8) = .empty;
        errdefer out.deinit(self.allocator);

        var writer = out.writer(self.allocator);
        try self.writeStreamObject(&writer, stream, include_obs_credentials);
        return try out.toOwnedSlice(self.allocator);
    }

    fn buildSignalEventJson(self: *KodaServer, signal: store.SignalEvent) ![]u8 {
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

    fn writeRoomObject(self: *KodaServer, writer: anytype, room: store.Room) !void {
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

    fn writeMessageObjectLocked(self: *KodaServer, writer: anytype, message: store.Message) !void {
        const username = self.usernameByUserIdLocked(message.user_id);
        try writer.writeByte('{');
        try writer.writeAll("\"id\":");
        try writeJsonString(writer, message.id);
        try writer.writeAll(",\"room_id\":");
        try writeJsonString(writer, message.room_id);
        try writer.writeAll(",\"user_id\":");
        try writeJsonString(writer, message.user_id);
        try writer.writeAll(",\"username\":");
        try writeJsonString(writer, username);
        try writer.writeAll(",\"body\":");
        try writeJsonString(writer, message.body);
        try writer.print(",\"sent_at_unix_ms\":{d}", .{message.sent_at_unix_ms});
        try writer.writeByte('}');
    }

    fn writeStreamObject(self: *KodaServer, writer: anytype, stream: store.StreamSession, include_obs_credentials: bool) !void {
        try writer.writeByte('{');
        try writer.writeAll("\"id\":");
        try writeJsonString(writer, stream.id);
        try writer.writeAll(",\"room_id\":");
        try writeJsonString(writer, stream.room_id);
        try writer.writeAll(",\"host_user_id\":");
        try writeJsonString(writer, stream.host_user_id);
        try writer.writeAll(",\"title\":");
        try writeJsonString(writer, stream.title);
        try writer.writeAll(",\"playback_url\":");
        try writeJsonString(writer, stream.playback_url);
        try writer.print(",\"live\":{s}", .{if (stream.live) "true" else "false"});

        if (include_obs_credentials) {
            const ingest_url = try std.fmt.allocPrint(self.allocator, "{s}/{s}", .{
                trimTrailingSlashes(stream.ingest_server_url),
                stream.stream_key,
            });
            defer self.allocator.free(ingest_url);

            try writer.writeAll(",\"obs\":{");
            try writer.writeAll("\"server_url\":");
            try writeJsonString(writer, stream.ingest_server_url);
            try writer.writeAll(",\"stream_key\":");
            try writeJsonString(writer, stream.stream_key);
            try writer.writeAll(",\"ingest_url\":");
            try writeJsonString(writer, ingest_url);
            try writer.writeByte('}');
        }

        try writer.writeByte('}');
    }

    fn generateStreamKey(self: *KodaServer) ![]u8 {
        var bytes: [18]u8 = undefined;
        std.crypto.random.bytes(&bytes);
        const hex = std.fmt.bytesToHex(bytes, .lower);
        return try self.allocator.dupe(u8, &hex);
    }

    fn buildPlaybackUrl(self: *KodaServer, stream_key: []const u8) ![]u8 {
        return std.fmt.allocPrint(self.allocator, "{s}/{s}/index.m3u8", .{
            trimTrailingSlashes(self.config.media_hls_base_url),
            stream_key,
        });
    }

    fn notifyUpdate(self: *KodaServer) void {
        _ = self.update_id.rmw(.Add, 1, .release);
        std.Thread.Futex.wake(&self.update_id, 32);
    }

    fn respondJson(self: *KodaServer, request: *http.Server.Request, status: http.Status, body: []const u8) !void {
        const headers = [_]http.Header{
            .{ .name = "Content-Type", .value = "application/json; charset=utf-8" },
            .{ .name = "Access-Control-Allow-Origin", .value = self.config.cors_origin },
            .{ .name = "Access-Control-Allow-Headers", .value = "Content-Type,Authorization" },
            .{ .name = "Access-Control-Allow-Methods", .value = "GET,POST,OPTIONS" },
        };
        try request.respond(body, .{ .status = status, .extra_headers = &headers });
    }

    fn respondText(self: *KodaServer, request: *http.Server.Request, status: http.Status, body: []const u8) !void {
        const headers = [_]http.Header{
            .{ .name = "Content-Type", .value = "text/plain; charset=utf-8" },
            .{ .name = "Access-Control-Allow-Origin", .value = self.config.cors_origin },
            .{ .name = "Access-Control-Allow-Headers", .value = "Content-Type,Authorization" },
            .{ .name = "Access-Control-Allow-Methods", .value = "GET,POST,OPTIONS" },
        };
        try request.respond(body, .{ .status = status, .extra_headers = &headers });
    }

    fn respondOptions(self: *KodaServer, request: *http.Server.Request) !void {
        const headers = [_]http.Header{
            .{ .name = "Content-Type", .value = "text/plain; charset=utf-8" },
            .{ .name = "Access-Control-Allow-Origin", .value = self.config.cors_origin },
            .{ .name = "Access-Control-Allow-Headers", .value = "Content-Type,Authorization" },
            .{ .name = "Access-Control-Allow-Methods", .value = "GET,POST,OPTIONS" },
        };
        try request.respond("", .{ .status = .no_content, .extra_headers = &headers });
    }

    fn respondRouteError(self: *KodaServer, request: *http.Server.Request, err: anyerror) !void {
        return switch (err) {
            error.InvalidRegistration => self.respondText(request, .bad_request, "username, email, and password are required"),
            error.InvalidLogin => self.respondText(request, .bad_request, "email and password are required"),
            error.InvalidJson => self.respondText(request, .bad_request, "invalid json payload"),
            error.InvalidRoomName => self.respondText(request, .bad_request, "room name is required"),
            error.InvalidMessage => self.respondText(request, .bad_request, "room_id and body are required"),
            error.InvalidStreamStart => self.respondText(request, .bad_request, "room_id and title are required"),
            error.InvalidObsConfig => self.respondText(request, .bad_request, "provide both OBS server and stream key (valid RTMP URL and key format)"),
            error.InvalidStreamId => self.respondText(request, .bad_request, "stream_id is required"),
            error.InvalidSignalPayload => self.respondText(request, .bad_request, "invalid signal payload"),
            error.UsernameTaken => self.respondText(request, .conflict, "username already taken"),
            error.EmailTaken => self.respondText(request, .conflict, "email already registered"),
            error.RoomNotFound => self.respondText(request, .not_found, "room not found"),
            error.StreamNotFound => self.respondText(request, .not_found, "stream not found"),
            error.InvalidPassword, error.UserNotFound => self.respondText(request, .unauthorized, "invalid email or password"),
            error.InvalidToken => self.respondText(request, .unauthorized, "invalid or expired session"),
            error.UnauthorizedUser => self.respondText(request, .forbidden, "not allowed to perform this action"),
            error.MissingContentLength => self.respondText(request, .length_required, "content-length header is required"),
            error.BodyTooLarge => self.respondText(request, .payload_too_large, "request body too large"),
            else => self.respondText(request, .internal_server_error, "internal server error"),
        };
    }

    /// Creates a new session for user_id, stores it, and returns the token.
    /// The returned slice is owned by the sessions list — do NOT free it.
    fn createSessionLocked(self: *KodaServer, user_id: []const u8) ![]const u8 {
        const token = try self.app.state.nextSessionToken(self.allocator);
        errdefer self.allocator.free(token);

        const session = store.Session{
            .token = token,
            .user_id = try self.allocator.dupe(u8, user_id),
        };
        errdefer self.allocator.free(session.user_id);

        try self.app.state.sessions.append(self.allocator, session);
        return token;
    }

    /// Returns the user_id associated with a token, or null if invalid.
    /// The returned slice points into session memory — copy it before dropping the lock.
    fn validateTokenLocked(self: *KodaServer, token: []const u8) ?[]const u8 {
        for (self.app.state.sessions.items) |session| {
            if (std.mem.eql(u8, session.token, token)) {
                return session.user_id;
            }
        }
        return null;
    }

    fn usernameByUserIdLocked(self: *KodaServer, user_id: []const u8) []const u8 {
        for (self.app.state.users.items) |user| {
            if (std.mem.eql(u8, user.id, user_id)) {
                return user.username;
            }
        }
        return user_id;
    }

    fn roomExistsLocked(self: *KodaServer, room_id: []const u8) bool {
        return roomExists(self.app.state.rooms.items, room_id);
    }
};

const WebSocketRecvContext = struct {
    server: *KodaServer,
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
    server: *KodaServer,
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

fn extractBearerToken(request: *http.Server.Request) ?[]const u8 {
    var it = request.iterateHeaders();
    while (it.next()) |header| {
        if (std.ascii.eqlIgnoreCase(header.name, "authorization")) {
            const prefix = "Bearer ";
            if (std.mem.startsWith(u8, header.value, prefix)) {
                return header.value[prefix.len..];
            }
        }
    }
    return null;
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

fn isValidSignalPayloadJson(allocator: std.mem.Allocator, payload: []const u8) !bool {
    if (payload.len == 0 or payload.len > max_signal_payload_len) {
        return false;
    }

    var parsed = std.json.parseFromSlice(std.json.Value, allocator, payload, .{}) catch |err| switch (err) {
        error.OutOfMemory => return err,
        else => return false,
    };
    defer parsed.deinit();

    return isValidSignalPayloadValue(parsed.value);
}

fn isValidSignalPayloadValue(value: std.json.Value) bool {
    const object = switch (value) {
        .object => |obj| obj,
        else => return false,
    };

    const kind = switch (object.get("kind") orelse return false) {
        .string => |s| s,
        else => return false,
    };
    const mode = switch (object.get("mode") orelse return false) {
        .string => |s| s,
        else => return false,
    };

    if (!isAllowedSignalMode(mode)) {
        return false;
    }

    if (object.get("target_user_id")) |target_user_id| {
        switch (target_user_id) {
            .string => |uid| {
                if (uid.len == 0) return false;
            },
            else => return false,
        }
    }

    if (std.mem.eql(u8, kind, "peer.announce") or std.mem.eql(u8, kind, "peer.leave")) {
        const role = switch (object.get("role") orelse return false) {
            .string => |s| s,
            else => return false,
        };
        return isAllowedSignalRole(mode, role);
    }

    if (std.mem.eql(u8, kind, "webrtc.offer") or std.mem.eql(u8, kind, "webrtc.answer")) {
        return hasSignalObjectField(object, "description") and hasRequiredTargetUserId(object);
    }

    if (std.mem.eql(u8, kind, "webrtc.ice")) {
        return hasSignalObjectField(object, "candidate") and hasRequiredTargetUserId(object);
    }

    if (std.mem.eql(u8, kind, "stream.status")) {
        if (!std.mem.eql(u8, mode, "stream")) return false;
        _ = switch (object.get("is_live") orelse return false) {
            .bool => true,
            else => return false,
        };

        if (object.get("title")) |title| {
            switch (title) {
                .string => {},
                else => return false,
            }
        }
        return true;
    }

    return false;
}

fn hasRequiredTargetUserId(object: std.json.ObjectMap) bool {
    const target = object.get("target_user_id") orelse return false;
    return switch (target) {
        .string => |uid| uid.len > 0,
        else => false,
    };
}

fn hasSignalObjectField(object: std.json.ObjectMap, key: []const u8) bool {
    const value = object.get(key) orelse return false;
    return switch (value) {
        .object => true,
        else => false,
    };
}

fn isAllowedSignalMode(mode: []const u8) bool {
    return std.mem.eql(u8, mode, "stream") or std.mem.eql(u8, mode, "video");
}

fn isAllowedSignalRole(mode: []const u8, role: []const u8) bool {
    if (std.mem.eql(u8, mode, "stream")) {
        return std.mem.eql(u8, role, "host") or std.mem.eql(u8, role, "viewer");
    }

    if (std.mem.eql(u8, mode, "video")) {
        return std.mem.eql(u8, role, "participant");
    }

    return false;
}

fn roomExists(rooms: []const store.Room, room_id: []const u8) bool {
    for (rooms) |room| {
        if (std.mem.eql(u8, room.id, room_id)) {
            return true;
        }
    }
    return false;
}

fn parseRoomKind(raw: []const u8) types.RoomKind {
    if (std.ascii.eqlIgnoreCase(raw, "voice")) return .voice;
    if (std.ascii.eqlIgnoreCase(raw, "video")) return .video;
    if (std.ascii.eqlIgnoreCase(raw, "stream")) return .stream;
    return .text;
}

fn isValidIngestServerUrl(value: []const u8) bool {
    return std.mem.startsWith(u8, value, "rtmp://") or std.mem.startsWith(u8, value, "rtmps://");
}

fn isValidStreamKey(value: []const u8) bool {
    if (value.len == 0 or value.len > 128) return false;

    for (value) |c| {
        if (std.ascii.isAlphanumeric(c) or c == '_' or c == '-' or c == '.') {
            continue;
        }
        return false;
    }

    return true;
}

fn trimTrailingSlashes(value: []const u8) []const u8 {
    var end = value.len;
    while (end > 0 and value[end - 1] == '/') : (end -= 1) {}
    return value[0..end];
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

test "roomExists returns true only for known room ids" {
    const rooms = [_]store.Room{
        .{ .id = "room-1", .name = "General", .kind = .text },
        .{ .id = "room-2", .name = "Stage", .kind = .stream },
    };

    try std.testing.expect(roomExists(&rooms, "room-1"));
    try std.testing.expect(roomExists(&rooms, "room-2"));
    try std.testing.expect(!roomExists(&rooms, "room-404"));
}

test "isValidSignalPayloadJson accepts supported signal payload schemas" {
    const valid_payloads = [_][]const u8{
        "{\"kind\":\"peer.announce\",\"mode\":\"stream\",\"role\":\"host\"}",
        "{\"kind\":\"peer.leave\",\"mode\":\"video\",\"role\":\"participant\"}",
        "{\"kind\":\"webrtc.offer\",\"mode\":\"stream\",\"target_user_id\":\"user-2\",\"description\":{\"type\":\"offer\",\"sdp\":\"abc\"}}",
        "{\"kind\":\"webrtc.answer\",\"mode\":\"video\",\"target_user_id\":\"user-2\",\"description\":{\"type\":\"answer\",\"sdp\":\"abc\"}}",
        "{\"kind\":\"webrtc.ice\",\"mode\":\"video\",\"target_user_id\":\"user-2\",\"candidate\":{\"candidate\":\"x\",\"sdpMid\":\"0\",\"sdpMLineIndex\":0}}",
        "{\"kind\":\"stream.status\",\"mode\":\"stream\",\"is_live\":true,\"title\":\"Live\"}",
    };

    for (valid_payloads) |payload| {
        try std.testing.expect(try isValidSignalPayloadJson(std.testing.allocator, payload));
    }
}

test "isValidSignalPayloadJson rejects malformed and unsupported payloads" {
    const invalid_payloads = [_][]const u8{
        "",
        "not-json",
        "{}",
        "{\"kind\":\"peer.announce\",\"mode\":\"video\",\"role\":\"viewer\"}",
        "{\"kind\":\"peer.leave\",\"mode\":\"stream\",\"role\":\"participant\"}",
        "{\"kind\":\"webrtc.offer\",\"mode\":\"stream\",\"target_user_id\":\"user-2\"}",
        "{\"kind\":\"webrtc.answer\",\"mode\":\"video\",\"target_user_id\":\"\",\"description\":{}}",
        "{\"kind\":\"webrtc.ice\",\"mode\":\"video\",\"target_user_id\":\"user-2\",\"candidate\":\"bad\"}",
        "{\"kind\":\"stream.status\",\"mode\":\"video\",\"is_live\":true}",
        "{\"kind\":\"stream.status\",\"mode\":\"stream\",\"is_live\":\"yes\"}",
        "{\"kind\":\"unknown\",\"mode\":\"stream\"}",
    };

    for (invalid_payloads) |payload| {
        try std.testing.expect(!(try isValidSignalPayloadJson(std.testing.allocator, payload)));
    }
}

test "parseRoomKind is case-insensitive and defaults to text" {
    try std.testing.expectEqual(types.RoomKind.voice, parseRoomKind("Voice"));
    try std.testing.expectEqual(types.RoomKind.video, parseRoomKind("VIDEO"));
    try std.testing.expectEqual(types.RoomKind.stream, parseRoomKind("stream"));
    try std.testing.expectEqual(types.RoomKind.text, parseRoomKind("unknown"));
}

test "isValidIngestServerUrl only accepts rtmp schemes" {
    try std.testing.expect(isValidIngestServerUrl("rtmp://localhost:1935/live"));
    try std.testing.expect(isValidIngestServerUrl("rtmps://ingest.example.com/live"));
    try std.testing.expect(!isValidIngestServerUrl("http://localhost/live"));
}

test "isValidStreamKey allows safe key characters only" {
    try std.testing.expect(isValidStreamKey("abc123_-."));
    try std.testing.expect(!isValidStreamKey(""));
    try std.testing.expect(!isValidStreamKey("a/b"));
    try std.testing.expect(!isValidStreamKey("space key"));
}

test "writeJsonString escapes control and quote characters" {
    var out: std.ArrayList(u8) = .empty;
    defer out.deinit(std.testing.allocator);

    var writer = out.writer(std.testing.allocator);
    try writeJsonString(&writer, "a\"\\\n\t\r\x01");

    try std.testing.expectEqualStrings("\"a\\\"\\\\\\n\\t\\r\\u0001\"", out.items);
}
