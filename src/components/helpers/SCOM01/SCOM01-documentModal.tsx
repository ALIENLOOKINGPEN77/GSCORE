"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import {
    X,
    RefreshCw,
    AlertCircle,
    FileSpreadsheet,
    FileDown,
    ChevronDown
} from "lucide-react";
import { generateSCOM01CompuestoPdf } from "../../../lib/utils/pdfDocumentGenerator-SCOM01-compuesto";
import { generateSCOM01CompuestoUnicoPdf } from "../../../lib/utils/pdfDocumentGenerator-SCOM01-compuesto-unico";
import { generateSCOM01CompuestoVehiculoPdf } from "../../../lib/utils/pdfDocumentGenerator-SCOM01-compuesto-vehiculo";
import * as XLSX from 'xlsx';
import type { CargaDisplay, CargaFlota, CargaExterna, FetchedData } from './SCOM01-calendarModal';

type MainFilterType = 'internal' | 'external' | null;

interface SCOM01DocumentModalProps {
    isOpen: boolean;
    onClose: () => void;
    data: FetchedData | null;
    onNewSearch: () => void;
}

export default function SCOM01DocumentModal({
    isOpen,
    onClose,
    data,
    onNewSearch
}: SCOM01DocumentModalProps) {
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
    const [isGeneratingVehiculoPdf, setIsGeneratingVehiculoPdf] = useState(false);

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
        if (!isOpen) {
            setMainFilter(null);
            setSelectedSubFilters({ nroMovil: [], empresa: [], numeroChapa: [] });
            setOpenDropdown(null);
            setError(null);
        }
    }, [isOpen]);

    const filterOptions = useMemo(() => {
        if (!data) return { nroMoviles: [], empresas: [], numeroChapas: [] };

        const nroMoviles = new Set<string>();
        const empresas = new Set<string>();
        const numeroChapas = new Set<string>();

        data.entries.forEach(entry => {
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
    }, [data]);

    const filteredEntries = useMemo(() => {
        if (!data) return [];

        let entries = data.entries;

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
    }, [data, mainFilter, selectedSubFilters]);

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
        if (!data || filteredEntries.length === 0) {
            setError('No hay datos para generar el PDF');
            return;
        }

        setIsGeneratingPdf(true);
        try {
            const startDate = data.dateRange[0];
            const endDate = data.dateRange[data.dateRange.length - 1];

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

            if (data.selectionMode === 'single') {
                await generateSCOM01CompuestoUnicoPdf(
                    filteredEntries,
                    startDate,
                    filterInfo,
                    data.totalizadorInicial,
                    data.totalizadorFinal
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
            console.error('[SCOM01-Document] Error generating PDF:', err);
            setError('Error al generar el PDF');
        } finally {
            setIsGeneratingPdf(false);
        }
    };

    // Add handler function
    const handleGenerateVehiculoPdf = async () => {
        if (!data || filteredEntries.length === 0) {
            setError('No hay datos para generar el PDF');
            return;
        }

        setIsGeneratingVehiculoPdf(true);
        try {
            const startDate = data.dateRange[0];
            const endDate = data.dateRange[data.dateRange.length - 1];

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

            await generateSCOM01CompuestoVehiculoPdf(
                filteredEntries,
                startDate,
                endDate,
                filterInfo
            );
        } catch (err) {
            console.error('[SCOM01-Document] Error generating Vehiculo PDF:', err);
            setError('Error al generar el PDF por vehículo');
        } finally {
            setIsGeneratingVehiculoPdf(false);
        }
    };

    const handleGenerateExcel = async () => {
        if (!data || filteredEntries.length === 0) {
            setError('No hay datos para generar el Excel');
            return;
        }

        setIsGeneratingExcel(true);
        try {
            const startDate = data.dateRange[0];
            const endDate = data.dateRange[data.dateRange.length - 1];

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

            const fileName = data.selectionMode === 'single'
                ? `SCOM01_${startDate}.xlsx`
                : `SCOM01_${startDate}_a_${endDate}.xlsx`;

            XLSX.writeFile(wb, fileName);
        } catch (err) {
            console.error('[SCOM01-Document] Error generating Excel:', err);
            setError('Error al generar el Excel');
        } finally {
            setIsGeneratingExcel(false);
        }
    };

    if (!isOpen || !data) return null;

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col">
                <div className="flex items-center justify-between p-6 border-b border-gray-200">
                    <h2 className="text-2xl font-bold text-gray-900">Generar Documento - SCOM01</h2>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        <X size={24} className="text-gray-500" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6">
                    {data.selectionMode === 'single' && data.totalizadorInicial && data.totalizadorFinal && (
                        <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
                            <h3 className="text-sm font-medium text-blue-900 mb-3">Totalizadores</h3>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <div className="text-xs text-blue-700 mb-1">Inicial</div>
                                    <div className="text-lg font-semibold text-blue-900">
                                        {data.totalizadorInicial || '-'}
                                    </div>
                                </div>
                                <div>
                                    <div className="text-xs text-blue-700 mb-1">Final</div>
                                    <div className="text-lg font-semibold text-blue-900">
                                        {data.totalizadorFinal || '-'}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="mb-6">
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">Filtros</h3>

                        <div className="space-y-4">
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
                            onClick={handleGenerateVehiculoPdf}
                            disabled={isGeneratingPdf || isGeneratingVehiculoPdf || isGeneratingExcel || filteredEntries.length === 0}
                            className="w-full h-20 bg-purple-50 border-2 border-purple-200 rounded-lg hover:bg-purple-100 transition-all duration-200 flex items-center justify-center gap-4 group disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isGeneratingVehiculoPdf ? (
                                <RefreshCw size={28} className="text-purple-600 animate-spin" />
                            ) : (
                                <FileDown size={28} className="text-purple-600 group-hover:scale-110 transition-transform" />
                            )}
                            <div className="text-left">
                                <div className="text-purple-900 font-semibold text-lg">
                                    {isGeneratingVehiculoPdf ? 'Generando PDF...' : 'Descargar PDF por Vehículo'}
                                </div>
                                <div className="text-purple-700 text-sm">
                                    Agrupado por vehículo con subtotales
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
                            onClick={onNewSearch}
                            className="w-full px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                        >
                            Nueva Búsqueda
                        </button>
                    </div>

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