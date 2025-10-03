// /app/components/modules/ASCOM01.tsx
// ASCOM01 — Administración de Entradas de Combustible (Retroactivas)
// Administrative module for creating/managing past fuel entries

"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    Calendar,
    Truck,
    User,
    FileText,
    Fuel,
    Clock,
    AlertCircle,
    CheckCircle,
    Plus,
    Trash2,
    Edit2,
    Save,
    X,
    Building,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    Shield
} from "lucide-react";
import { useAuth } from "../auth-context";
import {
    doc,
    getDoc,
    setDoc,
    updateDoc,
    serverTimestamp,
    Timestamp
} from "firebase/firestore";
import { db } from "../../lib/firebase/client";

// ---------------------------
// Types
// ---------------------------
type VehicleLoadEntry = {
    id: string;
    litros: string;
    nroMovil: string;
    chofer: string;
    horaCarga: string;
    kilometraje: string;
    horometro: string;
    precinto: string;
    hasFirma: boolean;
    firmaSvg: string;
    createdAt: number;
};

type ExternalLoadEntry = {
    id: string;
    empresa: string;
    numeroChapa: string;
    litrosCargados: string;
    nombreChofer: string;
    hora: string;
    kilometraje: string;
    horometro: string;
    precinto: string;
    hasFirma: boolean;
    firmaSvg: string;
    createdAt: number;
};

type TotalizerData = {
    tinicial: string;
    tfinal: string;
};

type SignatureData = {
    width: number;
    height: number;
    paths: Array<{
        d: string;
        strokeWidth: number;
    }>;
};

type Point = { x: number; y: number };
type Stroke = Point[];

