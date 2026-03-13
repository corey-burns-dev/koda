import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Room, StreamSession } from "../types";
import { useRoomRealtime } from "./useRoomRealtime";

const streamRoom: Room = {
	id: "room-stream",
	kind: "stream",
	name: "Stage",
};

const videoRoom: Room = {
	id: "room-video",
	kind: "video",
	name: "Cinema",
};

const liveStreams: StreamSession[] = [];

describe("useRoomRealtime", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("requires auth before starting a broadcast", () => {
		const onAuthRequired = vi.fn();
		const onStatusNote = vi.fn();

		const { result } = renderHook(() =>
			useRoomRealtime({
				activeRoom: streamRoom,
				activeRoomId: streamRoom.id,
				buildWsUrl: () => "ws://example.test/ws/signal",
				fetchStreams: vi.fn(async () => {}),
				hydrated: true,
				httpBase: "http://example.test",
				isAuthenticated: false,
				liveStreams,
				onAuthRequired,
				onStatusNote,
				sessionToken: "",
				userId: "",
			}),
		);

		act(() => {
			result.current.handleStartBroadcast();
		});

		expect(onStatusNote).toHaveBeenCalledWith(
			"Sign in before you start a stream.",
		);
		expect(onAuthRequired).toHaveBeenCalledTimes(1);
	});

	it("requires auth before joining a video room", () => {
		const onAuthRequired = vi.fn();
		const onStatusNote = vi.fn();

		const { result } = renderHook(() =>
			useRoomRealtime({
				activeRoom: videoRoom,
				activeRoomId: videoRoom.id,
				buildWsUrl: () => "ws://example.test/ws/signal",
				fetchStreams: vi.fn(async () => {}),
				hydrated: true,
				httpBase: "http://example.test",
				isAuthenticated: false,
				liveStreams,
				onAuthRequired,
				onStatusNote,
				sessionToken: "",
				userId: "",
			}),
		);

		act(() => {
			result.current.handleJoinVideoRoom();
		});

		expect(onStatusNote).toHaveBeenCalledWith(
			"Sign in before joining a video room.",
		);
		expect(onAuthRequired).toHaveBeenCalledTimes(1);
	});
});
