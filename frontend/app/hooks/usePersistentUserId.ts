import { useEffect, useState } from "react";

export function usePersistentUserId(storageKey = "punch.user_id") {
  const [userId, setUserId] = useState<string>("web-user");

  useEffect(() => {
    const existing = window.localStorage.getItem(storageKey);
    if (existing) {
      setUserId(existing);
      return;
    }

    const generated = `user-${Math.random().toString(36).slice(2, 10)}`;
    window.localStorage.setItem(storageKey, generated);
    setUserId(generated);
  }, [storageKey]);

  const updateUserId = (newId: string) => {
    window.localStorage.setItem(storageKey, newId);
    setUserId(newId);
  };

  return { userId, setUserId: updateUserId };
}