// ---------------------------
// Signature Pad Component
// ---------------------------
const SignaturePad = ({
    onSave,
    disabled = false,
    initialSignature = null
}: {
    onSave: (signature: string) => void;
    disabled?: boolean;
    initialSignature?: string | null;
}) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [strokes, setStrokes] = useState<Stroke[]>([]);
    const [currentStroke, setCurrentStroke] = useState<Point[]>([]);

    const canvasWidth = 600;
    const canvasHeight = 300;

    // Load initial signature if provided
    useEffect(() => {
        if (initialSignature && canvasRef.current) {
            const canvas = canvasRef.current;
            const ctx = canvas.getContext('2d');
            if (!ctx) return;

            // Clear canvas
            ctx.clearRect(0, 0, canvasWidth, canvasHeight);

            // Create a temporary div to parse SVG
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = initialSignature;
            const svgElement = tempDiv.querySelector('svg');

            if (svgElement) {
                // Draw SVG paths onto canvas
                const paths = svgElement.querySelectorAll('path');
                paths.forEach(path => {
                    const d = path.getAttribute('d');
                    if (d) {
                        const path2d = new Path2D(d);
                        ctx.stroke(path2d);
                    }
                });
            }
        }
    }, [initialSignature]);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        ctx.clearRect(0, 0, canvasWidth, canvasHeight);

        strokes.forEach(stroke => {
            if (stroke.length < 2) return;

            ctx.beginPath();
            ctx.moveTo(stroke[0].x, stroke[0].y);
            stroke.slice(1).forEach(point => {
                ctx.lineTo(point.x, point.y);
            });
            ctx.stroke();
        });
    }, [strokes]);

    const getEventPoint = useCallback((e: React.MouseEvent | React.TouchEvent): Point => {
        const canvas = canvasRef.current;
        if (!canvas) return { x: 0, y: 0 };

        const rect = canvas.getBoundingClientRect();
        const scaleX = canvasWidth / rect.width;
        const scaleY = canvasHeight / rect.height;

        if ('touches' in e) {
            const touch = e.touches[0] || e.changedTouches[0];
            return {
                x: (touch.clientX - rect.left) * scaleX,
                y: (touch.clientY - rect.top) * scaleY
            };
        } else {
            return {
                x: (e.clientX - rect.left) * scaleX,
                y: (e.clientY - rect.top) * scaleY
            };
        }
    }, []);

    const handleStart = useCallback((e: React.MouseEvent | React.TouchEvent) => {
        if (disabled) return;
        e.preventDefault();
        setIsDrawing(true);
        const point = getEventPoint(e);
        setCurrentStroke([point]);
    }, [disabled, getEventPoint]);

    const handleMove = useCallback((e: React.MouseEvent | React.TouchEvent) => {
        if (!isDrawing || disabled) return;
        e.preventDefault();
        const point = getEventPoint(e);
        setCurrentStroke(prev => [...prev, point]);

        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!ctx || currentStroke.length === 0) return;

        ctx.beginPath();
        ctx.moveTo(currentStroke[currentStroke.length - 1].x, currentStroke[currentStroke.length - 1].y);
        ctx.lineTo(point.x, point.y);
        ctx.stroke();
    }, [isDrawing, disabled, getEventPoint, currentStroke]);

    const handleEnd = useCallback(() => {
        if (!isDrawing || disabled) return;
        setIsDrawing(false);
        if (currentStroke.length > 1) {
            setStrokes(prev => [...prev, currentStroke]);
        }
        setCurrentStroke([]);
    }, [isDrawing, disabled, currentStroke]);

    const handleClear = useCallback(() => {
        if (disabled) return;
        setStrokes([]);
        setCurrentStroke([]);
    }, [disabled]);

    const convertToSVG = useCallback((): string => {
        if (strokes.length === 0) return "";

        const paths = strokes.map(stroke => {
            if (stroke.length < 2) return "";

            let d = `M ${stroke[0].x} ${stroke[0].y}`;
            for (let i = 1; i < stroke.length; i++) {
                d += ` L ${stroke[i].x} ${stroke[i].y}`;
            }

            return `<path d="${d}" stroke="black" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
        }).filter(p => p !== '').join('');

        return `<?xml version="1.0" encoding="UTF-8"?><svg xmlns="http://www.w3.org/2000/svg" width="${canvasWidth}" height="${canvasHeight}" viewBox="0 0 ${canvasWidth} ${canvasHeight}">${paths}</svg>`;
    }, [strokes]);

    const handleSave = useCallback(() => {
        if (disabled || strokes.length === 0) return;
        const svg = convertToSVG();
        onSave(svg);
    }, [disabled, strokes, convertToSVG, onSave]);

    const hasSignature = strokes.length > 0;

    return (
        <div className="flex flex-col gap-3">
            <div className="relative border-2 border-dashed border-gray-300 rounded-lg bg-white">
                <canvas
                    ref={canvasRef}
                    width={canvasWidth}
                    height={canvasHeight}
                    className={`w-full touch-none border border-gray-200 rounded-md ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-crosshair'
                        }`}
                    onMouseDown={handleStart}
                    onMouseMove={handleMove}
                    onMouseUp={handleEnd}
                    onMouseLeave={handleEnd}
                    onTouchStart={handleStart}
                    onTouchMove={handleMove}
                    onTouchEnd={handleEnd}
                    style={{
                        maxHeight: '150px',
                        aspectRatio: `${canvasWidth}/${canvasHeight}`
                    }}
                />

                {!hasSignature && !disabled && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <span className="text-gray-400 text-sm">Firme aquí</span>
                    </div>
                )}
            </div>

            <div className="flex gap-2">
                <button
                    type="button"
                    onClick={handleClear}
                    disabled={disabled || !hasSignature}
                    className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 bg-gray-100 rounded-md hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                    <Trash2 size={14} />
                    Limpiar
                </button>

                <button
                    type="button"
                    onClick={handleSave}
                    disabled={disabled || !hasSignature}
                    className="flex items-center gap-2 px-4 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium flex-1 justify-center"
                >
                    <CheckCircle size={14} />
                    Guardar Firma
                </button>
            </div>
        </div>
    );
};

// ---------------------------
// Date Picker Component
// ---------------------------
const DatePicker = ({
    value,
    onChange,
    error,
    disabled = false,
    maxDate = new Date()
}: {
    value: string;
    onChange: (value: string) => void;
    error?: string;
    disabled?: boolean;
    maxDate?: Date;
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [viewMonth, setViewMonth] = useState(value ? new Date(value + 'T00:00:00') : new Date());

    const selectedDate = value ? new Date(value + 'T00:00:00') : null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const generateCalendarDays = () => {
        const year = viewMonth.getFullYear();
        const month = viewMonth.getMonth();

        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const startDate = new Date(firstDay);
        startDate.setDate(startDate.getDate() - firstDay.getDay());

        const days = [];
        const current = new Date(startDate);

        for (let i = 0; i < 42; i++) {
            days.push(new Date(current));
            current.setDate(current.getDate() + 1);
        }

        return days;
    };

    const days = generateCalendarDays();
    const monthNames = [
        'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
        'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];

    const handleDateSelect = (date: Date) => {
        const formatted = date.toISOString().split('T')[0];
        onChange(formatted);
        setIsOpen(false);
    };

    const navigateMonth = (direction: number) => {
        setViewMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + direction, 1));
    };

    return (
        <div className="flex flex-col">
            <label className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                <Calendar size={16} className="text-gray-400" />
                Fecha del Documento
            </label>

            <div className="relative">
                <button
                    type="button"
                    onClick={() => !disabled && setIsOpen(!isOpen)}
                    disabled={disabled}
                    className={`w-full px-3 py-2 border rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 flex items-center justify-between ${error ? 'border-red-300 bg-red-50' : 'border-gray-300'
                        } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                    <span className={value ? 'text-gray-900' : 'text-gray-500'}>
                        {selectedDate ? selectedDate.toLocaleDateString('es-ES') : 'Seleccionar fecha'}
                    </span>
                    <Calendar size={16} className="text-gray-400" />
                </button>

                {isOpen && (
                    <div className="absolute z-20 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg p-4">
                        <div className="flex items-center justify-between mb-4">
                            <button
                                type="button"
                                onClick={() => navigateMonth(-1)}
                                className="p-1 hover:bg-gray-100 rounded"
                            >
                                <ChevronLeft size={16} />
                            </button>
                            <span className="font-semibold">
                                {monthNames[viewMonth.getMonth()]} {viewMonth.getFullYear()}
                            </span>
                            <button
                                type="button"
                                onClick={() => navigateMonth(1)}
                                className="p-1 hover:bg-gray-100 rounded"
                            >
                                <ChevronRight size={16} />
                            </button>
                        </div>

                        <div className="grid grid-cols-7 gap-1 mb-2">
                            {['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'].map(day => (
                                <div key={day} className="text-center text-xs font-medium text-gray-500 p-2">
                                    {day}
                                </div>
                            ))}
                        </div>

                        <div className="grid grid-cols-7 gap-1">
                            {days.map((day, index) => {
                                const isCurrentMonth = day.getMonth() === viewMonth.getMonth();
                                const isSelected = selectedDate && day.getTime() === selectedDate.getTime();
                                const isToday = day.getTime() === today.getTime();
                                const isFuture = day > maxDate;

                                return (
                                    <button
                                        key={index}
                                        type="button"
                                        onClick={() => !isFuture && handleDateSelect(day)}
                                        disabled={isFuture}
                                        className={`p-2 text-sm rounded transition-colors ${!isCurrentMonth
                                            ? 'text-gray-300'
                                            : isFuture
                                                ? 'text-gray-300 cursor-not-allowed'
                                                : isSelected
                                                    ? 'bg-blue-600 text-white'
                                                    : isToday
                                                        ? 'bg-blue-100 text-blue-800 hover:bg-blue-200'
                                                        : 'text-gray-700 hover:bg-gray-100'
                                            }`}
                                    >
                                        {day.getDate()}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>

            {error && (
                <div className="mt-1 flex items-center gap-1 text-red-600 text-xs">
                    <AlertCircle size={12} />
                    <span>{error}</span>
                </div>
            )}

            {isOpen && (
                <div
                    className="fixed inset-0 z-10"
                    onClick={() => setIsOpen(false)}
                />
            )}
        </div>
    );
};

// ---------------------------
// Time Picker Component
// ---------------------------
const TimePicker = ({
    value,
    onChange,
    error,
    disabled = false
}: {
    value: string;
    onChange: (value: string) => void;
    error?: string;
    disabled?: boolean;
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [selectedHour, setSelectedHour] = useState<number | null>(null);
    const [selectedMinute, setSelectedMinute] = useState<number | null>(null);

    const hours = Array.from({ length: 24 }, (_, i) => i);
    const minutes = Array.from({ length: 60 }, (_, i) => i);

    const handleSelect = (hour: number, minute: number) => {
        const formatted = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        onChange(formatted);
        setIsOpen(false);
        setSelectedHour(null);
        setSelectedMinute(null);
    };

    const handleHourClick = (hour: number) => {
        setSelectedHour(hour);
        if (selectedMinute !== null) {
            handleSelect(hour, selectedMinute);
        }
    };

    const handleMinuteClick = (minute: number) => {
        setSelectedMinute(minute);
        if (selectedHour !== null) {
            handleSelect(selectedHour, minute);
        }
    };

    return (
        <div className="flex flex-col">
            <label className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                <Clock size={16} className="text-gray-400" />
                Hora
            </label>

            <div className="relative">
                <button
                    type="button"
                    onClick={() => !disabled && setIsOpen(!isOpen)}
                    disabled={disabled}
                    className={`w-full px-3 py-2 border rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 flex items-center justify-between ${error ? 'border-red-300 bg-red-50' : 'border-gray-300'
                        } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                    <span className={value ? 'text-gray-900' : 'text-gray-500'}>
                        {value || 'Seleccionar hora'}
                    </span>
                    <Clock size={16} className="text-gray-400" />
                </button>

                {isOpen && (
                    <div className="absolute z-20 mt-1 bg-white border border-gray-300 rounded-md shadow-lg overflow-hidden" style={{ width: '140px' }}>
                        <div className="flex h-64">
                            <div className="flex-1 border-r border-gray-200 overflow-y-auto scrollbar-hide">
                                {hours.map(hour => (
                                    <button
                                        key={hour}
                                        type="button"
                                        onClick={() => handleHourClick(hour)}
                                        className={`w-full px-3 py-2 text-center hover:bg-blue-50 transition-colors ${selectedHour === hour ? 'bg-blue-100 text-blue-800 font-medium' : 'text-gray-700'
                                            }`}
                                    >
                                        {hour.toString().padStart(2, '0')}
                                    </button>
                                ))}
                            </div>

                            <div className="flex-1 overflow-y-auto scrollbar-hide">
                                {minutes.map(minute => (
                                    <button
                                        key={minute}
                                        type="button"
                                        onClick={() => handleMinuteClick(minute)}
                                        className={`w-full px-3 py-2 text-center hover:bg-blue-50 transition-colors ${selectedMinute === minute ? 'bg-blue-100 text-blue-800 font-medium' : 'text-gray-700'
                                            }`}
                                    >
                                        {minute.toString().padStart(2, '0')}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {error && (
                <div className="mt-1 flex items-center gap-1 text-red-600 text-xs">
                    <AlertCircle size={12} />
                    <span>{error}</span>
                </div>
            )}

            {isOpen && (
                <div
                    className="fixed inset-0 z-10"
                    onClick={() => setIsOpen(false)}
                />
            )}

            <style jsx>{`
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
      `}</style>
        </div>
    );
};

// ---------------------------
// Dropdown Component
// ---------------------------
const Dropdown = ({
    value,
    onChange,
    options,
    label,
    icon: Icon,
    error,
    disabled = false,
    placeholder = "Seleccionar..."
}: {
    value: string;
    onChange: (value: string) => void;
    options: string[];
    label: string;
    icon: any;
    error?: string;
    disabled?: boolean;
    placeholder?: string;
}) => {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <div className="flex flex-col">
            <label className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                <Icon size={16} className="text-gray-400" />
                {label}
            </label>

            <div className="relative">
                <button
                    type="button"
                    onClick={() => !disabled && setIsOpen(!isOpen)}
                    disabled={disabled}
                    className={`w-full px-3 py-2 border rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 flex items-center justify-between ${error ? 'border-red-300 bg-red-50' : 'border-gray-300'
                        } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                    <span className={value ? 'text-gray-900' : 'text-gray-500'}>
                        {value || placeholder}
                    </span>
                    <ChevronDown
                        size={16}
                        className={`transition-transform ${isOpen ? 'rotate-180' : ''}`}
                    />
                </button>

                {isOpen && (
                    <div className="absolute z-20 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                        {options.length === 0 ? (
                            <div className="px-3 py-2 text-gray-500 text-sm">
                                No hay opciones disponibles
                            </div>
                        ) : (
                            options.map((option) => (
                                <button
                                    key={option}
                                    type="button"
                                    onClick={() => {
                                        onChange(option);
                                        setIsOpen(false);
                                    }}
                                    className="w-full px-3 py-2 text-left hover:bg-gray-100 transition-colors text-sm"
                                >
                                    {option}
                                </button>
                            ))
                        )}
                    </div>
                )}
            </div>

            {error && (
                <div className="mt-1 flex items-center gap-1 text-red-600 text-xs">
                    <AlertCircle size={12} />
                    <span>{error}</span>
                </div>
            )}

            {isOpen && (
                <div
                    className="fixed inset-0 z-10"
                    onClick={() => setIsOpen(false)}
                />
            )}
        </div>
    );
};

// ---------------------------
// Main ASCOM01 Module
// ---------------------------
export default function ASCOM01Module() {
    const { user } = useAuth();

    // Document date state
    const [documentDate, setDocumentDate] = useState('');
    const [documentDateError, setDocumentDateError] = useState('');

    // Totalizer state
    const [totalizerData, setTotalizerData] = useState<TotalizerData>({
        tinicial: '',
        tfinal: ''
    });

    // Internal vehicle state
    const [internalVehicles, setInternalVehicles] = useState<string[]>([]);
    const [internalLoads, setInternalLoads] = useState<VehicleLoadEntry[]>([]);
    const [editingInternalId, setEditingInternalId] = useState<string | null>(null);

    // External vehicle state
    const [externalCompanies, setExternalCompanies] = useState<string[]>([]);
    const [externalLoads, setExternalLoads] = useState<ExternalLoadEntry[]>([]);
    const [editingExternalId, setEditingExternalId] = useState<string | null>(null);

    // Form state for internal vehicle
    const [internalForm, setInternalForm] = useState({
        nroMovil: '',
        chofer: '',
        litros: '',
        horaCarga: '',
        kilometraje: '',
        horometro: '',
        precinto: '',
        firmaSvg: ''
    });

    // Form state for external vehicle
    const [externalForm, setExternalForm] = useState({
        empresa: '',
        numeroChapa: '',
        nombreChofer: '',
        litrosCargados: '',
        hora: '',
        kilometraje: '',
        horometro: '',
        precinto: '',
        firmaSvg: ''
    });

    // UI state
    const [activeTab, setActiveTab] = useState<'internal' | 'external'>('internal');
    const [showSignaturePad, setShowSignaturePad] = useState(false);
    const [currentSignatureFor, setCurrentSignatureFor] = useState<'internal' | 'external'>('internal');
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [loadingDocument, setLoadingDocument] = useState(false);
    const [toast, setToast] = useState<string | null>(null);
    const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Toast helper
    const showToast = useCallback((message: string) => {
        setToast(message);
        if (hideTimer.current) clearTimeout(hideTimer.current);
        hideTimer.current = setTimeout(() => setToast(null), 3000);
    }, []);

    // Cleanup timer
    useEffect(() => {
        return () => {
            if (hideTimer.current) clearTimeout(hideTimer.current);
        };
    }, []);

    // Load internal vehicles
    useEffect(() => {
        const loadVehicles = async () => {
            try {
                const docRef = doc(db, 'defaults', 'app');
                const docSnap = await getDoc(docRef);

                if (docSnap.exists()) {
                    const vehicles = docSnap.data().internal_vehicles || [];
                    setInternalVehicles(vehicles);
                }
            } catch (error) {
                console.error('[ASCOM01] Error loading vehicles:', error);
                showToast('Error al cargar vehículos internos');
            }
        };

        loadVehicles();
    }, [showToast]);

    // Load external companies
    useEffect(() => {
        const loadCompanies = async () => {
            try {
                const docRef = doc(db, 'defaults', 'app');
                const docSnap = await getDoc(docRef);

                if (docSnap.exists()) {
                    const companies = docSnap.data().razones_externas || [];
                    setExternalCompanies(companies);
                }
            } catch (error) {
                console.error('[ASCOM01] Error loading companies:', error);
                showToast('Error al cargar empresas externas');
            }
        };

        loadCompanies();
    }, [showToast]);

    // Load document when date is selected
    useEffect(() => {
        if (!documentDate) return;

        const loadDocument = async () => {
            setLoadingDocument(true);
            try {
                // FIX: documentDate is in yyyy-MM-dd format, convert to dd-MM-yyyy
                const [year, month, day] = documentDate.split('-');
                const docId = `${day}-${month}-${year}`;

                const docRef = doc(db, 'SCOM01', docId);
                const docSnap = await getDoc(docRef);

                if (docSnap.exists()) {
                    const data = docSnap.data();

                    // Load totalizer data
                    const docData = data.docData || {};
                    setTotalizerData({
                        tinicial: docData.Tinicial || '',
                        tfinal: docData.Tfinal || ''
                    });

                    // Load internal loads
                    const cargasFlota = data.CargasFlota || {};
                    const internalLoadsList = Object.entries(cargasFlota).map(([id, loadData]: [string, any]) => ({
                        id,
                        litros: loadData.Litros || '',
                        nroMovil: loadData.NroMovil || '',
                        chofer: loadData.Chofer || '',
                        horaCarga: loadData.HoraCarga || '',
                        kilometraje: loadData.Kilometraje || '',
                        horometro: loadData.Horometro || '',
                        precinto: loadData.Precinto || '',
                        hasFirma: loadData.HasFirma || false,
                        firmaSvg: loadData.FirmaSvg || '',
                        createdAt: loadData.createdAt || Date.now()
                    })).sort((a, b) => b.createdAt - a.createdAt);

                    setInternalLoads(internalLoadsList);

                    // Load external loads
                    const cargasExternas = data.CargasExternas || {};
                    const externalLoadsList = Object.entries(cargasExternas).map(([id, loadData]: [string, any]) => ({
                        id,
                        empresa: loadData.Empresa || '',
                        numeroChapa: loadData.NumeroChapa || '',
                        litrosCargados: loadData.LitrosCargados || '',
                        nombreChofer: loadData.NombreChofer || '',
                        hora: loadData.Hora || '',
                        kilometraje: loadData.Kilometraje || '',
                        horometro: loadData.Horometro || '',
                        precinto: loadData.Precinto || '',
                        hasFirma: loadData.HasFirma || false,
                        firmaSvg: loadData.FirmaSvg || '',
                        createdAt: loadData.createdAt || Date.now()
                    })).sort((a, b) => b.createdAt - a.createdAt);

                    setExternalLoads(externalLoadsList);

                    showToast('Documento cargado correctamente');
                } else {
                    // Clear everything for new document
                    setTotalizerData({ tinicial: '', tfinal: '' });
                    setInternalLoads([]);
                    setExternalLoads([]);
                    showToast('Nuevo documento - sin datos previos');
                }
            } catch (error) {
                console.error('[ASCOM01] Error loading document:', error);
                showToast('Error al cargar el documento');
            } finally {
                setLoadingDocument(false);
            }
        };

        loadDocument();
    }, [documentDate, showToast]);

    // Handle signature save
    const handleSignatureSave = useCallback((svg: string) => {
        if (currentSignatureFor === 'internal') {
            setInternalForm(prev => ({ ...prev, firmaSvg: svg }));
        } else {
            setExternalForm(prev => ({ ...prev, firmaSvg: svg }));
        }
        setShowSignaturePad(false);
        showToast('Firma guardada');
    }, [currentSignatureFor, showToast]);

    // Add/Edit internal load - NO VALIDATION
    const handleSaveInternalLoad = useCallback(() => {
        const newLoad: VehicleLoadEntry = {
            id: editingInternalId || `internal_${Date.now()}`,
            nroMovil: internalForm.nroMovil,
            chofer: internalForm.chofer,
            litros: internalForm.litros,
            horaCarga: internalForm.horaCarga,
            kilometraje: internalForm.kilometraje,
            horometro: internalForm.horometro,
            precinto: internalForm.precinto,
            hasFirma: !!internalForm.firmaSvg,
            firmaSvg: internalForm.firmaSvg,
            createdAt: Date.now()
        };

        if (editingInternalId) {
            setInternalLoads(prev => prev.map(load => load.id === editingInternalId ? newLoad : load));
            showToast('Carga interna actualizada');
        } else {
            setInternalLoads(prev => [newLoad, ...prev]);
            showToast('Carga interna agregada');
        }

        // Reset form
        setInternalForm({
            nroMovil: '',
            chofer: '',
            litros: '',
            horaCarga: '',
            kilometraje: '',
            horometro: '',
            precinto: '',
            firmaSvg: ''
        });
        setEditingInternalId(null);
    }, [internalForm, editingInternalId, showToast]);

    // Add/Edit external load - NO VALIDATION
    const handleSaveExternalLoad = useCallback(() => {
        const newLoad: ExternalLoadEntry = {
            id: editingExternalId || `external_${Date.now()}`,
            empresa: externalForm.empresa,
            numeroChapa: externalForm.numeroChapa,
            nombreChofer: externalForm.nombreChofer,
            litrosCargados: externalForm.litrosCargados,
            hora: externalForm.hora,
            kilometraje: externalForm.kilometraje,
            horometro: externalForm.horometro,
            precinto: externalForm.precinto,
            hasFirma: !!externalForm.firmaSvg,
            firmaSvg: externalForm.firmaSvg,
            createdAt: Date.now()
        };

        if (editingExternalId) {
            setExternalLoads(prev => prev.map(load => load.id === editingExternalId ? newLoad : load));
            showToast('Carga externa actualizada');
        } else {
            setExternalLoads(prev => [newLoad, ...prev]);
            showToast('Carga externa agregada');
        }

        // Reset form
        setExternalForm({
            empresa: '',
            numeroChapa: '',
            nombreChofer: '',
            litrosCargados: '',
            hora: '',
            kilometraje: '',
            horometro: '',
            precinto: '',
            firmaSvg: ''
        });
        setEditingExternalId(null);
    }, [externalForm, editingExternalId, showToast]);

    // Delete internal load
    const handleDeleteInternalLoad = useCallback((id: string) => {
        setInternalLoads(prev => prev.filter(load => load.id !== id));
        showToast('Carga interna eliminada');
    }, [showToast]);

    // Delete external load
    const handleDeleteExternalLoad = useCallback((id: string) => {
        setExternalLoads(prev => prev.filter(load => load.id !== id));
        showToast('Carga externa eliminada');
    }, [showToast]);

    // Edit internal load
    const handleEditInternalLoad = useCallback((load: VehicleLoadEntry) => {
        setInternalForm({
            nroMovil: load.nroMovil,
            chofer: load.chofer,
            litros: load.litros,
            horaCarga: load.horaCarga,
            kilometraje: load.kilometraje,
            horometro: load.horometro,
            precinto: load.precinto,
            firmaSvg: load.firmaSvg
        });
        setEditingInternalId(load.id);
        setActiveTab('internal');
    }, []);

    // Edit external load
    const handleEditExternalLoad = useCallback((load: ExternalLoadEntry) => {
        setExternalForm({
            empresa: load.empresa,
            numeroChapa: load.numeroChapa,
            nombreChofer: load.nombreChofer,
            litrosCargados: load.litrosCargados,
            hora: load.hora,
            kilometraje: load.kilometraje,
            horometro: load.horometro,
            precinto: load.precinto,
            firmaSvg: load.firmaSvg
        });
        setEditingExternalId(load.id);
        setActiveTab('external');
    }, []);

    // Save complete document to Firebase
    const handleSaveDocument = useCallback(async () => {
        if (!documentDate) {
            showToast('Debe seleccionar una fecha');
            return;
        }

        if (!user?.uid) {
            showToast('Usuario no autenticado');
            return;
        }

        setSaving(true);
        try {
            // FIX: documentDate is in yyyy-MM-dd format, convert to dd-MM-yyyy
            const [year, month, day] = documentDate.split('-');
            const docId = `${day}-${month}-${year}`;
            const docRef = doc(db, 'SCOM01', docId);

            // Prepare internal loads
            const cargasFlota: Record<string, any> = {};
            internalLoads.forEach(load => {
                cargasFlota[load.id] = {
                    Litros: load.litros,
                    NroMovil: load.nroMovil,
                    Chofer: load.chofer,
                    HoraCarga: load.horaCarga,
                    Kilometraje: load.kilometraje,
                    Horometro: load.horometro,
                    Precinto: load.precinto,
                    HasFirma: load.hasFirma,
                    FirmaSvg: load.firmaSvg,
                    createdAt: load.createdAt
                };
            });

            // Prepare external loads
            const cargasExternas: Record<string, any> = {};
            externalLoads.forEach(load => {
                cargasExternas[load.id] = {
                    Empresa: load.empresa,
                    NumeroChapa: load.numeroChapa,
                    LitrosCargados: load.litrosCargados,
                    NombreChofer: load.nombreChofer,
                    Hora: load.hora,
                    Kilometraje: load.kilometraje,
                    Horometro: load.horometro,
                    Precinto: load.precinto,
                    HasFirma: load.hasFirma,
                    FirmaSvg: load.firmaSvg,
                    createdAt: load.createdAt
                };
            });

            // Prepare document data
            const documentData: any = {
                metadata: {
                    createdAt: serverTimestamp(),
                    userId: user.uid,
                    userEmail: user.email || ''
                }
            };

            // Add totalizer data if present
            if (totalizerData.tinicial || totalizerData.tfinal) {
                documentData.docData = {
                    Tinicial: totalizerData.tinicial,
                    Tfinal: totalizerData.tfinal
                };
            }

            // Add loads if present
            if (Object.keys(cargasFlota).length > 0) {
                documentData.CargasFlota = cargasFlota;
            }

            if (Object.keys(cargasExternas).length > 0) {
                documentData.CargasExternas = cargasExternas;
            }

            // Save to Firebase
            await setDoc(docRef, documentData, { merge: true });

            showToast('Documento guardado exitosamente');
            console.log('[ASCOM01] Document saved:', docId);

        } catch (error) {
            console.error('[ASCOM01] Error saving document:', error);
            showToast('Error al guardar el documento');
        } finally {
            setSaving(false);
        }
    }, [documentDate, user, internalLoads, externalLoads, totalizerData, showToast]);

    return (
        <section className="w-full p-6 bg-gray-50 min-h-full">
            <header className="mb-6">
                <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-purple-100 rounded-lg">
                        <Shield className="text-purple-600" size={24} />
                    </div>
                    <h1 className="text-2xl font-semibold text-gray-900">
                        ASCOM01 — Administración de Entradas Retroactivas
                    </h1>
                </div>
                <p className="text-gray-600">
                    Creación y edición de documentos de combustible para fechas pasadas (sin validaciones requeridas)
                </p>
            </header>

            {/* Date Selection */}
            <div className="bg-white border rounded-lg p-6 shadow-sm mb-6 max-w-md">
                <DatePicker
                    value={documentDate}
                    onChange={setDocumentDate}
                    error={documentDateError}
                    disabled={loading}
                    maxDate={new Date()}
                />

                {loadingDocument && (
                    <div className="mt-4 flex items-center gap-2 text-blue-600">
                        <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                        <span className="text-sm">Cargando documento...</span>
                    </div>
                )}
            </div>

            {documentDate && !loadingDocument && (
                <>
                    {/* Totalizer Section */}
                    <div className="bg-white border rounded-lg p-6 shadow-sm mb-6">
                        <h2 className="text-lg font-semibold text-gray-800 mb-4">Datos del Totalizador (Opcional)</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="text-sm font-medium text-gray-700 mb-2 block">
                                    Totalizador Inicial
                                </label>
                                <input
                                    type="text"
                                    value={totalizerData.tinicial}
                                    onChange={(e) => setTotalizerData(prev => ({ ...prev, tinicial: e.target.value }))}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    placeholder="Ej: 123.0"
                                />
                            </div>
                            <div>
                                <label className="text-sm font-medium text-gray-700 mb-2 block">
                                    Totalizador Final
                                </label>
                                <input
                                    type="text"
                                    value={totalizerData.tfinal}
                                    onChange={(e) => setTotalizerData(prev => ({ ...prev, tfinal: e.target.value }))}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    placeholder="Ej: 124.0"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Tabs */}
                    <div className="bg-white border rounded-lg shadow-sm mb-6">
                        <div className="border-b border-gray-200">
                            <div className="flex">
                                <button
                                    onClick={() => setActiveTab('internal')}
                                    className={`flex items-center gap-2 px-6 py-3 font-medium border-b-2 transition-colors ${activeTab === 'internal'
                                        ? 'border-blue-600 text-blue-600'
                                        : 'border-transparent text-gray-600 hover:text-gray-900'
                                        }`}
                                >
                                    <Building size={18} />
                                    Vehículos Internos ({internalLoads.length})
                                </button>
                                <button
                                    onClick={() => setActiveTab('external')}
                                    className={`flex items-center gap-2 px-6 py-3 font-medium border-b-2 transition-colors ${activeTab === 'external'
                                        ? 'border-green-600 text-green-600'
                                        : 'border-transparent text-gray-600 hover:text-gray-900'
                                        }`}
                                >
                                    <Truck size={18} />
                                    Vehículos Externos ({externalLoads.length})
                                </button>
                            </div>
                        </div>

                        <div className="p-6">
                            {activeTab === 'internal' ? (
                                <>
                                    {/* Internal Vehicle Form */}
                                    <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-6">
                                        <h3 className="text-lg font-semibold text-gray-800 mb-4">
                                            {editingInternalId ? 'Editar Carga Interna' : 'Nueva Carga Interna'}
                                        </h3>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                            <Dropdown
                                                value={internalForm.nroMovil}
                                                onChange={(value) => setInternalForm(prev => ({ ...prev, nroMovil: value }))}
                                                options={internalVehicles}
                                                label="Nro. Móvil"
                                                icon={Building}
                                                placeholder="Seleccionar móvil"
                                            />

                                            <div>
                                                <label className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                                                    <User size={16} className="text-gray-400" />
                                                    Chofer
                                                </label>
                                                <input
                                                    type="text"
                                                    value={internalForm.chofer}
                                                    onChange={(e) => setInternalForm(prev => ({ ...prev, chofer: e.target.value }))}
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                    placeholder="Nombre del chofer"
                                                />
                                            </div>

                                            <div>
                                                <label className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                                                    <Fuel size={16} className="text-gray-400" />
                                                    Litros
                                                </label>
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    value={internalForm.litros}
                                                    onChange={(e) => setInternalForm(prev => ({ ...prev, litros: e.target.value }))}
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                    placeholder="0.00"
                                                />
                                            </div>

                                            <TimePicker
                                                value={internalForm.horaCarga}
                                                onChange={(value) => setInternalForm(prev => ({ ...prev, horaCarga: value }))}
                                            />

                                            <div>
                                                <label className="text-sm font-medium text-gray-700 mb-2 block">
                                                    Kilometraje
                                                </label>
                                                <input
                                                    type="text"
                                                    value={internalForm.kilometraje}
                                                    onChange={(e) => setInternalForm(prev => ({ ...prev, kilometraje: e.target.value }))}
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                    placeholder="Opcional"
                                                />
                                            </div>

                                            <div>
                                                <label className="text-sm font-medium text-gray-700 mb-2 block">
                                                    Horómetro
                                                </label>
                                                <input
                                                    type="text"
                                                    value={internalForm.horometro}
                                                    onChange={(e) => setInternalForm(prev => ({ ...prev, horometro: e.target.value }))}
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                    placeholder="Opcional"
                                                />
                                            </div>

                                            <div>
                                                <label className="text-sm font-medium text-gray-700 mb-2 block">
                                                    Precinto
                                                </label>
                                                <input
                                                    type="text"
                                                    value={internalForm.precinto}
                                                    onChange={(e) => setInternalForm(prev => ({ ...prev, precinto: e.target.value }))}
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                    placeholder="Opcional"
                                                />
                                            </div>
                                        </div>

                                        <div className="mb-4">
                                            <label className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                                                <Edit2 size={16} className="text-gray-400" />
                                                Firma (Opcional)
                                            </label>

                                            {internalForm.firmaSvg ? (
                                                <div className="flex items-center gap-2">
                                                    <div className="flex-1 px-3 py-2 bg-green-50 border border-green-300 rounded-md text-green-700 text-sm flex items-center gap-2">
                                                        <CheckCircle size={16} />
                                                        Firma guardada
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setCurrentSignatureFor('internal');
                                                            setShowSignaturePad(true);
                                                        }}
                                                        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm"
                                                    >
                                                        Cambiar
                                                    </button>
                                                </div>
                                            ) : (
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setCurrentSignatureFor('internal');
                                                        setShowSignaturePad(true);
                                                    }}
                                                    className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                                                >
                                                    <Edit2 size={16} />
                                                    Agregar Firma
                                                </button>
                                            )}
                                        </div>

                                        <div className="flex gap-2">
                                            <button
                                                type="button"
                                                onClick={handleSaveInternalLoad}
                                                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                                            >
                                                <Save size={16} />
                                                {editingInternalId ? 'Actualizar' : 'Agregar'}
                                            </button>

                                            {editingInternalId && (
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setInternalForm({
                                                            nroMovil: '',
                                                            chofer: '',
                                                            litros: '',
                                                            horaCarga: '',
                                                            kilometraje: '',
                                                            horometro: '',
                                                            precinto: '',
                                                            firmaSvg: ''
                                                        });
                                                        setEditingInternalId(null);
                                                    }}
                                                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors"
                                                >
                                                    Cancelar
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    {/* Internal Loads List */}
                                    {internalLoads.length > 0 && (
                                        <div>
                                            <h3 className="text-lg font-semibold text-gray-800 mb-4">Cargas Registradas</h3>
                                            <div className="space-y-3">
                                                {internalLoads.map(load => (
                                                    <div key={load.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors">
                                                        <div className="flex items-start justify-between">
                                                            <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                                                                <div>
                                                                    <span className="text-gray-500">Móvil:</span>
                                                                    <p className="font-medium">{load.nroMovil || '-'}</p>
                                                                </div>
                                                                <div>
                                                                    <span className="text-gray-500">Chofer:</span>
                                                                    <p className="font-medium">{load.chofer || '-'}</p>
                                                                </div>
                                                                <div>
                                                                    <span className="text-gray-500">Litros:</span>
                                                                    <p className="font-medium">{load.litros || '-'}</p>
                                                                </div>
                                                                <div>
                                                                    <span className="text-gray-500">Hora:</span>
                                                                    <p className="font-medium">{load.horaCarga || '-'}</p>
                                                                </div>
                                                            </div>

                                                            <div className="flex gap-2 ml-4">
                                                                <button
                                                                    onClick={() => handleEditInternalLoad(load)}
                                                                    className="p-2 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                                                    title="Editar"
                                                                >
                                                                    <Edit2 size={16} />
                                                                </button>
                                                                <button
                                                                    onClick={() => handleDeleteInternalLoad(load.id)}
                                                                    className="p-2 text-red-600 hover:bg-red-50 rounded transition-colors"
                                                                    title="Eliminar"
                                                                >
                                                                    <Trash2 size={16} />
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </>
                            ) : (
                                <>
                                    {/* External Vehicle Form */}
                                    <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-6">
                                        <h3 className="text-lg font-semibold text-gray-800 mb-4">
                                            {editingExternalId ? 'Editar Carga Externa' : 'Nueva Carga Externa'}
                                        </h3>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                            <Dropdown
                                                value={externalForm.empresa}
                                                onChange={(value) => setExternalForm(prev => ({ ...prev, empresa: value }))}
                                                options={externalCompanies}
                                                label="Empresa"
                                                icon={Truck}
                                                placeholder="Seleccionar empresa"
                                            />

                                            <div>
                                                <label className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                                                    <FileText size={16} className="text-gray-400" />
                                                    Número de Chapa
                                                </label>
                                                <input
                                                    type="text"
                                                    value={externalForm.numeroChapa}
                                                    onChange={(e) => setExternalForm(prev => ({ ...prev, numeroChapa: e.target.value }))}
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                    placeholder="Número de chapa"
                                                />
                                            </div>

                                            <div>
                                                <label className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                                                    <User size={16} className="text-gray-400" />
                                                    Nombre del Chofer
                                                </label>
                                                <input
                                                    type="text"
                                                    value={externalForm.nombreChofer}
                                                    onChange={(e) => setExternalForm(prev => ({ ...prev, nombreChofer: e.target.value }))}
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                    placeholder="Nombre del chofer"
                                                />
                                            </div>

                                            <div>
                                                <label className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                                                    <Fuel size={16} className="text-gray-400" />
                                                    Litros Cargados
                                                </label>
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    value={externalForm.litrosCargados}
                                                    onChange={(e) => setExternalForm(prev => ({ ...prev, litrosCargados: e.target.value }))}
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                    placeholder="0.00"
                                                />
                                            </div>

                                            <TimePicker
                                                value={externalForm.hora}
                                                onChange={(value) => setExternalForm(prev => ({ ...prev, hora: value }))}
                                            />

                                            <div>
                                                <label className="text-sm font-medium text-gray-700 mb-2 block">
                                                    Kilometraje
                                                </label>
                                                <input
                                                    type="text"
                                                    value={externalForm.kilometraje}
                                                    onChange={(e) => setExternalForm(prev => ({ ...prev, kilometraje: e.target.value }))}
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                    placeholder="Opcional"
                                                />
                                            </div>

                                            <div>
                                                <label className="text-sm font-medium text-gray-700 mb-2 block">
                                                    Horómetro
                                                </label>
                                                <input
                                                    type="text"
                                                    value={externalForm.horometro}
                                                    onChange={(e) => setExternalForm(prev => ({ ...prev, horometro: e.target.value }))}
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                    placeholder="Opcional"
                                                />
                                            </div>

                                            <div>
                                                <label className="text-sm font-medium text-gray-700 mb-2 block">
                                                    Precinto
                                                </label>
                                                <input
                                                    type="text"
                                                    value={externalForm.precinto}
                                                    onChange={(e) => setExternalForm(prev => ({ ...prev, precinto: e.target.value }))}
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                    placeholder="Opcional"
                                                />
                                            </div>
                                        </div>

                                        <div className="mb-4">
                                            <label className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                                                <Edit2 size={16} className="text-gray-400" />
                                                Firma (Opcional)
                                            </label>

                                            {externalForm.firmaSvg ? (
                                                <div className="flex items-center gap-2">
                                                    <div className="flex-1 px-3 py-2 bg-green-50 border border-green-300 rounded-md text-green-700 text-sm flex items-center gap-2">
                                                        <CheckCircle size={16} />
                                                        Firma guardada
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setCurrentSignatureFor('external');
                                                            setShowSignaturePad(true);
                                                        }}
                                                        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm"
                                                    >
                                                        Cambiar
                                                    </button>
                                                </div>
                                            ) : (
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setCurrentSignatureFor('external');
                                                        setShowSignaturePad(true);
                                                    }}
                                                    className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                                                >
                                                    <Edit2 size={16} />
                                                    Agregar Firma
                                                </button>
                                            )}
                                        </div>

                                        <div className="flex gap-2">
                                            <button
                                                type="button"
                                                onClick={handleSaveExternalLoad}
                                                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
                                            >
                                                <Save size={16} />
                                                {editingExternalId ? 'Actualizar' : 'Agregar'}
                                            </button>

                                            {editingExternalId && (
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setExternalForm({
                                                            empresa: '',
                                                            numeroChapa: '',
                                                            nombreChofer: '',
                                                            litrosCargados: '',
                                                            hora: '',
                                                            kilometraje: '',
                                                            horometro: '',
                                                            precinto: '',
                                                            firmaSvg: ''
                                                        });
                                                        setEditingExternalId(null);
                                                    }}
                                                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors"
                                                >
                                                    Cancelar
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    {/* External Loads List */}
                                    {externalLoads.length > 0 && (
                                        <div>
                                            <h3 className="text-lg font-semibold text-gray-800 mb-4">Cargas Registradas</h3>
                                            <div className="space-y-3">
                                                {externalLoads.map(load => (
                                                    <div key={load.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors">
                                                        <div className="flex items-start justify-between">
                                                            <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                                                                <div>
                                                                    <span className="text-gray-500">Empresa:</span>
                                                                    <p className="font-medium">{load.empresa || '-'}</p>
                                                                </div>
                                                                <div>
                                                                    <span className="text-gray-500">Chapa:</span>
                                                                    <p className="font-medium">{load.numeroChapa || '-'}</p>
                                                                </div>
                                                                <div>
                                                                    <span className="text-gray-500">Litros:</span>
                                                                    <p className="font-medium">{load.litrosCargados || '-'}</p>
                                                                </div>
                                                                <div>
                                                                    <span className="text-gray-500">Hora:</span>
                                                                    <p className="font-medium">{load.hora || '-'}</p>
                                                                </div>
                                                            </div>

                                                            <div className="flex gap-2 ml-4">
                                                                <button
                                                                    onClick={() => handleEditExternalLoad(load)}
                                                                    className="p-2 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                                                    title="Editar"
                                                                >
                                                                    <Edit2 size={16} />
                                                                </button>
                                                                <button
                                                                    onClick={() => handleDeleteExternalLoad(load.id)}
                                                                    className="p-2 text-red-600 hover:bg-red-50 rounded transition-colors"
                                                                    title="Eliminar"
                                                                >
                                                                    <Trash2 size={16} />
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    </div>

                    {/* Save Document Button */}
                    <div className="bg-white border rounded-lg p-6 shadow-sm">
                        <button
                            onClick={handleSaveDocument}
                            disabled={saving}
                            className="w-full px-6 py-3 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium flex items-center justify-center gap-2"
                        >
                            {saving ? (
                                <>
                                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                    Guardando Documento...
                                </>
                            ) : (
                                <>
                                    <Save size={18} />
                                    Guardar Documento Completo
                                </>
                            )}
                        </button>

                        <p className="mt-3 text-sm text-gray-600 text-center">
                            Total: {internalLoads.length} cargas internas + {externalLoads.length} cargas externas
                        </p>
                    </div>
                </>
            )}

            {/* Signature Modal */}
            {showSignaturePad && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg max-w-2xl w-full">
                        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
                            <h2 className="text-xl font-semibold text-gray-900">Capturar Firma</h2>
                            <button
                                onClick={() => setShowSignaturePad(false)}
                                className="text-gray-400 hover:text-gray-600 transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div className="p-6">
                            <SignaturePad onSave={handleSignatureSave} />
                        </div>
                    </div>
                </div>
            )}

            {/* Toast */}
            {toast && (
                <div
                    role="alert"
                    aria-live="polite"
                    className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 w-[min(95vw,420px)] shadow-lg border border-gray-200 bg-white px-4 py-3 rounded-md text-sm flex items-center gap-2"
                >
                    <CheckCircle className="text-green-500 shrink-0" size={18} />
                    <span className="text-gray-800">{toast}</span>
                    <button
                        onClick={() => setToast(null)}
                        className="ml-auto text-gray-500 hover:text-gray-700"
                    >
                        <X size={16} />
                    </button>
                </div>
            )}

            <style jsx global>{`
        input[type=number]::-webkit-outer-spin-button,
        input[type=number]::-webkit-inner-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }
        input[type=number] {
          -moz-appearance: textfield;
        }
      `}</style>
        </section>
    );
}