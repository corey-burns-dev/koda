export type RoomKind = "text" | "voice" | "video" | "stream";

export type BrowseTab = "all" | "live" | "video" | "text";

export type Health = {
  ok: boolean;
  service: string;
};

export type Room = {
  id: string;
  name: string;
  kind: RoomKind;
};

export type StreamSession = {
  id: string;
  room_id: string;
  host_user_id: string;
  title: string;
  live: boolean;
};

export type ChatMessage = {
  id: string;
  room_id: string;
  user_id: string;
  body: string;
  sent_at_unix_ms: number;
};

export type ChatEvent = {
  type: "chat.message";
  message: ChatMessage;
};

export type SignalMode = "stream" | "video";

export type PeerRole = "host" | "viewer" | "participant";

export type PeerAnnounceSignal = {
  kind: "peer.announce";
  mode: SignalMode;
  role: PeerRole;
  target_user_id?: string;
};

export type PeerLeaveSignal = {
  kind: "peer.leave";
  mode: SignalMode;
  role: PeerRole;
  target_user_id?: string;
};

export type WebrtcOfferSignal = {
  kind: "webrtc.offer";
  mode: SignalMode;
  target_user_id: string;
  description: RTCSessionDescriptionInit;
};

export type WebrtcAnswerSignal = {
  kind: "webrtc.answer";
  mode: SignalMode;
  target_user_id: string;
  description: RTCSessionDescriptionInit;
};

export type WebrtcIceSignal = {
  kind: "webrtc.ice";
  mode: SignalMode;
  target_user_id: string;
  candidate: RTCIceCandidateInit;
};

export type StreamStatusSignal = {
  kind: "stream.status";
  mode: "stream";
  is_live: boolean;
  title?: string;
  target_user_id?: string;
};

export type SignalPayload =
  | PeerAnnounceSignal
  | PeerLeaveSignal
  | WebrtcOfferSignal
  | WebrtcAnswerSignal
  | WebrtcIceSignal
  | StreamStatusSignal;

export const ROOM_KINDS: RoomKind[] = ["text", "voice", "video", "stream"];
