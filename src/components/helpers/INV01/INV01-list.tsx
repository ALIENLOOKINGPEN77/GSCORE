"use client";

import React, { useEffect, useState } from "react";
import { X } from "lucide-react";
import { 
  collection,
  query,
  where,
  getDocs,
  orderBy,
  Timestamp
} from "firebase/firestore";
import { db } from "../../../lib/firebase/client";
import INV01MovementDetail from "./INV01-detail";

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

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function formatDate(timestamp: Timestamp): string {
  const date = timestamp.toDate();
  return date.toLocaleDateString('es-PY', {
    timeZone: 'America/Asuncion',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

// ============================================================================
// MAIN MODAL COMPONENT
// ============================================================================

type INV01ListProps = {
  material: Material;
  onClose: () => void;
};

export default function INV01List({ material, onClose }: INV01ListProps) {
  const [movements, setMovements] = useState<Movement[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMovement, setSelectedMovement] = useState<Movement | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);

  useEffect(() => {
    loadAllMovements();
  }, [material.documentId]);

  const loadAllMovements = async () => {
    try {
      setLoading(true);
      const movesRef = collection(db, 'INV01', material.documentId, 'moves');
      const movesQuery = query(
        movesRef,
        where('deleted', '==', false),
        orderBy('effectiveAt', 'desc')
      );
      
      const snapshot = await getDocs(movesQuery);
      const loadedMovements: Movement[] = [];
      
      snapshot.forEach((doc) => {
        // Skip the 'default' document if it exists
        if (doc.id === 'default') return;
        
        const data = doc.data();
        loadedMovements.push({
          moveId: doc.id,
          qty: data.qty,
          effectiveAt: data.effectiveAt,
          recordedAt: data.recordedAt,
          storageLocation: data.storageLocation,
          source: data.source,
          sourceId: data.sourceId,
          reason: data.reason || null,
          approvedByEmail: data.approvedByEmail || null,
          deleted: data.deleted,
        });
      });
      
      setMovements(loadedMovements);
    } catch (error) {
      console.error('Error loading movements:', error);
      setMovements([]);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDetail = (movement: Movement) => {
    setSelectedMovement(movement);
    setDetailModalOpen(true);
  };

  const handleCloseDetail = () => {
    setDetailModalOpen(false);
    setSelectedMovement(null);
  };

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !detailModalOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onClose, detailModalOpen]);

  return (
    <>
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
          {/* Modal Header */}
          <div className="p-6 border-b border-gray-200 flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Movimientos</h2>
              <p className="text-sm text-gray-600 mt-1 font-mono">{material.codigo}</p>
              <p className="text-sm text-gray-700">{material.descripcion}</p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors p-2 hover:bg-gray-100 rounded-full"
            >
              <X size={24} />
            </button>
          </div>

          {/* Search Bar Removed */}

          {/* Modal Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : movements.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <p className="text-lg font-medium">
                  {'No hay movimientos registrados'}
                </p>
                <p className="text-sm mt-1">
                  {'Este material no tiene movimientos en el sistema'}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        ID Movimiento
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Fecha
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Cantidad
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Ubicación
                      </th>
                      {/* "Razón" th removed */}
                      <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Acción
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {movements.map((movement) => (
                      <tr
                        key={movement.moveId}
                        className={`transition-colors ${
                          movement.qty > 0
                            ? 'bg-green-50 hover:bg-green-100'
                            : 'bg-orange-50 hover:bg-orange-100'
                        }`}
                      >
                        <td className="px-4 py-3 text-sm font-mono text-gray-900">
                          {movement.moveId}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">
                          {formatDate(movement.effectiveAt)}
                        </td>
                        <td className="px-4 py-3 text-sm font-semibold">
                          <span className={movement.qty > 0 ? 'text-green-700' : 'text-orange-700'}>
                            {movement.qty > 0 ? '+' : ''}{movement.qty}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">
                          {movement.storageLocation}
                        </td>
                        {/* "Razón" td removed */}
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() => handleOpenDetail(movement)}
                            className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-md font-medium transition-colors"
                          >
                            Datos
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
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

      {/* Movement Detail Modal */}
      {detailModalOpen && selectedMovement && (
        <INV01MovementDetail
          movement={selectedMovement}
          material={material}
          onClose={handleCloseDetail}
        />
      )}
    </>
  );
}