import { fireEvent, render, screen } from "@testing-library/react";
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

  it("switches to register mode", () => {
    render(<AuthModal onClose={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Sign up" }));

    expect(
      screen.getByRole("heading", { name: "Create account" }),
    ).toBeVisible();
    expect(screen.getByPlaceholderText("Username")).toBeVisible();
    expect(screen.getByPlaceholderText("Confirm password")).toBeVisible();
  });

  it("closes on overlay click and ignores modal-content click", () => {
    const onClose = vi.fn();
    const { container } = render(<AuthModal onClose={onClose} />);

    fireEvent.click(screen.getByRole("heading", { name: "Welcome back" }));
    expect(onClose).not.toHaveBeenCalled();

    const overlay = container.querySelector(".modal-overlay");
    expect(overlay).toBeTruthy();
    fireEvent.click(overlay!);

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
