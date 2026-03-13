import Hls from "hls.js";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { isRecord, isSignalPayload } from "../lib/signalPayload";
import type {
	Room,
	SignalPayload,
	StreamObsConfig,
	StreamSession,
	StreamStartResponse,
} from "../types";

const ICE_SERVERS: RTCIceServer[] = [{ urls: "stun:stun.l.google.com:19302" }];

type UseRoomRealtimeOptions = {
	activeRoom: Room | null;
	activeRoomId: string;
	buildWsUrl: (pathname: string, params: Record<string, string>) => string;
	fetchStreams: () => Promise<void>;
	hydrated: boolean;
	httpBase: string;
	isAuthenticated: boolean;
	liveStreams: StreamSession[];
	streams?: StreamSession[];
	onAuthRequired: () => void;
	onStatusNote: (note: string) => void;
	sessionToken: string;
	userId: string;
};

function stopMediaStream(stream: MediaStream | null): void {
	if (!stream) {
		return;
	}

	stream.getTracks().forEach((track) => {
		track.stop();
	});
}

function resolvePlaybackUrl(streamPlaybackUrl: string | null): string | null {
	if (!streamPlaybackUrl || typeof window === "undefined") {
		return streamPlaybackUrl;
	}

	if (/^https?:\/\//i.test(streamPlaybackUrl)) {
		return streamPlaybackUrl;
	}

	if (streamPlaybackUrl.startsWith("//")) {
		return `${window.location.protocol}${streamPlaybackUrl}`;
	}

	if (streamPlaybackUrl.startsWith(":")) {
		return `${window.location.protocol}//${window.location.hostname}${streamPlaybackUrl}`;
	}

	if (streamPlaybackUrl.startsWith("/")) {
		return `${window.location.origin}${streamPlaybackUrl}`;
	}

	return streamPlaybackUrl;
}

