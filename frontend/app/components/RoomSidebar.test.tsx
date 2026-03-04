import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps, FormEvent } from "react";
import { describe, expect, it, vi } from "vitest";

import type { Room, RoomKind, StreamSession } from "../types";
import { RoomSidebar } from "./RoomSidebar";

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
      onCreateRoom={(event: FormEvent<HTMLFormElement>) => event.preventDefault()}
      onRoomKindDraftChange={() => {}}
      onRoomNameDraftChange={() => {}}
      onSelectRoom={() => {}}
      roomKindDraft="stream"
      roomNameById={
        new Map([
          ["room-text", "General"],
          ["room-video", "Cinema"],
          ["room-stream", "Stage"],
        ])
      }
      roomNameDraft=""
      rooms={rooms}
      tab="all"
      {...overrides}
    />,
  );
}

function rerenderSidebar(
  rerender: (ui: React.ReactElement) => void,
  overrides?: Partial<ComponentProps<typeof RoomSidebar>>,
) {
  rerender(
    <RoomSidebar
      activeRoomId="room-text"
      liveStreams={liveStreams}
      onCreateRoom={(event: FormEvent<HTMLFormElement>) => event.preventDefault()}
      onRoomKindDraftChange={() => {}}
      onRoomNameDraftChange={() => {}}
      onSelectRoom={() => {}}
      roomKindDraft="stream"
      roomNameById={
        new Map([
          ["room-text", "General"],
          ["room-video", "Cinema"],
          ["room-stream", "Stage"],
        ])
      }
      roomNameDraft=""
      rooms={rooms}
      tab="all"
      {...overrides}
    />,
  );
}

describe("RoomSidebar", () => {
  it("filters visible rooms by selected browse tab", async () => {
    const { rerender } = renderSidebar({ tab: "all" });

    expect(screen.getByText("General")).toBeVisible();
    expect(screen.getByText("Cinema")).toBeVisible();
    expect(screen.getAllByText("Stage").length).toBeGreaterThan(0);
    expect(screen.getByText("Live Launch")).toBeVisible();

    rerenderSidebar(rerender, { tab: "video" });

    expect(screen.getByText("Video rooms")).toBeVisible();
    expect(screen.getByText("Cinema")).toBeVisible();
    expect(screen.queryByText("General")).not.toBeInTheDocument();
    expect(screen.queryByText("Stage")).not.toBeInTheDocument();
    expect(screen.queryByText("Live Launch")).not.toBeInTheDocument();
  });

  it("emits create-room callbacks from the form", async () => {
    const user = userEvent.setup();
    const onCreateRoom = vi.fn((event: FormEvent<HTMLFormElement>) => event.preventDefault());
    const onRoomNameDraftChange = vi.fn();
    const onRoomKindDraftChange = vi.fn((value: RoomKind) => value);

    renderSidebar({
      onCreateRoom,
      onRoomNameDraftChange,
      onRoomKindDraftChange,
      roomNameDraft: "",
    });

    await user.click(screen.getByRole("button", { name: "New room" }));

    const input = screen.getByPlaceholderText("Room name");
    fireEvent.change(input, { target: { value: "Streaming Lab" } });

    // Interact with Select
    await user.click(screen.getByRole("combobox"));
    // Shadcn/Radix Select items are in a portal, so we use screen to find them
    const option = await screen.findByRole("option", { name: "Video" });
    await user.click(option);

    await user.click(screen.getByRole("button", { name: "Create" }));

    expect(onRoomNameDraftChange).toHaveBeenCalledWith("Streaming Lab");
    expect(onRoomKindDraftChange).toHaveBeenCalledWith("video");
    expect(onCreateRoom).toHaveBeenCalledTimes(1);
  });
});
