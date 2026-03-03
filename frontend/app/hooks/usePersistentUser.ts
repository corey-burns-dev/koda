import { useEffect, useState } from "react";

import type { AuthUser } from "../types";

const USER_STORAGE_KEY = "koda.user";
const USER_ID_STORAGE_KEY = "koda.user_id";

function parseStoredUser(raw: string | null): AuthUser | null {
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<AuthUser>;
    if (
      typeof parsed.id === "string" &&
      typeof parsed.username === "string" &&
      typeof parsed.email === "string" &&
      typeof parsed.token === "string"
    ) {
      return {
        id: parsed.id,
        username: parsed.username,
        email: parsed.email,
        token: parsed.token,
      };
    }
  } catch {
    // Ignore malformed payloads.
  }

  return null;
}

export function usePersistentUser(storageKey = USER_STORAGE_KEY) {
  const [user, setUserState] = useState<AuthUser | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const stored = parseStoredUser(window.localStorage.getItem(storageKey));

    if (stored) {
      window.localStorage.setItem(USER_ID_STORAGE_KEY, stored.id);
      setUserState(stored);
    } else {
      window.localStorage.removeItem(USER_ID_STORAGE_KEY);
      setUserState(null);
    }

    setHydrated(true);
  }, [storageKey]);

  const setUser = (next: AuthUser) => {
    window.localStorage.setItem(storageKey, JSON.stringify(next));
    window.localStorage.setItem(USER_ID_STORAGE_KEY, next.id);
    setUserState(next);
  };

  const clearUser = () => {
    window.localStorage.removeItem(storageKey);
    window.localStorage.removeItem(USER_ID_STORAGE_KEY);
    setUserState(null);
  };

  return { user, hydrated, setUser, clearUser };
}
