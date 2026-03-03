import { useEffect, useRef } from "react";

export function usePersistentUserId(storageKey = "punch.user_id") {
  const userIdRef = useRef("web-user");

  useEffect(() => {
    const existing = window.localStorage.getItem(storageKey);
    if (existing) {
      userIdRef.current = existing;
      return;
    }

    const generated = `user-${Math.random().toString(36).slice(2, 10)}`;
    window.localStorage.setItem(storageKey, generated);
    userIdRef.current = generated;
  }, [storageKey]);

  return userIdRef;
}
