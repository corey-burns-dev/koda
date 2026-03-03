import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { AuthModal } from "./AuthModal";

describe("AuthModal", () => {
  it("starts in login mode", () => {
    render(<AuthModal onClose={() => {}} />);

    expect(screen.getByRole("heading", { name: "Welcome back" })).toBeVisible();
    expect(screen.queryByPlaceholderText("Username")).not.toBeInTheDocument();
    expect(
      screen.queryByPlaceholderText("Confirm password"),
    ).not.toBeInTheDocument();
  });

  it("switches to register mode", async () => {
    const user = userEvent.setup();
    render(<AuthModal onClose={() => {}} />);
    await user.click(screen.getByRole("tab", { name: "Sign up" }));

    expect(
      screen.getByRole("heading", { name: "Create account" }),
    ).toBeVisible();
    expect(screen.getByLabelText("Username")).toBeVisible();
    expect(screen.getByLabelText("Confirm Password")).toBeVisible();
  });

  it("closes on overlay click and ignores modal-content click", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<AuthModal onClose={onClose} />);

    await user.click(screen.getByRole("heading", { name: "Welcome back" }));
    expect(onClose).not.toHaveBeenCalled();

    const overlay = document.body.querySelector(".modal-overlay");
    expect(overlay).toBeTruthy();
    await user.click(overlay!);

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
