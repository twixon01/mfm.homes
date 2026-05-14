import { useEffect, useState } from "react";

import { apiRequest } from "../lib/http";
import type { User } from "../types/domain";

export function useSession() {
  const [bootstrapping, setBootstrapping] = useState(true);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    apiRequest<{ user: User }>("/api/auth/me")
      .then((data) => {
        setUser(data.user);
      })
      .catch(() => {
        setUser(null);
      })
      .finally(() => setBootstrapping(false));
  }, []);

  function handleAuth(currentUser: User) {
    setUser(currentUser);
  }

  async function handleLogout() {
    await apiRequest<unknown>("/api/auth/logout", { method: "POST" }).catch(() => undefined);
    setUser(null);
  }

  function handleUserUpdated(nextUser: User) {
    setUser(nextUser);
  }

  return {
    bootstrapping,
    user,
    handleAuth,
    handleLogout,
    handleUserUpdated,
  };
}
