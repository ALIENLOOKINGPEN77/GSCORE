"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  X,
  ChevronLeft,
  ChevronRight,
  Search,
  RefreshCw,
  AlertCircle,
  CheckCircle
} from "lucide-react";
import {
  collection,
  query,
  orderBy,
  getDocs,
  doc,
  getDoc
} from "firebase/firestore";
import { db } from "../../../lib/firebase/client";

type SelectionMode = 'single' | 'range';

export type CargaFlota = {
  id: string;
  Litros: string;
  NroMovil: string;
  Chofer: string;
  HoraCarga: string;
  Kilometraje?: string;
  Horometro?: string;
  Precinto?: string;
  HasFirma: boolean;
  FirmaSvg?: string;
  createdAt: number;
  type: 'flota';
  sourceDate: string;
};

export type CargaExterna = {
  id: string;
  Empresa: string;
  NumeroChapa: string;
  LitrosCargados: string;
  NombreChofer: string;
  Hora: string;
  Kilometraje?: string;
  Horometro?: string;
  Precinto?: string;
  HasFirma: boolean;
  FirmaSvg?: string;
  createdAt: number;
  type: 'externa';
  sourceDate: string;
};

export type CargaDisplay = CargaFlota | CargaExterna;

export interface FetchedData {
  entries: CargaDisplay[];
  totalizadorInicial: string;
  totalizadorFinal: string;
  dateRange: string[];
  selectionMode: SelectionMode;
}

interface SCOM01CalendarModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDataFetched: (data: FetchedData) => void;
}

