"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Package, Save, AlertCircle, CheckCircle, X } from "lucide-react";
import { useAuth } from "../auth-context";
import { doc, setDoc, serverTimestamp, collection, getDocs, query, getDoc } from "firebase/firestore";
import { db } from "../../lib/firebase/client";

// Form data type
type MaterialForm = {
  zona: string;
  categoria: string;
  subcategoria: string;
  codigo: string;
  descripcion: string;
  stockMinimo: string;
  unidadDeMedida: string;
  marca: string;
  proveedor: string;
};

// Validation result type
type ValidationResult = {
  isValid: boolean;
  errors: Partial<Record<keyof MaterialForm, string>>;
};

// Defaults type
type DefaultsData = {
  category: string[];
  subcategories: Record<string, string[]>;
  zone: string[];
};

// Utility function to format date
const formatDate = (date: Date): string => {
  return date.toISOString().split('T')[0];
};

// Dropdown Field Component
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

// Simple Form Field Component
const FormField = ({
  label,
  value,
  onChange,
  error,
  disabled = false,
  placeholder = '',
  required = true
}: {
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
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
    zona: '',
    categoria: '',
    subcategoria: '',
    codigo: '',
    descripcion: '',
    stockMinimo: '',
    unidadDeMedida: '',
    marca: '',
    proveedor: ''
  }), []);

  const [form, setForm] = useState<MaterialForm>(initialForm);
  const [validation, setValidation] = useState<ValidationResult>({ isValid: true, errors: {} });
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  const [currentDate] = useState(formatDate(new Date()));
  const [defaults, setDefaults] = useState<DefaultsData | null>(null);
  const [loadingDefaults, setLoadingDefaults] = useState(true);
  const [nextDocId, setNextDocId] = useState<string>('');
  const [nextCategoryNumber, setNextCategoryNumber] = useState<string>('');

  // Load defaults from database
  useEffect(() => {
    const loadDefaults = async () => {
      try {
        const defaultsRef = doc(db, 'defaults', 'inventory_default_codes');
        const defaultsSnap = await getDoc(defaultsRef);
        
        if (defaultsSnap.exists()) {
          const data = defaultsSnap.data();
          setDefaults({
            category: data.category || [],
            subcategories: data.subcategories || {},
            zone: data.zone || []
          });
        } else {
          console.error('[CMAT01] Defaults document not found');
          showToast('error', 'No se pudieron cargar las opciones por defecto');
        }
      } catch (error) {
        console.error('[CMAT01] Error loading defaults:', error);
        showToast('error', 'Error al cargar las opciones por defecto');
      } finally {
        setLoadingDefaults(false);
      }
    };

    loadDefaults();
  }, []);

  // Generate next document ID and category number when zona, categoria, or subcategoria changes
  useEffect(() => {
    const generateNumbers = async () => {
      if (!form.zona || !form.categoria || !form.subcategoria) {
        setNextDocId('');
        setNextCategoryNumber('');
        setForm(prev => ({ ...prev, codigo: '' }));
        return;
      }

      try {
        // Get all documents in CMAT01 to determine next document ID
        const cmat01Ref = collection(db, 'CMAT01');
        const allDocsSnapshot = await getDocs(query(cmat01Ref));
        
        // Next document ID (000001 to 999999)
        const nextDocNumber = (allDocsSnapshot.size + 1).toString().padStart(6, '0');
        setNextDocId(nextDocNumber);

        // Count documents with same zona-categoria-subcategoria for category numbering
        let categoryCount = 0;
        const prefix = `${form.zona}-${form.categoria}-${form.subcategoria}`;
        
        allDocsSnapshot.forEach((doc) => {
          const data = doc.data();
          const docPrefix = `${data.zona}-${data.categoria}-${data.subcategoria}`;
          if (docPrefix === prefix) {
            categoryCount++;
          }
        });

        // Next category number (0001, 0002, etc.)
        const nextCatNum = (categoryCount + 1).toString().padStart(4, '0');
        setNextCategoryNumber(nextCatNum);
        
        // Generate full code
        const fullCode = `${prefix}-${nextCatNum}`;
        setForm(prev => ({ ...prev, codigo: fullCode }));
      } catch (error) {
        console.error('[CMAT01] Error generating numbers:', error);
        showToast('error', 'Error al generar el código');
      }
    };

    generateNumbers();
  }, [form.zona, form.categoria, form.subcategoria]);

  // Validate form
  const validateForm = useCallback((data: MaterialForm): ValidationResult => {
    const errors: Partial<Record<keyof MaterialForm, string>> = {};

    if (!data.zona) errors.zona = 'La zona es requerida';
    if (!data.categoria) errors.categoria = 'La categoría es requerida';
    if (!data.subcategoria) errors.subcategoria = 'La subcategoría es requerida';
    if (!data.codigo.trim()) errors.codigo = 'El código es requerido';
    if (!data.descripcion.trim()) errors.descripcion = 'La descripción es requerida';
    if (!data.stockMinimo.trim()) errors.stockMinimo = 'El stock mínimo es requerido';
    if (!data.unidadDeMedida.trim()) errors.unidadDeMedida = 'La unidad de medida es requerida';
    // Note: marca and proveedor are optional, no validation needed

    return {
      isValid: Object.keys(errors).length === 0,
      errors
    };
  }, []);

  // Update field handler
  const updateField = useCallback((field: keyof MaterialForm) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm(prev => ({ ...prev, [field]: e.target.value }));
  }, []);

  // Update dropdown field handler
  const updateDropdownField = useCallback((field: keyof MaterialForm) => (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    setForm(prev => {
      const newForm = { ...prev, [field]: value };
      
      // Reset subcategoria if categoria changes
      if (field === 'categoria') {
        newForm.subcategoria = '';
      }
      
      return newForm;
    });
  }, []);

  // Show toast message
  const showToast = useCallback((type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 5000);
  }, []);

  // Save material
