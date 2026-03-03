import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { TopNav } from "./TopNav";

describe("TopNav", () => {
  it("calls onOpenAuth from either auth action when signed out", () => {
    const onOpenAuth = vi.fn();
    render(
      <TopNav
        user={null}
        onLogout={() => {}}
        onOpenAuth={onOpenAuth}
        onOpenProfile={() => {}}
        onOpenSettings={() => {}}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Log in" }));
    fireEvent.click(screen.getByRole("button", { name: "Sign up" }));

    expect(onOpenAuth).toHaveBeenCalledTimes(2);
  });

  it("shows profile menu actions when signed in", async () => {
    const user = userEvent.setup();
    const onOpenProfile = vi.fn();
    const onOpenSettings = vi.fn();
    const onLogout = vi.fn();

    render(
      <TopNav
        user={{ id: "user-1", username: "alice", email: "alice@example.com" }}
        onLogout={onLogout}
        onOpenAuth={() => {}}
        onOpenProfile={onOpenProfile}
        onOpenSettings={onOpenSettings}
      />,
    );

    await user.click(screen.getByRole("button", { name: /alice/i }));
    await user.click(await screen.findByRole("menuitem", { name: "Profile" }));
    await user.click(screen.getByRole("button", { name: /alice/i }));
    await user.click(await screen.findByRole("menuitem", { name: "Settings" }));
    await user.click(screen.getByRole("button", { name: /alice/i }));
    await user.click(await screen.findByRole("menuitem", { name: "Log out" }));

    expect(onOpenProfile).toHaveBeenCalledTimes(1);
    expect(onOpenSettings).toHaveBeenCalledTimes(1);
    expect(onLogout).toHaveBeenCalledTimes(1);
  });
});
