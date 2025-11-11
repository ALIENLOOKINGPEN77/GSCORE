"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  X,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Search,
  Download,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  FileSpreadsheet,
  FileDown,
  ChevronDown
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
import { generateSCOM01CompuestoPdf } from "../../../lib/utils/pdfDocumentGenerator-SCOM01-compuesto";
import { generateSCOM01CompuestoUnicoPdf } from "../../../lib/utils/pdfDocumentGenerator-SCOM01-compuesto-unico";
import * as XLSX from 'xlsx';

type SelectionMode = 'single' | 'range';
type MainFilterType = 'internal' | 'external' | null;

type CargaFlota = {
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

type CargaExterna = {
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

type CargaDisplay = CargaFlota | CargaExterna;

interface SCOM01CompuestoProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SCOM01Compuesto({ isOpen, onClose }: SCOM01CompuestoProps) {
  const [selectionMode, setSelectionMode] = useState<SelectionMode>('single');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [availableDates, setAvailableDates] = useState<Set<string>>(new Set());
  const [loadingDates, setLoadingDates] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [rangeStart, setRangeStart] = useState<string | null>(null);
  const [rangeEnd, setRangeEnd] = useState<string | null>(null);
  const [fetchedEntries, setFetchedEntries] = useState<CargaDisplay[]>([]);
  const [isFetchingData, setIsFetchingData] = useState(false);
  const [dataFetched, setDataFetched] = useState(false);

  const [mainFilter, setMainFilter] = useState<MainFilterType>(null);
  const [selectedSubFilters, setSelectedSubFilters] = useState<{
    nroMovil: string[];
    empresa: string[];
    numeroChapa: string[];
  }>({
    nroMovil: [],
    empresa: [],
    numeroChapa: []
  });

  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const dropdownRefs = {
    nroMovil: useRef<HTMLDivElement>(null),
    empresa: useRef<HTMLDivElement>(null),
    numeroChapa: useRef<HTMLDivElement>(null)
  };

  const [error, setError] = useState<string | null>(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [isGeneratingExcel, setIsGeneratingExcel] = useState(false);
  const [totalizadorInicial, setTotalizadorInicial] = useState<string>('');
  const [totalizadorFinal, setTotalizadorFinal] = useState<string>('');

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      const clickedOutside = Object.values(dropdownRefs).every(
        ref => ref.current && !ref.current.contains(target)
      );
      if (clickedOutside) {
        setOpenDropdown(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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
        console.log('[SCOM01-Compuesto] Loaded available dates:', dates.size);
      } catch (err) {
        console.error('[SCOM01-Compuesto] Error loading dates:', err);
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
      setFetchedEntries([]);
      setDataFetched(false);
      setMainFilter(null);
      setSelectedSubFilters({ nroMovil: [], empresa: [], numeroChapa: [] });
      setOpenDropdown(null);
      setError(null);
      setTotalizadorInicial('');
      setTotalizadorFinal('');
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

  const parseDateStr = (dateStr: string): Date | null => {
    const [day, month, year] = dateStr.split('-').map(Number);
    if (!day || !month || !year) return null;
    return new Date(year, month - 1, day);
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

      for (const dateStr of datesToFetch) {
        if (!availableDates.has(dateStr)) continue;

        const docRef = doc(db, 'SCOM01', dateStr);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const docData = docSnap.data();

          if (selectionMode === 'single' && datesToFetch.length === 1) {
            setTotalizadorInicial(docData.docData?.Tinicial || '');
            setTotalizadorFinal(docData.docData?.Tfinal || '');
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
      }

      allEntries.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

      setFetchedEntries(allEntries);
      setDataFetched(true);

      console.log('[SCOM01-Compuesto] Fetched entries:', allEntries.length);

      if (allEntries.length === 0) {
        setError('No se encontraron datos en las fechas seleccionadas');
      }
    } catch (err) {
      console.error('[SCOM01-Compuesto] Error fetching data:', err);
      setError('Error al cargar los datos');
    } finally {
      setIsFetchingData(false);
    }
  };

  const filterOptions = useMemo(() => {
    const nroMoviles = new Set<string>();
    const empresas = new Set<string>();
    const numeroChapas = new Set<string>();

    fetchedEntries.forEach(entry => {
      if (entry.type === 'flota') {
        if (entry.NroMovil) nroMoviles.add(entry.NroMovil);
      } else {
        if (entry.Empresa) empresas.add(entry.Empresa);
        if (entry.NumeroChapa) numeroChapas.add(entry.NumeroChapa);
      }
    });

    return {
      nroMoviles: Array.from(nroMoviles).sort(),
      empresas: Array.from(empresas).sort(),
      numeroChapas: Array.from(numeroChapas).sort()
    };
  }, [fetchedEntries]);

  const filteredEntries = useMemo(() => {
    let entries = fetchedEntries;

    if (mainFilter === 'internal') {
      entries = entries.filter(entry => entry.type === 'flota');
    } else if (mainFilter === 'external') {
      entries = entries.filter(entry => entry.type === 'externa');
    }

    if (mainFilter === 'internal' && selectedSubFilters.nroMovil.length > 0) {
      entries = entries.filter(entry =>
        entry.type === 'flota' && selectedSubFilters.nroMovil.includes((entry as CargaFlota).NroMovil)
      );
    }

    if (mainFilter === 'external') {
      if (selectedSubFilters.empresa.length > 0) {
        entries = entries.filter(entry =>
          entry.type === 'externa' && selectedSubFilters.empresa.includes((entry as CargaExterna).Empresa)
        );
      }
      if (selectedSubFilters.numeroChapa.length > 0) {
        entries = entries.filter(entry =>
          entry.type === 'externa' && selectedSubFilters.numeroChapa.includes((entry as CargaExterna).NumeroChapa)
        );
      }
    }

    return entries;
  }, [fetchedEntries, mainFilter, selectedSubFilters]);

  const handleMainFilterChange = (filterType: MainFilterType) => {
    if (mainFilter === filterType) {
      setMainFilter(null);
      setSelectedSubFilters({ nroMovil: [], empresa: [], numeroChapa: [] });
    } else {
      setMainFilter(filterType);
      setSelectedSubFilters({ nroMovil: [], empresa: [], numeroChapa: [] });
    }
    setOpenDropdown(null);
  };

  const handleSubFilterToggle = (filterType: 'nroMovil' | 'empresa' | 'numeroChapa', value: string) => {
    setSelectedSubFilters(prev => {
      const current = prev[filterType];
      if (current.includes(value)) {
        return { ...prev, [filterType]: current.filter(v => v !== value) };
      } else {
        return { ...prev, [filterType]: [...current, value] };
      }
    });
  };

  const handleGeneratePdf = async () => {
    if (filteredEntries.length === 0) {
      setError('No hay datos para generar el PDF');
      return;
    }

    setIsGeneratingPdf(true);
    try {
      const dateRange = getDatesInRange();
      const startDate = dateRange[0];
      const endDate = dateRange[dateRange.length - 1];

      let filterInfo: any = undefined;
      if (mainFilter) {
        const activeSubFilters: string[] = [];
        if (mainFilter === 'internal' && selectedSubFilters.nroMovil.length > 0) {
          activeSubFilters.push(...selectedSubFilters.nroMovil);
        }
        if (mainFilter === 'external') {
          if (selectedSubFilters.empresa.length > 0) {
            activeSubFilters.push(...selectedSubFilters.empresa);
          }
          if (selectedSubFilters.numeroChapa.length > 0) {
            activeSubFilters.push(...selectedSubFilters.numeroChapa);
          }
        }

        if (activeSubFilters.length > 0) {
          filterInfo = {
            type: mainFilter === 'internal' ? 'nroMovil' : 'empresa',
            values: activeSubFilters
          };
        }
      }

      if (selectionMode === 'single') {
        await generateSCOM01CompuestoUnicoPdf(
          filteredEntries,
          startDate,
          filterInfo,
          totalizadorInicial,
          totalizadorFinal
        );
      } else {
        await generateSCOM01CompuestoPdf(
          filteredEntries,
          startDate,
          endDate,
          filterInfo
        );
      }
    } catch (err) {
      console.error('[SCOM01-Compuesto] Error generating PDF:', err);
      setError('Error al generar el PDF');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handleGenerateExcel = async () => {
    if (filteredEntries.length === 0) {
      setError('No hay datos para generar el Excel');
      return;
    }

    setIsGeneratingExcel(true);
    try {
      const dateRange = getDatesInRange();
      const startDate = dateRange[0];
      const endDate = dateRange[dateRange.length - 1];

      const formatDateForDisplay = (dateStr: string) => {
        const [day, month, year] = dateStr.split('-');
        return `${day}/${month}/${year}`;
      };

      const excelData = filteredEntries.map((entry, index) => {
        if (entry.type === 'flota') {
          return {
            'N°': index + 1,
            'Tipo': 'Interno',
            'Fecha': formatDateForDisplay(entry.sourceDate),
            'Nro Móvil': entry.NroMovil,
            'Chofer': entry.Chofer,
            'Litros': entry.Litros,
            'Hora': entry.HoraCarga,
            'Kilometraje': entry.Kilometraje || '-',
            'Horometro': entry.Horometro || '-',
            'Precinto': entry.Precinto || '-',
            'Firma': entry.HasFirma ? 'Sí' : 'No'
          };
        } else {
          return {
            'N°': index + 1,
            'Tipo': 'Externo',
            'Fecha': formatDateForDisplay(entry.sourceDate),
            'Empresa': entry.Empresa,
            'Nro Chapa': entry.NumeroChapa,
            'Chofer': entry.NombreChofer,
            'Litros': entry.LitrosCargados,
            'Hora': entry.Hora,
            'Kilometraje': entry.Kilometraje || '-',
            'Horometro': entry.Horometro || '-',
            'Precinto': entry.Precinto || '-',
            'Firma': entry.HasFirma ? 'Sí' : 'No'
          };
        }
      });

      const ws = XLSX.utils.json_to_sheet(excelData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Registros');

      const fileName = selectionMode === 'single'
        ? `SCOM01_${startDate}.xlsx`
        : `SCOM01_${startDate}_a_${endDate}.xlsx`;

      XLSX.writeFile(wb, fileName);
    } catch (err) {
      console.error('[SCOM01-Compuesto] Error generating Excel:', err);
      setError('Error al generar el Excel');
    } finally {
      setIsGeneratingExcel(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-gray-900">Documento Compuesto - SCOM01</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X size={24} className="text-gray-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {!dataFetched ? (
            <>
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
                          className={` p-4 rounded-lg text-sm font-medium transition-all
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
            </>
          ) : (
            <>
              {selectionMode === 'single' && totalizadorInicial && totalizadorFinal && (
                <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h3 className="text-sm font-medium text-blue-900 mb-3">Totalizadores</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-xs text-blue-700 mb-1">Inicial</div>
                      <div className="text-lg font-semibold text-blue-900">
                        {totalizadorInicial || '-'}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-blue-700 mb-1">Final</div>
                      <div className="text-lg font-semibold text-blue-900">
                        {totalizadorFinal || '-'}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Filtros</h3>

                <div className="space-y-4">
                  {/* Internal Fleet Toggle */}
                  <div className="border rounded-lg p-4">
                    <div className="flex items-center gap-4">
                      <input
                        type="checkbox"
                        checked={mainFilter === 'internal'}
                        onChange={() => handleMainFilterChange('internal')}
                        className="w-5 h-5 text-blue-600 cursor-pointer"
                        style={{ transform: 'scale(1.3)' }}
                      />
                      <label className="font-medium text-gray-900 flex-1">
                        Vehículos Internos
                      </label>
                    </div>

                    {/* Internal Sub-filter Dropdown */}
                    {filterOptions.nroMoviles.length > 0 && (
                      <div className="mt-3 relative" ref={dropdownRefs.nroMovil}>
                        <button
                          onClick={() => setOpenDropdown(openDropdown === 'nroMovil' ? null : 'nroMovil')}
                          disabled={mainFilter !== 'internal'}
                          className={`w-full px-4 py-2 border rounded-md text-left flex items-center justify-between ${mainFilter === 'internal'
                              ? 'bg-white border-gray-300 hover:bg-gray-50 cursor-pointer'
                              : 'bg-gray-200 border-gray-200 cursor-not-allowed opacity-60'
                            }`}
                        >
                          <span className="text-sm">
                            {selectedSubFilters.nroMovil.length > 0
                              ? `${selectedSubFilters.nroMovil.length} móvil(es) seleccionado(s)`
                              : 'Nro. Móvil...'}
                          </span>
                          <ChevronDown size={16} />
                        </button>

                        {openDropdown === 'nroMovil' && mainFilter === 'internal' && (
                          <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-300 rounded-md shadow-lg z-50 max-h-60 overflow-y-auto">
                            {filterOptions.nroMoviles.map(movil => (
                              <label
                                key={movil}
                                className="flex items-center gap-2 px-4 py-2 hover:bg-gray-50 cursor-pointer"
                              >
                                <input
                                  type="checkbox"
                                  checked={selectedSubFilters.nroMovil.includes(movil)}
                                  onChange={() => handleSubFilterToggle('nroMovil', movil)}
                                  className="w-4 h-4 text-blue-600"
                                />
                                <span className="text-sm">{movil}</span>
                              </label>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* External Fleet Toggle */}
                  <div className="border rounded-lg p-4">
                    <div className="flex items-center gap-4">
                      <input
                        type="checkbox"
                        checked={mainFilter === 'external'}
                        onChange={() => handleMainFilterChange('external')}
                        className="w-5 h-5 text-blue-600 cursor-pointer"
                        style={{ transform: 'scale(1.3)' }}
                      />
                      <label className="font-medium text-gray-900 flex-1">
                        Vehículos Externos
                      </label>
                    </div>

                    {/* External Sub-filter Dropdowns */}
                    <div className="mt-3 space-y-2">
                      {filterOptions.empresas.length > 0 && (
                        <div className="relative" ref={dropdownRefs.empresa}>
                          <button
                            onClick={() => setOpenDropdown(openDropdown === 'empresa' ? null : 'empresa')}
                            disabled={mainFilter !== 'external'}
                            className={`w-full px-4 py-2 border rounded-md text-left flex items-center justify-between ${mainFilter === 'external'
                                ? 'bg-white border-gray-300 hover:bg-gray-50 cursor-pointer'
                                : 'bg-gray-200 border-gray-200 cursor-not-allowed opacity-60'
                              }`}
                          >
                            <span className="text-sm">
                              {selectedSubFilters.empresa.length > 0
                                ? `${selectedSubFilters.empresa.length} empresa(s) seleccionada(s)`
                                : 'Empresa...'}
                            </span>
                            <ChevronDown size={16} />
                          </button>

                          {openDropdown === 'empresa' && mainFilter === 'external' && (
                            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-300 rounded-md shadow-lg z-50 max-h-60 overflow-y-auto">
                              {filterOptions.empresas.map(empresa => (
                                <label
                                  key={empresa}
                                  className="flex items-center gap-2 px-4 py-2 hover:bg-gray-50 cursor-pointer"
                                >
                                  <input
                                    type="checkbox"
                                    checked={selectedSubFilters.empresa.includes(empresa)}
                                    onChange={() => handleSubFilterToggle('empresa', empresa)}
                                    className="w-4 h-4 text-blue-600"
                                  />
                                  <span className="text-sm">{empresa}</span>
                                </label>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {filterOptions.numeroChapas.length > 0 && (
                        <div className="relative" ref={dropdownRefs.numeroChapa}>
                          <button
                            onClick={() => setOpenDropdown(openDropdown === 'numeroChapa' ? null : 'numeroChapa')}
                            disabled={mainFilter !== 'external'}
                            className={`w-full px-4 py-2 border rounded-md text-left flex items-center justify-between ${mainFilter === 'external'
                                ? 'bg-white border-gray-300 hover:bg-gray-50 cursor-pointer'
                                : 'bg-gray-200 border-gray-200 cursor-not-allowed opacity-60'
                              }`}
                          >
                            <span className="text-sm">
                              {selectedSubFilters.numeroChapa.length > 0
                                ? `${selectedSubFilters.numeroChapa.length} chapa(s) seleccionada(s)`
                                : 'Nro. Chapa...'}
                            </span>
                            <ChevronDown size={16} />
                          </button>

                          {openDropdown === 'numeroChapa' && mainFilter === 'external' && (
                            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-300 rounded-md shadow-lg z-50 max-h-60 overflow-y-auto">
                              {filterOptions.numeroChapas.map(chapa => (
                                <label
                                  key={chapa}
                                  className="flex items-center gap-2 px-4 py-2 hover:bg-gray-50 cursor-pointer"
                                >
                                  <input
                                    type="checkbox"
                                    checked={selectedSubFilters.numeroChapa.includes(chapa)}
                                    onChange={() => handleSubFilterToggle('numeroChapa', chapa)}
                                    className="w-4 h-4 text-blue-600"
                                  />
                                  <span className="text-sm">{chapa}</span>
                                </label>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="text-sm text-gray-600 mb-2">
                  {filteredEntries.length} {filteredEntries.length === 1 ? 'registro encontrado' : 'registros encontrados'}
                </div>

                <button
                  onClick={handleGeneratePdf}
                  disabled={isGeneratingPdf || isGeneratingExcel || filteredEntries.length === 0}
                  className="w-full h-20 bg-red-50 border-2 border-red-200 rounded-lg hover:bg-red-100 transition-all duration-200 flex items-center justify-center gap-4 group disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isGeneratingPdf ? (
                    <RefreshCw size={28} className="text-red-600 animate-spin" />
                  ) : (
                    <FileDown size={28} className="text-red-600 group-hover:scale-110 transition-transform" />
                  )}
                  <div className="text-left">
                    <div className="text-red-900 font-semibold text-lg">
                      {isGeneratingPdf ? 'Generando PDF...' : 'Descargar PDF'}
                    </div>
                    <div className="text-red-700 text-sm">
                      Documento con formato oficial
                    </div>
                  </div>
                </button>

                <button
                  onClick={handleGenerateExcel}
                  disabled={isGeneratingPdf || isGeneratingExcel || filteredEntries.length === 0}
                  className="w-full h-20 bg-green-50 border-2 border-green-200 rounded-lg hover:bg-green-100 transition-all duration-200 flex items-center justify-center gap-4 group disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isGeneratingExcel ? (
                    <RefreshCw size={28} className="text-green-600 animate-spin" />
                  ) : (
                    <FileSpreadsheet size={28} className="text-green-600 group-hover:scale-110 transition-transform" />
                  )}
                  <div className="text-left">
                    <div className="text-green-900 font-semibold text-lg">
                      {isGeneratingExcel ? 'Generando Excel...' : 'Descargar Excel'}
                    </div>
                    <div className="text-green-700 text-sm">
                      Archivo editable para análisis
                    </div>
                  </div>
                </button>

                <button
                  onClick={() => {
                    setDataFetched(false);
                    setFetchedEntries([]);
                    setMainFilter(null);
                    setSelectedSubFilters({ nroMovil: [], empresa: [], numeroChapa: [] });
                    setOpenDropdown(null);
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