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
};

type ValidationResult = {
  isValid: boolean;
  errors: Partial<Record<keyof GeneralFormData, string>>;
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
  placeholder = 'Seleccione una opción'
}: {
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  options: string[];
  error?: string;
  disabled?: boolean;
  placeholder?: string;
}) => {
  return (
    <div className="flex flex-col">
      <label className="text-sm font-medium text-gray-700 mb-1">
        {label} <span className="text-red-500">*</span>
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
  const [formData, setFormData] = useState<GeneralFormData>({
    tipo: '',
    equipo: '',
    fechaDeEmision: getTodayDate(),
    fechaAEjecutar: '',
    tecnicosAsignados: [],
  });
  const [errors, setErrors] = useState<Partial<Record<keyof GeneralFormData, string>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<ToastMessage | null>(null);

  // Hardcoded tipo options
  const tipoOptions: TipoTrabajo[] = ['Mecanico', 'Electrico', 'Preventivo', 'Correctivo', 'Otro'];

  // Show toast
  const showToast = useCallback((type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 5000);
  }, []);

  // Validate form
  const validateForm = useCallback((): ValidationResult => {
    const newErrors: Partial<Record<keyof GeneralFormData, string>> = {};

    if (!formData.tipo) {
      newErrors.tipo = 'Seleccione un tipo de trabajo';
    }

    if (!formData.equipo.trim()) {
      newErrors.equipo = 'Ingrese el equipo';
    }

    if (!formData.fechaAEjecutar) {
      newErrors.fechaAEjecutar = 'Seleccione la fecha a ejecutar';
    }

    if (formData.tecnicosAsignados.length === 0) {
      newErrors.tecnicosAsignados = 'Agregue al menos un técnico';
    }

    return {
      isValid: Object.keys(newErrors).length === 0,
      errors: newErrors,
    };
  }, [formData]);

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const validation = validateForm();
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

      // Prepare data for Firestore
      const workOrderData = {
        orderId: newDocRef.id,
        orderType: orderType,
        type: formData.tipo,
        equipment: formData.equipo,
        issueDate: formData.fechaDeEmision,
        executionDate: formData.fechaAEjecutar,
        assignedTechnicians: formData.tecnicosAsignados,
        workPerformed: '', // Empty, not displayed on creation
        verifiedBy: '', // Empty, not displayed on creation
        componentsUsed: {}, // Empty map
        state: false, // Active order management
        createdAt: serverTimestamp(),
        createdBy: user.uid,
        createdByEmail: user.email || '',
      };

      await setDoc(newDocRef, workOrderData);

      showToast('success', `Orden de trabajo creada exitosamente: ${newDocRef.id}`);

      // Reset form
      setFormData({
        tipo: '',
        equipo: '',
        fechaDeEmision: getTodayDate(),
        fechaAEjecutar: '',
        tecnicosAsignados: [],
      });
      setErrors({});

    } catch (error) {
      console.error('Error creating work order:', error);
      showToast('error', 'Error al crear la orden de trabajo');
    } finally {
      setSubmitting(false);
    }
  };

  // Add technician
  const handleAddTechnician = useCallback((technician: string) => {
    setFormData(prev => ({
      ...prev,
      tecnicosAsignados: [...prev.tecnicosAsignados, technician],
    }));
  }, []);

  // Remove technician
  const handleRemoveTechnician = useCallback((index: number) => {
    setFormData(prev => ({
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
          <p className="text-gray-600">Registro de órdenes de trabajo para mantenimiento y reparaciones</p>
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
        {orderType === 'General' ? (
          <form onSubmit={handleSubmit} className="bg-white border rounded-lg shadow-sm p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">Orden General</h2>

            <div className="space-y-4">
              {/* Tipo */}
              <DropdownField
                label="Tipo"
                value={formData.tipo}
                onChange={(e) => setFormData({ ...formData, tipo: e.target.value as TipoTrabajo })}
                options={tipoOptions}
                error={errors.tipo}
              />

              {/* Equipo */}
              <FormField
                label="Equipo"
                value={formData.equipo}
                onChange={(e) => setFormData({ ...formData, equipo: e.target.value })}
                error={errors.equipo}
                placeholder="Nombre del equipo"
              />

              {/* Fecha de Emisión */}
              <FormField
                label="Fecha de Emisión"
                value={formData.fechaDeEmision}
                onChange={() => {}} // No-op, field is read-only
                disabled
                type="date"
              />

              {/* Fecha a Ejecutar */}
              <FormField
                label="Fecha a Ejecutar"
                value={formData.fechaAEjecutar}
                onChange={(e) => setFormData({ ...formData, fechaAEjecutar: e.target.value })}
                error={errors.fechaAEjecutar}
                type="date"
              />

              {/* Técnicos Asignados */}
              <TechniciansInput
                label="Técnicos Asignados"
                technicians={formData.tecnicosAsignados}
                onAdd={handleAddTechnician}
                onRemove={handleRemoveTechnician}
                error={errors.tecnicosAsignados}
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
          <div className="bg-white border rounded-lg shadow-sm p-12 text-center">
            <div className="text-gray-400 mb-4">
              <FileText size={64} className="mx-auto" />
            </div>
            <h2 className="text-2xl font-semibold text-gray-900 mb-2">Orden de Taller</h2>
            <p className="text-gray-600 text-lg">To Be Developed</p>
            <p className="text-gray-500 text-sm mt-2">Esta funcionalidad estará disponible próximamente</p>
          </div>
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