"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  X,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Download,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  FileDown
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
import { generateINV01MovimientosPdf } from "../../../lib/utils/pdfDocumentGenerator-INV01-movimientos";
import { generateINV01ActualPdf } from "../../../lib/utils/pdfDocumentGenerator-INV01-actual";

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

type Material = {
  documentId: string;
  codigo: string;
  descripcion: string;
  proveedor: string;
  marca: string;
  unidadDeMedida: string;
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
  materialCode?: string;
  materialDescription?: string;
  equipmentOrUnit?: string;
  orderType?: string | null;
};

interface INV01ReportProps {
  onClose: () => void;
}

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

function formatDateTime(timestamp: Timestamp): string {
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

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function INV01Report({ onClose }: INV01ReportProps) {
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

  // Load all materials on mount
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
    const lastDay = new Date(year, month + 1, 0);
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
    if (!rangeStart) return false;

    const date = parseDateStr(dateStr);
    const start = parseDateStr(rangeStart);

    if (!date || !start) return false;

    if (!rangeEnd) {
      return dateStr === rangeStart;
    }

    const end = parseDateStr(rangeEnd);
    if (!end) return false;

    return date >= start && date <= end;
  };

  const fetchData = async () => {
    if (!rangeStart || !rangeEnd) {
      setError('Seleccione un rango de fechas válido');
      return;
    }

    setIsFetchingData(true);
    setError(null);

    try {
      const start = parseDateStr(rangeStart);
      const end = parseDateStr(rangeEnd);

      if (!start || !end) {
        throw new Error('Fechas inválidas');
      }

      // Set time to start of day for start date, end of day for end date
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);

      const startTimestamp = Timestamp.fromDate(start);
      const endTimestamp = Timestamp.fromDate(end);

      const allMovements: Movement[] = [];

      // Fetch movements for ALL materials
      for (const material of materials) {
        const movesRef = collection(db, 'INV01', material.documentId, 'moves');
        const movesQuery = query(
          movesRef,
          where('deleted', '==', false),
          where('effectiveAt', '>=', startTimestamp),
          where('effectiveAt', '<=', endTimestamp),
          orderBy('effectiveAt', 'desc')
        );

        const snapshot = await getDocs(movesQuery);

        for (const moveDoc of snapshot.docs) {
          if (moveDoc.id === 'default') continue;

          const data = moveDoc.data();
          const movement: Movement = {
            moveId: moveDoc.id,
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
            orderType: null,
          };

          // If movement has a reason (orderId), fetch CORD01 to get equipment/mobileUnit and orderType
          if (data.reason) {
            try {
              const orderRef = doc(db, 'CORD01', data.reason);
              const orderSnap = await getDoc(orderRef);
              
              if (orderSnap.exists()) {
                const orderData = orderSnap.data();
                
                // Store orderType
                movement.orderType = orderData.orderType || null;
                
                // Check orderType to determine which field to read
                if (orderData.orderType === 'Taller') {
                  movement.equipmentOrUnit = orderData.mobileUnit || '-';
                } else {
                  movement.equipmentOrUnit = orderData.equipment || '-';
                }
              } else {
                movement.equipmentOrUnit = '-';
                movement.orderType = null;
              }
            } catch (err) {
              console.error(`Error fetching order ${data.reason}:`, err);
              movement.equipmentOrUnit = '-';
              movement.orderType = null;
            }
          } else {
            movement.equipmentOrUnit = '-';
            movement.orderType = null;
          }

          allMovements.push(movement);
        }
      }

      // Sort by date descending
      allMovements.sort((a, b) => b.effectiveAt.toMillis() - a.effectiveAt.toMillis());

      setMovements(allMovements);
      setDataFetched(true);

      if (allMovements.length === 0) {
        setError('No se encontraron movimientos en el rango seleccionado');
      }
    } catch (err) {
      console.error('Error fetching movements:', err);
      setError('Error al cargar los movimientos');
    } finally {
      setIsFetchingData(false);
    }
  };

  const handleGeneratePdf = async () => {
    if (movements.length === 0) {
      setError('No hay datos para generar el PDF');
      return;
    }

    setIsGeneratingPdf(true);

    try {
      await generateINV01MovimientosPdf(movements, rangeStart!, rangeEnd!);
    } catch (err) {
      console.error('Error generating PDF:', err);
      setError('Error al generar el PDF');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handleGenerateCostCenterPdf = async () => {
    if (movements.length === 0) {
      setError('No hay datos para generar el PDF');
      return;
    }

    setIsGeneratingPdf(true);

    try {
      await generateINV01ActualPdf(movements, rangeStart!, rangeEnd!);
    } catch (err) {
      console.error('Error generating Cost Center PDF:', err);
      setError('Error al generar el PDF de Centro de Costos');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Reporte General de Inventario</h2>
            <p className="text-sm text-gray-600 mt-1">Todos los materiales</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X size={24} className="text-gray-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {loadingMaterials ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
              <p className="ml-4 text-gray-600">Cargando materiales...</p>
            </div>
          ) : !dataFetched ? (
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
            </>
          ) : (
            <>
              <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="text-sm font-medium text-blue-900 mb-3">Resumen</h3>
                <div className="grid grid-cols-4 gap-4 text-sm">
                  <div>
                    <div className="text-xs text-blue-700 mb-1">Materiales</div>
                    <div className="text-lg font-semibold text-blue-900">
                      {new Set(movements.map(m => m.materialCode)).size}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-blue-700 mb-1">Total Movimientos</div>
                    <div className="text-lg font-semibold text-blue-900">{movements.length}</div>
                  </div>
                  <div>
                    <div className="text-xs text-green-700 mb-1">Entradas</div>
                    <div className="text-lg font-semibold text-green-700">
                      {movements.filter(m => m.qty > 0).length}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-orange-700 mb-1">Salidas</div>
                    <div className="text-lg font-semibold text-orange-700">
                      {movements.filter(m => m.qty < 0).length}
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <button
                  onClick={handleGeneratePdf}
                  disabled={isGeneratingPdf || movements.length === 0}
                  className="w-full h-20 bg-red-50 border-2 border-red-200 rounded-lg hover:bg-red-100 transition-all duration-200 flex items-center justify-center gap-4 group disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isGeneratingPdf ? (
                    <RefreshCw size={28} className="text-red-600 animate-spin" />
                  ) : (
                    <FileDown size={28} className="text-red-600 group-hover:scale-110 transition-transform" />
                  )}
                  <div className="text-left">
                    <div className="text-red-900 font-semibold text-lg">
                      {isGeneratingPdf ? 'Generando PDF...' : 'Descargar PDF General'}
                    </div>
                    <div className="text-red-700 text-sm">
                      Entradas y Salidas separadas
                    </div>
                  </div>
                </button>

                <button
                  onClick={handleGenerateCostCenterPdf}
                  disabled={isGeneratingPdf || movements.length === 0}
                  className="w-full h-20 bg-blue-50 border-2 border-blue-200 rounded-lg hover:bg-blue-100 transition-all duration-200 flex items-center justify-center gap-4 group disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isGeneratingPdf ? (
                    <RefreshCw size={28} className="text-blue-600 animate-spin" />
                  ) : (
                    <FileDown size={28} className="text-blue-600 group-hover:scale-110 transition-transform" />
                  )}
                  <div className="text-left">
                    <div className="text-blue-900 font-semibold text-lg">
                      {isGeneratingPdf ? 'Generando PDF...' : 'Reporte por Centro de Costos'}
                    </div>
                    <div className="text-blue-700 text-sm">
                      Salidas agrupadas por equipo (Solo Taller)
                    </div>
                  </div>
                </button>

                <button
                  onClick={() => {
                    setDataFetched(false);
                    setMovements([]);
                    setRangeStart(null);
                    setRangeEnd(null);
                  }}
                  className="w-full px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                >
                  Nueva Búsqueda
                </button>
              </div>
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