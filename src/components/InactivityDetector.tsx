"use client";

import React, { useEffect, useState, useRef } from "react";

const INACTIVITY_TIMEOUT = 420000; // 7 minute in milliseconds

export function InactivityDetector() {
  const [showToast, setShowToast] = useState(false);
  const showToastRef = useRef(showToast);

  // Keep the ref in sync with the state
  useEffect(() => {
    showToastRef.current = showToast;
  }, [showToast]);

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    const handleActivity = () => {
      // Check the ref's value to see if the toast is currently visible
      if (showToastRef.current) {
        // If the toast is showing, reload the page on any activity
        window.location.reload();
        return;
      }

      // If toast is not showing, just reset the timer
      clearTimeout(timeoutId);

      timeoutId = setTimeout(() => {
        // Set state to true to show the toast after INACTIVITY_TIMEOUT
        setShowToast(true);
      }, INACTIVITY_TIMEOUT);
    };

    // 🛑 REMOVED "mousemove" and "visibilitychange"
    // Events that reset the timer and trigger refresh after toast appears
    const events = ["keydown", "scroll", "click", "touchstart"];

    // Add event listeners
    events.forEach((event) => {
      window.addEventListener(event, handleActivity);
    });

    // Initialize the timer on mount
    handleActivity();

    // Cleanup
    return () => {
      clearTimeout(timeoutId);
      events.forEach((event) => {
        window.removeEventListener(event, handleActivity);
      });
    };
  }, []); 

  if (!showToast) return null;

  // Render both the full-screen overlay and the toast notification
  return (
    <>
      {/* 1. Full-Screen Overlay (Disables Interaction) */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9998]" 
        aria-hidden="true"
      />

      {/* 2. Toast Notification (Right-aligned) */}
      <div
        className="fixed top-4 right-4 bg-orange-400 text-white px-6 py-4 rounded-lg shadow-2xl z-[9999] max-w-sm animate-slide-in"
        role="alert"
      >
        <div className="flex items-center gap-3">
          <div className="flex-shrink-0">
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold">
              Inactividad detectada, Refresque la página
            </p>
          </div>
        </div>
      </div>
    </>
  );
}