// Save material
const handleSave = useCallback(async () => {
  // Check if user is authenticated
  if (!user) {
    showToast('error', 'Usuario no autenticado');
    return;
  }

  const validationResult = validateForm(form);
  setValidation(validationResult);

  if (!validationResult.isValid) {
    showToast('error', 'Por favor complete todos los campos requeridos');
    return;
  }

  if (!nextDocId) {
    showToast('error', 'Error al generar ID de documento');
    return;
  }

  setSaving(true);

  try {
    // Prepare material data with "default" for empty marca and proveedor
    const materialData = {
      documentId: nextDocId,
      zona: form.zona,
      categoria: form.categoria,
      subcategoria: form.subcategoria,
      categoryNumber: nextCategoryNumber,
      codigo: form.codigo,
      descripcion: form.descripcion,
      stockMinimo: form.stockMinimo,
      unidadDeMedida: form.unidadDeMedida,
      fechaDeCreacion: currentDate,
      marca: form.marca.trim() === '' ? 'default' : form.marca,
      proveedor: form.proveedor.trim() === '' ? 'default' : form.proveedor,
      createdAt: serverTimestamp(),
      createdBy: user.uid,
      createdByEmail: user.email || ''
    };

    // Save to CMAT01 collection with sequential document ID
    await setDoc(doc(db, 'CMAT01', nextDocId), materialData);

    console.log('[CMAT01] Material created successfully:', form.codigo, 'Document ID:', nextDocId);
    showToast('success', `Material ${form.codigo} creado exitosamente (ID: ${nextDocId})`);

    // Reset form after 2 seconds
    setTimeout(() => {
      setForm(initialForm);
      setValidation({ isValid: true, errors: {} });
      setNextDocId('');
      setNextCategoryNumber('');
    }, 2000);

  } catch (error) {
    console.error('[CMAT01] Error saving material:', error);
    showToast('error', 'Error al guardar el material');
  } finally {
    setSaving(false);
  }
}, [form, validateForm, user, initialForm, showToast, currentDate, nextDocId, nextCategoryNumber]);

  // Reset form
  const handleReset = useCallback(() => {
    setForm(initialForm);
    setValidation({ isValid: true, errors: {} });
    setNextDocId('');
    setNextCategoryNumber('');
  }, [initialForm]);

  // Get available subcategories based on selected category
  const availableSubcategories = useMemo(() => {
    if (!defaults || !form.categoria) return [];
    return defaults.subcategories[form.categoria] || [];
  }, [defaults, form.categoria]);

  if (loadingDefaults) {
    return (
      <section className="w-full p-6 bg-gray-50 min-h-full flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Cargando...</p>
        </div>
      </section>
    );
  }

  return (
    <section className="w-full p-6 bg-gray-50 min-h-full">
      <header className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-purple-100 rounded-lg">
            <Package className="text-purple-600" size={24} />
          </div>
          <h1 className="text-2xl font-semibold text-gray-900">
            CMAT01 – Creación de Materiales
          </h1>
        </div>
      </header>

      <div className="bg-white border rounded-lg p-8 shadow-sm max-w-2xl space-y-4">

        {/* Código Generation Section */}
        <div className="space-y-4 pb-4 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-900">Código del Material</h2>
          
          <div className="grid grid-cols-3 gap-4">
            <DropdownField
              label="Zona"
              value={form.zona}
              onChange={updateDropdownField('zona')}
              options={defaults?.zone || []}
              error={validation.errors.zona}
              disabled={saving}
              placeholder="Zona"
            />

            <DropdownField
              label="Categoría"
              value={form.categoria}
              onChange={updateDropdownField('categoria')}
              options={defaults?.category || []}
              error={validation.errors.categoria}
              disabled={saving}
              placeholder="Categoría"
            />

            <DropdownField
              label="Subcategoría"
              value={form.subcategoria}
              onChange={updateDropdownField('subcategoria')}
              options={availableSubcategories}
              error={validation.errors.subcategoria}
              disabled={saving || !form.categoria}
              placeholder="Subcategoría"
            />
          </div>

          {/* Display generated code */}
          {form.codigo && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-gray-600 mb-1">Código generado:</p>
              <p className="text-2xl font-mono font-bold text-blue-900">{form.codigo}</p>
            </div>
          )}
        </div>

        {/* Material Details Section */}
        <FormField
          label="Descripción"
          value={form.descripcion}
          onChange={updateField('descripcion')}
          error={validation.errors.descripcion}
          disabled={saving}
          placeholder="Ingrese la descripción"
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
          label="Marca"
          value={form.marca}
          onChange={updateField('marca')}
          error={validation.errors.marca}
          disabled={saving}
          placeholder="Ingrese la marca (opcional)"
          required={false}
        />

        <FormField
          label="Proveedor"
          value={form.proveedor}
          onChange={updateField('proveedor')}
          error={validation.errors.proveedor}
          disabled={saving}
          placeholder="Ingrese el proveedor (opcional)"
          required={false}
        />

        <FormField
          label="Fecha de Creación"
          value={currentDate}
          onChange={() => { }}
          disabled={true}
          required={false}
        />

        {/* Form Actions */}
        <div className="flex gap-4 pt-6 border-t border-gray-200">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !form.codigo || !nextDocId}
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