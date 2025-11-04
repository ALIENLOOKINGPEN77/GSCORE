// /app/login/page.tsx

"use client";

import React, { useEffect, useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../../lib/firebase/client";
import { useAuth } from "../../components/auth-context";
import { useRouter, useSearchParams } from "next/navigation";
import type { FirebaseError } from "firebase/app";

// Map Firebase error codes → friendly UI text
function mapFirebaseAuthError(err: unknown): string {
  const fe = err as FirebaseError & { code?: string; message?: string };
  switch (fe?.code) {
    case "auth/invalid-email":
      return "Ingresá un email válido.";
    case "auth/user-disabled":
      return "La cuenta está deshabilitada.";
    case "auth/user-not-found":
    case "auth/wrong-password":
    case "auth/invalid-credential":
    case "auth/invalid-login-credentials":
      return "Email o contraseña inválidos.";
    case "auth/too-many-requests":
      return "Demasiados intentos. Probá más tarde.";
    case "auth/operation-not-allowed":
      return "El inicio con email/contraseña no está habilitado.";
    default:
      return "No pudimos iniciar sesión. Intentá nuevamente.";
  }
}

const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);

export default function LoginPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const from = searchParams.get("from") || "/menu";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    console.log("[Login] auth:", { loading, hasUser: !!user });
    if (!loading && user) {
      console.log("[Login] Already logged in → redirect:", from);
      router.replace(from);
    }
  }, [user, loading, router, from]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!isEmail(email)) {
      setError("Ingresá un email válido.");
      return;
    }
    if (!password) {
      setError("Ingresá tu contraseña.");
      return;
    }

    setBusy(true);
    console.log("[Login] Attempting sign in for:", email);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      console.log("[Login] Success → redirect:", from);
      router.replace(from);
    } catch (err) {
      const msg = mapFirebaseAuthError(err);
      setError(msg); // only UI, no console noise
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="w-full h-[60vh] grid place-items-center">
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <main className="max-w-sm mx-auto p-6">
      <h1 className="text-2xl font-semibold mb-6">Login</h1>

      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <div>
          <label className="block text-sm mb-1" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            className="w-full border px-3 py-2 rounded-md"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="you@factory.com"
            aria-invalid={!!error && !isEmail(email)}
          />
        </div>

        <div>
          <label className="block text-sm mb-1" htmlFor="password">
            Password
          </label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            className="w-full border px-3 py-2 rounded-md"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            placeholder="••••••••"
          />
        </div>

        {error && (
          <p className="text-sm text-red-600" role="alert" aria-live="polite">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={busy}
          className="w-full border px-4 py-2 rounded-md hover:bg-gray-50 disabled:opacity-60"
        >
          {busy ? "Signing in..." : "Sign in"}
        </button>
      </form>

      <p className="text-xs text-gray-500 mt-4">
        No sign-up here — users are created internally via Firebase Console.
      </p>
    </main>
  );
}
