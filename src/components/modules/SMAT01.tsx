"use client";

import React, { useState } from "react";
import { PackageMinus } from "lucide-react";
import { useAuth } from "../auth-context";
import SMAT01Orden from "../helpers/SMAT01/SMAT01-orden";
import SMAT01Particular from "../helpers/SMAT01/SMAT01-particular";
import SMAT01Ajuste from "../helpers/SMAT01/SMAT01-ajuste";

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

type ExitType = 'orden' | 'particular' | 'ajuste';

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function SMAT01Module() {
  const { user } = useAuth();
  const [selectedType, setSelectedType] = useState<ExitType>('orden');

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <PackageMinus size={32} className="text-red-600" />
            <h1 className="text-3xl font-bold text-gray-900">Salida de Materiales</h1>
          </div>

        </div>

        {/* Type Selection Tabs */}
        <div className="bg-white border rounded-lg shadow-sm mb-6">
          <div className="flex border-b">
            <button
              onClick={() => setSelectedType('orden')}
              className={`flex-1 px-6 py-4 font-medium transition-all ${
                selectedType === 'orden'
                  ? 'text-red-600 border-b-2 border-red-600 bg-red-50'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              Orden de Trabajo
            </button>
            <button
              onClick={() => setSelectedType('particular')}
              className={`flex-1 px-6 py-4 font-medium transition-all ${
                selectedType === 'particular'
                  ? 'text-red-600 border-b-2 border-red-600 bg-red-50'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              Particular
            </button>
            <button
              onClick={() => setSelectedType('ajuste')}
              className={`flex-1 px-6 py-4 font-medium transition-all ${
                selectedType === 'ajuste'
                  ? 'text-red-600 border-b-2 border-red-600 bg-red-50'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              Ajuste
            </button>
          </div>

          {/* Content Area */}
          <div className="p-6">
            {selectedType === 'orden' && <SMAT01Orden />}
            {selectedType === 'particular' && <SMAT01Particular />}
            {selectedType === 'ajuste' && <SMAT01Ajuste />}
          </div>
        </div>
      </div>
    </div>
  );
}