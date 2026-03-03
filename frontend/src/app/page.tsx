"use client";

import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { ChatPanel } from "./components/ChatPanel";
import { RoomSidebar } from "./components/RoomSidebar";
import { StreamExperience } from "./components/StreamExperience";
import { VideoExperience } from "./components/VideoExperience";
import { usePersistentUserId } from "./hooks/usePersistentUserId";
import {
  ChatEvent,
  ChatMessage,
  Health,
  Room,
  RoomKind,
  SignalPayload,
  StreamSession,
} from "./types";

const HTTP_BASE =
  process.env.NEXT_PUBLIC_BACKEND_HTTP_URL ?? "http://localhost:8080";
const WS_BASE = process.env.NEXT_PUBLIC_BACKEND_WS_URL ?? "ws://localhost:8080";
const ICE_SERVERS: RTCIceServer[] = [{ urls: "stun:stun.l.google.com:19302" }];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isSignalPayload(value: unknown): value is SignalPayload {
  if (
    !isRecord(value) ||
    typeof value.kind !== "string" ||
    typeof value.mode !== "string"
  ) {
    return false;
  }

  if (value.mode !== "stream" && value.mode !== "video") {
    return false;
  }

  if (value.kind === "peer.announce" || value.kind === "peer.leave") {
    return typeof value.role === "string";
  }

  if (value.kind === "webrtc.offer" || value.kind === "webrtc.answer") {
    return (
      typeof value.target_user_id === "string" && isRecord(value.description)
    );
  }

  if (value.kind === "webrtc.ice") {
    return (
      typeof value.target_user_id === "string" && isRecord(value.candidate)
    );
  }

  if (value.kind === "stream.status") {
    return typeof value.is_live === "boolean";
  }

  return false;
}

