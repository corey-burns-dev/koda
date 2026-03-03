"use client";

import { FormEvent, useEffect, useRef, useState } from "react";

type Health = {
  ok: boolean;
  service: string;
};

type Room = {
  id: string;
  name: string;
  kind: "text" | "voice" | "video" | "stream";
};

type ChatMessage = {
  id: string;
  room_id: string;
  user_id: string;
  body: string;
  sent_at_unix_ms: number;
};

type ChatEvent = {
  type: "chat.message";
  message: ChatMessage;
};

const HTTP_BASE = process.env.NEXT_PUBLIC_BACKEND_HTTP_URL ?? "http://localhost:8080";
const WS_BASE = process.env.NEXT_PUBLIC_BACKEND_WS_URL ?? "ws://localhost:8080";

export default function Home() {
  const wsRef = useRef<WebSocket | null>(null);
  const [health, setHealth] = useState<Health | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [activeRoomId, setActiveRoomId] = useState<string>("room-1");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [socketState, setSocketState] = useState("disconnected");

  const userId = "web-user";

  useEffect(() => {
    fetch(`${HTTP_BASE}/health`)
      .then((response) => response.json())
      .then((payload: Health) => setHealth(payload))
      .catch(() => setHealth(null));

    fetch(`${HTTP_BASE}/api/rooms`)
      .then((response) => response.json())
      .then((payload: Room[]) => {
        setRooms(payload);
        if (payload.length > 0) {
          setActiveRoomId(payload[0].id);
        }
      })
      .catch(() => setRooms([]));
  }, []);

  useEffect(() => {
    fetch(`${HTTP_BASE}/api/messages?room_id=${encodeURIComponent(activeRoomId)}`)
      .then((response) => response.json())
      .then((payload: ChatMessage[]) => setMessages(payload))
      .catch(() => setMessages([]));

    const socket = new WebSocket(
      `${WS_BASE}/ws/chat?room_id=${encodeURIComponent(activeRoomId)}&user_id=${encodeURIComponent(userId)}`,
    );

    socket.onopen = () => setSocketState("connected");
    socket.onclose = () => setSocketState("disconnected");
    socket.onerror = () => setSocketState("error");
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

    wsRef.current = socket;

    return () => {
      wsRef.current = null;
      socket.close();
    };
  }, [activeRoomId]);

  function submitMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = draft.trim();
    if (!text || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      return;
    }
    wsRef.current.send(text);
    setDraft("");
  }

  return (
    <main className="shell">
      <section className="hero">
        <p className="eyebrow">Punch</p>
        <h1>Twitch-style streaming and Discord-style rooms, backend-first.</h1>
        <p className="lede">
          Live status: <strong>{health?.ok ? "backend healthy" : "backend unavailable"}</strong>.
          Socket: <strong>{socketState}</strong>.
        </p>
      </section>

      <section className="grid">
        <aside className="panel">
          <h2>Rooms</h2>
          <ul className="rooms">
            {rooms.map((room) => (
              <li key={room.id}>
                <button
                  className={room.id === activeRoomId ? "room active" : "room"}
                  onClick={() => setActiveRoomId(room.id)}
                  type="button"
                >
                  <span>{room.name}</span>
                  <small>{room.kind}</small>
                </button>
              </li>
            ))}
          </ul>
        </aside>

        <section className="panel chat-panel">
          <h2>Room Chat</h2>
          <div className="chat-log">
            {messages.map((message) => (
              <article key={message.id} className="msg">
                <header>
                  <strong>{message.user_id}</strong>
                  <span>{new Date(message.sent_at_unix_ms).toLocaleTimeString()}</span>
                </header>
                <p>{message.body}</p>
              </article>
            ))}
          </div>
          <form className="composer" onSubmit={submitMessage}>
            <input
              aria-label="Message"
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Send a message"
              value={draft}
            />
            <button type="submit">Send</button>
          </form>
        </section>
      </section>
    </main>
  );
}
