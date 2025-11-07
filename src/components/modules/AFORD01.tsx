"use client";

import React, { useCallback, useEffect, useState } from "react";
import { CheckCircle, AlertCircle, FileCheck, Trash2, Check, X } from "lucide-react";
import { useAuth } from "../auth-context";
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  doc,
  updateDoc,
  deleteDoc,
  orderBy
} from "firebase/firestore";
import { db } from "../../lib/firebase/client";
import OrderModal from "../helpers/AFORD01/AFORD01-modal";

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

type WorkOrder = {
  orderId: string;
  orderType: 'General' | 'Taller';
  executionDate: string;
  equipment?: string;
  mobileUnit?: string;
  state: boolean;
  stateSig: boolean;
  stateAudit: boolean;
  createdAt: any;
  [key: string]: any;
};

type ToastMessage = {
  type: 'success' | 'error';
  message: string;
};

// ============================================================================
// TOAST COMPONENT
// ============================================================================

const Toast = ({ message, type, onClose }: { message: string; type: 'success' | 'error'; onClose: () => void }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 4000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div
      role="alert"
      aria-live="polite"
      className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 w-[min(95vw,420px)] shadow-lg border bg-white px-4 py-3 rounded-md text-sm flex items-center gap-2"
    >
      {type === 'success' ? (
        <CheckCircle className="text-green-500 shrink-0" size={18} />
      ) : (
        <AlertCircle className="text-red-500 shrink-0" size={18} />
      )}
      <span className="text-gray-800">{message}</span>
      <button
        onClick={onClose}
        className="ml-auto text-gray-500 hover:text-gray-700"
        aria-label="Dismiss message"
      >
        <X size={16} />
      </button>
    </div>
  );
};

// ============================================================================
// CONFIRMATION MODAL
// ============================================================================