export function useRoomRealtime({
	activeRoom,
	activeRoomId,
	buildWsUrl,
	fetchStreams,
	hydrated,
	httpBase,
	isAuthenticated,
	liveStreams,
	streams = [],
	onAuthRequired,
	onStatusNote,
	sessionToken,
	userId,
}: UseRoomRealtimeOptions) {
	const signalSocketRef = useRef<WebSocket | null>(null);

	const streamRemoteVideoRef = useRef<HTMLVideoElement | null>(null);
	const videoLocalVideoRef = useRef<HTMLVideoElement | null>(null);

	const streamPeerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(
		new Map(),
	);
	const videoPeerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(
		new Map(),
	);
	const videoRemoteStreamsRef = useRef<Map<string, MediaStream>>(new Map());

	const streamViewerIdsRef = useRef<Set<string>>(new Set());
	const videoParticipantIdsRef = useRef<Set<string>>(new Set());

	const streamLocalMediaRef = useRef<MediaStream | null>(null);
	const hostedStreamIdRef = useRef<string | null>(null);
	const streamModeRef = useRef<"idle" | "hosting" | "watching">("idle");
	const knownStreamHostIdRef = useRef<string | null>(null);
	const videoLocalMediaRef = useRef<MediaStream | null>(null);
	const videoJoinedRef = useRef(false);
	const resetRoomRealtimeStateRef = useRef<(() => void) | null>(null);
	const handleStreamSignalRef = useRef<
		((fromUserId: string, payload: SignalPayload) => Promise<void>) | null
	>(null);
	const handleVideoSignalRef = useRef<
		((fromUserId: string, payload: SignalPayload) => Promise<void>) | null
	>(null);

	const [signalSocketState, setSignalSocketState] = useState("disconnected");

	const [streamTitleDraft, setStreamTitleDraft] = useState("");
	const [streamMode, setStreamMode] = useState<"idle" | "hosting" | "watching">(
		"idle",
	);
	const [streamLocalMedia, setStreamLocalMedia] = useState<MediaStream | null>(
		null,
	);
	const [streamPlaybackUrl, setStreamPlaybackUrl] = useState<string | null>(
		null,
	);
	const [hostedStreamId, setHostedStreamId] = useState<string | null>(null);
	const [knownStreamHostId, setKnownStreamHostId] = useState<string | null>(
		null,
	);
	const [streamObsConfig, setStreamObsConfig] =
		useState<StreamObsConfig | null>(null);
	const [streamObsServerDraft, setStreamObsServerDraft] = useState("");
	const [streamObsKeyDraft, setStreamObsKeyDraft] = useState("");
	const [streamViewerIds, setStreamViewerIds] = useState<string[]>([]);

	const [videoJoined, setVideoJoined] = useState(false);
	const [videoLocalMedia, setVideoLocalMedia] = useState<MediaStream | null>(
		null,
	);
	const [videoRemoteUserIds, setVideoRemoteUserIds] = useState<string[]>([]);
	const [videoParticipantIds, setVideoParticipantIds] = useState<string[]>([]);

	const resolvedStreamPlaybackUrl = useMemo(
		() => resolvePlaybackUrl(streamPlaybackUrl),
		[streamPlaybackUrl],
	);

	const currentRoomStream = useMemo(() => {
		if (!activeRoom || activeRoom.kind !== "stream") {
			return null;
		}

		for (let index = streams.length - 1; index >= 0; index -= 1) {
			const stream = streams[index];
			if (stream.room_id === activeRoom.id) {
				return stream;
			}
		}

		return null;
	}, [activeRoom, streams]);

	const canManageCurrentRoomStream = useMemo(() => {
		return Boolean(
			isAuthenticated &&
				currentRoomStream &&
				currentRoomStream.host_user_id === userId,
		);
	}, [isAuthenticated, currentRoomStream, userId]);

	useEffect(() => {
		streamLocalMediaRef.current = streamLocalMedia;
	}, [streamLocalMedia]);

	useEffect(() => {
		hostedStreamIdRef.current = hostedStreamId;
	}, [hostedStreamId]);

	useEffect(() => {
		streamModeRef.current = streamMode;
	}, [streamMode]);

	useEffect(() => {
		knownStreamHostIdRef.current = knownStreamHostId;
	}, [knownStreamHostId]);

	useEffect(() => {
		videoLocalMediaRef.current = videoLocalMedia;
	}, [videoLocalMedia]);

	useEffect(() => {
		videoJoinedRef.current = videoJoined;
	}, [videoJoined]);

	const setStreamViewers = useCallback((next: Set<string>): void => {
		streamViewerIdsRef.current = next;
		setStreamViewerIds(Array.from(next.values()));
	}, []);

	const addStreamViewer = useCallback(
		(nextUserId: string): void => {
			if (!nextUserId || nextUserId === userId) {
				return;
			}

			const next = new Set(streamViewerIdsRef.current);
			next.add(nextUserId);
			setStreamViewers(next);
		},
		[setStreamViewers, userId],
	);

	const removeStreamViewer = useCallback(
		(nextUserId: string): void => {
			const next = new Set(streamViewerIdsRef.current);
			if (!next.delete(nextUserId)) {
				return;
			}

			setStreamViewers(next);
		},
		[setStreamViewers],
	);

	const clearStreamViewers = useCallback((): void => {
		setStreamViewers(new Set());
	}, [setStreamViewers]);

	const setVideoParticipants = useCallback((next: Set<string>): void => {
		videoParticipantIdsRef.current = next;
		setVideoParticipantIds(Array.from(next.values()));
	}, []);

	const addVideoParticipant = useCallback(
		(nextUserId: string): void => {
			if (!nextUserId || nextUserId === userId) {
				return;
			}

			const next = new Set(videoParticipantIdsRef.current);
			next.add(nextUserId);
			setVideoParticipants(next);
		},
		[setVideoParticipants, userId],
	);

	const removeVideoParticipant = useCallback(
		(nextUserId: string): void => {
			const next = new Set(videoParticipantIdsRef.current);
			if (!next.delete(nextUserId)) {
				return;
			}

			setVideoParticipants(next);
		},
		[setVideoParticipants],
	);

	const clearVideoParticipants = useCallback((): void => {
		setVideoParticipants(new Set());
	}, [setVideoParticipants]);

	const closeStreamPeer = useCallback((remoteUserId: string): void => {
		const peer = streamPeerConnectionsRef.current.get(remoteUserId);
		if (!peer) {
			return;
		}

		peer.close();
		streamPeerConnectionsRef.current.delete(remoteUserId);
	}, []);

	const closeAllStreamPeers = useCallback((): void => {
		streamPeerConnectionsRef.current.forEach((peer) => {
			peer.close();
		});
		streamPeerConnectionsRef.current.clear();
	}, []);

	const closeVideoPeer = useCallback(
		(remoteUserId: string): void => {
			const peer = videoPeerConnectionsRef.current.get(remoteUserId);
			if (peer) {
				peer.close();
				videoPeerConnectionsRef.current.delete(remoteUserId);
			}

			removeVideoParticipant(remoteUserId);

			if (videoRemoteStreamsRef.current.delete(remoteUserId)) {
				setVideoRemoteUserIds(Array.from(videoRemoteStreamsRef.current.keys()));
			}
		},
		[removeVideoParticipant],
	);

	const closeAllVideoPeers = useCallback((): void => {
		videoPeerConnectionsRef.current.forEach((peer) => {
			peer.close();
		});
		videoPeerConnectionsRef.current.clear();
		videoRemoteStreamsRef.current.clear();
		setVideoRemoteUserIds([]);
	}, []);

	const sendSignal = useCallback((payload: SignalPayload): void => {
		const socket = signalSocketRef.current;
		if (!socket || socket.readyState !== WebSocket.OPEN) {
			return;
		}

		socket.send(JSON.stringify(payload));
	}, []);

	const makePeerConnection = useCallback(
		(
			mode: "stream" | "video",
			remoteUserId: string,
			includeLocalTracks: boolean,
		): RTCPeerConnection => {
			const peer = new RTCPeerConnection({ iceServers: ICE_SERVERS });

			peer.onicecandidate = (event) => {
				if (!event.candidate) {
					return;
				}

				sendSignal({
					kind: "webrtc.ice",
					mode,
					target_user_id: remoteUserId,
					candidate: event.candidate.toJSON(),
				});
			};

			peer.onconnectionstatechange = () => {
				if (
					peer.connectionState === "failed" ||
					peer.connectionState === "disconnected" ||
					peer.connectionState === "closed"
				) {
					if (mode === "stream") {
						closeStreamPeer(remoteUserId);
						removeStreamViewer(remoteUserId);
						return;
					}

					closeVideoPeer(remoteUserId);
				}
			};

			peer.ontrack = (event) => {
				const [incoming] = event.streams;
				if (!incoming) {
					return;
				}

				if (mode === "stream") {
					setStreamMode((current) =>
						current === "hosting" ? current : "watching",
					);
					return;
				}

				addVideoParticipant(remoteUserId);
				videoRemoteStreamsRef.current.set(remoteUserId, incoming);
				setVideoRemoteUserIds(Array.from(videoRemoteStreamsRef.current.keys()));
			};

			if (includeLocalTracks) {
				const media =
					mode === "stream"
						? streamLocalMediaRef.current
						: videoLocalMediaRef.current;
				if (media) {
					media.getTracks().forEach((track) => {
						peer.addTrack(track, media);
					});
				}
			}

			return peer;
		},
		[
			addVideoParticipant,
			closeStreamPeer,
			closeVideoPeer,
			removeStreamViewer,
			sendSignal,
		],
	);

	const ensureStreamPeer = useCallback(
		(remoteUserId: string, includeLocalTracks: boolean): RTCPeerConnection => {
			const existing = streamPeerConnectionsRef.current.get(remoteUserId);
			if (existing) {
				return existing;
			}

			const peer = makePeerConnection(
				"stream",
				remoteUserId,
				includeLocalTracks,
			);
			streamPeerConnectionsRef.current.set(remoteUserId, peer);
			return peer;
		},
		[makePeerConnection],
	);

	const ensureVideoPeer = useCallback(
		(remoteUserId: string): RTCPeerConnection => {
			const existing = videoPeerConnectionsRef.current.get(remoteUserId);
			if (existing) {
				return existing;
			}

			const peer = makePeerConnection("video", remoteUserId, true);
			videoPeerConnectionsRef.current.set(remoteUserId, peer);
			return peer;
		},
		[makePeerConnection],
	);

	const createStreamOfferForViewer = useCallback(
		async (viewerUserId: string): Promise<void> => {
			const peer = ensureStreamPeer(viewerUserId, true);
			const offer = await peer.createOffer();
			await peer.setLocalDescription(offer);

			sendSignal({
				kind: "webrtc.offer",
				mode: "stream",
				target_user_id: viewerUserId,
				description: offer,
			});
		},
		[ensureStreamPeer, sendSignal],
	);

	const createVideoOfferForParticipant = useCallback(
		async (participantUserId: string): Promise<void> => {
			const peer = ensureVideoPeer(participantUserId);
			const offer = await peer.createOffer();
			await peer.setLocalDescription(offer);

			sendSignal({
				kind: "webrtc.offer",
				mode: "video",
				target_user_id: participantUserId,
				description: offer,
			});
		},
		[ensureVideoPeer, sendSignal],
	);

	const startBroadcast = useCallback(async (): Promise<void> => {
		if (!isAuthenticated) {
			onStatusNote("Sign in before you start a stream.");
			onAuthRequired();
			return;
		}

		if (!activeRoom || activeRoom.kind !== "stream") {
			onStatusNote("Pick a stream room to broadcast.");
			return;
		}

		if (streamModeRef.current === "hosting") {
			return;
		}

		const customServer = streamObsServerDraft.trim();
		const customStreamKey = streamObsKeyDraft.trim();
		if (customServer.length > 0 !== customStreamKey.length > 0) {
			onStatusNote(
				"Enter both OBS server and stream key, or leave both blank.",
			);
			return;
		}

		try {
			closeAllStreamPeers();
			clearStreamViewers();
			setStreamLocalMedia(null);
			setStreamPlaybackUrl(null);
			setStreamObsConfig(null);
			setStreamMode("hosting");
			setKnownStreamHostId(userId);

			const payload: {
				room_id: string;
				title: string;
				ingest_server_url?: string;
				stream_key?: string;
			} = {
				room_id: activeRoom.id,
				title: streamTitleDraft.trim() || `${activeRoom.name} stream`,
			};

			if (customServer.length > 0) {
				payload.ingest_server_url = customServer;
				payload.stream_key = customStreamKey;
			}

			const response = await fetch(`${httpBase}/api/streams`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${sessionToken}`,
				},
				body: JSON.stringify(payload),
			});

			if (!response.ok) {
				throw new Error("failed to start stream");
			}

			const session = (await response.json()) as StreamStartResponse;
			setHostedStreamId(session.id);
			setStreamPlaybackUrl(session.playback_url);
			setStreamObsConfig(session.obs);
			setStreamObsServerDraft(session.obs.server_url);
			setStreamObsKeyDraft(session.obs.stream_key);
			onStatusNote(
				"Broadcast created. Start streaming from OBS with the shown credentials.",
			);

			await fetchStreams();
		} catch {
			onStatusNote("Could not create stream session.");
			setStreamMode("idle");
			setStreamLocalMedia(null);
			setStreamObsConfig(null);
			setStreamPlaybackUrl(null);
			setHostedStreamId(null);
			setKnownStreamHostId(null);
		}
	}, [
		activeRoom,
		clearStreamViewers,
		closeAllStreamPeers,
		fetchStreams,
		httpBase,
		isAuthenticated,
		onAuthRequired,
		onStatusNote,
		sessionToken,
		streamObsKeyDraft,
		streamObsServerDraft,
		streamTitleDraft,
		userId,
	]);

	const stopBroadcast = useCallback(
		async (notify = true): Promise<void> => {
			const streamId = hostedStreamIdRef.current;
			if (streamId) {
				await fetch(`${httpBase}/api/streams/stop`, {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						Authorization: `Bearer ${sessionToken}`,
					},
					body: JSON.stringify({ stream_id: streamId }),
				}).catch(() => {
					// Keep local teardown even if backend stop call fails.
				});
			}

			closeAllStreamPeers();
			clearStreamViewers();
			stopMediaStream(streamLocalMediaRef.current);
			setStreamLocalMedia(null);
			setStreamPlaybackUrl(null);
			setStreamObsConfig(null);
			setStreamObsServerDraft("");
			setStreamObsKeyDraft("");
			setStreamTitleDraft("");
			setHostedStreamId(null);
			setKnownStreamHostId(null);
			setStreamMode("idle");

			if (notify) {
				onStatusNote("Broadcast stopped.");
			}

			await fetchStreams();
		},
		[
			clearStreamViewers,
			closeAllStreamPeers,
			fetchStreams,
			httpBase,
			onStatusNote,
			sessionToken,
		],
	);

	const joinVideoRoom = useCallback(async (): Promise<void> => {
		if (!isAuthenticated) {
			onStatusNote("Sign in before joining a video room.");
			onAuthRequired();
			return;
		}

		if (!activeRoom || activeRoom.kind !== "video") {
			onStatusNote("Pick a video room before joining.");
			return;
		}

		if (videoJoinedRef.current) {
			return;
		}

		try {
			const media = await navigator.mediaDevices.getUserMedia({
				audio: true,
				video: true,
			});

			clearVideoParticipants();
			setVideoLocalMedia(media);
			setVideoJoined(true);
			onStatusNote("Joined video room.");
			sendSignal({ kind: "peer.announce", mode: "video", role: "participant" });
		} catch {
			onStatusNote("Could not access camera/mic for video room.");
		}
	}, [
		activeRoom,
		clearVideoParticipants,
		isAuthenticated,
		onAuthRequired,
		onStatusNote,
		sendSignal,
	]);

	const leaveVideoRoom = useCallback(
		(notify = true): void => {
			if (videoJoinedRef.current) {
				sendSignal({ kind: "peer.leave", mode: "video", role: "participant" });
			}

			closeAllVideoPeers();
			clearVideoParticipants();
			stopMediaStream(videoLocalMediaRef.current);
			setVideoLocalMedia(null);
			setVideoJoined(false);

			if (notify) {
				onStatusNote("Left video room.");
			}
		},
		[clearVideoParticipants, closeAllVideoPeers, onStatusNote, sendSignal],
	);

	const resetRoomRealtimeState = useCallback((): void => {
		if (streamModeRef.current === "hosting") {
			const streamId = hostedStreamIdRef.current;
			if (streamId) {
				fetch(`${httpBase}/api/streams/stop`, {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						Authorization: `Bearer ${sessionToken}`,
					},
					body: JSON.stringify({ stream_id: streamId }),
				})
					.then(() => fetchStreams())
					.catch(() => {
						// Room switches should keep local teardown even on request failures.
					});
			}
		}

		closeAllStreamPeers();
		clearStreamViewers();
		setStreamPlaybackUrl(null);
		setStreamObsConfig(null);
		setKnownStreamHostId(null);
		setStreamMode("idle");

		stopMediaStream(streamLocalMediaRef.current);
		setStreamLocalMedia(null);
		setHostedStreamId(null);

		leaveVideoRoom(false);
	}, [
		clearStreamViewers,
		closeAllStreamPeers,
		fetchStreams,
		httpBase,
		leaveVideoRoom,
		sessionToken,
	]);

	resetRoomRealtimeStateRef.current = resetRoomRealtimeState;

	useEffect(() => {
		return () => {
			resetRoomRealtimeStateRef.current?.();
		};
	}, []);

	const handleStreamSignal = useCallback(
		async (fromUserId: string, payload: SignalPayload): Promise<void> => {
			if (payload.mode !== "stream") {
				return;
			}

			if (payload.kind === "peer.announce") {
				if (payload.role === "host") {
					setKnownStreamHostId(fromUserId);
				}

				if (payload.role === "viewer") {
					addStreamViewer(fromUserId);
				}

				if (streamModeRef.current === "hosting" && payload.role === "viewer") {
					await createStreamOfferForViewer(fromUserId);
				}

				if (streamModeRef.current !== "hosting" && payload.role === "host") {
					sendSignal({
						kind: "peer.announce",
						mode: "stream",
						role: "viewer",
						target_user_id: fromUserId,
					});
				}

				return;
			}

			if (payload.kind === "peer.leave") {
				if (
					payload.role === "host" &&
					fromUserId === knownStreamHostIdRef.current
				) {
					closeStreamPeer(fromUserId);
					setKnownStreamHostId(null);
					setStreamMode("idle");
					onStatusNote("Host left the stream.");
				}

				if (payload.role === "viewer") {
					removeStreamViewer(fromUserId);
					closeStreamPeer(fromUserId);
				}

				return;
			}

			if (payload.kind === "stream.status") {
				if (!payload.is_live && fromUserId === knownStreamHostIdRef.current) {
					closeStreamPeer(fromUserId);
					setStreamMode("idle");
				}
				await fetchStreams();
				return;
			}

			if (payload.kind === "webrtc.offer") {
				if (streamModeRef.current === "hosting") {
					return;
				}

				setKnownStreamHostId(fromUserId);
				const peer = ensureStreamPeer(fromUserId, false);
				await peer.setRemoteDescription(
					new RTCSessionDescription(payload.description),
				);
				const answer = await peer.createAnswer();
				await peer.setLocalDescription(answer);
				sendSignal({
					kind: "webrtc.answer",
					mode: "stream",
					target_user_id: fromUserId,
					description: answer,
				});
				return;
			}

			if (payload.kind === "webrtc.answer") {
				if (streamModeRef.current !== "hosting") {
					return;
				}

				const peer = streamPeerConnectionsRef.current.get(fromUserId);
				if (!peer) {
					return;
				}

				await peer.setRemoteDescription(
					new RTCSessionDescription(payload.description),
				);
				return;
			}

			if (payload.kind === "webrtc.ice") {
				const peer = streamPeerConnectionsRef.current.get(fromUserId);
				if (!peer) {
					return;
				}

				await peer.addIceCandidate(new RTCIceCandidate(payload.candidate));
			}
		},
		[
			addStreamViewer,
			closeStreamPeer,
			createStreamOfferForViewer,
			ensureStreamPeer,
			fetchStreams,
			onStatusNote,
			removeStreamViewer,
			sendSignal,
		],
	);

	const handleVideoSignal = useCallback(
		async (fromUserId: string, payload: SignalPayload): Promise<void> => {
			if (payload.mode !== "video" || !videoJoinedRef.current) {
				return;
			}

			if (payload.kind === "peer.announce") {
				if (payload.role !== "participant") {
					return;
				}

				addVideoParticipant(fromUserId);

				const shouldInitiateOffer = userId < fromUserId;
				if (shouldInitiateOffer) {
					await createVideoOfferForParticipant(fromUserId);
				}
				return;
			}

			if (payload.kind === "peer.leave") {
				if (payload.role === "participant") {
					closeVideoPeer(fromUserId);
				}
				return;
			}

			if (payload.kind === "webrtc.offer") {
				addVideoParticipant(fromUserId);
				const peer = ensureVideoPeer(fromUserId);
				await peer.setRemoteDescription(
					new RTCSessionDescription(payload.description),
				);
				const answer = await peer.createAnswer();
				await peer.setLocalDescription(answer);
				sendSignal({
					kind: "webrtc.answer",
					mode: "video",
					target_user_id: fromUserId,
					description: answer,
				});
				return;
			}

			if (payload.kind === "webrtc.answer") {
				const peer = videoPeerConnectionsRef.current.get(fromUserId);
				if (!peer) {
					return;
				}

				await peer.setRemoteDescription(
					new RTCSessionDescription(payload.description),
				);
				return;
			}

			if (payload.kind === "webrtc.ice") {
				const peer = videoPeerConnectionsRef.current.get(fromUserId);
				if (!peer) {
					return;
				}

				await peer.addIceCandidate(new RTCIceCandidate(payload.candidate));
			}
		},
		[
			addVideoParticipant,
			closeVideoPeer,
			createVideoOfferForParticipant,
			ensureVideoPeer,
			sendSignal,
			userId,
		],
	);

	handleStreamSignalRef.current = handleStreamSignal;
	handleVideoSignalRef.current = handleVideoSignal;

	useEffect(() => {
		const shouldOpenSignal =
			activeRoom?.kind === "stream" || activeRoom?.kind === "video";

		if (
			!activeRoomId ||
			!shouldOpenSignal ||
			!hydrated ||
			!isAuthenticated ||
			!userId ||
			!sessionToken
		) {
			if (signalSocketRef.current) {
				signalSocketRef.current.close();
				signalSocketRef.current = null;
			}

			if (!activeRoomId || !shouldOpenSignal) {
				setSignalSocketState("disconnected");
			} else {
				setSignalSocketState(
					hydrated && !isAuthenticated ? "login required" : "disconnected",
				);
			}
			return;
		}

		const socket = new WebSocket(
			buildWsUrl("/ws/signal", {
				room_id: activeRoomId,
				token: sessionToken,
			}),
		);

		socket.onopen = () => {
			setSignalSocketState("connected");

			if (activeRoom?.kind === "video" && videoJoinedRef.current) {
				sendSignal({
					kind: "peer.announce",
					mode: "video",
					role: "participant",
				});
			}
		};

		socket.onclose = () => setSignalSocketState("disconnected");
		socket.onerror = () => setSignalSocketState("error");

		socket.onmessage = (event) => {
			try {
				const raw = JSON.parse(event.data) as unknown;
				if (!isRecord(raw) || raw.type !== "signal.message") {
					return;
				}

				const eventPayload = raw.event;
				if (!isRecord(eventPayload)) {
					return;
				}

				const parsedPayload = eventPayload.payload;
				const fromUserId =
					typeof eventPayload.user_id === "string"
						? eventPayload.user_id
						: null;
				if (!fromUserId || !isSignalPayload(parsedPayload)) {
					return;
				}

				if (
					parsedPayload.target_user_id &&
					parsedPayload.target_user_id !== userId
				) {
					return;
				}

				if (parsedPayload.mode === "stream" && activeRoom?.kind === "stream") {
					const streamSignalPromise = handleStreamSignalRef.current?.(
						fromUserId,
						parsedPayload,
					);
					streamSignalPromise?.catch(() => {
						// Ignore transient signaling failures.
					});
				}

				if (parsedPayload.mode === "video" && activeRoom?.kind === "video") {
					const videoSignalPromise = handleVideoSignalRef.current?.(
						fromUserId,
						parsedPayload,
					);
					videoSignalPromise?.catch(() => {
						// Ignore transient signaling failures.
					});
				}
			} catch {
				// Ignore malformed signaling payloads.
			}
		};

		signalSocketRef.current = socket;

		return () => {
			if (signalSocketRef.current === socket) {
				signalSocketRef.current = null;
			}
			socket.close();
		};
	}, [
		activeRoom,
		activeRoomId,
		buildWsUrl,
		hydrated,
		isAuthenticated,
		sendSignal,
		sessionToken,
		userId,
	]);

	useEffect(() => {
		const element = streamRemoteVideoRef.current;
		if (!element) {
			return;
		}

		if (!resolvedStreamPlaybackUrl) {
			element.pause();
			element.removeAttribute("src");
			element.load();
			return;
		}

		let hls: Hls | null = null;

		if (element.canPlayType("application/vnd.apple.mpegurl")) {
			element.src = resolvedStreamPlaybackUrl;
			element.play().catch(() => {
				// Ignore autoplay restrictions.
			});
		} else if (Hls.isSupported()) {
			hls = new Hls({
				lowLatencyMode: true,
			});
			hls.loadSource(resolvedStreamPlaybackUrl);
			hls.attachMedia(element);
			hls.on(Hls.Events.MANIFEST_PARSED, () => {
				element.play().catch(() => {
					// Ignore autoplay restrictions.
				});
			});
		} else {
			onStatusNote("This browser does not support HLS playback.");
		}

		return () => {
			if (hls) {
				hls.destroy();
			}
			element.pause();
			element.removeAttribute("src");
			element.load();
		};
	}, [onStatusNote, resolvedStreamPlaybackUrl]);

	useEffect(() => {
		if (videoLocalVideoRef.current) {
			videoLocalVideoRef.current.srcObject = videoLocalMedia;
		}
	}, [videoLocalMedia]);

	const streamObsIngestPreview = useMemo(() => {
		const server = streamObsServerDraft.trim();
		const streamKey = streamObsKeyDraft.trim();

		if (server.length > 0 && streamKey.length > 0) {
			return `${server.replace(/\/+$/, "")}/${streamKey}`;
		}

		return streamObsConfig?.ingest_url ?? null;
	}, [streamObsConfig, streamObsKeyDraft, streamObsServerDraft]);

	useEffect(() => {
		if (!activeRoom || activeRoom.kind !== "stream") {
			setStreamPlaybackUrl(null);
			return;
		}

		const streamForRoom = liveStreams.find(
			(stream) => stream.room_id === activeRoom.id,
		);
		setKnownStreamHostId(streamForRoom?.host_user_id ?? null);
		setStreamPlaybackUrl(streamForRoom?.playback_url ?? null);

		if (streamForRoom) {
			setStreamTitleDraft(streamForRoom.title);
			if (streamModeRef.current !== "hosting") {
				setStreamMode("watching");
			}
			return;
		}

		if (streamModeRef.current !== "hosting") {
			setStreamMode("idle");
		}
	}, [activeRoom, liveStreams]);

	const handleFindStream = useCallback(() => {
		fetchStreams().catch(() => {
			onStatusNote("Could not refresh streams.");
		});
	}, [fetchStreams, onStatusNote]);

	const handleResetCurrentRoomStream = useCallback(() => {
		if (!isAuthenticated) {
			onStatusNote("Sign in before you reset a stream session.");
			onAuthRequired();
			return;
		}

		if (!currentRoomStream || currentRoomStream.host_user_id !== userId) {
			onStatusNote("Only the host can reset this stream session.");
			return;
		}

		const endpoint =
			currentRoomStream.live && currentRoomStream.id
				? `${httpBase}/api/streams/stop`
				: null;

		const reset = async (): Promise<void> => {
			if (endpoint) {
				const response = await fetch(endpoint, {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						Authorization: `Bearer ${sessionToken}`,
					},
					body: JSON.stringify({ stream_id: currentRoomStream.id }),
				});

				if (!response.ok) {
					throw new Error("failed to reset stream");
				}
			}

			closeAllStreamPeers();
			clearStreamViewers();
			stopMediaStream(streamLocalMediaRef.current);
			setStreamLocalMedia(null);
			setStreamPlaybackUrl(null);
			setStreamObsConfig(null);
			setStreamObsServerDraft("");
			setStreamObsKeyDraft("");
			setStreamTitleDraft("");
			setHostedStreamId(null);
			setKnownStreamHostId(null);
			setStreamMode("idle");
			await fetchStreams();
			onStatusNote("Stream session reset. You can try going live again.");
		};

		reset().catch(() => {
			onStatusNote("Could not reset the stream session.");
		});
	}, [
		clearStreamViewers,
		closeAllStreamPeers,
		currentRoomStream,
		fetchStreams,
		httpBase,
		isAuthenticated,
		onAuthRequired,
		onStatusNote,
		sessionToken,
		userId,
	]);

	const handleDeleteCurrentRoomStream = useCallback(() => {
		if (!isAuthenticated) {
			onStatusNote("Sign in before you delete a stream session.");
			onAuthRequired();
			return;
		}

		if (!currentRoomStream || currentRoomStream.host_user_id !== userId) {
			onStatusNote("Only the host can delete this stream session.");
			return;
		}

		const remove = async (): Promise<void> => {
			const response = await fetch(`${httpBase}/api/streams/delete`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${sessionToken}`,
				},
				body: JSON.stringify({ stream_id: currentRoomStream.id }),
			});

			if (!response.ok) {
				throw new Error("failed to delete stream");
			}

			closeAllStreamPeers();
			clearStreamViewers();
			stopMediaStream(streamLocalMediaRef.current);
			setStreamLocalMedia(null);
			setStreamPlaybackUrl(null);
			setStreamObsConfig(null);
			setStreamObsServerDraft("");
			setStreamObsKeyDraft("");
			setStreamTitleDraft("");
			setHostedStreamId(null);
			setKnownStreamHostId(null);
			setStreamMode("idle");
			await fetchStreams();
			onStatusNote("Stream session deleted.");
		};

		remove().catch(() => {
			onStatusNote("Could not delete the stream session.");
		});
	}, [
		clearStreamViewers,
		closeAllStreamPeers,
		currentRoomStream,
		fetchStreams,
		httpBase,
		isAuthenticated,
		onAuthRequired,
		onStatusNote,
		sessionToken,
		userId,
	]);

	const handleStartBroadcast = useCallback(() => {
		startBroadcast().catch(() => {
			onStatusNote("Failed to start broadcast.");
		});
	}, [onStatusNote, startBroadcast]);

	const handleStopBroadcast = useCallback(() => {
		stopBroadcast().catch(() => {
			onStatusNote("Could not stop stream cleanly.");
		});
	}, [onStatusNote, stopBroadcast]);

	const getRemoteVideoStream = useCallback(
		(remoteUserId: string) =>
			videoRemoteStreamsRef.current.get(remoteUserId) ?? null,
		[],
	);

	const handleJoinVideoRoom = useCallback(() => {
		joinVideoRoom().catch(() => {
			onStatusNote("Could not join video room.");
		});
	}, [joinVideoRoom, onStatusNote]);

	return {
		getRemoteVideoStream,
		handleFindStream,
		handleJoinVideoRoom,
		handleDeleteCurrentRoomStream,
		handleResetCurrentRoomStream,
		handleStartBroadcast,
		handleStopBroadcast,
		canManageCurrentRoomStream,
		currentRoomStream,
		knownStreamHostId,
		leaveVideoRoom,
		resetRoomRealtimeState,
		signalSocketState,
		streamMode,
		streamObsConfig,
		streamObsIngestPreview,
		streamObsKeyDraft,
		streamObsServerDraft,
		streamPlaybackUrl,
		streamRemoteVideoRef,
		streamTitleDraft,
		streamViewerCount: streamViewerIds.length,
		setStreamObsKeyDraft,
		setStreamObsServerDraft,
		setStreamTitleDraft,
		videoJoined,
		videoLocalVideoRef,
		videoParticipantCount: videoParticipantIds.length + (videoJoined ? 1 : 0),
		videoRemoteUserIds,
	};
}
