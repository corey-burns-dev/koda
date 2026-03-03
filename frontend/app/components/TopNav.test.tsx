import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { TopNav } from "./TopNav";

describe("TopNav", () => {
  it("calls onOpenAuth from either auth action", () => {
    const onOpenAuth = vi.fn();
    render(<TopNav onOpenAuth={onOpenAuth} />);

    fireEvent.click(screen.getByRole("button", { name: "Log in" }));
    fireEvent.click(screen.getByRole("button", { name: "Sign up" }));

    expect(onOpenAuth).toHaveBeenCalledTimes(2);
  });
});