const ConfirmationModal = ({
  action,
  count,
  onConfirm,
  onCancel
}: {
  action: 'accept' | 'delete';
  count: number;
  onConfirm: () => void;
  onCancel: () => void;
}) => {
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
        <div className="flex items-start gap-3 mb-4">
          {action === 'accept' ? (
            <CheckCircle className="text-green-600 flex-shrink-0 mt-1" size={24} />
          ) : (
            <Trash2 className="text-red-600 flex-shrink-0 mt-1" size={24} />
          )}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-1">
              {action === 'accept' ? 'Aceptar Órdenes' : 'Eliminar Órdenes'}
            </h3>
            <p className="text-sm text-gray-600">
              {action === 'accept'
                ? `¿Está seguro que desea aceptar ${count} orden(es)? Las órdenes aceptadas se marcarán como auditadas.`
                : `¿Está seguro que desea eliminar ${count} orden(es)? Esta acción no se puede deshacer.`}
            </p>
          </div>
        </div>
        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            className={`px-4 py-2 text-white rounded-md transition-colors ${
              action === 'accept'
                ? 'bg-green-600 hover:bg-green-700'
                : 'bg-red-600 hover:bg-red-700'
            }`}
          >
            {action === 'accept' ? 'Aceptar' : 'Eliminar'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function AFORD01() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<WorkOrder[]>([]);
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set());
  const [selectedOrder, setSelectedOrder] = useState<WorkOrder | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState<'accept' | 'delete' | null>(null);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  // ============================================================================
  // LOAD WORK ORDERS
  // ============================================================================

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const ordersRef = collection(db, "CORD01");
    
    // Query for orders where state=true and stateAudit=false (completed but pending audit)
    const ordersQuery = query(
      ordersRef,
      where("state", "==", true),
      where("stateAudit", "==", false),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(ordersQuery, (snapshot) => {
      const loadedOrders: WorkOrder[] = [];
      snapshot.forEach((doc) => {
        loadedOrders.push({ orderId: doc.id, ...doc.data() } as WorkOrder);
      });
      setOrders(loadedOrders);
      setLoading(false);
    }, (error) => {
      console.error("Error loading orders:", error);
      setToast({ type: 'error', message: 'Error al cargar órdenes' });
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  // ============================================================================
  // HANDLERS
  // ============================================================================

  const handleSelectOrder = useCallback((orderId: string) => {
    setSelectedOrders(prev => {
      const newSet = new Set(prev);
      if (newSet.has(orderId)) {
        newSet.delete(orderId);
      } else {
        newSet.add(orderId);
      }
      return newSet;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    if (selectedOrders.size === orders.length) {
      setSelectedOrders(new Set());
    } else {
      setSelectedOrders(new Set(orders.map(o => o.orderId)));
    }
  }, [orders, selectedOrders.size]);

  const handleViewOrder = useCallback((order: WorkOrder) => {
    setSelectedOrder(order);
    setShowModal(true);
  }, []);

  const handleCloseModal = useCallback(() => {
    setShowModal(false);
    setSelectedOrder(null);
  }, []);

  const handleAccept = useCallback(async () => {
    setProcessing(true);
    try {
      const promises = Array.from(selectedOrders).map(orderId =>
        updateDoc(doc(db, "CORD01", orderId), { stateAudit: true })
      );
      await Promise.all(promises);
      setToast({ type: 'success', message: `${selectedOrders.size} orden(es) aceptada(s)` });
      setSelectedOrders(new Set());
    } catch (error) {
      console.error("Error accepting orders:", error);
      setToast({ type: 'error', message: 'Error al aceptar órdenes' });
    } finally {
      setProcessing(false);
      setShowConfirmation(null);
    }
  }, [selectedOrders]);

  const handleDelete = useCallback(async () => {
    setProcessing(true);
    try {
      const promises = Array.from(selectedOrders).map(orderId =>
        deleteDoc(doc(db, "CORD01", orderId))
      );
      await Promise.all(promises);
      setToast({ type: 'success', message: `${selectedOrders.size} orden(es) eliminada(s)` });
      setSelectedOrders(new Set());
    } catch (error) {
      console.error("Error deleting orders:", error);
      setToast({ type: 'error', message: 'Error al eliminar órdenes' });
    } finally {
      setProcessing(false);
      setShowConfirmation(null);
    }
  }, [selectedOrders]);

  // ============================================================================
  // RENDER
  // ============================================================================

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <AlertCircle className="mx-auto text-red-500 mb-4" size={48} />
          <p className="text-gray-700 font-medium">
            Debe iniciar sesión para acceder a este módulo
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando órdenes...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-6">
        <div className="flex items-center gap-3 mb-2">
          <FileCheck className="text-blue-600" size={32} />
          <h1 className="text-3xl font-bold text-gray-900">AFORD01</h1>
        </div>
        <p className="text-gray-600">Administración de Órdenes de Trabajo</p>
      </div>

      {/* Action Buttons */}
      {selectedOrders.size > 0 && (
        <div className="max-w-7xl mx-auto mb-4 flex gap-3">
          <button
            onClick={() => setShowConfirmation('accept')}
            disabled={processing}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors disabled:opacity-50"
          >
            <Check size={18} />
            Aceptar ({selectedOrders.size})
          </button>
          <button
            onClick={() => setShowConfirmation('delete')}
            disabled={processing}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors disabled:opacity-50"
          >
            <Trash2 size={18} />
            Eliminar ({selectedOrders.size})
          </button>
        </div>
      )}

      {/* Orders Table */}
      <div className="max-w-7xl mx-auto mb-6">
        <div className="bg-white rounded-lg shadow-md overflow-hidden" style={{ maxHeight: '500px' }}>
          <div className="overflow-auto" style={{ maxHeight: '500px' }}>
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
                <tr>
                  <th className="px-4 py-3 text-center">
                    <input
                      type="checkbox"
                      checked={selectedOrders.size === orders.length && orders.length > 0}
                      onChange={handleSelectAll}
                      className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                    />
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Acciones
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Fecha Ejecución
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Equipo/Unidad
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {orders.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                      No hay órdenes pendientes de confirmar
                    </td>
                  </tr>
                ) : (
                  orders.map((order) => (
                    <tr key={order.orderId} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-center">
                        <input
                          type="checkbox"
                          checked={selectedOrders.has(order.orderId)}
                          onChange={() => handleSelectOrder(order.orderId)}
                          className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => handleViewOrder(order)}
                          className="px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors"
                        >
                          Ver Detalles
                        </button>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">{order.executionDate}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {order.orderType === 'General' ? order.equipment : order.mobileUnit}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* History Button */}
      <div className="max-w-7xl mx-auto">
        <button
          disabled
          className="w-full py-4 bg-gray-300 text-gray-600 rounded-lg font-semibold text-lg cursor-not-allowed"
        >
          Historial de Órdenes (en desarrollo)
        </button>
      </div>

      {/* Modals */}
      {showModal && selectedOrder && (
        <OrderModal
          order={selectedOrder}
          onClose={handleCloseModal}
        />
      )}

      {showConfirmation && (
        <ConfirmationModal
          action={showConfirmation}
          count={selectedOrders.size}
          onConfirm={showConfirmation === 'accept' ? handleAccept : handleDelete}
          onCancel={() => setShowConfirmation(null)}
        />
      )}

      {/* Toast */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}