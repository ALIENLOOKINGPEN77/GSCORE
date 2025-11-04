// /app/components/ClientSuspenseWrapper.tsx
"use client";

import React, { Suspense, ReactNode } from 'react';

interface ClientSuspenseWrapperProps {
  children: ReactNode;
}

function GlobalLoading() {
  return (
    <div className="w-full h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-2 text-gray-600">Loading...</p>
      </div>
    </div>
  );
}

export function ClientSuspenseWrapper({ children }: ClientSuspenseWrapperProps) {
  return (
    <Suspense fallback={<GlobalLoading />}>
      {children}
    </Suspense>
  );
}