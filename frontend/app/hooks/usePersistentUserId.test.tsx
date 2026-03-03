import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { usePersistentUserId } from "./usePersistentUserId";

describe("usePersistentUserId", () => {
  afterEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it("reuses an existing id from localStorage", async () => {
    window.localStorage.setItem("koda.user_id", "user-existing");

    const { result } = renderHook(() => usePersistentUserId());

    await waitFor(() => {
      expect(result.current.userId).toBe("user-existing");
    });
  });

  it("generates and stores an id when none exists", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0.123456789);

    const { result } = renderHook(() => usePersistentUserId("custom.user_id"));

    await waitFor(() => {
      expect(result.current.userId).toMatch(/^user-[a-z0-9]{8}$/);
    });

    expect(window.localStorage.getItem("custom.user_id")).toBe(result.current.userId);
  });
});
