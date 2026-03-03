"use client";

import { FormEvent, useState } from "react";

import { ROOM_KINDS, Room, RoomKind, StreamSession } from "../types";

type BrowseTab = "all" | "live" | "video" | "text";

type RoomSidebarProps = {
  activeRoomId: string;
  liveStreams: StreamSession[];
  onCreateRoom: (event: FormEvent<HTMLFormElement>) => void;
  onRoomKindDraftChange: (value: RoomKind) => void;
  onRoomNameDraftChange: (value: string) => void;
  onSelectRoom: (roomId: string) => void;
  roomKindDraft: RoomKind;
  roomNameById: Map<string, string>;
  roomNameDraft: string;
  rooms: Room[];
};

const TABS: { id: BrowseTab; label: string }[] = [
  { id: "all", label: "All" },
  { id: "live", label: "Live" },
  { id: "video", label: "Video" },
  { id: "text", label: "Text" },
];

export function RoomSidebar({
  activeRoomId,
  liveStreams,
  onCreateRoom,
  onRoomKindDraftChange,
  onRoomNameDraftChange,
  onSelectRoom,
  roomKindDraft,
  roomNameById,
  roomNameDraft,
  rooms,
}: RoomSidebarProps) {
  const [tab, setTab] = useState<BrowseTab>("all");
  const [createOpen, setCreateOpen] = useState(false);

  const liveRoomIds = new Set(liveStreams.map((s) => s.room_id));

  const visibleRooms = rooms.filter((room) => {
    if (tab === "all") return true;
    if (tab === "live") return room.kind === "stream" && liveRoomIds.has(room.id);
    if (tab === "video") return room.kind === "video";
    if (tab === "text") return room.kind === "text" || room.kind === "voice";
    return true;
  });

  const visibleStreams = tab === "all" || tab === "live" ? liveStreams : [];

  return (
    <aside className="left-panel">
      {/* Browse tabs */}
      <div className="browse-tabs">
        {TABS.map(({ id, label }) => (
          <button
            key={id}
            className={`browse-tab${tab === id ? " active" : ""}`}
            onClick={() => setTab(id)}
            type="button"
          >
            {label}
          </button>
        ))}
      </div>

      {/* Live streams */}
      {visibleStreams.length > 0 && (
        <div>
          <p className="section-title">Live now</p>
          <div className="stream-list">
            {visibleStreams.map((stream) => (
              <button
                key={stream.id}
                className="stream-card"
                onClick={() => onSelectRoom(stream.room_id)}
                type="button"
              >
                <strong>
                  <span className="live-dot" />
                  {stream.title}
                </strong>
                <span>{roomNameById.get(stream.room_id) ?? stream.room_id}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Room list */}
      <div style={{ flex: 1 }}>
        <p className="section-title">
          {tab === "live"
            ? "Stream rooms"
            : tab === "video"
              ? "Video rooms"
              : tab === "text"
                ? "Text rooms"
                : "Rooms"}
        </p>
        {visibleRooms.length > 0 ? (
          <ul className="rooms">
            {visibleRooms.map((room) => (
              <li key={room.id}>
                <button
                  className={`room-item${room.id === activeRoomId ? " active" : ""}`}
                  onClick={() => onSelectRoom(room.id)}
                  type="button"
                >
                  <span>{room.name}</span>
                  <small>
                    {liveRoomIds.has(room.id) ? (
                      <>
                        <span className="live-dot" />
                        {room.kind}
                      </>
                    ) : (
                      room.kind
                    )}
                  </small>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">No rooms here yet.</p>
        )}
      </div>

      {/* Create room */}
      <div>
        {!createOpen ? (
          <button
            className="create-room-toggle"
            onClick={() => setCreateOpen(true)}
            type="button"
          >
            + New room
          </button>
        ) : (
          <form
            className="create-room"
            onSubmit={(e) => {
              onCreateRoom(e);
              setCreateOpen(false);
            }}
          >
            <input
              autoFocus
              onChange={(e) => onRoomNameDraftChange(e.target.value)}
              placeholder="Room name"
              value={roomNameDraft}
            />
            <select
              onChange={(e) =>
                onRoomKindDraftChange(e.target.value as RoomKind)
              }
              value={roomKindDraft}
            >
              {ROOM_KINDS.map((kind) => (
                <option key={kind} value={kind}>
                  {kind}
                </option>
              ))}
            </select>
            <div style={{ display: "flex", gap: "0.38rem" }}>
              <button
                className="btn-ghost btn-sm"
                onClick={() => setCreateOpen(false)}
                type="button"
                style={{ flex: 1 }}
              >
                Cancel
              </button>
              <button className="btn-sm" type="submit" style={{ flex: 1 }}>
                Create
              </button>
            </div>
          </form>
        )}
      </div>
    </aside>
  );
}
