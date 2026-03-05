"use client";

import Hls from "hls.js";
import { Hash, MessageSquare, Radio, Video as VideoIcon } from "lucide-react";
import type { FormEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { AuthModal } from "./components/AuthModal";
import { ChatPanel } from "./components/ChatPanel";
import { RightNav } from "./components/RightNav";
import { RoomSidebar } from "./components/RoomSidebar";
import { StreamExperience } from "./components/StreamExperience";
import { TopNav } from "./components/TopNav";
import { VideoExperience } from "./components/VideoExperience";
import { usePersistentUser } from "./hooks/usePersistentUser";

import type {
  BrowseTab,
  ChatEvent,
  ChatMessage,
  Health,
  Room,
  RoomKind,
  SignalPayload,
  StreamObsConfig,
  StreamSession,
  StreamStartResponse,
} from "./types";

const ICE_SERVERS: RTCIceServer[] = [{ urls: "stun:stun.l.google.com:19302" }];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isSignalPayload(value: unknown): value is SignalPayload {
  if (!isRecord(value) || typeof value.kind !== "string" || typeof value.mode !== "string") {
    return false;
  }

  if (value.mode !== "stream" && value.mode !== "video") {
    return false;
  }

  if (value.kind === "peer.announce" || value.kind === "peer.leave") {
    return typeof value.role === "string";
  }

  if (value.kind === "webrtc.offer" || value.kind === "webrtc.answer") {
    return typeof value.target_user_id === "string" && isRecord(value.description);
  }

  if (value.kind === "webrtc.ice") {
    return typeof value.target_user_id === "string" && isRecord(value.candidate);
  }

  if (value.kind === "stream.status") {
    return typeof value.is_live === "boolean";
  }

  return false;
}

export default function Home() {
  const { user, hydrated, setUser, clearUser } = usePersistentUser();
  const isAuthenticated = user !== null;
  const userId = user?.id ?? "";
  const sessionToken = user?.token ?? "";

  const { http: HTTP_BASE, ws: WS_BASE } = useMemo(() => {
    const DEFAULT_BACKEND_PORT = "8080";
    if (typeof window === "undefined") {
      return {
        http:
          process.env.NEXT_PUBLIC_BACKEND_HTTP_URL ?? `http://localhost:${DEFAULT_BACKEND_PORT}`,
        ws: process.env.NEXT_PUBLIC_BACKEND_WS_URL ?? `ws://localhost:${DEFAULT_BACKEND_PORT}`,
      };
    }
    const hostname = window.location.hostname;
    const httpProtocol = window.location.protocol === "https:" ? "https:" : "http:";
    const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    return {
      http:
        process.env.NEXT_PUBLIC_BACKEND_HTTP_URL ??
        `${httpProtocol}//${hostname}:${DEFAULT_BACKEND_PORT}`,
      ws:
        process.env.NEXT_PUBLIC_BACKEND_WS_URL ??
        `${wsProtocol}//${hostname}:${DEFAULT_BACKEND_PORT}`,
    };
  }, []);

  const chatSocketRef = useRef<WebSocket | null>(null);
  const signalSocketRef = useRef<WebSocket | null>(null);

  const streamRemoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const videoLocalVideoRef = useRef<HTMLVideoElement | null>(null);

  const streamPeerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const videoPeerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const videoRemoteStreamsRef = useRef<Map<string, MediaStream>>(new Map());

  const streamViewerIdsRef = useRef<Set<string>>(new Set());
  const videoParticipantIdsRef = useRef<Set<string>>(new Set());

  const streamLocalMediaRef = useRef<MediaStream | null>(null);
  const hostedStreamIdRef = useRef<string | null>(null);
  const streamModeRef = useRef<"idle" | "hosting" | "watching">("idle");
  const knownStreamHostIdRef = useRef<string | null>(null);
  const videoLocalMediaRef = useRef<MediaStream | null>(null);
  const videoJoinedRef = useRef<boolean>(false);
  const resetRoomRealtimeStateRef = useRef<(() => void) | null>(null);
  const handleStreamSignalRef = useRef<
    ((fromUserId: string, payload: SignalPayload) => Promise<void>) | null
  >(null);
  const handleVideoSignalRef = useRef<
    ((fromUserId: string, payload: SignalPayload) => Promise<void>) | null
  >(null);

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

  const [streamTitleDraft, setStreamTitleDraft] = useState("My Koda Stream");
  const [streamMode, setStreamMode] = useState<"idle" | "hosting" | "watching">("idle");
  const [streamLocalMedia, setStreamLocalMedia] = useState<MediaStream | null>(null);
  const [streamPlaybackUrl, setStreamPlaybackUrl] = useState<string | null>(null);
  const [hostedStreamId, setHostedStreamId] = useState<string | null>(null);
  const [knownStreamHostId, setKnownStreamHostId] = useState<string | null>(null);
  const [streamObsConfig, setStreamObsConfig] = useState<StreamObsConfig | null>(null);
  const [streamObsServerDraft, setStreamObsServerDraft] = useState("");
  const [streamObsKeyDraft, setStreamObsKeyDraft] = useState("");
  const [streamViewerIds, setStreamViewerIds] = useState<string[]>([]);

  const [videoJoined, setVideoJoined] = useState(false);
  const [videoLocalMedia, setVideoLocalMedia] = useState<MediaStream | null>(null);
  const [videoRemoteUserIds, setVideoRemoteUserIds] = useState<string[]>([]);
  const [videoParticipantIds, setVideoParticipantIds] = useState<string[]>([]);

  const [statusNote, setStatusNote] = useState("Ready");
  const [authOpen, setAuthOpen] = useState(false);
  const [tab, setTab] = useState<BrowseTab>("all");

  const activeRoom = useMemo(
    () => rooms.find((room) => room.id === activeRoomId) ?? null,
    [rooms, activeRoomId],
  );

  const buildWsUrl = useCallback(
    (pathname: string, params: Record<string, string>): string => {
      const base = WS_BASE.endsWith("/") ? WS_BASE : `${WS_BASE}/`;
      const url = new URL(pathname, base);
      for (const [key, value] of Object.entries(params)) {
        url.searchParams.set(key, value);
      }
      return url.toString();
    },
    [WS_BASE],
  );

  const probeSessionToken = useCallback(async (): Promise<"valid" | "invalid" | "unreachable"> => {
    if (!sessionToken) {
      return "invalid";
    }

    try {
      const response = await fetch(`${HTTP_BASE}/api/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({
          room_id: "",
          body: "",
        }),
      });

      if (response.status === 401) {
        return "invalid";
      }

      return "valid";
    } catch {
      return "unreachable";
    }
  }, [HTTP_BASE, sessionToken]);

  const resolvedStreamPlaybackUrl = useMemo(() => {
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
  }, [streamPlaybackUrl]);

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

  function addStreamViewer(userIdParam: string): void {
    if (!userIdParam || userIdParam === userId) {
      return;
    }

    const next = new Set(streamViewerIdsRef.current);
    next.add(userIdParam);
    setStreamViewers(next);
  }

  function removeStreamViewer(userIdParam: string): void {
    const next = new Set(streamViewerIdsRef.current);
    if (!next.delete(userIdParam)) {
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

  function addVideoParticipant(userIdParam: string): void {
    if (!userIdParam || userIdParam === userId) {
      return;
    }

    const next = new Set(videoParticipantIdsRef.current);
    next.add(userIdParam);
    setVideoParticipants(next);
  }

  function removeVideoParticipant(userIdParam: string): void {
    const next = new Set(videoParticipantIdsRef.current);
    if (!next.delete(userIdParam)) {
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
  }, [HTTP_BASE]);

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
  }, [HTTP_BASE]);

  const fetchStreams = useCallback(async (): Promise<void> => {
    try {
      const response = await fetch(`${HTTP_BASE}/api/streams`);
      const payload = (await response.json()) as StreamSession[];
      setStreams(payload);
    } catch {
      setStreams([]);
    }
  }, [HTTP_BASE]);

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
    streamPeerConnectionsRef.current.forEach((peer) => {
      peer.close();
    });
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
    videoPeerConnectionsRef.current.forEach((peer) => {
      peer.close();
    });
    videoPeerConnectionsRef.current.clear();
    videoRemoteStreamsRef.current.clear();
    setVideoRemoteUserIds([]);
  }

  function stopMediaStream(stream: MediaStream | null): void {
    if (!stream) {
      return;
    }
    stream.getTracks().forEach((track) => {
      track.stop();
    });
  }

  const sendSignal = useCallback((payload: SignalPayload): void => {
    const socket = signalSocketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      return;
    }

    socket.send(JSON.stringify(payload));
  }, []);

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
        setStreamMode((current) => (current === "hosting" ? current : "watching"));
        return;
      }

      addVideoParticipant(remoteUserId);
      videoRemoteStreamsRef.current.set(remoteUserId, incoming);
      setVideoRemoteUserIds(Array.from(videoRemoteStreamsRef.current.keys()));
    };

    if (includeLocalTracks) {
      const media = mode === "stream" ? streamLocalMediaRef.current : videoLocalMediaRef.current;
      if (media) {
        media.getTracks().forEach((track) => {
          peer.addTrack(track, media);
        });
      }
    }

    return peer;
  }

  function ensureStreamPeer(remoteUserId: string, includeLocalTracks: boolean): RTCPeerConnection {
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

  async function createStreamOfferForViewer(viewerUserId: string): Promise<void> {
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

  async function createVideoOfferForParticipant(participantUserId: string): Promise<void> {
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
    if (!isAuthenticated) {
      setStatusNote("Sign in before you start a stream.");
      setAuthOpen(true);
      return;
    }

    if (!activeRoom || activeRoom.kind !== "stream") {
      setStatusNote("Pick a stream room to broadcast.");
      return;
    }

    if (streamModeRef.current === "hosting") {
      return;
    }

    const customServer = streamObsServerDraft.trim();
    const customStreamKey = streamObsKeyDraft.trim();
    if (customServer.length > 0 !== customStreamKey.length > 0) {
      setStatusNote("Enter both OBS server and stream key, or leave both blank.");
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
        title: streamTitleDraft.trim() || "Live on Koda",
      };

      if (customServer.length > 0) {
        payload.ingest_server_url = customServer;
        payload.stream_key = customStreamKey;
      }

      const response = await fetch(`${HTTP_BASE}/api/streams`, {
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
      setStatusNote("Broadcast created. Start streaming from OBS with the shown credentials.");

      await fetchStreams();
    } catch {
      setStatusNote("Could not create stream session.");
      setStreamMode("idle");
      setStreamLocalMedia(null);
      setStreamObsConfig(null);
      setStreamPlaybackUrl(null);
      setHostedStreamId(null);
      setKnownStreamHostId(null);
    }
  }

  async function stopBroadcast(notify = true): Promise<void> {
    const streamId = hostedStreamIdRef.current;
    if (streamId) {
      await fetch(`${HTTP_BASE}/api/streams/stop`, {
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
    setHostedStreamId(null);
    setKnownStreamHostId(null);
    setStreamMode("idle");

    if (notify) {
      setStatusNote("Broadcast stopped.");
    }

    await fetchStreams();
  }

  async function joinVideoRoom(): Promise<void> {
    if (!isAuthenticated) {
      setStatusNote("Sign in before joining a video room.");
      setAuthOpen(true);
      return;
    }

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
      const streamId = hostedStreamIdRef.current;
      if (streamId) {
        fetch(`${HTTP_BASE}/api/streams/stop`, {
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
  }

  resetRoomRealtimeStateRef.current = resetRoomRealtimeState;

  function handleSelectRoom(nextRoomId: string): void {
    if (nextRoomId === activeRoomId) {
      return;
    }

    resetRoomRealtimeState();
    setActiveRoomId(nextRoomId);
  }

  useEffect(() => {
    return () => {
      resetRoomRealtimeStateRef.current?.();
    };
  }, []);

  useEffect(() => {
    if (!activeRoomId) {
      setMessages([]);
      return;
    }

    const controller = new AbortController();

    fetch(`${HTTP_BASE}/api/messages?room_id=${encodeURIComponent(activeRoomId)}`, {
      signal: controller.signal,
    })
      .then((response) => response.json())
      .then((payload: ChatMessage[]) => setMessages(payload))
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
        setMessages([]);
      });

    return () => {
      controller.abort();
    };
  }, [activeRoomId, HTTP_BASE]);

  useEffect(() => {
    if (!activeRoomId || !hydrated || !isAuthenticated || !userId || !sessionToken) {
      if (chatSocketRef.current) {
        chatSocketRef.current.close();
        chatSocketRef.current = null;
      }
      setChatSocketState(hydrated && !isAuthenticated ? "login required" : "disconnected");
      return;
    }

    let socket: WebSocket | null = null;
    let cancelled = false;
    let reconnectTimer: number | null = null;
    let reconnectAttempt = 0;

    const scheduleReconnect = () => {
      if (cancelled || reconnectTimer !== null) {
        return;
      }

      const delayMs = Math.min(1000 * 2 ** reconnectAttempt, 5000);
      reconnectAttempt += 1;
      reconnectTimer = window.setTimeout(() => {
        reconnectTimer = null;
        connect();
      }, delayMs);
    };

    const connect = () => {
      if (cancelled) {
        return;
      }

      const currentSocket = new WebSocket(
        buildWsUrl("/ws/chat", {
          room_id: activeRoomId,
          token: sessionToken,
        }),
      );
      socket = currentSocket;
      let opened = false;

      currentSocket.onopen = () => {
        opened = true;
        reconnectAttempt = 0;
        setChatSocketState("connected");
      };

      currentSocket.onerror = () => {
        if (!opened) {
          setChatSocketState("error");
        }
      };

      currentSocket.onclose = () => {
        if (chatSocketRef.current === currentSocket) {
          chatSocketRef.current = null;
        }

        if (cancelled) {
          return;
        }

        if (opened) {
          setChatSocketState("disconnected");
          scheduleReconnect();
          return;
        }

        setChatSocketState("error");
        void probeSessionToken().then((status) => {
          if (cancelled) {
            return;
          }

          if (status === "invalid") {
            clearUser();
            setStatusNote("Session expired. Sign in again.");
            setAuthOpen(true);
            setChatSocketState("login required");
            return;
          }

          scheduleReconnect();
        });
      };

      currentSocket.onmessage = (event) => {
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

      chatSocketRef.current = currentSocket;
    };

    setChatSocketState("connecting");
    connect();

    return () => {
      cancelled = true;
      if (reconnectTimer !== null) {
        window.clearTimeout(reconnectTimer);
      }
      if (socket) {
        socket.close();
      }
      if (chatSocketRef.current === socket) {
        chatSocketRef.current = null;
      }
    };
  }, [
    activeRoomId,
    hydrated,
    isAuthenticated,
    userId,
    sessionToken,
    buildWsUrl,
    probeSessionToken,
    clearUser,
  ]);

  async function handleStreamSignal(fromUserId: string, payload: SignalPayload): Promise<void> {
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
      if (payload.role === "host" && fromUserId === knownStreamHostIdRef.current) {
        closeStreamPeer(fromUserId);
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
      await peer.setRemoteDescription(new RTCSessionDescription(payload.description));
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

      await peer.setRemoteDescription(new RTCSessionDescription(payload.description));
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

  async function handleVideoSignal(fromUserId: string, payload: SignalPayload): Promise<void> {
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
      await peer.setRemoteDescription(new RTCSessionDescription(payload.description));
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

      await peer.setRemoteDescription(new RTCSessionDescription(payload.description));
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

  handleStreamSignalRef.current = handleStreamSignal;
  handleVideoSignalRef.current = handleVideoSignal;

  useEffect(() => {
    const shouldOpenSignal = activeRoom?.kind === "stream" || activeRoom?.kind === "video";

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
        setSignalSocketState(hydrated && !isAuthenticated ? "login required" : "disconnected");
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
        const fromUserId = typeof eventPayload.user_id === "string" ? eventPayload.user_id : null;
        if (!fromUserId || !isSignalPayload(parsedPayload)) {
          return;
        }

        if (parsedPayload.target_user_id && parsedPayload.target_user_id !== userId) {
          return;
        }

        if (parsedPayload.mode === "stream" && activeRoom?.kind === "stream") {
          const streamSignalPromise = handleStreamSignalRef.current?.(fromUserId, parsedPayload);
          streamSignalPromise?.catch(() => {
            // Ignore transient signaling failures.
          });
        }

        if (parsedPayload.mode === "video" && activeRoom?.kind === "video") {
          const videoSignalPromise = handleVideoSignalRef.current?.(fromUserId, parsedPayload);
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
    activeRoomId,
    activeRoom?.kind,
    hydrated,
    isAuthenticated,
    userId,
    sessionToken,
    buildWsUrl,
    sendSignal,
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
      setStatusNote("This browser does not support HLS playback.");
    }

    return () => {
      if (hls) {
        hls.destroy();
      }
      element.pause();
      element.removeAttribute("src");
      element.load();
    };
  }, [resolvedStreamPlaybackUrl]);

  useEffect(() => {
    if (videoLocalVideoRef.current) {
      videoLocalVideoRef.current.srcObject = videoLocalMedia;
    }
  }, [videoLocalMedia]);

  function submitMessage(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (!activeRoomId) {
      setStatusNote("Pick a room to chat.");
      return;
    }

    if (!isAuthenticated) {
      setStatusNote("Sign in to chat.");
      setAuthOpen(true);
      return;
    }

    const text = draft.trim();
    if (!text) {
      return;
    }

    const socket = chatSocketRef.current;
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(text);
      setDraft("");
      return;
    }

    fetch(`${HTTP_BASE}/api/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${sessionToken}`,
      },
      body: JSON.stringify({
        room_id: activeRoomId,
        body: text,
      }),
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("failed to send chat message");
        }

        const payload = (await response.json()) as ChatEvent;
        if (payload.type === "chat.message") {
          setMessages((prev) => [...prev, payload.message]);
        }
        setDraft("");
      })
      .catch(() => {
        setStatusNote("Could not send message.");
      });
  }

  async function submitCreateRoom(event: FormEvent<HTMLFormElement>): Promise<boolean> {
    event.preventDefault();

    const name = roomNameDraft.trim();
    if (!name) {
      return false;
    }

    try {
      const response = await fetch(`${HTTP_BASE}/api/rooms`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, kind: roomKindDraft }),
      });

      if (!response.ok) {
        setStatusNote("Could not create room.");
        return false;
      }

      const room = (await response.json()) as Room;
      setRooms((prev) => [...prev, room]);
      handleSelectRoom(room.id);
      setRoomNameDraft("");
      setStatusNote(`Created ${room.kind} room "${room.name}".`);
      return true;
    } catch {
      setStatusNote("Could not create room.");
      return false;
    }
  }

  const liveStreams = useMemo(() => streams.filter((stream) => stream.live), [streams]);
  const liveStreamForActiveRoom = useMemo(() => {
    if (!activeRoom || activeRoom.kind !== "stream") {
      return null;
    }
    return liveStreams.find((stream) => stream.room_id === activeRoom.id) ?? null;
  }, [activeRoom, liveStreams]);

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

    const streamForRoom = liveStreams.find((stream) => stream.room_id === activeRoom.id);
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

  const roomNameById = useMemo(() => {
    const entries = new Map<string, string>();
    rooms.forEach((room) => {
      entries.set(room.id, room.name);
    });
    return entries;
  }, [rooms]);

  const videoParticipantCount = videoParticipantIds.length + (videoJoined ? 1 : 0);

  function handleLogout(): void {
    resetRoomRealtimeState();
    clearUser();
    setDraft("");
    setStatusNote("Signed out.");
  }

  return (
    <div className="app-shell antialiased text-foreground">
      <TopNav
        user={user}
        onOpenAuth={() => setAuthOpen(true)}
        onOpenProfile={() => setStatusNote("Profile panel is coming soon.")}
        onOpenSettings={() => setStatusNote("Settings panel is coming soon.")}
        onLogout={handleLogout}
      />

      <RoomSidebar
        activeRoomId={activeRoomId}
        liveStreams={liveStreams}
        onCreateRoom={submitCreateRoom}
        onRoomKindDraftChange={setRoomKindDraft}
        onRoomNameDraftChange={setRoomNameDraft}
        onSelectRoom={handleSelectRoom}
        onTabChange={setTab}
        roomKindDraft={roomKindDraft}
        roomNameById={roomNameById}
        roomNameDraft={roomNameDraft}
        rooms={rooms}
        tab={tab}
      />

      <section className="main-panel animate-in" style={{ animationDelay: "150ms" }}>
        <header className="flex items-center gap-2 pb-2 border-b border-border/40 shrink-0">
          <h2 className="text-sm font-bold tracking-tight">
            {activeRoom ? activeRoom.name : "Pick a room"}
          </h2>
          {activeRoom && (
            <Badge
              variant="outline"
              className="h-4 px-1.5 bg-primary/10 border-primary/20 text-primary text-[9px] font-extrabold uppercase tracking-widest"
            >
              {activeRoom.kind === "text" && <MessageSquare size={10} className="mr-1" />}
              {activeRoom.kind === "video" && <VideoIcon size={10} className="mr-1" />}
              {activeRoom.kind === "stream" && <Radio size={10} className="mr-1" />}
              {activeRoom.kind === "voice" && <Hash size={10} className="mr-1" />}
              {activeRoom.kind}
            </Badge>
          )}
        </header>

        {activeRoom?.kind === "stream" ? (
          <div className="shrink-0">
            <StreamExperience
              knownStreamHostId={knownStreamHostId}
              liveStreamTitle={liveStreamForActiveRoom?.title ?? null}
              obsConfig={streamObsConfig}
              obsIngestPreview={streamObsIngestPreview}
              obsServerDraft={streamObsServerDraft}
              obsStreamKeyDraft={streamObsKeyDraft}
              onFindStream={() => {
                fetchStreams().catch(() => {
                  setStatusNote("Could not refresh streams.");
                });
              }}
              onObsServerDraftChange={setStreamObsServerDraft}
              onObsStreamKeyDraftChange={setStreamObsKeyDraft}
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
              streamMode={streamMode}
              streamPlaybackUrl={streamPlaybackUrl}
              streamPlaybackVideoRef={streamRemoteVideoRef}
              streamTitleDraft={streamTitleDraft}
              streamViewerCount={streamViewerIds.length}
            />
          </div>
        ) : null}

        {activeRoom?.kind === "video" ? (
          <div className="shrink-0">
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
          </div>
        ) : null}

        <ChatPanel
          canChat={isAuthenticated}
          currentUserId={user?.id ?? null}
          currentUsername={user?.username ?? null}
          draft={draft}
          messages={messages}
          onOpenAuth={() => setAuthOpen(true)}
          onDraftChange={setDraft}
          onSubmit={submitMessage}
        />
      </section>

      <RightNav
        backendHealthy={health?.ok ?? false}
        chatSocketState={chatSocketState}
        signalSocketState={signalSocketState}
        statusNote={statusNote}
        user={user}
        onOpenAuth={() => setAuthOpen(true)}
        onLogout={handleLogout}
      />

      {authOpen && (
        <AuthModal
          onClose={() => setAuthOpen(false)}
          onSuccess={(user) => {
            setUser(user);
            setStatusNote(`Logged in as ${user.username}`);
          }}
        />
      )}
    </div>
  );
}
