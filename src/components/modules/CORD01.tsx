"use client";

import React, { useCallback, useEffect, useState } from "react";
import { FileText, Save, AlertCircle, CheckCircle, X } from "lucide-react";
import { useAuth } from "../auth-context";
import { doc, setDoc, serverTimestamp, collection, getDoc } from "firebase/firestore";
import { db } from "../../lib/firebase/client";

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

type OrderType = 'General' | 'Taller';

type TipoTrabajo = 'Mecanico' | 'Electrico' | 'Preventivo' | 'Correctivo' | 'Otro';

type GeneralFormData = {
  tipo: TipoTrabajo | '';
  equipo: string;
  fechaDeEmision: string;
  fechaAEjecutar: string;
  tecnicosAsignados: string[];
  descripcion: string;
};

type TallerFormData = {
  vehicleType: 'interno' | 'externo' | '';
  unidadMovil: string;
  conductor: string;
  kilometraje: string;
  horometro: string;
  fechaDeEmision: string;
  fechaAEjecutar: string;
  descripcion: string;
  observaciones: string;
};

type ValidationResult = {
  isValid: boolean;
  errors: Record<string, string>;
};

type ToastMessage = {
  type: 'success' | 'error';
  message: string;
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

const formatDate = (date: Date): string => {
  return date.toISOString().split('T')[0];
};

const getTodayDate = (): string => {
  return formatDate(new Date());
};

// ============================================================================
// DROPDOWN FIELD COMPONENT
// ============================================================================

const DropdownField = ({
  label,
  value,
  onChange,
  options,
  error,
  disabled = false,
  placeholder = 'Seleccione una opción',
  required = true
}: {
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  options: string[];
  error?: string;
  disabled?: boolean;
  placeholder?: string;
  required?: boolean;
}) => {
  return (
    <div className="flex flex-col">
      <label className="text-sm font-medium text-gray-700 mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <select
        value={value}
        onChange={onChange}
        disabled={disabled}
        className={`px-3 py-2 border rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${
          error ? 'border-red-300 bg-red-50' : 'border-gray-300'
        } ${disabled ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'}`}
      >
        <option value="">{placeholder}</option>
        {options.map(option => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
      {error && (
        <div className="mt-1 flex items-center gap-1 text-red-600 text-xs">
          <AlertCircle size={12} />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// FORM FIELD COMPONENT
// ============================================================================

const FormField = ({
  label,
  value,
  onChange,
  error,
  disabled = false,
  placeholder = '',
  required = true,
  type = 'text'
}: {
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  error?: string;
  disabled?: boolean;
  placeholder?: string;
  required?: boolean;
  type?: string;
}) => {
  return (
    <div className="flex flex-col">
      <label className="text-sm font-medium text-gray-700 mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={onChange}
        disabled={disabled}
        placeholder={placeholder}
        className={`px-3 py-2 border rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${
          error ? 'border-red-300 bg-red-50' : 'border-gray-300'
        } ${disabled ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'}`}
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

// ============================================================================
// TEXTAREA FIELD COMPONENT
// ============================================================================

const TextareaField = ({
  label,
  value,
  onChange,
  error,
  placeholder = '',
  required = false,
  rows = 3
}: {
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  error?: string;
  placeholder?: string;
  required?: boolean;
  rows?: number;
}) => {
  return (
    <div className="flex flex-col">
      <label className="text-sm font-medium text-gray-700 mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <textarea
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        rows={rows}
        className={`px-3 py-2 border rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none ${
          error ? 'border-red-300 bg-red-50' : 'border-gray-300'
        }`}
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

// ============================================================================
// TECHNICIANS INPUT COMPONENT
// ============================================================================

const TechniciansInput = ({
  label,
  technicians,
  onAdd,
  onRemove,
  error
}: {
  label: string;
  technicians: string[];
  onAdd: (technician: string) => void;
  onRemove: (index: number) => void;
  error?: string;
}) => {
  const [inputValue, setInputValue] = useState('');

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && inputValue.trim()) {
      e.preventDefault();
      onAdd(inputValue.trim());
      setInputValue('');
    }
  };

  return (
    <div className="flex flex-col">
      <label className="text-sm font-medium text-gray-700 mb-1">
        {label} <span className="text-red-500">*</span>
      </label>
      <input
        type="text"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Escriba el nombre y presione Enter"
        className={`px-3 py-2 border rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${
          error ? 'border-red-300 bg-red-50' : 'border-gray-300'
        }`}
      />
      {error && (
        <div className="mt-1 flex items-center gap-1 text-red-600 text-xs">
          <AlertCircle size={12} />
          <span>{error}</span>
        </div>
      )}
      
      {/* Display added technicians */}
      {technicians.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {technicians.map((tech, index) => (
            <div
              key={index}
              className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm flex items-center gap-2"
            >
              <span>{tech}</span>
              <button
                onClick={() => onRemove(index)}
                className="hover:bg-blue-200 rounded-full p-0.5 transition-colors"
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function CORD01() {
  const { user } = useAuth();
  
  // State
  const [orderType, setOrderType] = useState<OrderType>('General');
  const [generalFormData, setGeneralFormData] = useState<GeneralFormData>({
    tipo: '',
    equipo: '',
    fechaDeEmision: getTodayDate(),
    fechaAEjecutar: '',
    tecnicosAsignados: [],
    descripcion: '',
  });
  const [tallerFormData, setTallerFormData] = useState<TallerFormData>({
    vehicleType: '',
    unidadMovil: '',
    conductor: '',
    kilometraje: '',
    horometro: '',
    fechaDeEmision: getTodayDate(),
    fechaAEjecutar: '',
    descripcion: '',
    observaciones: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [internalVehicles, setInternalVehicles] = useState<string[]>([]);
  const [loadingDefaults, setLoadingDefaults] = useState(true);

  // Hardcoded tipo options
  const tipoOptions: TipoTrabajo[] = ['Mecanico', 'Electrico', 'Preventivo', 'Correctivo', 'Otro'];

  // Load defaults on mount
  useEffect(() => {
    loadDefaults();
  }, []);

  const loadDefaults = async () => {
    try {
      setLoadingDefaults(true);
      const defaultsRef = doc(db, 'defaults', 'work_order_defaults');
      const defaultsSnap = await getDoc(defaultsRef);
      
      if (defaultsSnap.exists()) {
        const data = defaultsSnap.data();
        setInternalVehicles(data.internal_vehicles || []);
      }
    } catch (error) {
      console.error('Error loading defaults:', error);
      showToast('error', 'Error al cargar configuración');
    } finally {
      setLoadingDefaults(false);
    }
  };

  // Show toast
  const showToast = useCallback((type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 5000);
  }, []);

  // Validate General form
  const validateGeneralForm = useCallback((): ValidationResult => {
    const newErrors: Record<string, string> = {};

    if (!generalFormData.tipo) {
      newErrors.tipo = 'Seleccione un tipo de trabajo';
    }

    if (!generalFormData.equipo.trim()) {
      newErrors.equipo = 'Ingrese el equipo';
    }

    if (!generalFormData.fechaAEjecutar) {
      newErrors.fechaAEjecutar = 'Seleccione la fecha a ejecutar';
    }

    if (generalFormData.tecnicosAsignados.length === 0) {
      newErrors.tecnicosAsignados = 'Agregue al menos un técnico';
    }

    return {
      isValid: Object.keys(newErrors).length === 0,
      errors: newErrors,
    };
  }, [generalFormData]);

  // Validate Taller form
  const validateTallerForm = useCallback((): ValidationResult => {
    const newErrors: Record<string, string> = {};

    if (!tallerFormData.vehicleType) {
      newErrors.vehicleType = 'Seleccione el tipo de vehículo';
    }

    if (!tallerFormData.unidadMovil.trim()) {
      newErrors.unidadMovil = 'Seleccione o ingrese la unidad móvil';
    }

    if (!tallerFormData.conductor.trim()) {
      newErrors.conductor = 'Ingrese el conductor';
    }

    if (!tallerFormData.fechaAEjecutar) {
      newErrors.fechaAEjecutar = 'Seleccione la fecha a ejecutar';
    }

    return {
      isValid: Object.keys(newErrors).length === 0,
      errors: newErrors,
    };
  }, [tallerFormData]);

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate based on order type
    const validation = orderType === 'General' 
      ? validateGeneralForm() 
      : validateTallerForm();
    
    setErrors(validation.errors);

    if (!validation.isValid) {
      showToast('error', 'Por favor complete todos los campos requeridos');
      return;
    }

    if (!user) {
      showToast('error', 'Usuario no autenticado');
      return;
    }

    try {
      setSubmitting(true);

      // Generate a new document reference with auto-ID
      const newDocRef = doc(collection(db, 'CORD01'));

      // Prepare data based on order type
      let workOrderData: any = {
        orderId: newDocRef.id,
        orderType: orderType,
        state: false,
        createdAt: serverTimestamp(),
        createdBy: user.uid,
        createdByEmail: user.email || '',
      };

      if (orderType === 'General') {
        workOrderData = {
          ...workOrderData,
          type: generalFormData.tipo,
          equipment: generalFormData.equipo,
          issueDate: generalFormData.fechaDeEmision,
          executionDate: generalFormData.fechaAEjecutar,
          assignedTechnicians: generalFormData.tecnicosAsignados,
          description: generalFormData.descripcion,
          workPerformed: '',
          verifiedBy: '',
          stateSig: false,
          stateUsed: false,
          stateAudit: false,
          componentsUsed: {},
        };
      } else {
        // Taller
        workOrderData = {
          ...workOrderData,
          vehicleType: tallerFormData.vehicleType,
          mobileUnit: tallerFormData.unidadMovil,
          driver: tallerFormData.conductor,
          mileage: tallerFormData.kilometraje ? parseFloat(tallerFormData.kilometraje) : 0,
          hourmeter: tallerFormData.horometro ? parseFloat(tallerFormData.horometro) : 0,
          issueDate: tallerFormData.fechaDeEmision,
          executionDate: tallerFormData.fechaAEjecutar,
          description: tallerFormData.descripcion,
          observations: tallerFormData.observaciones,
          signatureConformity: '',
          verifiedBy: '',
          componentsUsed: {},
          stateSig: false,
          stateUsed: false,
          stateAudit: false,
        };
      }

      await setDoc(newDocRef, workOrderData);

      showToast('success', `Orden de trabajo creada exitosamente: ${newDocRef.id}`);

      // Reset form
      if (orderType === 'General') {
        setGeneralFormData({
          tipo: '',
          equipo: '',
          fechaDeEmision: getTodayDate(),
          fechaAEjecutar: '',
          tecnicosAsignados: [],
          descripcion: '',
        });
      } else {
        setTallerFormData({
          vehicleType: '',
          unidadMovil: '',
          conductor: '',
          kilometraje: '',
          horometro: '',
          fechaDeEmision: getTodayDate(),
          fechaAEjecutar: '',
          descripcion: '',
          observaciones: '',
        });
      }
      setErrors({});

    } catch (error) {
      console.error('Error creating work order:', error);
      showToast('error', 'Error al crear la orden de trabajo');
    } finally {
      setSubmitting(false);
    }
  };

  // Add technician (General form only)
  const handleAddTechnician = useCallback((technician: string) => {
    setGeneralFormData(prev => ({
      ...prev,
      tecnicosAsignados: [...prev.tecnicosAsignados, technician],
    }));
  }, []);

  // Remove technician (General form only)
  const handleRemoveTechnician = useCallback((index: number) => {
    setGeneralFormData(prev => ({
      ...prev,
      tecnicosAsignados: prev.tecnicosAsignados.filter((_, i) => i !== index),
    }));
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <FileText size={32} className="text-blue-600" />
            <h1 className="text-3xl font-bold text-gray-900">Crear Orden de Trabajo</h1>
          </div>
        </div>

        {/* Order Type Selection */}
        <div className="bg-white border rounded-lg shadow-sm p-6 mb-6">
          <label className="text-sm font-medium text-gray-700 mb-3 block">
            Tipo de Orden <span className="text-red-500">*</span>
          </label>
          <div className="flex gap-4">
            <button
              onClick={() => setOrderType('General')}
              className={`flex-1 px-6 py-3 rounded-md font-medium transition-all ${
                orderType === 'General'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              General
            </button>
            <button
              onClick={() => setOrderType('Taller')}
              className={`flex-1 px-6 py-3 rounded-md font-medium transition-all ${
                orderType === 'Taller'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Taller
            </button>
          </div>
        </div>

        {/* Form Content */}
        {loadingDefaults ? (
          <div className="bg-white border rounded-lg shadow-sm p-12 text-center">
            <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-gray-600">Cargando configuración...</p>
          </div>
        ) : orderType === 'General' ? (
          <form onSubmit={handleSubmit} className="bg-white border rounded-lg shadow-sm p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">Orden General</h2>

            <div className="space-y-4">
              {/* Tipo */}
              <DropdownField
                label="Tipo"
                value={generalFormData.tipo}
                onChange={(e) => setGeneralFormData({ ...generalFormData, tipo: e.target.value as TipoTrabajo })}
                options={tipoOptions}
                error={errors.tipo}
              />

              {/* Equipo */}
              <FormField
                label="Equipo"
                value={generalFormData.equipo}
                onChange={(e) => setGeneralFormData({ ...generalFormData, equipo: e.target.value })}
                error={errors.equipo}
                placeholder="Nombre del equipo"
              />

              {/* Fecha de Emisión */}
              <FormField
                label="Fecha de Emisión"
                value={generalFormData.fechaDeEmision}
                onChange={() => {}} // No-op, field is read-only
                disabled
                type="date"
              />

              {/* Fecha a Ejecutar */}
              <FormField
                label="Fecha a Ejecutar"
                value={generalFormData.fechaAEjecutar}
                onChange={(e) => setGeneralFormData({ ...generalFormData, fechaAEjecutar: e.target.value })}
                error={errors.fechaAEjecutar}
                type="date"
              />

              {/* Técnicos Asignados */}
              <TechniciansInput
                label="Técnicos Asignados"
                technicians={generalFormData.tecnicosAsignados}
                onAdd={handleAddTechnician}
                onRemove={handleRemoveTechnician}
                error={errors.tecnicosAsignados}
              />

              {/* Descripción */}
              <TextareaField
                label="Descripción"
                value={generalFormData.descripcion}
                onChange={(e) => setGeneralFormData({ ...generalFormData, descripcion: e.target.value })}
                placeholder="Descripción del trabajo (opcional)"
                required={false}
              />
            </div>

            {/* Submit Button */}
            <div className="mt-6 flex justify-end">
              <button
                type="submit"
                disabled={submitting}
                className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-medium flex items-center gap-2"
              >
                {submitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Guardando...
                  </>
                ) : (
                  <>
                    <Save size={18} />
                    Crear Orden
                  </>
                )}
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleSubmit} className="bg-white border rounded-lg shadow-sm p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">Orden de Taller</h2>

            <div className="space-y-4">
              {/* Vehicle Type Selection */}
              <div className="flex flex-col">
                <label className="text-sm font-medium text-gray-700 mb-2">
                  Tipo de Vehículo <span className="text-red-500">*</span>
                </label>
                <div className="flex gap-6">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="vehicleType"
                      value="interno"
                      checked={tallerFormData.vehicleType === 'interno'}
                      onChange={(e) => {
                        setTallerFormData({ 
                          ...tallerFormData, 
                          vehicleType: 'interno',
                          unidadMovil: '' // Reset field when switching
                        });
                      }}
                      className="w-4 h-4 text-blue-600 focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">Vehículo Interno</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="vehicleType"
                      value="externo"
                      checked={tallerFormData.vehicleType === 'externo'}
                      onChange={(e) => {
                        setTallerFormData({ 
                          ...tallerFormData, 
                          vehicleType: 'externo',
                          unidadMovil: '' // Reset field when switching
                        });
                      }}
                      className="w-4 h-4 text-blue-600 focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">Vehículo Externo</span>
                  </label>
                </div>
                {errors.vehicleType && (
                  <div className="mt-1 flex items-center gap-1 text-red-600 text-xs">
                    <AlertCircle size={12} />
                    <span>{errors.vehicleType}</span>
                  </div>
                )}
              </div>

              {/* Unidad Móvil - Dropdown (interno) or Text Input (externo) */}
              {tallerFormData.vehicleType === 'interno' ? (
                <DropdownField
                  label="Unidad Móvil"
                  value={tallerFormData.unidadMovil}
                  onChange={(e) => setTallerFormData({ ...tallerFormData, unidadMovil: e.target.value })}
                  options={internalVehicles}
                  error={errors.unidadMovil}
                  placeholder="Seleccione una unidad móvil"
                  disabled={false}
                />
              ) : tallerFormData.vehicleType === 'externo' ? (
                <FormField
                  label="Unidad Móvil"
                  value={tallerFormData.unidadMovil}
                  onChange={(e) => setTallerFormData({ ...tallerFormData, unidadMovil: e.target.value })}
                  error={errors.unidadMovil}
                  placeholder="Ingrese la unidad móvil"
                  disabled={false}
                />
              ) : (
                <div className="flex flex-col opacity-50">
                  <label className="text-sm font-medium text-gray-700 mb-1">
                    Unidad Móvil <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    disabled
                    placeholder="Seleccione primero el tipo de vehículo"
                    className="px-3 py-2 border border-gray-300 rounded-md bg-gray-100 cursor-not-allowed"
                  />
                </div>
              )}

              {/* Conductor */}
              <FormField
                label="Conductor"
                value={tallerFormData.conductor}
                onChange={(e) => setTallerFormData({ ...tallerFormData, conductor: e.target.value })}
                error={errors.conductor}
                placeholder="Nombre del conductor"
              />

              {/* Kilometraje */}
              <FormField
                label="Kilometraje"
                value={tallerFormData.kilometraje}
                onChange={(e) => setTallerFormData({ ...tallerFormData, kilometraje: e.target.value })}
                placeholder="0"
                type="number"
                required={false}
              />

              {/* Horómetro */}
              <FormField
                label="Horómetro"
                value={tallerFormData.horometro}
                onChange={(e) => setTallerFormData({ ...tallerFormData, horometro: e.target.value })}
                placeholder="0"
                type="number"
                required={false}
              />

              {/* Fecha de Emisión */}
              <FormField
                label="Fecha de Emisión"
                value={tallerFormData.fechaDeEmision}
                onChange={() => {}} // No-op, field is read-only
                disabled
                type="date"
              />

              {/* Fecha a Ejecutar */}
              <FormField
                label="Fecha a Ejecutar"
                value={tallerFormData.fechaAEjecutar}
                onChange={(e) => setTallerFormData({ ...tallerFormData, fechaAEjecutar: e.target.value })}
                error={errors.fechaAEjecutar}
                type="date"
              />

              {/* Descripción */}
              <TextareaField
                label="Descripción"
                value={tallerFormData.descripcion}
                onChange={(e) => setTallerFormData({ ...tallerFormData, descripcion: e.target.value })}
                placeholder="Descripción del trabajo (opcional)"
                required={false}
              />

              {/* Observaciones */}
              <TextareaField
                label="Observaciones"
                value={tallerFormData.observaciones}
                onChange={(e) => setTallerFormData({ ...tallerFormData, observaciones: e.target.value })}
                placeholder="Observaciones adicionales (opcional)"
                required={false}
              />
            </div>

            {/* Submit Button */}
            <div className="mt-6 flex justify-end">
              <button
                type="submit"
                disabled={submitting}
                className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-medium flex items-center gap-2"
              >
                {submitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Guardando...
                  </>
                ) : (
                  <>
                    <Save size={18} />
                    Crear Orden
                  </>
                )}
              </button>
            </div>
          </form>
        )}

        {/* Toast Notification */}
        {toast && (
          <div
            role="alert"
            aria-live="polite"
            className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 w-[min(95vw,420px)] shadow-lg border bg-white px-4 py-3 rounded-md text-sm flex items-center gap-2"
          >
            {toast.type === 'success' ? (
              <CheckCircle className="text-green-500 shrink-0" size={18} />
            ) : (
              <AlertCircle className="text-red-500 shrink-0" size={18} />
            )}
            <span className="text-gray-800">{toast.message}</span>
            <button
              onClick={() => setToast(null)}
              className="ml-auto text-gray-500 hover:text-gray-700"
              aria-label="Dismiss message"
            >
              <X size={16} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}