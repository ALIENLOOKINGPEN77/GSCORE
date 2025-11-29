"use client";

import React, { useEffect, useState } from "react";
import { X, FileText, MapPin, Calendar, User, Tag, AlertCircle, TrendingUp, TrendingDown } from "lucide-react";
import { 
  doc,
  getDoc,
  Timestamp
} from "firebase/firestore";
import { db } from "../../../lib/firebase/client";

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

type Material = {
  documentId: string;
  codigo: string;
  descripcion: string;
};

type Movement = {
  moveId: string;
  qty: number;
  effectiveAt: Timestamp;
  recordedAt: Timestamp;
  storageLocation: string;
  source: string;
  sourceId: string;
  reason: string | null;
  approvedByEmail: string | null;
  deleted: boolean;
};

type SourceData = {
  entryType?: string;
  entryDate?: string;
  createdByEmail?: string;
  createdAt?: Timestamp;
  [key: string]: any;
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function formatTimestamp(timestamp: Timestamp): string {
  const date = timestamp.toDate();
  return date.toLocaleString('es-PY', {
    timeZone: 'America/Asuncion',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

// ============================================================================
// MAIN MODAL COMPONENT
// ============================================================================

type INV01MovementDetailProps = {
  movement: Movement;
  material: Material;
  onClose: () => void;
};

export default function INV01MovementDetail({ movement, material, onClose }: INV01MovementDetailProps) {
  const [sourceData, setSourceData] = useState<SourceData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSourceData();
  }, [movement.source, movement.sourceId]);

  const loadSourceData = async () => {
    try {
      setLoading(true);
      
      // Try to load the source document (EMAT01, SMAT01, etc.)
      const sourceRef = doc(db, movement.source, movement.sourceId);
      const sourceSnap = await getDoc(sourceRef);
      
      if (sourceSnap.exists()) {
        setSourceData(sourceSnap.data() as SourceData);
      } else {
        setSourceData(null);
      }
    } catch (error) {
      console.error('Error loading source data:', error);
      setSourceData(null);
    } finally {
      setLoading(false);
    }
  };

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  const isEntry = movement.qty > 0;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Modal Header */}
        <div className={`p-6 border-b border-gray-200 ${
          isEntry ? 'bg-gradient-to-r from-green-50 to-white' : 'bg-gradient-to-r from-orange-50 to-white'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-3 rounded-full ${isEntry ? 'bg-green-100' : 'bg-orange-100'}`}>
                {isEntry ? (
                  <TrendingUp size={28} className="text-green-600" />
                ) : (
                  <TrendingDown size={28} className="text-orange-600" />
                )}
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900">
                  Detalle del Movimiento
                </h2>
                <p className="text-sm text-gray-600 mt-1 font-mono">ID: {movement.moveId}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors p-2 hover:bg-gray-100 rounded-full"
            >
              <X size={24} />
            </button>
          </div>
        </div>

        {/* Modal Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-6">
            {/* Movement Type Badge */}
            <div className="flex justify-center">
              <span className={`inline-flex items-center px-6 py-3 rounded-full text-lg font-bold 
              }`}>
                {isEntry ? 'ENTRADA' : 'SALIDA'}
              </span>
            </div>

            {/* Material Information */}
            <div className="bg-blue-50 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <FileText size={20} className="text-blue-600" />
                Material
              </h3>
              <div className="space-y-2">
                <div>
                  <label className="text-xs font-medium text-gray-500 uppercase">Código</label>
                  <p className="text-sm text-gray-900 font-mono font-semibold">{material.codigo}</p>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 uppercase">Descripción</label>
                  <p className="text-sm text-gray-900">{material.descripcion}</p>
                </div>
              </div>
            </div>

            {/* Movement Details */}
            <div className={`rounded-lg p-4 ${isEntry ? 'bg-green-50' : 'bg-orange-50'}`}>
              <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <Tag size={20} className={isEntry ? 'text-green-600' : 'text-orange-600'} />
                Detalles del Movimiento
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-gray-500 uppercase">Cantidad</label>
                  <p className={` ${isEntry ? 'text-gray-900' : 'text-gray-900'}`}>
                    {movement.qty > 0 ? '+' : ''}{movement.qty}
                  </p>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 uppercase">Ubicación</label>
                  <p className="text-xs  text-gray-900 flex items-center gap-2 mt-1">
                    {movement.storageLocation}
                  </p>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 uppercase">Fecha Efectiva</label>
                  <p className="text-sm text-gray-900 flex items-center gap-2 mt-1">
                    <Calendar size={14} className="text-gray-500" />
                    {formatTimestamp(movement.effectiveAt)}
                  </p>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 uppercase">Fecha Registrado</label>
                  <p className="text-sm text-gray-900 flex items-center gap-2 mt-1">
                    <Calendar size={14} className="text-gray-500" />
                    {formatTimestamp(movement.recordedAt)}
                  </p>
                </div>
              
                {movement.reason && (
                  <div className="col-span-2">
                    <label className="text-xs font-medium text-gray-500 uppercase">Razón</label>
                    <p className="text-sm text-gray-900 bg-white px-3 py-2 rounded border mt-1 italic">
                      {movement.reason}
                    </p>
                  </div>
                )}
                {movement.approvedByEmail && (
                  <div className="col-span-2">
                    <label className="text-xs font-medium text-gray-500 uppercase">Aprobado Por</label>
                    <p className="text-sm text-gray-900 flex items-center gap-2 mt-1">
                      <User size={14} className="text-gray-500" />
                      {movement.approvedByEmail}
                    </p>
                  </div>
                )}
              </div>
            </div>


          
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-6 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            className="px-6 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors font-medium"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}