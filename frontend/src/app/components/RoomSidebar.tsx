import { FormEvent } from "react";

import { ROOM_KINDS, Room, RoomKind, StreamSession } from "../types";

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
  return (
    <aside className="panel sidebar">
      <div>
        <h2>Live Now</h2>
        <div className="stream-list">
          {liveStreams.map((stream) => (
            <button
              key={stream.id}
              className="stream-card"
              onClick={() => onSelectRoom(stream.room_id)}
              type="button"
            >
              <strong>{stream.title}</strong>
              <span>Host: {stream.host_user_id}</span>
              <small>
                Room: {roomNameById.get(stream.room_id) ?? stream.room_id}
              </small>
            </button>
          ))}
          {liveStreams.length === 0 ? (
            <p className="muted">No live streams yet.</p>
          ) : null}
        </div>
      </div>

      <div>
        <h2>Rooms</h2>
        <ul className="rooms">
          {rooms.map((room) => (
            <li key={room.id}>
              <button
                className={room.id === activeRoomId ? "room active" : "room"}
                onClick={() => onSelectRoom(room.id)}
                type="button"
              >
                <span>{room.name}</span>
                <small>{room.kind}</small>
              </button>
            </li>
          ))}
        </ul>
      </div>

      <form className="create-room" onSubmit={onCreateRoom}>
        <h3>Create Room</h3>
        <input
          onChange={(event) => onRoomNameDraftChange(event.target.value)}
          placeholder="Room name"
          value={roomNameDraft}
        />
        <select
          onChange={(event) =>
            onRoomKindDraftChange(event.target.value as RoomKind)
          }
          value={roomKindDraft}
        >
          {ROOM_KINDS.map((kind) => (
            <option key={kind} value={kind}>
              {kind}
            </option>
          ))}
        </select>
        <button type="submit">Create</button>
      </form>
    </aside>
  );
}
