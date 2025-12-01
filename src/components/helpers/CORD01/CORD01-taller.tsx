// CORD01-taller.tsx
"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Save, AlertCircle } from "lucide-react";
import { useAuth } from "../../auth-context";
import { doc, setDoc, serverTimestamp, collection, getDoc } from "firebase/firestore";
import { db } from "../../../lib/firebase/client";
import { GlobalToast } from "../../Globaltoast";

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
  disabled = false,
  placeholder = 'Seleccione una opción',
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

const TextareaField = ({
  label,
  value,
  onChange,
  placeholder = '',
  rows = 3,
  required = false,
  error
}: {
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  placeholder?: string;
  rows?: number;
  required?: boolean;
  error?: string;
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

export default function CORD01Taller() {
  const { user } = useAuth();
  
  const [formData, setFormData] = useState<TallerFormData>({
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

  const showToast = useCallback((type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 5000);
  }, []);

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

  const validateForm = useCallback((): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.vehicleType) {
      newErrors.vehicleType = 'Seleccione el tipo de vehículo';
    }
    if (!formData.unidadMovil.trim()) {
      newErrors.unidadMovil = 'Seleccione o ingrese la unidad móvil';
    }
    if (!formData.conductor.trim()) {
      newErrors.conductor = 'Ingrese el conductor';
    }
    if (!formData.fechaAEjecutar) {
      newErrors.fechaAEjecutar = 'Seleccione la fecha a ejecutar';
    }
    if (!formData.descripcion.trim()) {
      newErrors.descripcion = 'Ingrese la descripción del trabajo';
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
        orderType: 'Taller',
        state: false,
        createdAt: serverTimestamp(),
        createdBy: user.uid,
        createdByEmail: user.email || '',
        vehicleType: formData.vehicleType,
        mobileUnit: formData.unidadMovil,
        driver: formData.conductor,
        mileage: formData.kilometraje ? parseFloat(formData.kilometraje) : 0,
        hourmeter: formData.horometro ? parseFloat(formData.horometro) : 0,
        issueDate: formData.fechaDeEmision,
        executionDate: formData.fechaAEjecutar,
        description: formData.descripcion,
        observations: formData.observaciones,
        signatureConformity: '',
        verifiedBy: '',
        componentsUsed: {},
        stateSig: false,
        stateUsed: false,
        stateAudit: false,
        stateUsedAudit: false,
      };

      await setDoc(newDocRef, workOrderData);

      showToast('success', `Orden de trabajo creada exitosamente: ${newDocRef.id}`);

      setFormData({
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
      setErrors({});

    } catch (error) {
      console.error('Error creating work order:', error);
      showToast('error', 'Error al crear la orden de trabajo');
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingDefaults) {
    return (
      <div className="bg-white border rounded-lg shadow-sm p-12 text-center">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-gray-600">Cargando configuración...</p>
      </div>
    );
  }

  return (
    <>
      <form onSubmit={handleSubmit} className="bg-white border rounded-lg shadow-sm p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-6">Orden de Taller</h2>

        <div className="space-y-4">
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
                  checked={formData.vehicleType === 'interno'}
                  onChange={() => {
                    setFormData({ 
                      ...formData, 
                      vehicleType: 'interno',
                      unidadMovil: ''
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
                  checked={formData.vehicleType === 'externo'}
                  onChange={() => {
                    setFormData({ 
                      ...formData, 
                      vehicleType: 'externo',
                      unidadMovil: ''
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

          {formData.vehicleType === 'interno' ? (
            <DropdownField
              label="Unidad Móvil"
              value={formData.unidadMovil}
              onChange={(e) => setFormData({ ...formData, unidadMovil: e.target.value })}
              options={internalVehicles}
              error={errors.unidadMovil}
              placeholder="Seleccione una unidad móvil"
            />
          ) : formData.vehicleType === 'externo' ? (
            <FormField
              label="Unidad Móvil"
              value={formData.unidadMovil}
              onChange={(e) => setFormData({ ...formData, unidadMovil: e.target.value })}
              error={errors.unidadMovil}
              placeholder="Ingrese la unidad móvil"
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

          <FormField
            label="Conductor"
            value={formData.conductor}
            onChange={(e) => setFormData({ ...formData, conductor: e.target.value })}
            error={errors.conductor}
            placeholder="Nombre del conductor"
          />

          <FormField
            label="Kilometraje"
            value={formData.kilometraje}
            onChange={(e) => setFormData({ ...formData, kilometraje: e.target.value })}
            placeholder="0"
            type="number"
            required={false}
          />

          <FormField
            label="Horómetro"
            value={formData.horometro}
            onChange={(e) => setFormData({ ...formData, horometro: e.target.value })}
            placeholder="0"
            type="number"
            required={false}
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

          <TextareaField
            label="Descripción"
            value={formData.descripcion}
            onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
            placeholder="Descripción del trabajo"
            required={true}
            error={errors.descripcion}
          />

          <TextareaField
            label="Observaciones"
            value={formData.observaciones}
            onChange={(e) => setFormData({ ...formData, observaciones: e.target.value })}
            placeholder="Observaciones adicionales (opcional)"
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