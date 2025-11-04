// /app/page.tsx
// Nice-to-have: redirect root users to /menu if logged in, else to /login.

"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../components/auth-context";

export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    console.log("[Home] loading:", loading, "user:", !!user);
    if (loading) return;
    router.replace(user ? "/menu" : "/login");
  }, [user, loading, router]);

  return (
    <div className="w-full h-[60vh] grid place-items-center">
      <p>Loading...</p>
    </div>
  );
}
