"use client";

import React, { useEffect, useState } from "react";
import { X, Package, MapPin, Calendar, TrendingUp, AlertCircle, List } from "lucide-react";
import { 
  doc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
  orderBy,
  Timestamp
} from "firebase/firestore";
import { db } from "../../../lib/firebase/client";
import INV01List from "./INV01-list";

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

type Material = {
  documentId: string;
  codigo: string;
  descripcion: string;
  proveedor: string;
  marca: string;
  zona: string;
  categoria: string;
  subcategoria: string;
  unidadDeMedida: string;
  stockMinimo: string;
};

type InventoryData = {
  [location: string]: {
    quantity: number;
    lastEntry: string | null;
    lastExit: string | null;
    lastModified: any;
  };
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
  });
}

function getTodayStart(): Date {
  const now = new Date();
  const localStr = now.toLocaleString("en-US", { timeZone: "America/Asuncion" });
  const localDate = new Date(localStr);
  localDate.setHours(0, 0, 0, 0);
  return localDate;
}

function getTodayEnd(): Date {
  const now = new Date();
  const localStr = now.toLocaleString("en-US", { timeZone: "America/Asuncion" });
  const localDate = new Date(localStr);
  localDate.setHours(23, 59, 59, 999);
  return localDate;
}

// ============================================================================
// MAIN MODAL COMPONENT
// ============================================================================

type INV01ModalProps = {
  material: Material;
  onClose: () => void;
};