export default function Home() {
  const userIdRef = usePersistentUserId();

  const chatSocketRef = useRef<WebSocket | null>(null);
  const signalSocketRef = useRef<WebSocket | null>(null);

  const streamLocalVideoRef = useRef<HTMLVideoElement | null>(null);
  const streamPreviewVideoRef = useRef<HTMLVideoElement | null>(null);
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
  const videoJoinedRef = useRef<boolean>(false);

  const [health, setHealth] = useState<Health | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [streams, setStreams] = useState<StreamSession[]>([]);
  const [activeRoomId, setActiveRoomId] = useState("");

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [chatSocketState, setChatSocketState] = useState("disconnected");
  const [signalSocketState, setSignalSocketState] = useState("disconnected");

  const [roomNameDraft, setRoomNameDraft] = useState("");
  const [roomKindDraft, setRoomKindDraft] = useState<RoomKind>("stream");

  const [streamTitleDraft, setStreamTitleDraft] = useState("My Punch Stream");
  const [streamMode, setStreamMode] = useState<"idle" | "hosting" | "watching">(
    "idle",
  );
  const [streamLocalMedia, setStreamLocalMedia] = useState<MediaStream | null>(
    null,
  );
  const [streamRemoteMedia, setStreamRemoteMedia] =
    useState<MediaStream | null>(null);
  const [hostedStreamId, setHostedStreamId] = useState<string | null>(null);
  const [knownStreamHostId, setKnownStreamHostId] = useState<string | null>(
    null,
  );
  const [streamViewerIds, setStreamViewerIds] = useState<string[]>([]);

  const [videoJoined, setVideoJoined] = useState(false);
  const [videoLocalMedia, setVideoLocalMedia] = useState<MediaStream | null>(
    null,
  );
  const [videoRemoteUserIds, setVideoRemoteUserIds] = useState<string[]>([]);
  const [videoParticipantIds, setVideoParticipantIds] = useState<string[]>([]);

  const [statusNote, setStatusNote] = useState("Ready");

  const activeRoom = useMemo(
    () => rooms.find((room) => room.id === activeRoomId) ?? null,
    [rooms, activeRoomId],
  );

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

  function setStreamViewers(next: Set<string>): void {
    streamViewerIdsRef.current = next;
    setStreamViewerIds(Array.from(next.values()));
  }

  function addStreamViewer(userId: string): void {
    if (!userId || userId === userIdRef.current) {
      return;
    }

    const next = new Set(streamViewerIdsRef.current);
    next.add(userId);
    setStreamViewers(next);
  }

  function removeStreamViewer(userId: string): void {
    const next = new Set(streamViewerIdsRef.current);
    if (!next.delete(userId)) {
      return;
    }
    setStreamViewers(next);
  }

  function clearStreamViewers(): void {
    setStreamViewers(new Set());
  }

  function setVideoParticipants(next: Set<string>): void {
    videoParticipantIdsRef.current = next;
    setVideoParticipantIds(Array.from(next.values()));
  }

  function addVideoParticipant(userId: string): void {
    if (!userId || userId === userIdRef.current) {
      return;
    }

    const next = new Set(videoParticipantIdsRef.current);
    next.add(userId);
    setVideoParticipants(next);
  }

  function removeVideoParticipant(userId: string): void {
    const next = new Set(videoParticipantIdsRef.current);
    if (!next.delete(userId)) {
      return;
    }
    setVideoParticipants(next);
  }

  function clearVideoParticipants(): void {
    setVideoParticipants(new Set());
  }

  const fetchHealth = useCallback(async (): Promise<void> => {
    try {
      const response = await fetch(`${HTTP_BASE}/health`);
      const payload = (await response.json()) as Health;
      setHealth(payload);
    } catch {
      setHealth(null);
    }
  }, []);

  const fetchRooms = useCallback(async (): Promise<void> => {
    try {
      const response = await fetch(`${HTTP_BASE}/api/rooms`);
      const payload = (await response.json()) as Room[];
      setRooms(payload);
      setActiveRoomId((prev) => {
        if (payload.length === 0) {
          return "";
        }

        if (prev && payload.some((room) => room.id === prev)) {
          return prev;
        }

        return payload[0].id;
      });
    } catch {
      setRooms([]);
      setActiveRoomId("");
    }
  }, []);

  const fetchStreams = useCallback(async (): Promise<void> => {
    try {
      const response = await fetch(`${HTTP_BASE}/api/streams`);
      const payload = (await response.json()) as StreamSession[];
      setStreams(payload);
    } catch {
      setStreams([]);
    }
  }, []);

  useEffect(() => {
    void fetchHealth();
    void fetchRooms();
    void fetchStreams();
  }, [fetchHealth, fetchRooms, fetchStreams]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      fetchStreams().catch(() => {
        // Ignore polling errors.
      });
    }, 5000);

    return () => window.clearInterval(interval);
  }, [fetchStreams]);

  function closeStreamPeer(remoteUserId: string): void {
    const peer = streamPeerConnectionsRef.current.get(remoteUserId);
    if (!peer) {
      return;
    }

    peer.close();
    streamPeerConnectionsRef.current.delete(remoteUserId);
  }

  function closeAllStreamPeers(): void {
    streamPeerConnectionsRef.current.forEach((peer) => peer.close());
    streamPeerConnectionsRef.current.clear();
  }

  function closeVideoPeer(remoteUserId: string): void {
    const peer = videoPeerConnectionsRef.current.get(remoteUserId);
    if (peer) {
      peer.close();
      videoPeerConnectionsRef.current.delete(remoteUserId);
    }

    removeVideoParticipant(remoteUserId);

    if (videoRemoteStreamsRef.current.delete(remoteUserId)) {
      setVideoRemoteUserIds(Array.from(videoRemoteStreamsRef.current.keys()));
    }
  }

  function closeAllVideoPeers(): void {
    videoPeerConnectionsRef.current.forEach((peer) => peer.close());
    videoPeerConnectionsRef.current.clear();
    videoRemoteStreamsRef.current.clear();
    setVideoRemoteUserIds([]);
  }

  function stopMediaStream(stream: MediaStream | null): void {
    if (!stream) {
      return;
    }
    stream.getTracks().forEach((track) => track.stop());
  }

  function sendSignal(payload: SignalPayload): void {
    const socket = signalSocketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      return;
    }

    socket.send(JSON.stringify(payload));
  }

  function sendStreamViewerLeave(): void {
    if (streamModeRef.current !== "watching") {
      return;
    }

    sendSignal({
      kind: "peer.leave",
      mode: "stream",
      role: "viewer",
      target_user_id: knownStreamHostIdRef.current ?? undefined,
    });
  }

  function makePeerConnection(
    mode: "stream" | "video",
    remoteUserId: string,
    includeLocalTracks: boolean,
  ): RTCPeerConnection {
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
        setStreamRemoteMedia(incoming);
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
  }

  function ensureStreamPeer(
    remoteUserId: string,
    includeLocalTracks: boolean,
  ): RTCPeerConnection {
    const existing = streamPeerConnectionsRef.current.get(remoteUserId);
    if (existing) {
      return existing;
    }

    const peer = makePeerConnection("stream", remoteUserId, includeLocalTracks);
    streamPeerConnectionsRef.current.set(remoteUserId, peer);
    return peer;
  }

  function ensureVideoPeer(remoteUserId: string): RTCPeerConnection {
    const existing = videoPeerConnectionsRef.current.get(remoteUserId);
    if (existing) {
      return existing;
    }

    const peer = makePeerConnection("video", remoteUserId, true);
    videoPeerConnectionsRef.current.set(remoteUserId, peer);
    return peer;
  }

  async function createStreamOfferForViewer(
    viewerUserId: string,
  ): Promise<void> {
    const peer = ensureStreamPeer(viewerUserId, true);
    const offer = await peer.createOffer();
    await peer.setLocalDescription(offer);

    sendSignal({
      kind: "webrtc.offer",
      mode: "stream",
      target_user_id: viewerUserId,
      description: offer,
    });
  }

  async function createVideoOfferForParticipant(
    participantUserId: string,
  ): Promise<void> {
    const peer = ensureVideoPeer(participantUserId);
    const offer = await peer.createOffer();
    await peer.setLocalDescription(offer);

    sendSignal({
      kind: "webrtc.offer",
      mode: "video",
      target_user_id: participantUserId,
      description: offer,
    });
  }

  async function startBroadcast(): Promise<void> {
    if (!activeRoom || activeRoom.kind !== "stream") {
      setStatusNote("Pick a stream room to broadcast.");
      return;
    }

    if (streamModeRef.current === "hosting") {
      return;
    }

    let media: MediaStream | null = null;

    try {
      media = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });

      closeAllStreamPeers();
      clearStreamViewers();
      setStreamRemoteMedia(null);
      setStreamLocalMedia(media);
      setStreamMode("hosting");
      setKnownStreamHostId(userIdRef.current);

      const response = await fetch(`${HTTP_BASE}/api/streams`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          room_id: activeRoom.id,
          user_id: userIdRef.current,
          title: streamTitleDraft.trim() || "Live on Punch",
        }),
      });

      if (!response.ok) {
        throw new Error("failed to start stream");
      }

      const session = (await response.json()) as StreamSession;
      setHostedStreamId(session.id);
      setStatusNote("Broadcast is live.");
      sendSignal({ kind: "peer.announce", mode: "stream", role: "host" });
      sendSignal({
        kind: "stream.status",
        mode: "stream",
        is_live: true,
        title: session.title,
      });

      await fetchStreams();
    } catch {
      setStatusNote("Could not access camera/mic for stream broadcasting.");
      setStreamMode("idle");
      stopMediaStream(media ?? streamLocalMediaRef.current);
      setStreamLocalMedia(null);
    }
  }

  async function stopBroadcast(notify = true): Promise<void> {
    sendSignal({ kind: "peer.leave", mode: "stream", role: "host" });
    sendSignal({ kind: "stream.status", mode: "stream", is_live: false });

    const streamId = hostedStreamIdRef.current;
    if (streamId) {
      await fetch(`${HTTP_BASE}/api/streams/stop`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stream_id: streamId }),
      }).catch(() => {
        // Keep local teardown even if backend stop call fails.
      });
    }

    closeAllStreamPeers();
    clearStreamViewers();
    stopMediaStream(streamLocalMediaRef.current);
    setStreamLocalMedia(null);
    setStreamRemoteMedia(null);
    setHostedStreamId(null);
    setKnownStreamHostId(null);
    setStreamMode("idle");

    if (notify) {
      setStatusNote("Broadcast stopped.");
    }

    await fetchStreams();
  }

  async function joinVideoRoom(): Promise<void> {
    if (!activeRoom || activeRoom.kind !== "video") {
      setStatusNote("Pick a video room before joining.");
      return;
    }

    if (videoJoinedRef.current) {
      return;
    }

    try {
      const media = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });

      clearVideoParticipants();
      setVideoLocalMedia(media);
      setVideoJoined(true);
      setStatusNote("Joined video room.");
      sendSignal({ kind: "peer.announce", mode: "video", role: "participant" });
    } catch {
      setStatusNote("Could not access camera/mic for video room.");
    }
  }

  function leaveVideoRoom(notify = true): void {
    if (videoJoinedRef.current) {
      sendSignal({ kind: "peer.leave", mode: "video", role: "participant" });
    }

    closeAllVideoPeers();
    clearVideoParticipants();
    stopMediaStream(videoLocalMediaRef.current);
    setVideoLocalMedia(null);
    setVideoJoined(false);

    if (notify) {
      setStatusNote("Left video room.");
    }
  }

  function resetRoomRealtimeState(): void {
    if (streamModeRef.current === "hosting") {
      sendSignal({ kind: "peer.leave", mode: "stream", role: "host" });
      sendSignal({ kind: "stream.status", mode: "stream", is_live: false });

      const streamId = hostedStreamIdRef.current;
      if (streamId) {
        fetch(`${HTTP_BASE}/api/streams/stop`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ stream_id: streamId }),
        })
          .then(() => fetchStreams())
          .catch(() => {
            // Room switches should keep local teardown even on request failures.
          });
      }
    }

    sendStreamViewerLeave();

    closeAllStreamPeers();
    clearStreamViewers();
    setStreamRemoteMedia(null);
    setKnownStreamHostId(null);
    setStreamMode("idle");

    stopMediaStream(streamLocalMediaRef.current);
    setStreamLocalMedia(null);
    setHostedStreamId(null);

    leaveVideoRoom(false);
  }

  function handleSelectRoom(nextRoomId: string): void {
    if (nextRoomId === activeRoomId) {
      return;
    }

    resetRoomRealtimeState();
    setActiveRoomId(nextRoomId);
  }

  useEffect(() => {
    return () => {
      resetRoomRealtimeState();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!activeRoomId) {
      setMessages([]);
      return;
    }

    fetch(
      `${HTTP_BASE}/api/messages?room_id=${encodeURIComponent(activeRoomId)}`,
    )
      .then((response) => response.json())
      .then((payload: ChatMessage[]) => setMessages(payload))
      .catch(() => setMessages([]));
  }, [activeRoomId]);

  useEffect(() => {
    if (!activeRoomId) {
      chatSocketRef.current = null;
      setChatSocketState("disconnected");
      return;
    }

    const socket = new WebSocket(
      `${WS_BASE}/ws/chat?room_id=${encodeURIComponent(activeRoomId)}&user_id=${encodeURIComponent(userIdRef.current)}`,
    );

    socket.onopen = () => setChatSocketState("connected");
    socket.onclose = () => setChatSocketState("disconnected");
    socket.onerror = () => setChatSocketState("error");
    socket.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data) as ChatEvent;
        if (payload.type !== "chat.message") {
          return;
        }

        if (payload.message.room_id !== activeRoomId) {
          return;
        }

        setMessages((prev) => [...prev, payload.message]);
      } catch {
        // Ignore malformed payloads.
      }
    };

    chatSocketRef.current = socket;

    return () => {
      if (chatSocketRef.current === socket) {
        chatSocketRef.current = null;
      }
      socket.close();
    };
  }, [activeRoomId, userIdRef]);

  async function handleStreamSignal(
    fromUserId: string,
    payload: SignalPayload,
  ): Promise<void> {
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
        setStreamRemoteMedia(null);
        setKnownStreamHostId(null);
        setStreamMode("idle");
        setStatusNote("Host left the stream.");
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
        setStreamRemoteMedia(null);
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
  }

  async function handleVideoSignal(
    fromUserId: string,
    payload: SignalPayload,
  ): Promise<void> {
    if (payload.mode !== "video" || !videoJoinedRef.current) {
      return;
    }

    if (payload.kind === "peer.announce") {
      if (payload.role !== "participant") {
        return;
      }

      addVideoParticipant(fromUserId);

      const shouldInitiateOffer = userIdRef.current < fromUserId;
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
  }

  useEffect(() => {
    if (!activeRoomId) {
      signalSocketRef.current = null;
      setSignalSocketState("disconnected");
      return;
    }

    const socket = new WebSocket(
      `${WS_BASE}/ws/signal?room_id=${encodeURIComponent(activeRoomId)}&user_id=${encodeURIComponent(userIdRef.current)}`,
    );

    socket.onopen = () => {
      setSignalSocketState("connected");

      if (activeRoom?.kind === "stream") {
        const isHosting = streamModeRef.current === "hosting";
        sendSignal({
          kind: "peer.announce",
          mode: "stream",
          role: isHosting ? "host" : "viewer",
          target_user_id: isHosting
            ? undefined
            : (knownStreamHostIdRef.current ?? undefined),
        });
      }

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
          parsedPayload.target_user_id !== userIdRef.current
        ) {
          return;
        }

        if (parsedPayload.mode === "stream" && activeRoom?.kind === "stream") {
          handleStreamSignal(fromUserId, parsedPayload).catch(() => {
            // Ignore transient signaling failures.
          });
        }

        if (parsedPayload.mode === "video" && activeRoom?.kind === "video") {
          handleVideoSignal(fromUserId, parsedPayload).catch(() => {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeRoomId, activeRoom?.kind]);

  useEffect(() => {
    if (streamLocalVideoRef.current) {
      streamLocalVideoRef.current.srcObject = streamLocalMedia;
    }
    if (streamPreviewVideoRef.current) {
      streamPreviewVideoRef.current.srcObject = streamLocalMedia;
    }
  }, [streamLocalMedia]);

  useEffect(() => {
    if (streamRemoteVideoRef.current) {
      streamRemoteVideoRef.current.srcObject = streamRemoteMedia;
    }
  }, [streamRemoteMedia]);

  useEffect(() => {
    if (videoLocalVideoRef.current) {
      videoLocalVideoRef.current.srcObject = videoLocalMedia;
    }
  }, [videoLocalMedia]);

  function submitMessage(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const text = draft.trim();
    if (
      !text ||
      !chatSocketRef.current ||
      chatSocketRef.current.readyState !== WebSocket.OPEN
    ) {
      return;
    }

    chatSocketRef.current.send(text);
    setDraft("");
  }

  async function submitCreateRoom(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();

    const name = roomNameDraft.trim();
    if (!name) {
      return;
    }

    const response = await fetch(`${HTTP_BASE}/api/rooms`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, kind: roomKindDraft }),
    });

    if (!response.ok) {
      setStatusNote("Could not create room.");
      return;
    }

    const room = (await response.json()) as Room;
    setRooms((prev) => [...prev, room]);
    handleSelectRoom(room.id);
    setRoomNameDraft("");
    setStatusNote(`Created ${room.kind} room "${room.name}".`);
  }

  const liveStreams = useMemo(
    () => streams.filter((stream) => stream.live),
    [streams],
  );

  useEffect(() => {
    if (!activeRoom || activeRoom.kind !== "stream") {
      return;
    }

    const streamForRoom = liveStreams.find(
      (stream) => stream.room_id === activeRoom.id,
    );
    setKnownStreamHostId(streamForRoom?.host_user_id ?? null);
  }, [activeRoom, liveStreams]);

  const roomNameById = useMemo(() => {
    const entries = new Map<string, string>();
    rooms.forEach((room) => entries.set(room.id, room.name));
    return entries;
  }, [rooms]);

  const videoParticipantCount =
    videoParticipantIds.length + (videoJoined ? 1 : 0);

  return (
    <main className="shell">
      <header className="hero">
        <p className="eyebrow">Punch</p>
        <h1>Streams and live rooms in one place.</h1>
        <p className="lede">
          Build Twitch-style channel browsing and Discord-style webcam rooms.
          Backend: <strong>{health?.ok ? "healthy" : "down"}</strong>. Chat
          socket: <strong>{chatSocketState}</strong>. Signal socket:{" "}
          <strong>{signalSocketState}</strong>.
        </p>
        <p className="status">
          User: {userIdRef.current}. Status: {statusNote}
        </p>
      </header>

      <section className="grid">
        <RoomSidebar
          activeRoomId={activeRoomId}
          liveStreams={liveStreams}
          onCreateRoom={submitCreateRoom}
          onRoomKindDraftChange={setRoomKindDraft}
          onRoomNameDraftChange={setRoomNameDraft}
          onSelectRoom={handleSelectRoom}
          roomKindDraft={roomKindDraft}
          roomNameById={roomNameById}
          roomNameDraft={roomNameDraft}
          rooms={rooms}
        />

        <section className="panel workspace">
          <header className="room-head">
            <h2>{activeRoom ? activeRoom.name : "No room selected"}</h2>
            <span>{activeRoom ? activeRoom.kind : ""}</span>
          </header>

          <div className="experience">
            {activeRoom?.kind === "stream" ? (
              <StreamExperience
                knownStreamHostId={knownStreamHostId}
                onFindStream={() =>
                  sendSignal({
                    kind: "peer.announce",
                    mode: "stream",
                    role: "viewer",
                    target_user_id: knownStreamHostId ?? undefined,
                  })
                }
                onStartBroadcast={() => {
                  startBroadcast().catch(() => {
                    setStatusNote("Failed to start broadcast.");
                  });
                }}
                onStopBroadcast={() => {
                  stopBroadcast().catch(() => {
                    setStatusNote("Could not stop stream cleanly.");
                  });
                }}
                onStreamTitleDraftChange={setStreamTitleDraft}
                streamLocalVideoRef={streamLocalVideoRef}
                streamMode={streamMode}
                streamPreviewVideoRef={streamPreviewVideoRef}
                streamRemoteVideoRef={streamRemoteVideoRef}
                streamTitleDraft={streamTitleDraft}
                streamViewerCount={streamViewerIds.length}
              />
            ) : null}

            {activeRoom?.kind === "video" ? (
              <VideoExperience
                getRemoteVideoStream={(remoteUserId) =>
                  videoRemoteStreamsRef.current.get(remoteUserId) ?? null
                }
                onJoinVideoRoom={() => {
                  joinVideoRoom().catch(() => {
                    setStatusNote("Could not join video room.");
                  });
                }}
                onLeaveVideoRoom={() => leaveVideoRoom()}
                videoJoined={videoJoined}
                videoLocalVideoRef={videoLocalVideoRef}
                videoParticipantCount={videoParticipantCount}
                videoRemoteUserIds={videoRemoteUserIds}
              />
            ) : null}

            {activeRoom &&
            activeRoom.kind !== "stream" &&
            activeRoom.kind !== "video" ? (
              <section className="mode-panel">
                <p className="muted">
                  This is a <strong>{activeRoom.kind}</strong> room. Text chat
                  below is live.
                </p>
              </section>
            ) : null}
          </div>

          <ChatPanel
            draft={draft}
            messages={messages}
            onDraftChange={setDraft}
            onSubmit={submitMessage}
          />
        </section>
      </section>
    </main>
  );
}
