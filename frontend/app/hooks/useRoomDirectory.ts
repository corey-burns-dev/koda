import { useCallback, useEffect, useMemo, useState } from "react";

import type { Health, Room, StreamSession } from "../types";

type UseRoomDirectoryOptions = {
	httpBase: string;
};

export function useRoomDirectory({ httpBase }: UseRoomDirectoryOptions) {
	const [health, setHealth] = useState<Health | null>(null);
	const [rooms, setRooms] = useState<Room[]>([]);
	const [streams, setStreams] = useState<StreamSession[]>([]);
	const [activeRoomId, setActiveRoomId] = useState("");

	const activeRoom = useMemo(
		() => rooms.find((room) => room.id === activeRoomId) ?? null,
		[activeRoomId, rooms],
	);

	const fetchHealth = useCallback(async (): Promise<void> => {
		try {
			const response = await fetch(`${httpBase}/health`);
			const payload = (await response.json()) as Health;
			setHealth(payload);
		} catch {
			setHealth(null);
		}
	}, [httpBase]);

	const fetchRooms = useCallback(async (): Promise<void> => {
		try {
			const response = await fetch(`${httpBase}/api/rooms`);
			const payload = (await response.json()) as Room[];
			setRooms(payload);
			setActiveRoomId((currentRoomId) => {
				if (payload.length === 0) {
					return "";
				}

				if (
					currentRoomId &&
					payload.some((room) => room.id === currentRoomId)
				) {
					return currentRoomId;
				}

				return payload[0].id;
			});
		} catch {
			setRooms([]);
			setActiveRoomId("");
		}
	}, [httpBase]);

	const fetchStreams = useCallback(async (): Promise<void> => {
		try {
			const response = await fetch(`${httpBase}/api/streams`);
			const payload = (await response.json()) as StreamSession[];
			setStreams(payload);
		} catch {
			setStreams([]);
		}
	}, [httpBase]);

	useEffect(() => {
		void fetchHealth();
		void fetchRooms();
		void fetchStreams();
	}, [fetchHealth, fetchRooms, fetchStreams]);

	useEffect(() => {
		const intervalId = window.setInterval(() => {
			fetchStreams().catch(() => {
				// Ignore polling errors.
			});
		}, 5000);

		return () => window.clearInterval(intervalId);
	}, [fetchStreams]);

	const liveStreams = useMemo(
		() => streams.filter((stream) => stream.live),
		[streams],
	);

	const liveStreamForActiveRoom = useMemo(() => {
		if (!activeRoom || activeRoom.kind !== "stream") {
			return null;
		}

		return (
			liveStreams.find((stream) => stream.room_id === activeRoom.id) ?? null
		);
	}, [activeRoom, liveStreams]);

	const roomNameById = useMemo(() => {
		const entries = new Map<string, string>();

		rooms.forEach((room) => {
			entries.set(room.id, room.name);
		});

		return entries;
	}, [rooms]);

	return {
		activeRoom,
		activeRoomId,
		fetchStreams,
		health,
		liveStreamForActiveRoom,
		liveStreams,
		roomNameById,
		rooms,
		setActiveRoomId,
		setRooms,
		streams,
	};
}