export default function SCOM01CalendarModal({
  isOpen,
  onClose,
  onDataFetched
}: SCOM01CalendarModalProps) {
  const [selectionMode, setSelectionMode] = useState<SelectionMode>('single');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [availableDates, setAvailableDates] = useState<Set<string>>(new Set());
  const [loadingDates, setLoadingDates] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [rangeStart, setRangeStart] = useState<string | null>(null);
  const [rangeEnd, setRangeEnd] = useState<string | null>(null);
  const [isFetchingData, setIsFetchingData] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    const loadAvailableDates = async () => {
      setLoadingDates(true);
      try {
        const q = query(collection(db, 'SCOM01'), orderBy('__name__'));
        const snapshot = await getDocs(q);

        const dates = new Set<string>();
        snapshot.forEach((doc) => {
          const docId = doc.id;
          if (/^\d{2}-\d{2}-\d{4}$/.test(docId)) {
            dates.add(docId);
          }
        });

        setAvailableDates(dates);
        console.log('[SCOM01-Calendar] Loaded available dates:', dates.size);
      } catch (err) {
        console.error('[SCOM01-Calendar] Error loading dates:', err);
        setError('Error al cargar fechas disponibles');
      } finally {
        setLoadingDates(false);
      }
    };

    loadAvailableDates();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      setSelectedDate(null);
      setRangeStart(null);
      setRangeEnd(null);
      setError(null);
    }
  }, [isOpen]);

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
      const isAvailable = availableDates.has(dateStr);

      days.push({
        date: new Date(current),
        dateStr,
        isCurrentMonth,
        isAvailable
      });

      current.setDate(current.getDate() + 1);
    }

    return days;
  }, [currentMonth, availableDates]);

  const parseDateStr = (dateStr: string): Date | null => {
    const [day, month, year] = dateStr.split('-').map(Number);
    if (!day || !month || !year) return null;
    return new Date(year, month - 1, day);
  };

  const handleDateClick = (dateStr: string, isAvailable: boolean) => {
    if (!isAvailable) return;

    if (selectionMode === 'single') {
      setSelectedDate(dateStr);
      setRangeStart(null);
      setRangeEnd(null);
    } else {
      if (!rangeStart) {
        setRangeStart(dateStr);
        setRangeEnd(null);
        setSelectedDate(null);
      } else if (!rangeEnd) {
        const start = parseDateStr(rangeStart);
        const end = parseDateStr(dateStr);

        if (start && end) {
          const diffTime = Math.abs(end.getTime() - start.getTime());
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

          if (diffDays > 31) {
            setError('El rango no puede exceder 31 días');
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
    }

    setError(null);
  };

  const isDateInRange = (dateStr: string): boolean => {
    if (selectionMode === 'single') {
      return selectedDate === dateStr;
    }

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

  const getDatesInRange = (): string[] => {
    if (selectionMode === 'single' && selectedDate) {
      return [selectedDate];
    }

    if (!rangeStart || !rangeEnd) return [];

    const start = parseDateStr(rangeStart);
    const end = parseDateStr(rangeEnd);

    if (!start || !end) return [];

    const dates: string[] = [];
    const current = new Date(start);

    while (current <= end) {
      const dateStr = `${String(current.getDate()).padStart(2, '0')}-${String(current.getMonth() + 1).padStart(2, '0')}-${current.getFullYear()}`;
      dates.push(dateStr);
      current.setDate(current.getDate() + 1);
    }

    return dates;
  };

  const fetchData = async () => {
    const datesToFetch = getDatesInRange();

    if (datesToFetch.length === 0) {
      setError('Seleccione una fecha o rango válido');
      return;
    }

    setIsFetchingData(true);
    setError(null);

    try {
      const allEntries: CargaDisplay[] = [];
      let totalizadorInicial = '';
      let totalizadorFinal = '';

      // Batch fetch: 10 documents at a time
      const BATCH_SIZE = 10;
      const batches: string[][] = [];

      for (let i = 0; i < datesToFetch.length; i += BATCH_SIZE) {
        batches.push(datesToFetch.slice(i, i + BATCH_SIZE));
      }

      for (const batch of batches) {
        const batchPromises = batch
          .filter(dateStr => availableDates.has(dateStr))
          .map(async (dateStr) => {
            const docRef = doc(db, 'SCOM01', dateStr);
            const docSnap = await getDoc(docRef);
            return { dateStr, docSnap };
          });

        const batchResults = await Promise.all(batchPromises);

        batchResults.forEach(({ dateStr, docSnap }) => {
          if (docSnap.exists()) {
            const docData = docSnap.data();

            if (selectionMode === 'single' && datesToFetch.length === 1) {
              totalizadorInicial = docData.docData?.Tinicial || '';
              totalizadorFinal = docData.docData?.Tfinal || '';
            }

            if (docData.CargasFlota) {
              Object.entries(docData.CargasFlota).forEach(([id, data]: [string, any]) => {
                allEntries.push({
                  ...data,
                  id,
                  type: 'flota',
                  sourceDate: dateStr
                });
              });
            }

            if (docData.CargasExternas) {
              Object.entries(docData.CargasExternas).forEach(([id, data]: [string, any]) => {
                allEntries.push({
                  ...data,
                  id,
                  type: 'externa',
                  sourceDate: dateStr
                });
              });
            }
          }
        });
      }

      allEntries.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

      console.log('[SCOM01-Calendar] Fetched entries:', allEntries.length);

      if (allEntries.length === 0) {
        setError('No se encontraron datos en las fechas seleccionadas');
        return;
      }

      onDataFetched({
        entries: allEntries,
        totalizadorInicial,
        totalizadorFinal,
        dateRange: datesToFetch,
        selectionMode
      });
    } catch (err) {
      console.error('[SCOM01-Calendar] Error fetching data:', err);
      setError('Error al cargar los datos');
    } finally {
      setIsFetchingData(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-gray-900">Seleccionar Fechas - SCOM01</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X size={24} className="text-gray-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="mb-6">
            <div className="flex gap-2 mb-4">
              <button
                onClick={() => setSelectionMode('single')}
                className={`flex-1 py-3 px-4 rounded-lg font-medium transition-colors ${selectionMode === 'single'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
              >
                Fecha Única
              </button>
              <button
                onClick={() => setSelectionMode('range')}
                className={`flex-1 py-3 px-4 rounded-lg font-medium transition-colors ${selectionMode === 'range'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
              >
                Rango de Fechas
              </button>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
              <p className="text-sm text-blue-900">
                {selectionMode === 'single'
                  ? 'Seleccione una fecha con datos disponibles'
                  : 'Seleccione dos fechas para definir el rango (máximo 31 días)'}
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
                      onClick={() => handleDateClick(day.dateStr, day.isAvailable)}
                      disabled={!day.isAvailable || loadingDates}
                      className={`p-4 rounded-lg text-sm font-medium transition-all
                        ${!day.isCurrentMonth ? 'text-gray-300' : ''}
                        ${day.isAvailable
                          ? 'cursor-pointer hover:bg-blue-50'
                          : 'cursor-not-allowed opacity-40'
                        }
                        ${isSelected && !isRangeStart && !isRangeEnd
                          ? 'bg-blue-100 text-blue-900'
                          : ''
                        }
                        ${(isRangeStart || isRangeEnd)
                          ? 'bg-blue-600 text-white hover:bg-blue-700'
                          : ''
                        }
                      `}
                    >
                      {day.date.getDate()}
                    </button>
                  );
                })}
              </div>
            </div>

            {(selectedDate || (rangeStart && rangeEnd)) && (
              <div className="mt-4 bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-center gap-2 text-green-900">
                  <CheckCircle size={20} />
                  <span className="font-medium">
                    {selectionMode === 'single'
                      ? `Fecha seleccionada: ${selectedDate}`
                      : `Rango: ${rangeStart} a ${rangeEnd}`
                    }
                  </span>
                </div>
              </div>
            )}
          </div>

          <button
            onClick={fetchData}
            disabled={
              isFetchingData ||
              (selectionMode === 'single' ? !selectedDate : (!rangeStart || !rangeEnd))
            }
            className="w-full py-4 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isFetchingData ? (
              <>
                <RefreshCw size={20} className="animate-spin" />
                <span>Cargando datos...</span>
              </>
            ) : (
              <>
                <Search size={20} />
                <span>Cargar Datos</span>
              </>
            )}
          </button>

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