"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Package, Save, AlertCircle, CheckCircle, X } from "lucide-react";
import { useAuth } from "../auth-context";
import { doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../../lib/firebase/client";

// Form data type
type MaterialForm = {
  codigo: string;
  descripcion: string;
  categoria: string;
  subcategoria: string;
  stockMinimo: string;
  unidadDeMedida: string;
  estado: string;
};

// Validation result type
type ValidationResult = {
  isValid: boolean;
  errors: Partial<Record<keyof MaterialForm, string>>;
};

// Utility function to format date
const formatDate = (date: Date): string => {
  return date.toISOString().split('T')[0];
};

// Simple Form Field Component
const FormField = ({ 
  label, 
  value, 
  onChange, 
  error, 
  disabled = false,
  placeholder = ''
}: {
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  error?: string;
  disabled?: boolean;
  placeholder?: string;
}) => {
  return (
    <div className="flex flex-col">
      <label className="text-sm font-medium text-gray-700 mb-1">
        {label} <span className="text-red-500">*</span>
      </label>
      <input
        type="text"
        value={value}
        onChange={onChange}
        disabled={disabled}
        placeholder={placeholder}
        className={`px-3 py-2 border rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${
          error ? 'border-red-300 bg-red-50' : 'border-gray-300'
        } ${disabled ? 'bg-gray-100 cursor-not-allowed' : ''}`}
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

export default function CMAT01Module() {
  const { user } = useAuth();
  
  const initialForm: MaterialForm = useMemo(() => ({
    codigo: '',
    descripcion: '',
    categoria: '',
    subcategoria: '',
    stockMinimo: '',
    unidadDeMedida: '',
    estado: ''
  }), []);

  const [form, setForm] = useState<MaterialForm>(initialForm);
  const [validation, setValidation] = useState<ValidationResult>({ isValid: true, errors: {} });
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  const [currentDate] = useState(formatDate(new Date()));

  useEffect(() => {
    console.log("[CMAT01] Module mounted — Creación de Materiales");
  }, []);

  // Validate form
  const validateForm = useCallback((data: MaterialForm): ValidationResult => {
    const errors: Partial<Record<keyof MaterialForm, string>> = {};
    
    if (!data.codigo.trim()) errors.codigo = 'El código es requerido';
    if (!data.descripcion.trim()) errors.descripcion = 'La descripción es requerida';
    if (!data.categoria.trim()) errors.categoria = 'La categoría es requerida';
    if (!data.subcategoria.trim()) errors.subcategoria = 'La subcategoría es requerida';
    if (!data.stockMinimo.trim()) errors.stockMinimo = 'El stock mínimo es requerido';
    if (!data.unidadDeMedida.trim()) errors.unidadDeMedida = 'La unidad de medida es requerida';
    if (!data.estado.trim()) errors.estado = 'El estado es requerido';
    
    return { isValid: Object.keys(errors).length === 0, errors };
  }, []);

  // Update field handler
  const updateField = useCallback((key: keyof MaterialForm) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const newForm = { ...form, [key]: value };
    setForm(newForm);
    
    if (validation.errors[key]) {
      setValidation(prev => ({ ...prev, errors: { ...prev.errors, [key]: undefined } }));
    }
  }, [form, validation.errors]);

  // Show toast
  const showToast = useCallback((type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  }, []);

  // Check if material code already exists
  const checkMaterialExists = async (codigo: string): Promise<boolean> => {
    try {
      const docRef = doc(db, 'CMAT01', codigo);
      const docSnap = await getDoc(docRef);
      return docSnap.exists();
    } catch (error) {
      console.error('[CMAT01] Error checking material:', error);
      return false;
    }
  };

  // Save material
  const handleSave = useCallback(async () => {
    const validationResult = validateForm(form);
    setValidation(validationResult);
    
    if (!validationResult.isValid) {
      showToast('error', 'Por favor, complete todos los campos requeridos');
      return;
    }

    if (!user?.uid) {
      showToast('error', 'Usuario no autenticado');
      return;
    }

    setSaving(true);
    
    try {
      // Check if material already exists
      const exists = await checkMaterialExists(form.codigo);
      if (exists) {
        showToast('error', `El material con código ${form.codigo} ya existe`);
        setSaving(false);
        return;
      }

      // Save to Firestore
      const materialData = {
        codigo: form.codigo,
        descripcion: form.descripcion,
        categoria: form.categoria,
        subcategoria: form.subcategoria,
        stockMinimo: form.stockMinimo,
        unidadDeMedida: form.unidadDeMedida,
        fechaDeCreacion: currentDate,
        estado: form.estado,
        createdAt: serverTimestamp(),
        createdBy: user.uid,
        createdByEmail: user.email || ''
      };

      await setDoc(doc(db, 'CMAT01', form.codigo), materialData);
      
      console.log('[CMAT01] Material created successfully:', form.codigo);
      showToast('success', `Material ${form.codigo} creado exitosamente`);
      
      // Reset form after 2 seconds
      setTimeout(() => {
        setForm(initialForm);
        setValidation({ isValid: true, errors: {} });
      }, 2000);
      
    } catch (error) {
      console.error('[CMAT01] Error saving material:', error);
      showToast('error', 'Error al guardar el material');
    } finally {
      setSaving(false);
    }
  }, [form, validateForm, user, initialForm, showToast, currentDate]);

  // Reset form
  const handleReset = useCallback(() => {
    setForm(initialForm);
    setValidation({ isValid: true, errors: {} });
  }, [initialForm]);

  return (
    <section className="w-full p-6 bg-gray-50 min-h-full">
      <header className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-purple-100 rounded-lg">
            <Package className="text-purple-600" size={24} />
          </div>
          <h1 className="text-2xl font-semibold text-gray-900">
            CMAT01 — Creación de Materiales
          </h1>
        </div>
      </header>

      <div className="bg-white border rounded-lg p-8 shadow-sm max-w-2xl space-y-4">
        <FormField
          label="Código"
          value={form.codigo}
          onChange={updateField('codigo')}
          error={validation.errors.codigo}
          disabled={saving}
          placeholder="Ingrese el código del material"
        />

        <FormField
          label="Descripción"
          value={form.descripcion}
          onChange={updateField('descripcion')}
          error={validation.errors.descripcion}
          disabled={saving}
          placeholder="Ingrese la descripción"
        />

        <FormField
          label="Categoría"
          value={form.categoria}
          onChange={updateField('categoria')}
          error={validation.errors.categoria}
          disabled={saving}
          placeholder="Ingrese la categoría"
        />

        <FormField
          label="Subcategoría"
          value={form.subcategoria}
          onChange={updateField('subcategoria')}
          error={validation.errors.subcategoria}
          disabled={saving}
          placeholder="Ingrese la subcategoría"
        />

        <FormField
          label="Stock Mínimo"
          value={form.stockMinimo}
          onChange={updateField('stockMinimo')}
          error={validation.errors.stockMinimo}
          disabled={saving}
          placeholder="Ingrese el stock mínimo"
        />

        <FormField
          label="Unidad de Medida"
          value={form.unidadDeMedida}
          onChange={updateField('unidadDeMedida')}
          error={validation.errors.unidadDeMedida}
          disabled={saving}
          placeholder="Ingrese la unidad de medida"
        />

        <FormField
          label="Estado"
          value={form.estado}
          onChange={updateField('estado')}
          error={validation.errors.estado}
          disabled={saving}
          placeholder="Ingrese el estado"
        />

        <FormField
          label="Fecha de Creación"
          value={currentDate}
          onChange={() => {}}
          disabled={true}
        />

        <div className="flex flex-col">
          <label className="text-sm font-medium text-gray-700 mb-1">
            Usuario
          </label>
          <input
            type="text"
            value={user?.email || 'No autenticado'}
            disabled
            className="px-3 py-2 border rounded-md bg-gray-100 cursor-not-allowed border-gray-300"
          />
        </div>

        {/* Form Actions */}
        <div className="flex gap-4 pt-6 border-t border-gray-200">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="bg-blue-600 text-white px-6 py-2.5 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-medium flex items-center gap-2"
          >
            {saving ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Guardando...
              </>
            ) : (
              <>
                <Save size={16} />
                Guardar
              </>
            )}
          </button>
          
          <button
            type="button"
            onClick={handleReset}
            disabled={saving}
            className="bg-gray-100 text-gray-700 px-6 py-2.5 rounded-md hover:bg-gray-200 disabled:opacity-50 transition-colors font-medium"
          >
            Limpiar
          </button>
        </div>
      </div>

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
    </section>
  );
}