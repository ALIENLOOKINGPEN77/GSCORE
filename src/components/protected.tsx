// /components/protected.tsx
// Simple client guard. Unauthed users are redirected to /login?from=<path>.

"use client";

import React, { useEffect } from "react";
import { useAuth } from "./auth-context";
import { usePathname, useRouter } from "next/navigation";

export default function Protected({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    console.log("[Protected] loading:", loading, "user:", !!user);
    if (loading) return;
    if (!user) {
      const from = pathname ? `?from=${encodeURIComponent(pathname)}` : "";
      console.log("[Protected] No user → redirect to /login");
      router.replace(`/login${from}`);
    }
  }, [user, loading, pathname, router]);

  if (loading) {
    return (
      <div className="w-full h-[60vh] grid place-items-center">
        <p>Loading...</p>
      </div>
    );
  }

  if (user) return <>{children}</>;
  return null;
}
