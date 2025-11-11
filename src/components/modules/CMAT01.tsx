"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Package, Save, AlertCircle, CheckCircle, X } from "lucide-react";
import { useAuth } from "../auth-context";
import { doc, setDoc, serverTimestamp, collection, getDocs, query, getDoc } from "firebase/firestore";
import { db } from "../../lib/firebase/client";

// LABEL MAPPINGS
const ZONA_LABELS: Record<string, string> = {
  'P': 'Planta',
  'T': 'Taller',
  'U': 'Universal'
};

const CATEGORIA_LABELS: Record<string, string> = {
  'LUB': 'Lubricante',
  'REP': 'Repuesto',
  'MAT': 'Material',
  'FIX': 'Activo Fijo'
};

const SUBCATEGORIA_LABELS: Record<string, string> = {
  'G': 'Gasa',
  'A': 'Aceite',
  'O': 'Otros',
  'E': 'Electrico',
  'N': 'Neumatico',
  'M': 'Mecanico',
  'Z': 'Item',
  'X': 'Fijo'
};

const getLabel = (value: string, map: Record<string, string>): string => {
  return map[value] || 'ERROR';
};

// TYPE DEFINITIONS
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

type ValidationResult = {
  isValid: boolean;
  errors: Partial<Record<keyof MaterialForm, string>>;
};

type DefaultsData = {
  category: string[];
  subcategories: Record<string, string[]>;
  zone: string[];
};

const formatDate = (date: Date): string => {
  return date.toISOString().split('T')[0];
};

