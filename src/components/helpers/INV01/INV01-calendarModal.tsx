"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  X,
  Calendar,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Package
} from "lucide-react";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  Timestamp,
  orderBy
} from "firebase/firestore";
import { db } from "../../../lib/firebase/client";
import { generateINV01GeneralPdf } from "../../../lib/utils/pdfDocumentGenerator-INV01-general";
import INV01PdfModal from "./INV01-pdfModal";

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export type Material = {
  documentId: string;
  codigo: string;
  descripcion: string;
  proveedor: string;
  marca: string;
  unidadDeMedida: string;
};

export type Movement = {
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
  materialCode?: string;
  materialDescription?: string;
  unidadDeMedida?: string;
  equipmentOrUnit?: string;
  orderType?: string | null;
};

export type InventoryLocation = {
  quantity: number;
  lastEntry: string | null;
  lastExit: string | null;
  lastModified: any;
};

export type MaterialWithInventory = Material & {
  inventory: Record<string, InventoryLocation>;
};

interface INV01CalendarModalProps {
  onClose: () => void;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function INV01CalendarModal({ onClose }: INV01CalendarModalProps) {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loadingMaterials, setLoadingMaterials] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [rangeStart, setRangeStart] = useState<string | null>(null);
  const [rangeEnd, setRangeEnd] = useState<string | null>(null);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [isFetchingData, setIsFetchingData] = useState(false);
  const [dataFetched, setDataFetched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    loadMaterials();
  }, []);

  const loadMaterials = async () => {
    try {
      setLoadingMaterials(true);
      const materialsQuery = query(collection(db, 'CMAT01'));
      const snapshot = await getDocs(materialsQuery);
      
      const loadedMaterials: Material[] = [];
      snapshot.forEach((doc) => {
        if (doc.id === 'default') return;
        
        const data = doc.data();
        loadedMaterials.push({
          documentId: doc.id,
          codigo: data.codigo || '',
          descripcion: data.descripcion || '',
          proveedor: data.proveedor || '',
          marca: data.marca || '',
          unidadDeMedida: data.unidadDeMedida || '',
        });
      });

      loadedMaterials.sort((a, b) => a.codigo.localeCompare(b.codigo));
      setMaterials(loadedMaterials);
    } catch (error) {
      console.error('Error loading materials:', error);
      setError('Error al cargar los materiales');
    } finally {
      setLoadingMaterials(false);
    }
  };

  const navigateMonth = (direction: number) => {
    setCurrentMonth(prev => {
      const newDate = new Date(prev);
      newDate.setMonth(newDate.getMonth() + direction);
      return newDate;
    });
  };

  const calendarDays = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();

    const firstDay = new Date(year, month, 1);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());

    const days = [];
    const current = new Date(startDate);

    for (let i = 0; i < 42; i++) {
      const dateStr = `${String(current.getDate()).padStart(2, '0')}-${String(current.getMonth() + 1).padStart(2, '0')}-${current.getFullYear()}`;
      const isCurrentMonth = current.getMonth() === month;

      days.push({
        date: new Date(current),
        dateStr,
        isCurrentMonth
      });

      current.setDate(current.getDate() + 1);
    }

    return days;
  }, [currentMonth]);

  const parseDateStr = (dateStr: string): Date | null => {
    const [day, month, year] = dateStr.split('-').map(Number);
    if (!day || !month || !year) return null;
    return new Date(year, month - 1, day);
  };

  const handleDateClick = (dateStr: string) => {
    if (!rangeStart) {
      setRangeStart(dateStr);
      setRangeEnd(null);
    } else if (!rangeEnd) {
      const start = parseDateStr(rangeStart);
      const end = parseDateStr(dateStr);

      if (start && end) {
        const diffTime = Math.abs(end.getTime() - start.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays > 90) {
          setError('El rango no puede exceder 90 días');
          return;
        }

        if (end < start) {
          setRangeStart(dateStr);
          setRangeEnd(rangeStart);
        } else {
          setRangeEnd(dateStr);
        }
      }
    } else {
      setRangeStart(dateStr);
      setRangeEnd(null);
    }

    setError(null);
  };

  const isDateInRange = (dateStr: string): boolean => {
    if (!rangeStart || !rangeEnd) return false;

    const date = parseDateStr(dateStr);
    const start = parseDateStr(rangeStart);
    const end = parseDateStr(rangeEnd);

    if (!date || !start || !end) return false;

    return date >= start && date <= end;
  };

  const fetchSmat01Batch = async (sourceIds: string[]): Promise<Map<string, any>> => {
    const smat01Map = new Map<string, any>();
    if (sourceIds.length === 0) return smat01Map;

    const BATCH_SIZE = 10;
    
    for (let i = 0; i < sourceIds.length; i += BATCH_SIZE) {
      const batch = sourceIds.slice(i, Math.min(i + BATCH_SIZE, sourceIds.length));
      
      const batchPromises = batch.map(async (sourceId) => {
        try {
          const smat01Ref = doc(db, 'SMAT01', sourceId);
          const smat01Snap = await getDoc(smat01Ref);
          if (smat01Snap.exists()) {
            return { id: sourceId, data: smat01Snap.data() };
          }
        } catch (error) {
          console.error(`Error fetching SMAT01 ${sourceId}:`, error);
        }
        return null;
      });
      
      const results = await Promise.all(batchPromises);
      
      results.forEach(result => {
        if (result) {
          smat01Map.set(result.id, result.data);
        }
      });
    }
    
    return smat01Map;
  };

  const fetchCord01Batch = async (workOrderIds: string[]): Promise<Map<string, any>> => {
    const workOrderMap = new Map<string, any>();
    if (workOrderIds.length === 0) return workOrderMap;

    const BATCH_SIZE = 10;
    
    for (let i = 0; i < workOrderIds.length; i += BATCH_SIZE) {
      const batch = workOrderIds.slice(i, Math.min(i + BATCH_SIZE, workOrderIds.length));
      
      const batchPromises = batch.map(async (orderId) => {
        try {
          const orderRef = doc(db, 'CORD01', orderId);
          const orderSnap = await getDoc(orderRef);
          if (orderSnap.exists()) {
            return { id: orderId, data: orderSnap.data() };
          }
        } catch (error) {
          console.error(`Error fetching work order ${orderId}:`, error);
        }
        return null;
      });
      
      const results = await Promise.all(batchPromises);
      
      results.forEach(result => {
        if (result) {
          workOrderMap.set(result.id, result.data);
        }
      });
    }
    
    return workOrderMap;
  };

  const fetchData = async () => {
    if (!rangeStart || !rangeEnd) {
      setError('Por favor selecciona un rango de fechas');
      return;
    }

    try {
      setIsFetchingData(true);
      setProgress(0);
      setError(null);

      const startDate = parseDateStr(rangeStart);
      const endDate = parseDateStr(rangeEnd);

      if (!startDate || !endDate) {
        setError('Fechas inválidas');
        return;
      }

      endDate.setHours(23, 59, 59, 999);

      const startTimestamp = Timestamp.fromDate(startDate);
      const endTimestamp = Timestamp.fromDate(endDate);

      const allMovements: Movement[] = [];
      const totalMaterials = materials.length;
      const MATERIAL_BATCH_SIZE = 10;

      for (let i = 0; i < materials.length; i += MATERIAL_BATCH_SIZE) {
        const batch = materials.slice(i, Math.min(i + MATERIAL_BATCH_SIZE, materials.length));
        
        const batchPromises = batch.map(async (material) => {
          try {
            const movesRef = collection(db, 'INV01', material.documentId, 'moves');
            const movesQuery = query(
              movesRef,
              where('deleted', '==', false),
              where('effectiveAt', '>=', startTimestamp),
              where('effectiveAt', '<=', endTimestamp),
              orderBy('effectiveAt', 'desc')
            );

            const snapshot = await getDocs(movesQuery);
            const movements: Movement[] = [];

            snapshot.forEach((doc) => {
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
                deleted: data.deleted,
                materialCode: material.codigo,
                materialDescription: material.descripcion,
                unidadDeMedida: material.unidadDeMedida,
              });
            });

            return movements;
          } catch (error) {
            console.error(`Error fetching movements for material ${material.codigo}:`, error);
            return [];
          }
        });

        const batchResults = await Promise.all(batchPromises);
        
        batchResults.forEach(movements => {
          allMovements.push(...movements);
        });

        const processedCount = Math.min(i + MATERIAL_BATCH_SIZE, totalMaterials);
        setProgress(Math.round((processedCount / totalMaterials) * 70));
      }

      allMovements.sort((a, b) => b.effectiveAt.toMillis() - a.effectiveAt.toMillis());

      const uniqueSmat01Ids = new Set<string>();
      const uniqueWorkOrderIds = new Set<string>();

      allMovements.forEach(movement => {
        if (movement.source === 'SMAT01' && movement.sourceId) {
          uniqueSmat01Ids.add(movement.sourceId);
        }
        if (movement.reason && movement.source === 'SMAT01') {
          uniqueWorkOrderIds.add(movement.reason);
        }
      });

      setProgress(75);

      const [smat01Map, workOrderMap] = await Promise.all([
        fetchSmat01Batch(Array.from(uniqueSmat01Ids)),
        fetchCord01Batch(Array.from(uniqueWorkOrderIds))
      ]);

      setProgress(90);

      const enrichedMovements = allMovements.map(movement => {
        const smat01Data = movement.sourceId ? smat01Map.get(movement.sourceId) : null;
        
        if (smat01Data?.entryType === 'particular' && smat01Data?.mobileUnit) {
          return {
            ...movement,
            orderType: 'Particular',
            equipmentOrUnit: smat01Data.mobileUnit,
          };
        }
        
        if (movement.reason && workOrderMap.has(movement.reason)) {
          const workOrderData = workOrderMap.get(movement.reason);
          return {
            ...movement,
            orderType: workOrderData.orderType || null,
            equipmentOrUnit: workOrderData.mobileUnit || null,
          };
        }
        
        return {
          ...movement,
          orderType: null,
          equipmentOrUnit: null,
        };
      });

      setProgress(100);
      setMovements(enrichedMovements);
      setDataFetched(true);
    } catch (error) {
      console.error('Error fetching data:', error);
      setError('Error al cargar los datos. Por favor intenta de nuevo.');
    } finally {
      setIsFetchingData(false);
      setProgress(0);
    }
  };

  const handleGenerateCurrentInventoryPdf = async () => {
    try {
      setIsGeneratingPdf(true);
      setProgress(0);
      setError(null);

      const BATCH_SIZE = 15;
      const materialsWithInventory: MaterialWithInventory[] = [];
      const totalMaterials = materials.length;

      const processMaterial = async (material: Material): Promise<MaterialWithInventory | null> => {
        try {
          const invDocRef = doc(db, 'INV01', material.documentId);
          const invDocSnap = await getDoc(invDocRef);

          if (invDocSnap.exists()) {
            const invData = invDocSnap.data();
            const inventory: Record<string, InventoryLocation> = {};

            Object.keys(invData).forEach(key => {
              if (key !== 'default' && typeof invData[key] === 'object' && invData[key].quantity !== undefined) {
                inventory[key] = {
                  quantity: invData[key].quantity || 0,
                  lastEntry: invData[key].lastEntry || null,
                  lastExit: invData[key].lastExit || null,
                  lastModified: invData[key].lastModified || null,
                };
              }
            });

            return {
              ...material,
              inventory
            };
          }

          return null;
        } catch (error) {
          console.error(`Error loading inventory for material ${material.codigo}:`, error);
          return null;
        }
      };

      for (let i = 0; i < materials.length; i += BATCH_SIZE) {
        const batch = materials.slice(i, Math.min(i + BATCH_SIZE, materials.length));
        
        const batchResults = await Promise.all(
          batch.map(material => processMaterial(material))
        );

        batchResults.forEach(result => {
          if (result !== null) {
            materialsWithInventory.push(result);
          }
        });

        const processedCount = Math.min(i + BATCH_SIZE, totalMaterials);
        setProgress(Math.round((processedCount / totalMaterials) * 100));
      }

      const today = new Date();
      const reportDate = `${String(today.getDate()).padStart(2, '0')}-${String(today.getMonth() + 1).padStart(2, '0')}-${today.getFullYear()}`;

      await generateINV01GeneralPdf(materialsWithInventory, reportDate);
      
    } catch (error) {
      console.error('Error generating inventory PDF:', error);
      setError('Error al generar el PDF de inventario. Por favor intenta de nuevo.');
    } finally {
      setIsGeneratingPdf(false);
      setProgress(0);
    }
  };

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  if (dataFetched) {
    return (
      <INV01PdfModal
        movements={movements}
        materials={materials}
        rangeStart={rangeStart!}
        rangeEnd={rangeEnd!}
        onClose={onClose}
        onBack={() => {
          setDataFetched(false);
          setMovements([]);
          setRangeStart(null);
          setRangeEnd(null);
          setProgress(0);
        }}
      />
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-green-50 to-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-full bg-green-100">
                <Calendar size={28} className="text-green-600" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Reportes de Inventario</h2>
                <p className="text-sm text-gray-600 mt-1">Generar reportes y análisis</p>
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

        <div className="flex-1 overflow-y-auto p-6">
          {loadingMaterials ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-12 h-12 border-4 border-green-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                <p className="text-sm text-blue-900">
                  Seleccione dos fechas para definir el rango (máximo 90 días)
                </p>
              </div>

              <div className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-4">
                  <button
                    onClick={() => navigateMonth(-1)}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <ChevronLeft size={20} />
                  </button>
                  <div className="text-lg font-semibold text-gray-900">
                    {currentMonth.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}
                  </div>
                  <button
                    onClick={() => navigateMonth(1)}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <ChevronRight size={20} />
                  </button>
                </div>

                <div className="grid grid-cols-7 gap-2">
                  {['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'].map(day => (
                    <div key={day} className="text-center text-xs font-medium text-gray-600 py-2">
                      {day}
                    </div>
                  ))}
                  {calendarDays.map((day, index) => {
                    const isSelected = isDateInRange(day.dateStr);
                    const isRangeStart = rangeStart === day.dateStr;
                    const isRangeEnd = rangeEnd === day.dateStr;

                    return (
                      <button
                        key={index}
                        onClick={() => handleDateClick(day.dateStr)}
                        className={`p-4 rounded-lg text-sm font-medium transition-all
                          ${!day.isCurrentMonth ? 'text-gray-300' : ''}
                          cursor-pointer hover:bg-blue-50
                          ${isSelected && !isRangeStart && !isRangeEnd ? 'bg-blue-100 text-blue-900' : ''}
                          ${(isRangeStart || isRangeEnd) ? 'bg-blue-600 text-white hover:bg-blue-700' : ''}
                        `}
                      >
                        {day.date.getDate()}
                      </button>
                    );
                  })}
                </div>
              </div>

              {(rangeStart && rangeEnd) && (
                <div className="mt-4 bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-green-900">
                    <CheckCircle size={20} />
                    <span className="font-medium">
                      Rango: {rangeStart} a {rangeEnd}
                    </span>
                  </div>
                </div>
              )}

              {isFetchingData && (
                <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-blue-900">
                      Cargando movimientos...
                    </span>
                    <span className="text-sm font-semibold text-blue-900">
                      {progress}%
                    </span>
                  </div>
                  <div className="w-full bg-blue-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <p className="text-xs text-blue-700 mt-2">
                    Procesando datos...
                  </p>
                </div>
              )}

              <button
                onClick={fetchData}
                disabled={isFetchingData || !rangeStart || !rangeEnd}
                className="w-full mt-4 py-4 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isFetchingData ? (
                  <>
                    <RefreshCw size={20} className="animate-spin" />
                    <span>Cargando movimientos...</span>
                  </>
                ) : (
                  <>
                    <Calendar size={20} />
                    <span>Cargar Movimientos</span>
                  </>
                )}
              </button>

              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-300"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white text-gray-500">O generar reporte actual</span>
                </div>
              </div>

              <button
                onClick={handleGenerateCurrentInventoryPdf}
                disabled={isGeneratingPdf}
                className="w-full h-20 bg-green-50 border-2 border-green-200 rounded-lg hover:bg-green-100 transition-all duration-200 flex items-center justify-center gap-4 group disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isGeneratingPdf ? (
                  <RefreshCw size={28} className="text-green-600 animate-spin" />
                ) : (
                  <Package size={28} className="text-green-600 group-hover:scale-110 transition-transform" />
                )}
                <div className="text-left">
                  <div className="text-green-900 font-semibold text-lg">
                    {isGeneratingPdf ? `Cargando... ${progress}%` : 'Reporte Inventario Actual'}
                  </div>
                  <div className="text-green-700 text-sm">
                    Stock actual por ubicación
                  </div>
                </div>
              </button>

              {isGeneratingPdf && progress > 0 && (
                <div className="mt-2 bg-green-50 border border-green-200 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-green-900">
                      Cargando inventario...
                    </span>
                    <span className="text-xs font-semibold text-green-900">
                      {progress}%
                    </span>
                  </div>
                  <div className="w-full bg-green-200 rounded-full h-2">
                    <div
                      className="bg-green-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              )}
            </>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-2 mt-4">
              <AlertCircle className="text-red-600 mt-0.5" size={20} />
              <div className="flex-1">
                <div className="font-medium text-red-900">{error}</div>
              </div>
              <button onClick={() => setError(null)} className="text-red-600 hover:text-red-800">
                <X size={16} />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}