"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { 
  Calendar, 
  Truck, 
  User, 
  FileText, 
  Fuel, 
  Clock, 
  Trash2, 
  RefreshCw, 
  AlertCircle,
  Search,
  Archive,
  CheckCircle,
  X,
  AlertTriangle
} from "lucide-react";
import { useAuth } from "../auth-context";
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  getDocs, 
  doc,
  deleteDoc,
  addDoc,
  Timestamp,
  serverTimestamp
} from "firebase/firestore";
import { db } from "../../lib/firebase/client";
import { type ECOM01Document } from "../../lib/firebase/ecom01";

// ---------------------------
// Types
// ---------------------------
type FuelEntryDisplay = ECOM01Document & {
  id: string;
  quantityDifference: number;
  formattedDate: string;
  formattedTime: string;
  completedTime: string;
};

type DeletedEntry = {
  id: string;
  factura: string;
  createdBy: string;
  fecha: string;
  proveedorExterno: string;
  deletedAt: Timestamp;
  deletedBy: string;
  originalId: string;
};

type TabType = 'current' | 'deleted';

// ---------------------------
// Confirmation Modal
// ---------------------------
const DeleteConfirmationModal = ({ 
  entry, 
  onConfirm, 
  onCancel, 
  isDeleting 
}: { 
  entry: FuelEntryDisplay | null; 
  onConfirm: () => void; 
  onCancel: () => void;
  isDeleting: boolean;
}) => {
  if (!entry) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-md w-full">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-red-100 rounded-lg">
              <AlertTriangle className="text-red-600" size={24} />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">
              Confirmar Eliminación
            </h3>
          </div>
          
          <div className="space-y-3 mb-6">
            <p className="text-gray-700">
              ¿Está seguro de que desea eliminar esta entrada de combustible?
            </p>
            
            <div className="bg-gray-50 rounded-lg p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Factura:</span>
                <span className="font-medium">{entry.factura}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Proveedor:</span>
                <span className="font-medium">{entry.proveedorExterno}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Fecha:</span>
                <span className="font-medium">{entry.formattedDate}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Chapa:</span>
                <span className="font-medium">{entry.nroChapa}</span>
              </div>
            </div>
            
          
          </div>
          
          <div className="flex gap-3">
            <button
              onClick={onCancel}
              disabled={isDeleting}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 disabled:opacity-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={onConfirm}
              disabled={isDeleting}
              className="flex-1 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
            >
              {isDeleting ? (
                <>
                  <RefreshCw className="animate-spin" size={16} />
                  Eliminando...
                </>
              ) : (
                <>
                  <Trash2 size={16} />
                  Eliminar
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ---------------------------
// Toast Component
// ---------------------------
const Toast = ({ 
  message, 
  type, 
  onClose 
}: { 
  message: string; 
  type: 'success' | 'error'; 
  onClose: () => void; 
}) => (
  <div className="fixed bottom-4 right-4 z-50 animate-fade-in">
    <div className={`flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg border ${
      type === 'success' 
        ? 'bg-green-50 border-green-200 text-green-800' 
        : 'bg-red-50 border-red-200 text-red-800'
    }`}>
      {type === 'success' ? (
        <CheckCircle size={18} />
      ) : (
        <AlertCircle size={18} />
      )}
      <span className="font-medium">{message}</span>
      <button
        onClick={onClose}
        className={`ml-2 ${type === 'success' ? 'text-green-600 hover:text-green-800' : 'text-red-600 hover:text-red-800'}`}
      >
        <X size={16} />
      </button>
    </div>
  </div>
);

// ---------------------------
// Main ATCOM01 Module
// ---------------------------
export default function ATCOM01Module() {
  const { user } = useAuth();
  
  // Tab state
  const [activeTab, setActiveTab] = useState<TabType>('current');
  
  // Current entries state
  const [currentEntries, setCurrentEntries] = useState<FuelEntryDisplay[]>([]);
  const [currentLoading, setCurrentLoading] = useState(false);
  const [currentError, setCurrentError] = useState<string | null>(null);
  
  // Deleted entries state
  const [deletedEntries, setDeletedEntries] = useState<DeletedEntry[]>([]);
  const [deletedLoading, setDeletedLoading] = useState(false);
  const [deletedError, setDeletedError] = useState<string | null>(null);
  const [deletedLoaded, setDeletedLoaded] = useState(false);
  
  // Date range for current entries
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  
  // Deletion state
  const [entryToDelete, setEntryToDelete] = useState<FuelEntryDisplay | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Toast state
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Initialize default dates
  useEffect(() => {
    const today = new Date();
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);
    
    setEndDate(today.toISOString().split('T')[0]);
    setStartDate(weekAgo.toISOString().split('T')[0]);
  }, []);

  // Transform entry function
  const transformEntry = useCallback((id: string, data: ECOM01Document): FuelEntryDisplay => {
    const facturada = parseFloat(data.cantidadFacturadaLts || '0');
    const recepcionada = parseFloat(data.cantidadRecepcionadaLts || '0');
    const quantityDifference = facturada - recepcionada;

    let formattedDate = '';
    if (data.fecha) {
      const date = new Date(data.fecha + 'T00:00:00');
      if (!isNaN(date.getTime())) {
        formattedDate = date.toLocaleDateString('es-ES', {
          day: '2-digit', month: '2-digit', year: 'numeric'
        });
      }
    }

    let completedTime = '';
    if (data.completedAt) {
      const completedDate = data.completedAt.toDate();
      completedTime = completedDate.toLocaleDateString('es-ES', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
      });
    }

    return {
      ...data,
      id,
      quantityDifference,
      formattedDate,
      formattedTime: data.horaDescarga || '',
      completedTime
    };
  }, []);

  // Show toast
  const showToast = useCallback((message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 5000);
  }, []);

  // Fetch current entries
  const fetchCurrentEntries = useCallback(async () => {
    if (!startDate || !endDate) {
      setCurrentError('Por favor selecciona ambas fechas');
      return;
    }

    if (new Date(startDate) > new Date(endDate)) {
      setCurrentError('La fecha de inicio debe ser anterior a la fecha de fin');
      return;
    }

    setCurrentLoading(true);
    setCurrentError(null);

    try {
      const startTimestamp = Timestamp.fromDate(new Date(startDate + 'T00:00:00'));
      const endTimestamp = Timestamp.fromDate(new Date(endDate + 'T23:59:59'));

      const q = query(
        collection(db, 'ECOM01'),
        where('status', '==', 'completed'),
        where('completedAt', '>=', startTimestamp),
        where('completedAt', '<=', endTimestamp),
        orderBy('completedAt', 'desc')
      );

      const querySnapshot = await getDocs(q);
      const entriesData = querySnapshot.docs.map(doc => 
        transformEntry(doc.id, doc.data() as ECOM01Document)
      );
      
      setCurrentEntries(entriesData);
    } catch (err) {
      console.error('Error fetching current entries:', err);
      setCurrentError('Error al cargar las entradas');
      showToast('Error al cargar las entradas', 'error');
    } finally {
      setCurrentLoading(false);
    }
  }, [startDate, endDate, transformEntry, showToast]);

  // Fetch deleted entries
  const fetchDeletedEntries = useCallback(async () => {
    if (deletedLoaded) return;

    setDeletedLoading(true);
    setDeletedError(null);

    try {
      const q = query(
        collection(db, 'DELETED', 'ECOM01', 'files'),
        orderBy('deletedAt', 'desc')
      );

      const querySnapshot = await getDocs(q);
      const deletedData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as DeletedEntry[];
      
      setDeletedEntries(deletedData);
      setDeletedLoaded(true);
    } catch (err) {
      console.error('Error fetching deleted entries:', err);
      setDeletedError('Error al cargar las entradas eliminadas');
      showToast('Error al cargar las entradas eliminadas', 'error');
    } finally {
      setDeletedLoading(false);
    }
  }, [deletedLoaded, showToast]);

  // Handle delete entry
  const handleDeleteEntry = useCallback(async () => {
    if (!entryToDelete || !user?.uid) return;

    setIsDeleting(true);
    try {
      // First, save to deleted collection
      const deletedData = {
        factura: entryToDelete.factura,
        createdBy: entryToDelete.createdBy,
        fecha: entryToDelete.fecha,
        proveedorExterno: entryToDelete.proveedorExterno,
        deletedAt: serverTimestamp(),
        deletedBy: user.uid,
        originalId: entryToDelete.id
      };

      await addDoc(collection(db, 'DELETED', 'ECOM01', 'files'), deletedData);

      // Then delete from original collection
      await deleteDoc(doc(db, 'ECOM01', entryToDelete.id));

      // Update local state
      setCurrentEntries(prev => prev.filter(entry => entry.id !== entryToDelete.id));
      
      // Reset deleted entries to force reload
      setDeletedLoaded(false);
      setDeletedEntries([]);

      showToast('Entrada eliminada exitosamente', 'success');
      setEntryToDelete(null);
    } catch (error) {
      console.error('Error deleting entry:', error);
      showToast('Error al eliminar la entrada', 'error');
    } finally {
      setIsDeleting(false);
    }
  }, [entryToDelete, user?.uid, showToast]);

  // Handle tab change
  const handleTabChange = useCallback((tab: TabType) => {
    setActiveTab(tab);
    if (tab === 'deleted' && !deletedLoaded) {
      fetchDeletedEntries();
    }
  }, [deletedLoaded, fetchDeletedEntries]);

  return (
    <section className="w-full p-6 bg-gray-50 min-h-full">
      <header className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-red-100 rounded-lg">
            <Archive className="text-red-600" size={24} />
          </div>
          <h1 className="text-2xl font-semibold text-gray-900">
            ATCOM01 — Administración de Entradas de Combustible
          </h1>
        </div>
        <p className="text-gray-600">
          Gestión y eliminación de entradas de combustible con preservación de datos de auditoría
        </p>
      </header>

      <div className="bg-white border rounded-lg shadow-sm">
        {/* Tab Navigation */}
        <div className="border-b border-gray-200">
          <nav className="flex">
            <button
              onClick={() => handleTabChange('current')}
              className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'current'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center gap-2">
                <FileText size={16} />
                Entradas Actuales
                {currentEntries.length > 0 && (
                  <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">
                    {currentEntries.length}
                  </span>
                )}
              </div>
            </button>
            <button
              onClick={() => handleTabChange('deleted')}
              className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'deleted'
                  ? 'border-red-500 text-red-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center gap-2">
                <Archive size={16} />
                Entradas Eliminadas
                {deletedEntries.length > 0 && (
                  <span className="bg-red-100 text-red-800 text-xs px-2 py-1 rounded-full">
                    {deletedEntries.length}
                  </span>
                )}
              </div>
            </button>
          </nav>
        </div>

        {/* Current Entries Tab */}
        {activeTab === 'current' && (
          <>
            {/* Date Range Controls */}
            <div className="p-6 border-b border-gray-200 bg-gray-50">
              <div className="flex flex-col md:flex-row gap-4 items-end">
                <div className="flex gap-4 flex-1">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Fecha Inicio
                    </label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Fecha Fin
                    </label>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <button
                    onClick={fetchCurrentEntries}
                    disabled={currentLoading || !startDate || !endDate}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {currentLoading ? (
                      <RefreshCw className="animate-spin" size={16} />
                    ) : (
                      <Search size={16} />
                    )}
                    Buscar
                  </button>
                </div>
              </div>
            </div>

            {/* Current Entries Error */}
            {currentError && (
              <div className="p-4 bg-red-50 border-b border-red-200 flex items-center gap-2 text-red-800">
                <AlertCircle size={20} />
                <span>{currentError}</span>
              </div>
            )}

            {/* Current Entries Table */}
            <div className="overflow-x-auto">
              {currentLoading ? (
                <div className="p-8 text-center">
                  <div className="inline-flex items-center gap-2 text-gray-500">
                    <RefreshCw className="animate-spin" size={20} />
                    <span>Cargando entradas...</span>
                  </div>
                </div>
              ) : currentEntries.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  {startDate && endDate 
                    ? 'No se encontraron entradas en el rango de fechas seleccionado'
                    : 'Selecciona un rango de fechas para buscar entradas'
                  }
                </div>
              ) : (
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="text-left p-4 font-medium text-gray-900">Fecha</th>
                      <th className="text-left p-4 font-medium text-gray-900">Proveedor</th>
                      <th className="text-left p-4 font-medium text-gray-900">Chapa</th>
                      <th className="text-left p-4 font-medium text-gray-900">Chofer</th>
                      <th className="text-left p-4 font-medium text-gray-900">Factura</th>
                      <th className="text-right p-4 font-medium text-gray-900">Facturado (L)</th>
                      <th className="text-right p-4 font-medium text-gray-900">Recepcionado (L)</th>
                      <th className="text-right p-4 font-medium text-gray-900">Diferencia</th>
                      <th className="text-center p-4 font-medium text-gray-900">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {currentEntries.map((entry) => (
                      <tr key={entry.id} className="hover:bg-gray-50">
                        <td className="p-4 text-sm text-gray-900">{entry.formattedDate}</td>
                        <td className="p-4 text-sm text-gray-900">{entry.proveedorExterno}</td>
                        <td className="p-4 text-sm font-medium text-gray-900">{entry.nroChapa}</td>
                        <td className="p-4 text-sm text-gray-900">{entry.chofer}</td>
                        <td className="p-4 text-sm text-gray-900">{entry.factura}</td>
                        <td className="p-4 text-sm text-right text-gray-900">
                          {parseFloat(entry.cantidadFacturadaLts || '0').toFixed(2)}
                        </td>
                        <td className="p-4 text-sm text-right text-gray-900">
                          {parseFloat(entry.cantidadRecepcionadaLts || '0').toFixed(2)}
                        </td>
                        <td className="p-4 text-sm text-right">
                          <span className={`font-medium ${
                            Math.abs(entry.quantityDifference) < 0.01
                              ? 'text-green-600'
                              : entry.quantityDifference > 0
                              ? 'text-orange-600'
                              : 'text-red-600'
                          }`}>
                            {entry.quantityDifference > 0 ? '+' : ''}{entry.quantityDifference.toFixed(2)}
                          </span>
                        </td>
                        <td className="p-4 text-center">
                          <button
                            onClick={() => setEntryToDelete(entry)}
                            className="inline-flex items-center gap-1 px-3 py-1 bg-red-100 text-red-700 rounded-md hover:bg-red-200 transition-colors text-sm"
                          >
                            <Trash2 size={14} />
                            Eliminar
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}

        {/* Deleted Entries Tab */}
        {activeTab === 'deleted' && (
          <div className="overflow-x-auto">
            {deletedLoading ? (
              <div className="p-8 text-center">
                <div className="inline-flex items-center gap-2 text-gray-500">
                  <RefreshCw className="animate-spin" size={20} />
                  <span>Cargando entradas eliminadas...</span>
                </div>
              </div>
            ) : deletedError ? (
              <div className="p-4 bg-red-50 flex items-center gap-2 text-red-800">
                <AlertCircle size={20} />
                <span>{deletedError}</span>
                <button 
                  onClick={() => {
                    setDeletedLoaded(false);
                    fetchDeletedEntries();
                  }}
                  className="ml-auto text-red-600 hover:text-red-800 underline"
                >
                  Reintentar
                </button>
              </div>
            ) : deletedEntries.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                No hay entradas eliminadas registradas
              </div>
            ) : (
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left p-4 font-medium text-gray-900">Fecha Original</th>
                    <th className="text-left p-4 font-medium text-gray-900">Proveedor</th>
                    <th className="text-left p-4 font-medium text-gray-900">Factura</th>
                    <th className="text-left p-4 font-medium text-gray-900">Eliminado Por</th>
                    <th className="text-left p-4 font-medium text-gray-900">Fecha de Eliminación</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {deletedEntries.map((entry) => (
                    <tr key={entry.id} className="hover:bg-gray-50">
                      <td className="p-4 text-sm text-gray-900">
                        {new Date(entry.fecha + 'T00:00:00').toLocaleDateString('es-ES', {
                          day: '2-digit', month: '2-digit', year: 'numeric'
                        })}
                      </td>
                      <td className="p-4 text-sm text-gray-900">{entry.proveedorExterno}</td>
                      <td className="p-4 text-sm font-medium text-gray-900">{entry.factura}</td>
                      <td className="p-4 text-sm text-gray-900">{entry.deletedBy}</td>
                      <td className="p-4 text-sm text-gray-900">
                        {entry.deletedAt?.toDate?.()?.toLocaleDateString('es-ES', {
                          day: '2-digit', month: '2-digit', year: 'numeric',
                          hour: '2-digit', minute: '2-digit'
                        }) || 'N/A'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {entryToDelete && (
        <DeleteConfirmationModal
          entry={entryToDelete}
          onConfirm={handleDeleteEntry}
          onCancel={() => setEntryToDelete(null)}
          isDeleting={isDeleting}
        />
      )}

      {/* Toast Notification */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      {/* CSS Animation for Toast */}
      <style jsx global>{`
        @keyframes fade-in {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fade-in {
          animation: fade-in 0.3s ease-out;
        }
      `}</style>
    </section>
  );
}