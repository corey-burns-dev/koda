import type { ComponentProps, FormEvent } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { RoomSidebar } from "./RoomSidebar";
import type { Room, RoomKind, StreamSession } from "../types";

const rooms: Room[] = [
  { id: "room-text", name: "General", kind: "text" },
  { id: "room-video", name: "Cinema", kind: "video" },
  { id: "room-stream", name: "Stage", kind: "stream" },
];

const liveStreams: StreamSession[] = [
  {
    id: "stream-1",
    room_id: "room-stream",
    host_user_id: "host-1",
    title: "Live Launch",
    live: true,
  },
];

function renderSidebar(overrides?: Partial<ComponentProps<typeof RoomSidebar>>) {
  return render(
    <RoomSidebar
      activeRoomId="room-text"
      liveStreams={liveStreams}
      onCreateRoom={(event: FormEvent<HTMLFormElement>) =>
        event.preventDefault()
      }
      onRoomKindDraftChange={() => {}}
      onRoomNameDraftChange={() => {}}
      onSelectRoom={() => {}}
      roomKindDraft="stream"
      roomNameById={new Map([
        ["room-text", "General"],
        ["room-video", "Cinema"],
        ["room-stream", "Stage"],
      ])}
      roomNameDraft=""
      rooms={rooms}
      {...overrides}
    />,
  );
}

describe("RoomSidebar", () => {
  it("filters visible rooms by selected browse tab", () => {
    renderSidebar();

    expect(screen.getByText("General")).toBeVisible();
    expect(screen.getByText("Cinema")).toBeVisible();
    expect(screen.getAllByText("Stage").length).toBeGreaterThan(0);
    expect(screen.getByText("Live Launch")).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Video" }));

    expect(screen.getByText("Video rooms")).toBeVisible();
    expect(screen.getByText("Cinema")).toBeVisible();
    expect(screen.queryByText("General")).not.toBeInTheDocument();
    expect(screen.queryByText("Stage")).not.toBeInTheDocument();
    expect(screen.queryByText("Live Launch")).not.toBeInTheDocument();
  });

  it("emits create-room callbacks from the form", () => {
    const onCreateRoom = vi.fn((event: FormEvent<HTMLFormElement>) =>
      event.preventDefault(),
    );
    const onRoomNameDraftChange = vi.fn();
    const onRoomKindDraftChange = vi.fn((value: RoomKind) => value);

    renderSidebar({
      onCreateRoom,
      onRoomNameDraftChange,
      onRoomKindDraftChange,
      roomNameDraft: "New Room",
    });

    fireEvent.click(screen.getByRole("button", { name: "+ New room" }));
    fireEvent.change(screen.getByPlaceholderText("Room name"), {
      target: { value: "Streaming Lab" },
    });
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "video" } });
    fireEvent.submit(screen.getByRole("button", { name: "Create" }).closest("form")!);

    expect(onRoomNameDraftChange).toHaveBeenCalledWith("Streaming Lab");
    expect(onRoomKindDraftChange).toHaveBeenCalledWith("video");
    expect(onCreateRoom).toHaveBeenCalledTimes(1);
  });
});
