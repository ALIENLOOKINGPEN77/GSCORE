// CORD01.tsx
"use client";

import React, { useState } from "react";
import { FileText } from "lucide-react";
import CORD01General from "../helpers/CORD01/CORD01-general";
import CORD01Taller from "../helpers/CORD01/CORD01-taller";

type OrderType = 'General' | 'Taller';

export default function CORD01() {
  const [orderType, setOrderType] = useState<OrderType>('General');

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <FileText size={32} className="text-blue-600" />
            <h1 className="text-3xl font-bold text-gray-900">Crear Orden de Trabajo</h1>
          </div>
        </div>

        {/* Order Type Selection */}
        <div className="bg-white border rounded-lg shadow-sm p-6 mb-6">
          <label className="text-sm font-medium text-gray-700 mb-3 block">
            Tipo de Orden <span className="text-red-500">*</span>
          </label>
          <div className="flex gap-4">
            <button
              onClick={() => setOrderType('General')}
              className={`flex-1 px-6 py-3 rounded-md font-medium transition-all ${
                orderType === 'General'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              General
            </button>
            <button
              onClick={() => setOrderType('Taller')}
              className={`flex-1 px-6 py-3 rounded-md font-medium transition-all ${
                orderType === 'Taller'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Taller
            </button>
          </div>
        </div>

        {/* Form Content */}
        {orderType === 'General' ? <CORD01General /> : <CORD01Taller />}
      </div>
    </div>
  );
}