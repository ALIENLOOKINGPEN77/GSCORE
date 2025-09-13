// /app/components/modules/ECOM01.tsx
// ECOM01 – Entrada de Combustible
// Enhanced fuel entry module with QR generation and signature functionality

"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Calendar, Truck, User, FileText, Fuel, Clock, AlertCircle, CheckCircle, ArrowRight, Minus, QrCode, Smartphone, X, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { useAuth } from "../auth-context";
import { 
  createPendingEntry, 
  subscribeToEntry, 
  completeEntry, 
  deletePendingEntry,
  buildSigningUrl,
  renderSignatureSVG,
  type ECOM01Document,
  type FuelEntryFormData 
} from "../../lib/firebase/ecom01";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../../lib/firebase/client";

// Form data type with clear field definitions
type FuelEntry = {
  fecha: string;
  proveedorExterno: string;
  nroChapa: string;
  chofer: string;
  factura: string;
  cantidadFacturadaLts: string;
  horaDescarga: string;
  cantidadRecepcionadaLts: string;
};

// Validation result type
type ValidationResult = {
  isValid: boolean;
  errors: Partial<Record<keyof FuelEntry, string>>;
};

// Signature workflow states
type SignatureState = 'idle' | 'generating' | 'pending' | 'signed' | 'saving' | 'completed';

const FORM_FIELDS_CONFIG = {
  fecha: { label: 'Fecha', placeholder: 'dd/mm/aaaa', icon: Calendar, type: 'date', required: true },
  proveedorExterno: { label: 'Proveedor Externo', placeholder: 'Seleccione un proveedor', icon: Truck, type: 'select', required: true },
  nroChapa: { label: 'Nro. Chapa', placeholder: 'Ingrese número de chapa (mín. 6 caracteres)', icon: FileText, type: 'text', required: true },
  chofer: { label: 'Chofer', placeholder: 'Nombre del chofer', icon: User, type: 'text', required: true },
  factura: { label: 'Factura', placeholder: 'Nº de factura', icon: FileText, type: 'text', required: true },
  cantidadFacturadaLts: { label: 'Cantidad Facturada (Lts)', placeholder: '0.00', icon: Fuel, type: 'number', required: true },
  horaDescarga: { label: 'Hora de Descarga', placeholder: 'HH:MM', icon: Clock, type: 'time', required: true },
  cantidadRecepcionadaLts: { label: 'Cantidad Recepcionada (Lts)', placeholder: '0.00', icon: Fuel, type: 'number', required: true },
};

// Utility functions for date/time handling
const formatDate = (date: Date): string => {
  return date.toISOString().split('T')[0];
};

const parseDate = (dateStr: string): Date | null => {
  if (!dateStr) return null;
  const date = new Date(dateStr + 'T00:00:00');
  return isNaN(date.getTime()) ? null : date;
};

const formatTime = (hours: number, minutes: number): string => {
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
};

const parseTime = (timeStr: string): { hours: number; minutes: number } | null => {
  if (!timeStr) return null;
  const [hours, minutes] = timeStr.split(':').map(Number);
  if (isNaN(hours) || isNaN(minutes)) return null;
  return { hours, minutes };
};

// QR Code component using a simple external service
const QRCodeDisplay = ({ value, size = 200 }: { value: string; size?: number }) => (
  <img
    src={`https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(value)}&ecc=Q`}
    alt="QR Code"
    className="rounded-lg border"
    width={size}
    height={size}
  />
);

// Signature display component
const SignatureDisplay = ({ signature }: { signature: any }) => {
  const svgString = renderSignatureSVG(signature);
  
  return (
    <div className="border rounded-lg p-4 bg-gray-50">
      <div 
        dangerouslySetInnerHTML={{ __html: svgString }}
        className="w-full"
        style={{ maxWidth: '300px' }}
      />
    </div>
  );
};

