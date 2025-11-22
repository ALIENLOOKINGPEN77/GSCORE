"use client";

import React, { useCallback, useEffect, useState } from "react";
import { ClipboardCheck, Wrench } from "lucide-react";
import { useAuth } from "../auth-context";
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  orderBy
} from "firebase/firestore";
import { db } from "../../lib/firebase/client";
import GeneralModal from "../helpers/FORD01/FORD01-modal-general";
import TallerModal from "../helpers/FORD01/FORD01-modal-taller";
import { GlobalToast } from "../Globaltoast";

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

type WorkOrder = {
  orderId: string;
  orderType: 'General' | 'Taller';
  state: boolean;
  createdAt: any;
  issueDate: any;
  [key: string]: any;
};

// ============================================================================
// WORK ORDERS TABLE COMPONENT
// ============================================================================

const WorkOrdersTable = ({ 
  orders, 
  orderType,
  onUpdate 
}: { 
  orders: WorkOrder[];
  orderType: 'General' | 'Taller';
  onUpdate: (order: WorkOrder) => void;
}) => {
  const formatDate = (date: any) => {
    if (!date) return '-';
    
    // If date is already a string in format "YYYY-MM-DD", parse and format it
    if (typeof date === 'string' && date.match(/^\d{4}-\d{2}-\d{2}$/)) {
      const [year, month, day] = date.split('-');
      return `${day}/${month}/${year}`;
    }
    
    // Fallback for other date formats
    const dateObj = date.toDate ? date.toDate() : new Date(date);
    return dateObj.toLocaleDateString('es-ES', { 
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric' 
    });
  };

  const getRowContent = (order: WorkOrder) => {
    // For Taller orders with state=true and stateSig=false, show data with message in Actions column
    if (orderType === 'Taller' && order.state && order.stateSig === false) {
      return (
        <>
          <td className="px-4 py-3 text-sm text-gray-700">{formatDate(order.issueDate)}</td>
          <td className="px-4 py-3 text-sm text-gray-700">{order.mobileUnit}</td>
          <td className="px-4 py-3 text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-lg">
              <span className="text-amber-800 text-sm font-medium">Firma requerida en la App</span>
            </div>
          </td>
        </>
      );
    }

    return (
      <>
        <td className="px-4 py-3 text-sm text-gray-700">{formatDate(order.issueDate)}</td>
        <td className="px-4 py-3 text-sm text-gray-700">
          {orderType === 'General' ? order.equipment : order.mobileUnit}
        </td>
        <td className="px-4 py-3 text-center">
          <button
            onClick={() => onUpdate(order)}
            className="px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors"
          >
            Actualizar
          </button>
        </td>
      </>
    );
  };

  return (
    <div className="bg-white rounded-lg border overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full table-fixed">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="w-[20%] px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                Fecha
              </th>
              <th className="w-[35%] px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                {orderType === 'General' ? 'Equipo' : 'Unidad Móvil'}
              </th>
              <th className="w-[45%] px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">
                Acciones
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {orders.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-4 py-8 text-center text-gray-500">
                  No hay órdenes {orderType === 'General' ? 'generales' : 'de taller'} pendientes
                </td>
              </tr>
            ) : (
              orders.map((order) => (
                <tr key={order.orderId} className="hover:bg-gray-50 transition-colors">
                  {getRowContent(order)}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function FORD01() {
  const { user } = useAuth();
  const [generalOrders, setGeneralOrders] = useState<WorkOrder[]>([]);
  const [tallerOrders, setTallerOrders] = useState<WorkOrder[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<WorkOrder | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  const [loading, setLoading] = useState(true);

  // ============================================================================
  // TOAST HANDLER
  // ============================================================================

  const showToast = useCallback((type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 5000);
  }, []);

  // ============================================================================
  // LOAD WORK ORDERS
  // ============================================================================

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const ordersRef = collection(db, "CORD01");
    
    // Query for General orders with state=false
    const generalQuery = query(
      ordersRef,
      where("orderType", "==", "General"),
      where("state", "==", false),
      orderBy("createdAt", "desc")
    );

    // Query for Taller orders with state=false
    const tallerPendingQuery = query(
      ordersRef,
      where("orderType", "==", "Taller"),
      where("state", "==", false),
      orderBy("createdAt", "desc")
    );

    // Query for Taller orders with state=true but stateSig=false
    const tallerSignatureQuery = query(
      ordersRef,
      where("orderType", "==", "Taller"),
      where("state", "==", true),
      where("stateSig", "==", false),
      orderBy("createdAt", "desc")
    );

    const unsubscribeGeneral = onSnapshot(generalQuery, (snapshot) => {
      const orders: WorkOrder[] = [];
      snapshot.forEach((doc) => {
        orders.push({ orderId: doc.id, ...doc.data() } as WorkOrder);
      });
      setGeneralOrders(orders);
      setLoading(false);
    }, (error) => {
      console.error("Error loading general orders:", error);
      showToast('error', 'Error al cargar órdenes generales');
      setLoading(false);
    });

    // State to hold both sets of taller orders
    let pendingOrders: WorkOrder[] = [];
    let signatureOrders: WorkOrder[] = [];

    const combineTallerOrders = () => {
      // Merge and remove duplicates based on orderId
      const orderMap = new Map<string, WorkOrder>();
      
      [...pendingOrders, ...signatureOrders].forEach(order => {
        orderMap.set(order.orderId, order);
      });
      
      const allOrders = Array.from(orderMap.values());
      
      // Sort by createdAt
      allOrders.sort((a, b) => {
        const aTime = a.createdAt?.toMillis() || 0;
        const bTime = b.createdAt?.toMillis() || 0;
        return bTime - aTime;
      });
      
      setTallerOrders(allOrders);
    };

    // Independent listener for pending taller orders
    const unsubscribeTallerPending = onSnapshot(tallerPendingQuery, (snapshot) => {
      pendingOrders = [];
      snapshot.forEach((doc) => {
        pendingOrders.push({ orderId: doc.id, ...doc.data() } as WorkOrder);
      });
      combineTallerOrders();
    }, (error) => {
      console.error("Error loading taller pending orders:", error);
      showToast('error', 'Error al cargar órdenes de taller');
    });

    // Independent listener for signature pending taller orders
    const unsubscribeTallerSignature = onSnapshot(tallerSignatureQuery, (snapshot) => {
      signatureOrders = [];
      snapshot.forEach((doc) => {
        signatureOrders.push({ orderId: doc.id, ...doc.data() } as WorkOrder);
      });
      combineTallerOrders();
    }, (error) => {
      console.error("Error loading taller signature orders:", error);
      showToast('error', 'Error al cargar órdenes de taller');
    });

    return () => {
      unsubscribeGeneral();
      unsubscribeTallerPending();
      unsubscribeTallerSignature();
    };
  }, [user, showToast]);

  // ============================================================================
  // HANDLERS
  // ============================================================================

  const handleUpdateOrder = useCallback((order: WorkOrder) => {
    setSelectedOrder(order);
    setShowModal(true);
  }, []);

  const handleCloseModal = useCallback(() => {
    setShowModal(false);
    setSelectedOrder(null);
  }, []);

  const handleSuccess = useCallback((message: string) => {
    showToast('success', message);
    handleCloseModal();
  }, [handleCloseModal, showToast]);

  const handleError = useCallback((message: string) => {
    showToast('error', message);
  }, [showToast]);

  // ============================================================================
  // RENDER
  // ============================================================================

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
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
          <p className="text-gray-600">Cargando órdenes de trabajo...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {toast && <GlobalToast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* Header */}
      <div className="max-w-7xl mx-auto mb-8">
        <div className="flex items-center gap-3 mb-2">
          <ClipboardCheck className="text-blue-600" size={32} />
          <h1 className="text-3xl font-bold text-gray-900">Finalización de Orden de Trabajo</h1>
        </div>
      </div>

      {/* General Orders Section */}
      <div className="max-w-7xl mx-auto mb-8">
        <div className="flex items-center gap-2 mb-4">
          <Wrench className="text-gray-700" size={24} />
          <h2 className="text-xl font-semibold text-gray-800">Órdenes Generales</h2>
        </div>
        <WorkOrdersTable 
          orders={generalOrders} 
          orderType="General"
          onUpdate={handleUpdateOrder}
        />
      </div>

      {/* Taller Orders Section */}
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center gap-2 mb-4">
          <Wrench className="text-gray-700" size={24} />
          <h2 className="text-xl font-semibold text-gray-800">Órdenes de Taller</h2>
        </div>
        <WorkOrdersTable 
          orders={tallerOrders} 
          orderType="Taller"
          onUpdate={handleUpdateOrder}
        />
      </div>

      {/* Modals */}
      {showModal && selectedOrder && (
        selectedOrder.orderType === 'General' ? (
          <GeneralModal
            order={selectedOrder}
            onClose={handleCloseModal}
            onSuccess={handleSuccess}
            onError={handleError}
          />
        ) : (
          <TallerModal
            order={selectedOrder}
            onClose={handleCloseModal}
            onSuccess={handleSuccess}
            onError={handleError}
          />
        )
      )}
    </div>
  );
}