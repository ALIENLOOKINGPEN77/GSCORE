// /components/auth-context.tsx
// Subscribes to Firebase Auth changes and exposes { user, loading, error } across the app.

"use client";

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth } from "../lib/firebase/client";

type AuthCtx = {
  user: User | null;
  loading: boolean;
  error: Error | null;
};

const AuthContext = createContext<AuthCtx>({
  user: null,
  loading: true,
  error: null,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    console.log("[AuthProvider] Subscribing to onAuthStateChanged...");
    const unsub = onAuthStateChanged(
      auth,
      (u) => {
        console.log("[AuthProvider] Auth state:", u ? `user:${u.uid}` : "no user");
        setUser(u);
        setLoading(false);
      },
      (err) => {
        console.log("[AuthProvider] Error handled:", err);
        setError(err);
        setLoading(false);
      }
    );
    return () => {
      console.log("[AuthProvider] Unsubscribing from onAuthStateChanged");
      unsub();
    };
  }, []);

  const value = useMemo(() => ({ user, loading, error }), [user, loading, error]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