// Custom Date Picker Component
const DatePicker = ({ 
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
  const [viewMonth, setViewMonth] = useState(new Date());

  const selectedDate = parseDate(value);
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Generate calendar days
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
    onChange(formatDate(date));
    setIsOpen(false);
  };

  const navigateMonth = (direction: number) => {
    setViewMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + direction, 1));
  };

  return (
    <div className="flex flex-col">
      <label className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
        <Calendar size={16} className="text-gray-400" />
        Fecha
        <span className="text-red-500">*</span>
      </label>
      
      <div className="relative">
        <button
          type="button"
          onClick={() => !disabled && setIsOpen(!isOpen)}
          disabled={disabled}
          className={`w-full px-3 py-2 border rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 flex items-center justify-between ${
            error ? 'border-red-300 bg-red-50 focus:border-red-400' : 'border-gray-300 focus:border-blue-400'
          } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
        >
          <span className={value ? 'text-gray-900' : 'text-gray-500'}>
            {selectedDate ? selectedDate.toLocaleDateString('es-ES') : 'Seleccionar fecha'}
          </span>
          <Calendar size={16} className="text-gray-400" />
        </button>
        
        {isOpen && (
          <div className="absolute z-20 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg p-4">
            {/* Month Navigation */}
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
            
            {/* Week Headers */}
            <div className="grid grid-cols-7 gap-1 mb-2">
              {['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'].map(day => (
                <div key={day} className="text-center text-xs font-medium text-gray-500 p-2">
                  {day}
                </div>
              ))}
            </div>
            
            {/* Calendar Days */}
            <div className="grid grid-cols-7 gap-1">
              {days.map((day, index) => {
                const isCurrentMonth = day.getMonth() === viewMonth.getMonth();
                const isSelected = selectedDate && day.getTime() === selectedDate.getTime();
                const isToday = day.getTime() === today.getTime();
                
                return (
                  <button
                    key={index}
                    type="button"
                    onClick={() => handleDateSelect(day)}
                    className={`p-2 text-sm rounded transition-colors ${
                      !isCurrentMonth 
                        ? 'text-gray-300 hover:bg-gray-50' 
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
      
      {/* Click outside handler */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-10"
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  );
};

// Custom Time Picker Component - FIXED VERSION
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
  
  const timeObj = parseTime(value);
  const [selectedHour, setSelectedHour] = useState(timeObj?.hours ?? 8);
  const [selectedMinute, setSelectedMinute] = useState(timeObj?.minutes ?? 0);

  // Initialize with default time if no value is provided
  useEffect(() => {
    if (!value) {
      // Set default time of 08:00 when component mounts with no value
      onChange('08:00');
    }
  }, []); // Only run on mount

  const hours = Array.from({ length: 24 }, (_, i) => i);
  const minutes = Array.from({ length: 60 }, (_, i) => i);

  const handleTimeSelect = () => {
    onChange(formatTime(selectedHour, selectedMinute));
    setIsOpen(false);
  };

  // Don't show placeholder text - always show the actual time value
  const displayTime = value || '08:00';

  return (
    <div className="flex flex-col">
      <label className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
        <Clock size={16} className="text-gray-400" />
        Hora de Descarga
        <span className="text-red-500">*</span>
      </label>
      
      <div className="relative">
        <button
          type="button"
          onClick={() => !disabled && setIsOpen(!isOpen)}
          disabled={disabled}
          className={`w-full px-3 py-2 border rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 flex items-center justify-between ${
            error ? 'border-red-300 bg-red-50 focus:border-red-400' : 'border-gray-300 focus:border-blue-400'
          } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
        >
          {/* Always show the time value, never a placeholder */}
          <span className="text-gray-900">
            {displayTime}
          </span>
          <Clock size={16} className="text-gray-400" />
        </button>
        
        {isOpen && (
          <div className="absolute z-20 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg p-4">
            <div className="flex gap-4 mb-4">
              {/* Hour Selector */}
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-2">Hora</label>
                <div className="max-h-40 overflow-y-auto border rounded-md">
                  {hours.map(hour => (
                    <button
                      key={hour}
                      type="button"
                      onClick={() => setSelectedHour(hour)}
                      className={`w-full px-3 py-2 text-left hover:bg-gray-100 ${
                        selectedHour === hour ? 'bg-blue-100 text-blue-800' : ''
                      }`}
                    >
                      {hour.toString().padStart(2, '0')}
                    </button>
                  ))}
                </div>
              </div>
              
              {/* Minute Selector */}
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-2">Minuto</label>
                <div className="max-h-40 overflow-y-auto border rounded-md">
                  {minutes.filter(m => m % 5 === 0).map(minute => (
                    <button
                      key={minute}
                      type="button"
                      onClick={() => setSelectedMinute(minute)}
                      className={`w-full px-3 py-2 text-left hover:bg-gray-100 ${
                        selectedMinute === minute ? 'bg-blue-100 text-blue-800' : ''
                      }`}
                    >
                      {minute.toString().padStart(2, '0')}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            
            {/* Action Buttons */}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleTimeSelect}
                className="flex-1 bg-blue-600 text-white px-3 py-2 rounded-md hover:bg-blue-700 transition-colors text-sm"
              >
                Seleccionar
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="px-3 py-2 border rounded-md hover:bg-gray-50 transition-colors text-sm"
              >
                Cancelar
              </button>
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
      
      {/* Click outside handler */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-10"
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  );
};

// Custom dropdown component for providers
const ProviderDropdown = ({ 
  value, 
  onChange, 
  options, 
  error, 
  disabled = false 
}: {
  value: string;
  onChange: (value: string) => void;
  options: string[];
  error?: string;
  disabled?: boolean;
}) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="flex flex-col">
      <label className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
        <Truck size={16} className="text-gray-400" />
        Proveedor Externo
        <span className="text-red-500">*</span>
      </label>
      
      <div className="relative">
        <button
          type="button"
          onClick={() => !disabled && setIsOpen(!isOpen)}
          disabled={disabled}
          className={`w-full px-3 py-2 border rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 flex items-center justify-between ${
            error ? 'border-red-300 bg-red-50 focus:border-red-400' : 'border-gray-300 focus:border-blue-400'
          } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
        >
          <span className={value ? 'text-gray-900' : 'text-gray-500'}>
            {value || 'Seleccione un proveedor'}
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
                Cargando proveedores...
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
      
      {/* Click outside handler */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-10"
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  );
};

// Form field component
const FormField = ({ id, label, icon: Icon, error, type, ...props }: any) => {
  if (type === 'select' || type === 'date' || type === 'time') {
    return null; // Handled separately by custom components
  }

  return (
    <div className="flex flex-col">
      <label htmlFor={id} className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
        <Icon size={16} className="text-gray-400" />
        {label}
        {props.required && <span className="text-red-500">*</span>}
      </label>
      <input
        id={id}
        autoComplete="off"
        className={`px-3 py-2 border rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${
          error ? 'border-red-300 bg-red-50 focus:border-red-400' : 'border-gray-300 focus:border-blue-400'
        }`}
        {...props}
      />
      {error && (
        <div className="mt-1 flex items-center gap-1 text-red-600 text-xs">
          <AlertCircle size={12} />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
};

export default function ECOM01Module() {
  const { user } = useAuth();
  
  const initialForm: FuelEntry = useMemo(() => ({
    fecha: '',
    proveedorExterno: '',
    nroChapa: '',
    chofer: '',
    factura: '',
    cantidadFacturadaLts: '',
    horaDescarga: '',
    cantidadRecepcionadaLts: ''
  }), []);

  // Form state
  const [form, setForm] = useState<FuelEntry>(initialForm);
  const [validation, setValidation] = useState<ValidationResult>({ isValid: true, errors: {} });
  const [showSuccess, setShowSuccess] = useState(false);

  // Providers state
  const [providers, setProviders] = useState<string[]>([]);
  const [providersLoading, setProvidersLoading] = useState(true);

  // Signature workflow state
  const [signatureState, setSignatureState] = useState<SignatureState>('idle');
  const [currentDocId, setCurrentDocId] = useState<string>('');
  const [signingUrl, setSigningUrl] = useState<string>('');
  const [document, setDocument] = useState<ECOM01Document | null>(null);

  // Fetch providers from Firebase
  useEffect(() => {
    const fetchProviders = async () => {
      try {
        console.log('[ECOM01] Fetching fuel providers...');
        const providersRef = doc(db, 'defaults', 'providers');
        const providersSnap = await getDoc(providersRef);
        
        if (providersSnap.exists()) {
          const data = providersSnap.data();
          const fuelProviders = data.fuel || [];
          console.log('[ECOM01] Loaded providers:', fuelProviders);
          setProviders(fuelProviders);
        } else {
          console.warn('[ECOM01] Providers document not found');
          setProviders([]);
        }
      } catch (error) {
        console.error('[ECOM01] Error fetching providers:', error);
        setProviders([]);
      } finally {
        setProvidersLoading(false);
      }
    };

    fetchProviders();
  }, []);

  useEffect(() => {
    console.log("[ECOM01] Module mounted – Entrada de Combustible");
    
    // Cleanup function to handle component unmount
    return () => {
      if (currentDocId && signatureState === 'pending' && document?.status === 'pending') {
        // Clean up incomplete document
        deletePendingEntry(currentDocId).catch(console.error);
      }
    };
  }, [currentDocId, signatureState, document?.status]);

  // Subscribe to document changes when we have a pending signature
  useEffect(() => {
    if (!currentDocId || signatureState !== 'pending') return;

    console.log('[ECOM01] Subscribing to document changes:', currentDocId);
    const unsubscribe = subscribeToEntry(currentDocId, (doc) => {
      setDocument(doc);
      
      if (doc?.status === 'signed' && doc.signature) {
        console.log('[ECOM01] Signature received!');
        setSignatureState('signed');
      }
    });

    return unsubscribe;
  }, [currentDocId, signatureState]);

  // Simple license plate validation function - only checks minimum length
  const validateLicensePlate = useCallback((plate: string): boolean => {
    // Remove spaces and check minimum length
    const cleanPlate = plate.trim();
    return cleanPlate.length >= 6;
  }, []);

  // Check if all fields are completed - ENHANCED WITH DEBUG LOGGING
  const isFormComplete = useMemo(() => {
    const fieldStatuses: Record<string, { completed: boolean, value: string, issue?: string }> = {};
    let completedFields = 0;
    let totalFields = 0;
    
    const completionStatus = Object.entries(form).every(([key, value]) => {
      totalFields++;
      const fieldKey = key as keyof FuelEntry;
      
      if (key === 'nroChapa') {
        const hasValue = value.trim() !== '';
        const isValidLength = hasValue && validateLicensePlate(value);
        const isComplete = hasValue && isValidLength;
        
        fieldStatuses[key] = {
          completed: isComplete,
          value: value || '(empty)',
          issue: !hasValue ? 'Campo vacío' : !isValidLength ? 'Debe tener al menos 6 caracteres' : undefined
        };
        
        if (isComplete) completedFields++;
        return isComplete;
      } else {
        const isComplete = value.trim() !== '';
        fieldStatuses[key] = {
          completed: isComplete,
          value: value || '(empty)',
          issue: !isComplete ? 'Campo vacío' : undefined
        };
        
        if (isComplete) completedFields++;
        return isComplete;
      }
    });
    
    // DEBUG LOG - Form completion status
    console.log('🔍 [ECOM01] FORM COMPLETION DEBUG:', {
      overallComplete: completionStatus,
      completedFields: `${completedFields}/${totalFields}`,
      fieldDetails: fieldStatuses,
      missingFields: Object.entries(fieldStatuses)
        .filter(([_, status]) => !status.completed)
        .map(([field, status]) => ({ field, issue: status.issue })),
      completionPercentage: `${Math.round((completedFields / totalFields) * 100)}%`
    });
    
    return completionStatus;
  }, [form, validateLicensePlate]);

  // Enhanced validation logic
  const validateForm = useCallback((data: FuelEntry): ValidationResult => {
    const errors: Partial<Record<keyof FuelEntry, string>> = {};
    
    if (!data.fecha) errors.fecha = 'La fecha es requerida';
    if (!data.proveedorExterno.trim()) errors.proveedorExterno = 'El proveedor es requerido';
    
    if (!data.nroChapa.trim()) {
      errors.nroChapa = 'El número de chapa es requerido';
    } else if (!validateLicensePlate(data.nroChapa)) {
      errors.nroChapa = 'Debe tener al menos 6 caracteres';
    }
    
    if (!data.chofer.trim()) errors.chofer = 'El nombre del chofer es requerido';
    if (!data.factura.trim()) errors.factura = 'El número de factura es requerido';
    if (!data.horaDescarga) errors.horaDescarga = 'La hora de descarga es requerida';

    if (!data.cantidadFacturadaLts) {
      errors.cantidadFacturadaLts = 'La cantidad facturada es requerida';
    } else if (isNaN(Number(data.cantidadFacturadaLts)) || Number(data.cantidadFacturadaLts) <= 0) {
      errors.cantidadFacturadaLts = 'Debe ser un número mayor a 0';
    }

    if (!data.cantidadRecepcionadaLts) {
      errors.cantidadRecepcionadaLts = 'La cantidad recepcionada es requerida';
    } else if (isNaN(Number(data.cantidadRecepcionadaLts)) || Number(data.cantidadRecepcionadaLts) <= 0) {
      errors.cantidadRecepcionadaLts = 'Debe ser un número mayor a 0';
    }
    
    return { isValid: Object.keys(errors).length === 0, errors };
  }, [validateLicensePlate]);

  const updateField = useCallback((key: keyof FuelEntry) => (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value;
    
    const newForm = { ...form, [key]: value };
    setForm(newForm);
    if (validation.errors[key]) {
      setValidation(prev => ({ ...prev, errors: { ...prev.errors, [key]: undefined } }));
    }
  }, [form, validation.errors]);

  // Special handler for provider dropdown
  const updateProvider = useCallback((value: string) => {
    const newForm = { ...form, proveedorExterno: value };
    setForm(newForm);
    if (validation.errors.proveedorExterno) {
      setValidation(prev => ({ ...prev, errors: { ...prev.errors, proveedorExterno: undefined } }));
    }
  }, [form, validation.errors]);

  // Special handler for date picker
  const updateDate = useCallback((value: string) => {
    const newForm = { ...form, fecha: value };
    setForm(newForm);
    if (validation.errors.fecha) {
      setValidation(prev => ({ ...prev, errors: { ...prev.errors, fecha: undefined } }));
    }
  }, [form, validation.errors]);

  // Special handler for time picker
  const updateTime = useCallback((value: string) => {
    const newForm = { ...form, horaDescarga: value };
    setForm(newForm);
    if (validation.errors.horaDescarga) {
      setValidation(prev => ({ ...prev, errors: { ...prev.errors, horaDescarga: undefined } }));
    }
  }, [form, validation.errors]);
  
  const quantityDifference = useMemo(() => {
    const facturada = Number(form.cantidadFacturadaLts) || 0;
    const recepcionada = Number(form.cantidadRecepcionadaLts) || 0;
    return facturada - recepcionada;
  }, [form.cantidadFacturadaLts, form.cantidadRecepcionadaLts]);

  // Generate QR for signature
  const handleGenerateQR = useCallback(async () => {
    if (!user?.uid) return;

    setSignatureState('generating');
    try {
      console.log('[ECOM01] Creating pending entry...');
      const { docId, signatureToken } = await createPendingEntry(user.uid);
      const url = buildSigningUrl(docId, signatureToken);
      
      setCurrentDocId(docId);
      setSigningUrl(url);
      setSignatureState('pending');
      
      console.log('[ECOM01] QR generated:', { docId, url });
    } catch (error) {
      console.error('[ECOM01] Failed to generate QR:', error);
      setSignatureState('idle');
    }
  }, [user?.uid]);

  // Cancel signature process
  const handleCancelSignature = useCallback(async () => {
    if (currentDocId) {
      await deletePendingEntry(currentDocId);
    }
    
    setSignatureState('idle');
    setCurrentDocId('');
    setSigningUrl('');
    setDocument(null);
  }, [currentDocId]);

  // Save complete entry
  const handleSaveEntry = useCallback(async () => {
    if (!currentDocId || signatureState !== 'signed') return;

    const validationResult = validateForm(form);
    setValidation(validationResult);
    if (!validationResult.isValid) return;
    
    setSignatureState('saving');
    try {
      const formData: FuelEntryFormData = { ...form };
      await completeEntry(currentDocId, formData);
      
      console.log("[ECOM01] Entry completed successfully");
      setSignatureState('completed');
      setShowSuccess(true);
      
      // Reset after delay
      setTimeout(() => {
        setShowSuccess(false);
        setForm(initialForm);
        setValidation({ isValid: true, errors: {} });
        setSignatureState('idle');
        setCurrentDocId('');
        setSigningUrl('');
        setDocument(null);
      }, 3000);
      
    } catch (error) {
      console.error("[ECOM01] Failed to save entry:", error);
      setSignatureState('signed');
    }
  }, [currentDocId, signatureState, form, validateForm, initialForm]);

  const handleReset = useCallback(async () => {
    if (currentDocId && signatureState !== 'completed') {
      await deletePendingEntry(currentDocId);
    }
    
    setForm(initialForm);
    setValidation({ isValid: true, errors: {} });
    setShowSuccess(false);
    setSignatureState('idle');
    setCurrentDocId('');
    setSigningUrl('');
    setDocument(null);
  }, [initialForm, currentDocId, signatureState]);
  
  // Helper to render a form field
  const renderField = (key: keyof FuelEntry) => {
    const config = FORM_FIELDS_CONFIG[key];
    
    // Special handling for different field types
    if (key === 'proveedorExterno') {
      return (
        <ProviderDropdown
          key={key}
          value={form[key]}
          onChange={updateProvider}
          options={providers}
          error={validation.errors[key]}
          disabled={signatureState === 'saving' || signatureState === 'completed'}
        />
      );
    }
    
    if (key === 'fecha') {
      return (
        <DatePicker
          key={key}
          value={form[key]}
          onChange={updateDate}
          error={validation.errors[key]}
          disabled={signatureState === 'saving' || signatureState === 'completed'}
        />
      );
    }
    
    if (key === 'horaDescarga') {
      return (
        <TimePicker
          key={key}
          value={form[key]}
          onChange={updateTime}
          error={validation.errors[key]}
          disabled={signatureState === 'saving' || signatureState === 'completed'}
        />
      );
    }
    
    return (
      <FormField
        id={key}
        key={key}
        {...config}
        value={form[key]}
        onChange={updateField(key)}
        error={validation.errors[key]}
        disabled={signatureState === 'saving' || signatureState === 'completed'}
      />
    );
  };

  const canSave = signatureState === 'signed' && document?.signature;
  const isProcessing = ['generating', 'saving'].includes(signatureState);

  return (
    <section className="w-full p-6 bg-gray-50 min-h-full">
      {showSuccess && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2 text-green-800 animate-fade-in">
          <CheckCircle size={20} />
          <span>Entrada de combustible registrada exitosamente</span>
        </div>
      )}

      <header className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-blue-100 rounded-lg">
            <Fuel className="text-blue-600" size={24} />
          </div>
          <h1 className="text-2xl font-semibold text-gray-900">
            ECOM01 – Entrada de Combustible
          </h1>
        </div>
     
      </header>

      <form className="bg-white border rounded-lg p-8 shadow-sm max-w-6xl space-y-8" noValidate>
        {/* Main info in a two-column layout */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
          
          {/* Section 1: Delivery Information */}
          <div className="space-y-6">
            <h2 className="text-lg font-semibold text-gray-800 border-b pb-2">Información de la Entrega</h2>
            {renderField('proveedorExterno')}
            {renderField('nroChapa')}
            {renderField('chofer')}
          </div>
          
          {/* Section 2: Document Information */}
          <div className="space-y-6">
            <h2 className="text-lg font-semibold text-gray-800 border-b pb-2">Datos del Documento</h2>
            {renderField('factura')}
            {renderField('fecha')}
            {renderField('horaDescarga')}
          </div>
        </div>

        {/* Dedicated section for quantities */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-800 border-b pb-2">Cantidades de Combustible</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 items-end gap-6 bg-gray-50 p-6 rounded-lg">
            
            {renderField('cantidadFacturadaLts')}
            {renderField('cantidadRecepcionadaLts')}

            {/* Contextual difference display */}
            <div className="flex flex-col">
              <label className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                <Minus size={16} className="text-gray-400" />
                Diferencia
              </label>
              <div className="h-10 px-3 py-2 border border-gray-200 bg-white rounded-md flex items-center">
                <span className={`font-bold text-lg ${quantityDifference > 0 ? 'text-orange-600' : quantityDifference < 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {quantityDifference.toFixed(2)} Lts
                </span>
                {quantityDifference !== 0 && (
                  <span className="ml-2 text-xs text-gray-500 font-medium">
                    ({quantityDifference > 0 ? 'Faltante' : 'Sobrante'})
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

         {/* Signature Section */}
        <div className="border-b pb-8">
          <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <Smartphone size={20} />
            Firma Digital
          </h2>
          
          {/* Show form completion requirement when form is incomplete */}
          {!isFormComplete && signatureState === 'idle' && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="font-medium text-yellow-900 mb-2">Complete todos los campos</h3>
                  <p className="text-yellow-700 text-sm mb-4">
                    Para habilitar la generación del código QR de firma, debe completar todos los campos requeridos del formulario.
                  </p>
                  
                </div>
              </div>
            </div>
          )}
          
          {/* Show QR generation when form is complete and signature is idle */}
          {isFormComplete && signatureState === 'idle' && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="font-medium text-blue-900 mb-2">Formulario Completo - Firma Requerida</h3>
                  <p className="text-blue-700 text-sm mb-4">
                    Todos los campos han sido completados correctamente. Genere un código QR para obtener la firma digital.
                  </p>
                  <button
                    type="button"
                    onClick={handleGenerateQR}
                    disabled={isProcessing}
                    className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors font-medium flex items-center gap-2"
                  >
                    <QrCode size={16} />
                    Generar QR para Firma
                  </button>
                </div>
              </div>
            </div>
          )}

          {signatureState === 'generating' && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
              <div className="flex items-center gap-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                <span className="text-blue-800 font-medium">Generando código QR...</span>
              </div>
            </div>
          )}

          {signatureState === 'pending' && signingUrl && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="font-medium text-yellow-900 mb-2">Esperando Firma</h3>
                  <p className="text-yellow-700 text-sm mb-4">
                    Escanee el código QR con un dispositivo móvil para proceder con la firma digital.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleCancelSignature}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
              
              <div className="flex items-start gap-6">
                <QRCodeDisplay value={signingUrl} size={250} />
                <div className="flex-1">
                  <div className="space-y-2 text-sm text-gray-600">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-bold">1</span>
                      <span>Abra la cámara de su teléfono</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-bold">2</span>
                      <span>Escanee el código QR</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-bold">3</span>
                      <span>Firme en la pantalla del dispositivo</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {signatureState === 'signed' && document?.signature && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="font-medium text-green-900 mb-2 flex items-center gap-2">
                    <CheckCircle size={18} />
                    Firma Recibida
                  </h3>
                  <p className="text-green-700 text-sm mb-4">
                    La firma digital ha sido registrada correctamente. Ahora puede completar y guardar el registro.
                  </p>
                </div>
              </div>
              <SignatureDisplay signature={document.signature} />
            </div>
          )}

          {signatureState === 'saving' && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
              <div className="flex items-center gap-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                <span className="text-blue-800 font-medium">Guardando entrada de combustible...</span>
              </div>
            </div>
          )}
        </div>

        {/* Form Actions */}
        <div className="flex gap-4 pt-6 border-t border-gray-200">
          <button
            type="button"
            onClick={handleSaveEntry}
            disabled={!canSave || isProcessing}
            className="bg-blue-600 text-white px-6 py-2.5 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-medium flex items-center gap-2"
          >
            {signatureState === 'saving' ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Guardando...
              </>
            ) : (
              <>
                <CheckCircle size={16} />
                Guardar Entrada
              </>
            )}
          </button>
          
          <button
            type="button"
            onClick={handleReset}
            disabled={isProcessing}
            className="bg-gray-100 text-gray-700 px-6 py-2.5 rounded-md hover:bg-gray-200 disabled:opacity-50 transition-colors font-medium"
          >
            Limpiar Formulario
          </button>
        </div>
      </form>
      
      {/* CSS to remove number input spinners */}
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