export default function INV01Modal({ material, onClose }: INV01ModalProps) {
  const [inventoryData, setInventoryData] = useState<InventoryData | null>(null);
  const [todayMovements, setTodayMovements] = useState<Movement[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalQuantity, setTotalQuantity] = useState(0);
  const [movementsListOpen, setMovementsListOpen] = useState(false);

  useEffect(() => {
    loadInventoryData();
    loadTodayMovements();
  }, [material.documentId]);

  const loadInventoryData = async () => {
    try {
      const invRef = doc(db, 'INV01', material.documentId);
      const invSnap = await getDoc(invRef);
      
      if (invSnap.exists()) {
        const data = invSnap.data() as InventoryData;
        setInventoryData(data);
        
        // Calculate total quantity
        let total = 0;
        Object.values(data).forEach(location => {
          if (typeof location.quantity === 'number') {
            total += location.quantity;
          }
        });
        setTotalQuantity(total);
      } else {
        setInventoryData(null);
        setTotalQuantity(0);
      }
    } catch (error) {
      console.error('Error loading inventory data:', error);
      setInventoryData(null);
    }
  };

  const loadTodayMovements = async () => {
    try {
      const todayStart = Timestamp.fromDate(getTodayStart());
      const todayEnd = Timestamp.fromDate(getTodayEnd());
      
      const movesRef = collection(db, 'INV01', material.documentId, 'moves');
      const movesQuery = query(
        movesRef,
        where('effectiveAt', '>=', todayStart),
        where('effectiveAt', '<=', todayEnd),
        where('deleted', '==', false),
        orderBy('effectiveAt', 'desc')
      );
      
      const snapshot = await getDocs(movesQuery);
      const movements: Movement[] = [];
      
      snapshot.forEach((doc) => {
        // Skip the 'default' document if it exists
        if (doc.id === 'default') return;
        
        const data = doc.data();
        movements.push({
          moveId: doc.id,
          qty: data.qty,
          effectiveAt: data.effectiveAt,
          recordedAt: data.recordedAt,
          storageLocation: data.storageLocation,
          source: data.source,
          sourceId: data.sourceId,
          reason: data.reason || null,
          approvedByEmail: data.approvedByEmail || null,
        });
      });
      
      setTodayMovements(movements);
    } catch (error) {
      console.error('Error loading today movements:', error);
      setTodayMovements([]);
    } finally {
      setLoading(false);
    }
  };

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !movementsListOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onClose, movementsListOpen]);

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Modal Header */}
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Package size={28} className="text-blue-600" />
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Detalles de Inventario</h2>
              <p className="text-sm text-gray-600 mt-1 font-mono">{material.codigo}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors p-2 hover:bg-gray-100 rounded-full"
          >
            <X size={24} />
          </button>
        </div>

        {/* Modal Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <div className="space-y-6">
              {/* Material Information */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <Package size={20} className="text-blue-600" />
                  Información del Material
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-medium text-gray-500 uppercase">Descripción</label>
                    <p className="text-sm text-gray-900 mt-1">{material.descripcion}</p>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-500 uppercase">Proveedor</label>
                    <p className="text-sm text-gray-900 mt-1">{material.proveedor}</p>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-500 uppercase">Marca</label>
                    <p className="text-sm text-gray-900 mt-1">{material.marca}</p>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-500 uppercase">Unidad de Medida</label>
                    <p className="text-sm text-gray-900 mt-1">{material.unidadDeMedida}</p>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-500 uppercase">Categoría</label>
                    <p className="text-sm text-gray-900 mt-1">{material.categoria} / {material.subcategoria}</p>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-500 uppercase">Zona</label>
                    <p className="text-sm text-gray-900 mt-1">{material.zona}</p>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-500 uppercase">Stock Mínimo</label>
                    <p className="text-sm text-gray-900 mt-1">{material.stockMinimo}</p>
                  </div>
                </div>
              </div>

              {/* Current Inventory by Location */}
              <div className="bg-blue-50 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <MapPin size={20} className="text-blue-600" />
                  Inventario Actual
                </h3>
                
                {!inventoryData || Object.keys(inventoryData).length === 0 ? (
                  <div className="text-center py-6 text-gray-500">
                    <AlertCircle size={32} className="mx-auto mb-2 text-gray-400" />
                    <p className="text-sm">No hay inventario disponible para este material</p>
                  </div>
                ) : (
                  <>
                 

                    {/* Locations Table */}
                    <div className="bg-white rounded-lg overflow-hidden border border-gray-200">
                      <table className="w-full">
                        <thead className="bg-gray-50 border-b border-gray-200">
                          <tr>
                            <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase">
                              Ubicación
                            </th>
                            <th className="px-4 py-2 text-right text-xs font-semibold text-gray-600 uppercase">
                              Cantidad
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {Object.entries(inventoryData).map(([location, data]) => (
                            <tr key={location} className="hover:bg-gray-50">
                              <td className="px-4 py-3 text-sm font-medium text-gray-900">
                                {location}
                              </td>
                              <td className="px-4 py-3 text-sm text-right font-semibold text-gray-900">
                                {data.quantity}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </div>

              {/* Today's Movements */}
              <div className="bg-green-50 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <TrendingUp size={20} className="text-green-600" />
                  Movimientos de Hoy
                </h3>
                
                {todayMovements.length === 0 ? (
                  <div className="text-center py-6 text-gray-500">
                    <Calendar size={32} className="mx-auto mb-2 text-gray-400" />
                    <p className="text-sm">No hay movimientos registrados hoy</p>
                  </div>
                ) : (
                  <div className="bg-white rounded-lg overflow-hidden border border-gray-200">
                    <table className="w-full">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase">
                            Hora
                          </th>
                          <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase">
                            Tipo
                          </th>
                          <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase">
                            Ubicación
                          </th>
                          <th className="px-4 py-2 text-right text-xs font-semibold text-gray-600 uppercase">
                            Cantidad
                          </th>
                          <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase">
                            Razón
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {todayMovements.map((move) => (
                          <tr key={move.moveId} className="hover:bg-gray-50">
                            <td className="px-4 py-3 text-sm text-gray-700">
                              {formatTimestamp(move.effectiveAt)}
                            </td>
                            <td className="px-4 py-3">
                              <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                move.qty > 0 
                                  ? 'bg-green-100 text-green-800' 
                                  : 'bg-red-100 text-red-800'
                              }`}>
                                {move.source === 'EMAT01' ? 'Entrada' : 'Salida'}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-700">
                              {move.storageLocation}
                            </td>
                            <td className="px-4 py-3 text-sm text-right font-semibold">
                              <span className={move.qty > 0 ? 'text-green-600' : 'text-red-600'}>
                                {move.qty > 0 ? '+' : ''}{move.qty}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-600 max-w-xs truncate">
                              {move.reason || '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-6 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-6 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors font-medium"
          >
            Cerrar
          </button>
          
          <button
            onClick={() => setMovementsListOpen(true)}
            className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-medium flex items-center gap-2"
          >
            <List size={18} />
            Movimientos
          </button>
        </div>
      </div>

      {/* Movements List Modal */}
      {movementsListOpen && (
        <INV01List
          material={{
            documentId: material.documentId,
            codigo: material.codigo,
            descripcion: material.descripcion,
          }}
          onClose={() => setMovementsListOpen(false)}
        />
      )}
    </div>
  );
}