// FORM COMPONENTS
const DropdownField = ({
  label,
  value,
  onChange,
  options,
  labelMap,
  error,
  disabled = false,
  placeholder = 'Seleccione una opción'
}: {
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  options: string[];
  labelMap?: Record<string, string>;
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
        className={`px-3 py-2 border rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500 ${
          error ? 'border-red-300 bg-red-50' : 'border-gray-300'
        } ${disabled ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'}`}
      >
        <option value="">{placeholder}</option>
        {options.map(option => (
          <option key={option} value={option}>
            {labelMap ? getLabel(option, labelMap) : option}
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
        className={`px-3 py-2 border rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500 ${
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

const Toast = ({ 
  message, 
  type, 
  onClose 
}: { 
  message: string; 
  type: 'success' | 'error'; 
  onClose: () => void;
}) => (
  <div className="fixed top-4 right-4 z-50 animate-slide-in">
    <div className={`rounded-lg shadow-lg p-4 flex items-center gap-3 ${
      type === 'success' ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
    }`}>
      {type === 'success' ? (
        <CheckCircle className="text-green-600" size={20} />
      ) : (
        <AlertCircle className="text-red-600" size={20} />
      )}
      <span className={`font-medium ${
        type === 'success' ? 'text-green-800' : 'text-red-800'
      }`}>
        {message}
      </span>
      <button onClick={onClose} className="ml-2 hover:bg-gray-200 rounded p-1 transition-colors">
        <X size={16} />
      </button>
    </div>
  </div>
);

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

  useEffect(() => {
    const generateNumbers = async () => {
      if (!form.zona || !form.categoria || !form.subcategoria) {
        setNextDocId('');
        setNextCategoryNumber('');
        setForm(prev => ({ ...prev, codigo: '' }));
        return;
      }

      try {
        const cmat01Ref = collection(db, 'CMAT01');
        const allDocsSnapshot = await getDocs(query(cmat01Ref));
        
        const nextDocNumber = (allDocsSnapshot.size + 1).toString().padStart(6, '0');
        setNextDocId(nextDocNumber);

        let categoryCount = 0;
        const prefix = `${form.zona}-${form.categoria}-${form.subcategoria}`;
        
        allDocsSnapshot.forEach((doc) => {
          const data = doc.data();
          const docPrefix = `${data.zona}-${data.categoria}-${data.subcategoria}`;
          if (docPrefix === prefix) categoryCount++;
        });

        const nextCatNum = (categoryCount + 1).toString().padStart(4, '0');
        setNextCategoryNumber(nextCatNum);
        
        const fullCode = `${prefix}-${nextCatNum}`;
        setForm(prev => ({ ...prev, codigo: fullCode }));
      } catch (error) {
        console.error('[CMAT01] Error generating numbers:', error);
        showToast('error', 'Error al generar el código');
      }
    };
    generateNumbers();
  }, [form.zona, form.categoria, form.subcategoria]);

  const validateForm = useCallback((data: MaterialForm): ValidationResult => {
    const errors: Partial<Record<keyof MaterialForm, string>> = {};
    if (!data.zona) errors.zona = 'La zona es requerida';
    if (!data.categoria) errors.categoria = 'La categoría es requerida';
    if (!data.subcategoria) errors.subcategoria = 'La subcategoría es requerida';
    if (!data.codigo.trim()) errors.codigo = 'El código es requerido';
    if (!data.descripcion.trim()) errors.descripcion = 'La descripción es requerida';
    if (!data.stockMinimo.trim()) errors.stockMinimo = 'El stock mínimo es requerido';
    if (!data.unidadDeMedida.trim()) errors.unidadDeMedida = 'La unidad de medida es requerida';
    return { isValid: Object.keys(errors).length === 0, errors };
  }, []);

  const updateField = useCallback((field: keyof MaterialForm) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm(prev => ({ ...prev, [field]: e.target.value }));
  }, []);

  const updateDropdownField = useCallback((field: keyof MaterialForm) => (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    setForm(prev => {
      const newForm = { ...prev, [field]: value };
      if (field === 'categoria') newForm.subcategoria = '';
      return newForm;
    });
  }, []);

  const showToast = useCallback((type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 5000);
  }, []);

  const handleSave = useCallback(async () => {
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

      await setDoc(doc(db, 'CMAT01', nextDocId), materialData);
      showToast('success', 'Material creado exitosamente');

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

  const handleReset = useCallback(() => {
    setForm(initialForm);
    setValidation({ isValid: true, errors: {} });
    setNextDocId('');
    setNextCategoryNumber('');
  }, [initialForm]);

  const availableSubcategories = useMemo(() => {
    if (!defaults || !form.categoria) return [];
    return defaults.subcategories[form.categoria] || [];
  }, [defaults, form.categoria]);

  if (loadingDefaults) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-4xl mx-auto">
          <div className="p-12 text-center">
            <div className="w-12 h-12 border-4 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-gray-600">Cargando...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <Package size={32} className="text-purple-600" />
            <h1 className="text-3xl font-bold text-gray-900">Creación de Materiales</h1>
          </div>
          <p className="text-gray-600">Registrar nuevos materiales en el catálogo</p>
        </div>

        <div className="space-y-6">
          {/* Code Generation */}
          <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
            <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center gap-2">
              <Package size={20} />
              Código del Material
            </h3>

            <div className="grid grid-cols-3 gap-4">
              <DropdownField
                label="Zona"
                value={form.zona}
                onChange={updateDropdownField('zona')}
                options={defaults?.zone || []}
                labelMap={ZONA_LABELS}
                error={validation.errors.zona}
                disabled={saving}
              />

              <DropdownField
                label="Categoría"
                value={form.categoria}
                onChange={updateDropdownField('categoria')}
                options={defaults?.category || []}
                labelMap={CATEGORIA_LABELS}
                error={validation.errors.categoria}
                disabled={saving}
              />

              <DropdownField
                label="Subcategoría"
                value={form.subcategoria}
                onChange={updateDropdownField('subcategoria')}
                options={availableSubcategories}
                labelMap={SUBCATEGORIA_LABELS}
                error={validation.errors.subcategoria}
                disabled={saving || !form.categoria}
              />
            </div>

            {form.codigo && (
              <div className="mt-4 bg-white border border-gray-200 rounded-lg p-4">
                <p className="text-sm text-gray-600 mb-1">Código generado:</p>
                <p className="text-lg font-medium text-gray-900">{form.codigo}</p>
                <p className="text-xs text-gray-500 mt-1">ID: {nextDocId}</p>
              </div>
            )}
          </div>

          {/* Material Details */}
          <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Detalles del Material</h3>

            <div className="space-y-4">
              <FormField
                label="Descripción"
                value={form.descripcion}
                onChange={updateField('descripcion')}
                error={validation.errors.descripcion}
                disabled={saving}
                placeholder="Ingrese la descripción"
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  label="Stock Mínimo"
                  value={form.stockMinimo}
                  onChange={updateField('stockMinimo')}
                  error={validation.errors.stockMinimo}
                  disabled={saving}
                  placeholder="0"
                />

                <FormField
                  label="Unidad de Medida"
                  value={form.unidadDeMedida}
                  onChange={updateField('unidadDeMedida')}
                  error={validation.errors.unidadDeMedida}
                  disabled={saving}
                  placeholder="ej. unidad, kg, litro"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  label="Marca"
                  value={form.marca}
                  onChange={updateField('marca')}
                  disabled={saving}
                  placeholder="Opcional"
                  required={false}
                />

                <FormField
                  label="Proveedor"
                  value={form.proveedor}
                  onChange={updateField('proveedor')}
                  disabled={saving}
                  placeholder="Opcional"
                  required={false}
                />
              </div>

              <FormField
                label="Fecha de Creación"
                value={currentDate}
                onChange={() => {}}
                disabled={true}
                required={false}
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3">
            <button
              onClick={handleReset}
              disabled={saving}
              className="px-6 py-3 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
            >
              Limpiar
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !form.codigo || !nextDocId}
              className="bg-purple-600 text-white px-6 py-3 rounded-md hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2 font-medium"
            >
              {saving ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Guardando...
                </>
              ) : (
                <>
                  <Save size={20} />
                  Guardar Material
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}