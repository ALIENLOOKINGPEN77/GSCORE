// /app/components/offline-indicator.tsx
// Component to show offline status

"use client";

import React from 'react';
import { WifiOff, Wifi } from 'lucide-react';


export default function OfflineIndicator() {
  
  return (
    <div className="fixed top-0 left-0 right-0 bg-red-600 text-white p-2 text-center z-50">
      <div className="flex items-center justify-center gap-2">
        <WifiOff size={16} />
        <span className="text-sm font-medium">
          Sin conexión a internet. Algunas funciones pueden no estar disponibles.
        </span>
      </div>
    </div>
  );
}