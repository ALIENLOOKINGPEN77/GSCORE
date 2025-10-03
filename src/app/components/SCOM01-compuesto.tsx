"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
    X,
    Calendar,
    ChevronLeft,
    ChevronRight,
    Search,
    Download,
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
import { db } from "../lib/firebase/client";
import { generateSCOM01CompuestoPdf } from "../lib/utils/pdfDocumentGenerator-SCOM01-compuesto";

type SelectionMode = 'single' | 'range';

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

type FilterType = 'nroMovil' | 'empresa' | 'numeroChapa' | null;

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
    const [activeFilter, setActiveFilter] = useState<FilterType>(null);
    const [selectedFilterValue, setSelectedFilterValue] = useState<string>('');
    const [error, setError] = useState<string | null>(null);
    const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

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
            setActiveFilter(null);
            setSelectedFilterValue('');
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
        if (!activeFilter || !selectedFilterValue) {
            return fetchedEntries;
        }

        return fetchedEntries.filter(entry => {
            switch (activeFilter) {
                case 'nroMovil':
                    return entry.type === 'flota' && (entry as CargaFlota).NroMovil === selectedFilterValue;
                case 'empresa':
                    return entry.type === 'externa' && (entry as CargaExterna).Empresa === selectedFilterValue;
                case 'numeroChapa':
                    return entry.type === 'externa' && (entry as CargaExterna).NumeroChapa === selectedFilterValue;
                default:
                    return true;
            }
        });
    }, [fetchedEntries, activeFilter, selectedFilterValue]);

    const handleFilterChange = (filterType: FilterType) => {
        if (activeFilter === filterType) {
            setActiveFilter(null);
            setSelectedFilterValue('');
        } else {
            setActiveFilter(filterType);
            setSelectedFilterValue('');
        }
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

            await generateSCOM01CompuestoPdf(
                filteredEntries,
                startDate,
                endDate,
                activeFilter && selectedFilterValue ? {
                    type: activeFilter,
                    values: [selectedFilterValue]
                } : undefined
            );
        } catch (err) {
            console.error('[SCOM01-Compuesto] Error generating PDF:', err);
            setError('Error al generar el PDF');
        } finally {
            setIsGeneratingPdf(false);
        }
    };

    if (!isOpen) return null;

    const monthNames = [
        'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
        'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-5xl w-full max-h-[90vh] overflow-y-auto">
                <div className="p-6 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white z-10">
                    <h2 className="text-xl font-semibold text-gray-900">
                        Documento Compuesto - Selección de Datos
                    </h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                        <X size={24} />
                    </button>
                </div>

                <div className="p-6 space-y-6">
                    {!dataFetched && (
                        <>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-3">
                                    Modo de Selección
                                </label>
                                <div className="flex gap-4">
                                    <button
                                        onClick={() => {
                                            setSelectionMode('single');
                                            setRangeStart(null);
                                            setRangeEnd(null);
                                        }}
                                        className={`flex-1 px-4 py-3 rounded-lg border-2 transition-colors ${selectionMode === 'single'
                                            ? 'border-blue-500 bg-blue-50 text-blue-700'
                                            : 'border-gray-300 hover:border-gray-400'
                                            }`}
                                    >
                                        <div className="font-medium">Fecha Única</div>
                                        <div className="text-xs text-gray-500 mt-1">Seleccionar un día específico</div>
                                    </button>
                                    <button
                                        onClick={() => {
                                            setSelectionMode('range');
                                            setSelectedDate(null);
                                        }}
                                        className={`flex-1 px-4 py-3 rounded-lg border-2 transition-colors ${selectionMode === 'range'
                                            ? 'border-blue-500 bg-blue-50 text-blue-700'
                                            : 'border-gray-300 hover:border-gray-400'
                                            }`}
                                    >
                                        <div className="font-medium">Rango de Fechas</div>
                                        <div className="text-xs text-gray-500 mt-1">Hasta 31 días</div>
                                    </button>
                                </div>
                            </div>

                            <div className="border rounded-lg p-4">
                                <div className="flex items-center justify-between mb-4">
                                    <button
                                        onClick={() => navigateMonth(-1)}
                                        className="p-2 hover:bg-gray-100 rounded transition-colors"
                                    >
                                        <ChevronLeft size={20} />
                                    </button>
                                    <h3 className="text-lg font-semibold">
                                        {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
                                    </h3>
                                    <button
                                        onClick={() => navigateMonth(1)}
                                        className="p-2 hover:bg-gray-100 rounded transition-colors"
                                    >
                                        <ChevronRight size={20} />
                                    </button>
                                </div>

                                <div className="grid grid-cols-7 gap-2 mb-2">
                                    {['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'].map(day => (
                                        <div key={day} className="text-center text-xs font-medium text-gray-500 p-2">
                                            {day}
                                        </div>
                                    ))}
                                </div>

                                {/* FIXED: Calendar with consistent sizing */}
                                <div className="grid grid-cols-7 gap-2">
                                    {calendarDays.map((day, idx) => {
                                        const isSelected = isDateInRange(day.dateStr);
                                        const isDisabled = !day.isAvailable || !day.isCurrentMonth;

                                        return (
                                            <button
                                                key={idx}
                                                onClick={() => handleDateClick(day.dateStr, day.isAvailable)}
                                                disabled={isDisabled || loadingDates}
                                                className={`p-2 text-sm rounded transition-colors min-h-[36px] flex items-center justify-center border ${!day.isCurrentMonth
                                                    ? 'text-gray-300 border-transparent'
                                                    : isSelected
                                                        ? 'bg-blue-600 text-white border-blue-600'
                                                        : day.isAvailable
                                                            ? 'bg-white text-gray-700 hover:bg-gray-100 border-gray-300'
                                                            : 'bg-gray-100 text-gray-400 cursor-not-allowed border-transparent'
                                                    }`}
                                                style={{ fontWeight: isSelected ? 600 : 400 }}
                                            >
                                                {day.date.getDate()}
                                            </button>
                                        );
                                    })}
                                </div>

                                <div className="flex gap-4 mt-4 text-xs text-gray-600">
                                    <div className="flex items-center gap-2">
                                        <div className="w-4 h-4 border border-gray-300 bg-white rounded"></div>
                                        <span>Disponible</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="w-4 h-4 bg-gray-300 rounded"></div>
                                        <span>No disponible</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="w-4 h-4 bg-blue-600 rounded"></div>
                                        <span>Seleccionado</span>
                                    </div>
                                </div>
                            </div>
                            <button
                                onClick={fetchData}
                                disabled={isFetchingData || (!selectedDate && (!rangeStart || !rangeEnd))}
                                className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
                            >
                                {isFetchingData ? (
                                    <>
                                        <RefreshCw className="animate-spin" size={20} />
                                        Cargando datos...
                                    </>
                                ) : (
                                    <>
                                        <Search size={20} />
                                        Buscar Datos
                                    </>
                                )}
                            </button>
                        </>
                    )}

                    {dataFetched && (
                        <>
                            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                                <div className="flex items-center gap-2">
                                    <CheckCircle className="text-green-600" size={20} />
                                    <span className="font-medium text-green-900">Datos cargados exitosamente</span>
                                </div>
                            </div>

                            <div>
                                <h3 className="text-lg font-semibold text-gray-900 mb-4">Filtros Opcionales</h3>

                                <div className="space-y-4">
                                    {/* Internal Fleet Filter */}
                                    {filterOptions.nroMoviles.length > 0 && (
                                        <div className="border rounded-lg p-4">
                                            <div className="flex items-center gap-4">
                                                <input
                                                    type="checkbox"
                                                    checked={activeFilter === 'nroMovil'}
                                                    onChange={() => handleFilterChange('nroMovil')}
                                                    className="w-5 h-5 text-blue-600 cursor-pointer"
                                                    style={{ transform: 'scale(1.3)' }}
                                                />
                                                <label className="font-medium text-gray-900 flex-1">
                                                    Vehículos Internos - Nro. Móvil
                                                </label>

                                                <select
                                                    value={selectedFilterValue}
                                                    onChange={(e) => setSelectedFilterValue(e.target.value)}
                                                    disabled={activeFilter !== 'nroMovil'}
                                                    className={`px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[200px] transition-colors ${activeFilter === 'nroMovil'
                                                        ? 'bg-gray-50 cursor-pointer'
                                                        : 'bg-gray-200 cursor-not-allowed opacity-60'
                                                        }`}
                                                >
                                                    <option value="">Seleccionar móvil...</option>
                                                    {filterOptions.nroMoviles.map(movil => (
                                                        <option key={movil} value={movil}>{movil}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        </div>
                                    )}

                                    {/* External Fleet - Empresa Filter */}
                                    {filterOptions.empresas.length > 0 && (
                                        <div className="border rounded-lg p-4">
                                            <div className="flex items-center gap-4">
                                                <input
                                                    type="checkbox"
                                                    checked={activeFilter === 'empresa'}
                                                    onChange={() => handleFilterChange('empresa')}
                                                    className="w-5 h-5 text-blue-600 cursor-pointer"
                                                    style={{ transform: 'scale(1.3)' }}
                                                />
                                                <label className="font-medium text-gray-900 flex-1">
                                                    Vehículos Externos - Empresa
                                                </label>

                                                <select
                                                    value={selectedFilterValue}
                                                    onChange={(e) => setSelectedFilterValue(e.target.value)}
                                                    disabled={activeFilter !== 'empresa'}
                                                    className={`px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[200px] transition-colors ${activeFilter === 'empresa'
                                                        ? 'bg-gray-50 cursor-pointer'
                                                        : 'bg-gray-200 cursor-not-allowed opacity-60'
                                                        }`}
                                                >
                                                    <option value="">Seleccionar empresa...</option>
                                                    {filterOptions.empresas.map(empresa => (
                                                        <option key={empresa} value={empresa}>{empresa}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        </div>
                                    )}

                                    {/* External Fleet - NumeroChapa Filter */}
                                    {filterOptions.numeroChapas.length > 0 && (
                                        <div className="border rounded-lg p-4">
                                            <div className="flex items-center gap-4">
                                                <input
                                                    type="checkbox"
                                                    checked={activeFilter === 'numeroChapa'}
                                                    onChange={() => handleFilterChange('numeroChapa')}
                                                    className="w-5 h-5 text-blue-600 cursor-pointer"
                                                    style={{ transform: 'scale(1.3)' }}
                                                />
                                                <label className="font-medium text-gray-900 flex-1">
                                                    Vehículos Externos - Nro. Chapa
                                                </label>

                                                <select
                                                    value={selectedFilterValue}
                                                    onChange={(e) => setSelectedFilterValue(e.target.value)}
                                                    disabled={activeFilter !== 'numeroChapa'}
                                                    className={`px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[200px] transition-colors ${activeFilter === 'numeroChapa'
                                                            ? 'bg-gray-50 cursor-pointer'
                                                            : 'bg-gray-200 cursor-not-allowed opacity-60'
                                                        }`}
                                                >
                                                    <option value="">Seleccionar chapa...</option>
                                                    {filterOptions.numeroChapas.map(chapa => (
                                                        <option key={chapa} value={chapa}>{chapa}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="flex gap-3">
                                <button
                                    onClick={handleGeneratePdf}
                                    disabled={isGeneratingPdf || filteredEntries.length === 0}
                                    className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
                                >
                                    {isGeneratingPdf ? (
                                        <>
                                            <RefreshCw className="animate-spin" size={20} />
                                            Generando PDF...
                                        </>
                                    ) : (
                                        <>
                                            <Download size={20} />
                                            Descargar Documento ({filteredEntries.length} registros)
                                        </>
                                    )}
                                </button>

                                <button
                                    onClick={() => {
                                        setDataFetched(false);
                                        setFetchedEntries([]);
                                        setActiveFilter(null);
                                        setSelectedFilterValue('');
                                    }}
                                    className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                                >
                                    Nueva Búsqueda
                                </button>
                            </div>
                        </>
                    )}

                    {error && (
                        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-2">
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