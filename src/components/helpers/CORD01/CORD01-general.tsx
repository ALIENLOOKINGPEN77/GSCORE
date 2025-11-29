// CORD01-general.tsx
"use client";

import React, { useCallback, useState } from "react";
import { Save, AlertCircle, X } from "lucide-react";
import { useAuth } from "../../auth-context";
import { doc, setDoc, serverTimestamp, collection } from "firebase/firestore";
import { db } from "../../../lib/firebase/client";
import { GlobalToast } from "../../Globaltoast";

type TipoTrabajo = 'Mecanico' | 'Electrico' | 'Preventivo' | 'Correctivo' | 'Otro';

type GeneralFormData = {
  tipo: TipoTrabajo | '';
  equipo: string;
  fechaDeEmision: string;
  fechaAEjecutar: string;
  tecnicosAsignados: string[];
  descripcion: string;
};

type ToastMessage = {
  type: 'success' | 'error';
  message: string;
};

const formatDate = (date: Date): string => {
  return date.toISOString().split('T')[0];
};

const getTodayDate = (): string => {
  return formatDate(new Date());
};

const DropdownField = ({
  label,
  value,
  onChange,
  options,
  error,
  placeholder = 'Seleccione una opción',
}: {
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  options: string[];
  error?: string;
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
        className={`px-3 py-2 border rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white ${
          error ? 'border-red-300 bg-red-50' : 'border-gray-300'
        }`}
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

const FormField = ({
  label,
  value,
  onChange,
  error,
  disabled = false,
  placeholder = '',
  type = 'text'
}: {
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  error?: string;
  disabled?: boolean;
  placeholder?: string;
  type?: string;
}) => {
  return (
    <div className="flex flex-col">
      <label className="text-sm font-medium text-gray-700 mb-1">
        {label} <span className="text-red-500">*</span>
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

const TextareaField = ({
  label,
  value,
  onChange,
  placeholder = '',
  rows = 3
}: {
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  placeholder?: string;
  rows?: number;
}) => {
  return (
    <div className="flex flex-col">
      <label className="text-sm font-medium text-gray-700 mb-1">
        {label}
      </label>
      <textarea
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        rows={rows}
        className="px-3 py-2 border border-gray-300 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
      />
    </div>
  );
};

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

export default function CORD01General() {
  const { user } = useAuth();
  
  const [formData, setFormData] = useState<GeneralFormData>({
    tipo: '',
    equipo: '',
    fechaDeEmision: getTodayDate(),
    fechaAEjecutar: '',
    tecnicosAsignados: [],
    descripcion: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<ToastMessage | null>(null);

  const showToast = useCallback((type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 5000);
  }, []);

  const tipoOptions: TipoTrabajo[] = ['Mecanico', 'Electrico', 'Preventivo', 'Correctivo', 'Otro'];

  const validateForm = useCallback((): boolean => {
    const newErrors: Record<string, string> = {};

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

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      showToast('error', 'Por favor complete todos los campos requeridos');
      return;
    }

    if (!user) {
      showToast('error', 'Usuario no autenticado');
      return;
    }

    try {
      setSubmitting(true);

      const newDocRef = doc(collection(db, 'CORD01'));

      const workOrderData = {
        orderId: newDocRef.id,
        orderType: 'General',
        state: false,
        createdAt: serverTimestamp(),
        createdBy: user.uid,
        createdByEmail: user.email || '',
        type: formData.tipo,
        equipment: formData.equipo,
        issueDate: formData.fechaDeEmision,
        executionDate: formData.fechaAEjecutar,
        assignedTechnicians: formData.tecnicosAsignados,
        description: formData.descripcion,
        workPerformed: '',
        verifiedBy: '',
        stateSig: false,
        stateUsed: false,
        stateAudit: false,
        stateUsedAudit: false,
        componentsUsed: {},
      };

      await setDoc(newDocRef, workOrderData);

      showToast('success', `Orden de trabajo creada exitosamente: ${newDocRef.id}`);

      setFormData({
        tipo: '',
        equipo: '',
        fechaDeEmision: getTodayDate(),
        fechaAEjecutar: '',
        tecnicosAsignados: [],
        descripcion: '',
      });
      setErrors({});

    } catch (error) {
      console.error('Error creating work order:', error);
      showToast('error', 'Error al crear la orden de trabajo');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddTechnician = useCallback((technician: string) => {
    setFormData(prev => ({
      ...prev,
      tecnicosAsignados: [...prev.tecnicosAsignados, technician],
    }));
  }, []);

  const handleRemoveTechnician = useCallback((index: number) => {
    setFormData(prev => ({
      ...prev,
      tecnicosAsignados: prev.tecnicosAsignados.filter((_, i) => i !== index),
    }));
  }, []);

  return (
    <>
      <form onSubmit={handleSubmit} className="bg-white border rounded-lg shadow-sm p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-6">Orden General</h2>

        <div className="space-y-4">
          <DropdownField
            label="Tipo"
            value={formData.tipo}
            onChange={(e) => setFormData({ ...formData, tipo: e.target.value as TipoTrabajo })}
            options={tipoOptions}
            error={errors.tipo}
          />

          <FormField
            label="Equipo"
            value={formData.equipo}
            onChange={(e) => setFormData({ ...formData, equipo: e.target.value })}
            error={errors.equipo}
            placeholder="Nombre del equipo"
          />

          <FormField
            label="Fecha de Emisión"
            value={formData.fechaDeEmision}
            onChange={() => {}}
            disabled
            type="date"
          />

          <FormField
            label="Fecha a Ejecutar"
            value={formData.fechaAEjecutar}
            onChange={(e) => setFormData({ ...formData, fechaAEjecutar: e.target.value })}
            error={errors.fechaAEjecutar}
            type="date"
          />

          <TechniciansInput
            label="Técnicos Asignados"
            technicians={formData.tecnicosAsignados}
            onAdd={handleAddTechnician}
            onRemove={handleRemoveTechnician}
            error={errors.tecnicosAsignados}
          />

          <TextareaField
            label="Descripción"
            value={formData.descripcion}
            onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
            placeholder="Descripción del trabajo (opcional)"
          />
        </div>

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

      {toast && <GlobalToast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </>
  );
}