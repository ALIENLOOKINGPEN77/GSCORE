// app/components/modules/Test01.tsx

"use client";

import React from "react";

export default function Test01Module() {
  console.log("[TEST01] Module mounted");

  const handleAction = () => {
    console.log("[TEST01] Example action clicked");
    alert("TEST01 action executed (replace with real logic).");
  };

  return (
    <section className="h-full w-full p-6">
      <header className="mb-4">
        <h1 className="text-2xl font-semibold">TEST01 — Demo Module</h1>
        <p className="text-gray-600">
          This module is rendered inline (no iframe). Replace with your real ERP UI.
        </p>
      </header>

      <div className="border rounded-md p-4 bg-white shadow-sm">
        <p className="mb-3">Boilerplate content for TEST01.</p>
        <button
          onClick={handleAction}
          className="border px-4 py-2 rounded-md hover:bg-gray-50"
        >
          Run Sample Action
        </button>
      </div>
    </section>
  );
}
