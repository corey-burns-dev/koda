import type { FormEvent } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ChatPanel } from "./ChatPanel";

describe("ChatPanel", () => {
  it("renders messages and submits composer events", () => {
    const onDraftChange = vi.fn();
    const onSubmit = vi.fn((event: FormEvent<HTMLFormElement>) =>
      event.preventDefault(),
    );

    render(
      <ChatPanel
        draft=""
        messages={[
          {
            id: "msg-1",
            room_id: "room-1",
            user_id: "alice",
            body: "hello world",
            sent_at_unix_ms: 0,
          },
        ]}
        onDraftChange={onDraftChange}
        onSubmit={onSubmit}
      />,
    );

    expect(screen.getByText("hello world")).toBeVisible();
    fireEvent.change(screen.getByLabelText("Message"), {
      target: { value: "updated" },
    });
    expect(onDraftChange).toHaveBeenCalledWith("updated");

    fireEvent.submit(screen.getByRole("button", { name: "Send" }).closest("form")!);
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });
});
