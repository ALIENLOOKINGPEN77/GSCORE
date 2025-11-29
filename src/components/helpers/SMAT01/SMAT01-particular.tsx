// SMAT01-particular.tsx
"use client";

import React, { useCallback, useEffect, useState } from "react";
import { 
  Package, 
  Save, 
  AlertCircle, 
  CheckCircle, 
  Trash2,
  Plus,
  FileText,
  Search
} from "lucide-react";
import { useAuth } from "../../auth-context";
import { 
  collection, 
  query, 
  getDocs, 
  doc, 
  getDoc,
  setDoc,
  serverTimestamp
} from "firebase/firestore";
import { db } from "../../../lib/firebase/client";
import Searcher, { Material } from "../../searcher";

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

type MaterialEntry = {
  id: string;
  isoCode: string;
  codigo: string;
  descripcion: string;
  quantity: number;
};

type ValidationResult = {
  isValid: boolean;
  errors: Record<string, string>;
};

type ToastMessage = {
  type: 'success' | 'error';
  message: string;
};

type UsageType = 'general' | 'taller';

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
// FORM FIELD COMPONENTS
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
  options: Array<{ value: string; label: string }>;
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
        className={`px-3 py-2 border rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 ${
          error ? 'border-red-300 bg-red-50' : 'border-gray-300'
        } ${disabled ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'}`}
      >
        <option value="">{placeholder}</option>
        {options.map(option => (
          <option key={option.value} value={option.value}>
            {option.label}
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
  type = 'text',
  disabled = false,
  placeholder = '',
  required = true
}: {
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  error?: string;
  type?: string;
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
        type={type}
        value={value}
        onChange={onChange}
        disabled={disabled}
        placeholder={placeholder}
        className={`px-3 py-2 border rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 ${
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

const TextAreaField = ({
  label,
  value,
  onChange,
  error,
  disabled = false,
  placeholder = '',
  required = true,
  rows = 3
}: {
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  error?: string;
  disabled?: boolean;
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
        disabled={disabled}
        placeholder={placeholder}
        rows={rows}
        className={`px-3 py-2 border rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 resize-none ${
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

// ============================================================================
// TOAST COMPONENT
// ============================================================================

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
      <button 
        onClick={onClose}
        className="ml-2 hover:bg-gray-200 rounded p-1 transition-colors"
      >
        <AlertCircle size={16} />
      </button>
    </div>
  </div>
);

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function SMAT01Particular() {
  const { user } = useAuth();

  // State
  const [storageLocations, setStorageLocations] = useState<string[]>([]);
  const [internalVehicles, setInternalVehicles] = useState<string[]>([]);
  const [materialEntries, setMaterialEntries] = useState<MaterialEntry[]>([]);
  
  const [usageType, setUsageType] = useState<UsageType>('general');
  const [storageLocation, setStorageLocation] = useState<string>('');
  const [reason, setReason] = useState<string>('');
  const [mobileUnit, setMobileUnit] = useState<string>('');
  const [entryDate, setEntryDate] = useState<string>(getTodayDate());
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  const [searcherOpen, setSearcherOpen] = useState(false);
  const [currentEntryId, setCurrentEntryId] = useState<string>('');
  

  // Load storage locations and vehicles on mount
  useEffect(() => {
    loadDefaults();
  }, []);

  // Load defaults
  const loadDefaults = async () => {
    try {
      setLoading(true);
      
      // Load storage locations
      const storageRef = doc(db, 'defaults', 'storage_defaults');
      const storageSnap = await getDoc(storageRef);
      
      if (storageSnap.exists()) {
        const data = storageSnap.data();
        setStorageLocations(data.storage_locations || []);
      }
      
      // Load internal vehicles
      const vehiclesRef = doc(db, 'defaults', 'work_order_defaults');
      const vehiclesSnap = await getDoc(vehiclesRef);
      
      if (vehiclesSnap.exists()) {
        const data = vehiclesSnap.data();
        setInternalVehicles(data.internal_vehicles || []);
      }
      
    } catch (error) {
      console.error('[SMAT01-particular] Error loading defaults:', error);
      showToast('error', 'Error al cargar configuración');
    } finally {
      setLoading(false);
    }
  };

  // Add new material entry
  const addMaterialEntry = useCallback(() => {
    const newEntry: MaterialEntry = {
      id: `entry-${Date.now()}`,
      isoCode: '',
      codigo: '',
      descripcion: '',
      quantity: 0
    };
    setMaterialEntries(prev => [...prev, newEntry]);
  }, []);

  // Remove material entry
  const removeMaterialEntry = useCallback((id: string) => {
    setMaterialEntries(prev => prev.filter(e => e.id !== id));
  }, []);

  // Open searcher for specific entry
  const openSearcher = useCallback((entryId: string) => {
    setCurrentEntryId(entryId);
    setSearcherOpen(true);
  }, []);

  // Handle material selection from searcher
  const handleMaterialSelect = useCallback((material: Material) => {
    // Check if material already exists
    const exists = materialEntries.some(entry => entry.isoCode === material.id);
    
    if (exists) {
      showToast('error', 'Este material ya ha sido agregado');
      return;
    }
    
    setMaterialEntries(prev => 
      prev.map(e => e.id === currentEntryId ? {
        ...e,
        isoCode: material.id,
        codigo: material.codigo,
        descripcion: material.descripcion
      } : e)
    );
    
    // Clear error for this entry
    if (errors[`material-${currentEntryId}`]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[`material-${currentEntryId}`];
        return newErrors;
      });
    }
  }, [currentEntryId, errors, materialEntries]);

  // Update material quantity
  const updateMaterialQuantity = useCallback((id: string, quantity: string) => {
    const numQuantity = parseFloat(quantity);
    
    setMaterialEntries(prev => 
      prev.map(e => e.id === id ? {
        ...e,
        quantity: quantity === '' ? 0 : numQuantity
      } : e)
    );
  }, []);

  // Validate form
  const validateForm = useCallback((): ValidationResult => {
    const newErrors: Record<string, string> = {};
    
    if (!storageLocation) {
      newErrors.storageLocation = 'Debe seleccionar una ubicación de almacenamiento';
    }
    
    if (!reason.trim()) {
      newErrors.reason = 'Debe ingresar una descripción del uso del material';
    } else if (reason.trim().length < 10) {
      newErrors.reason = 'La descripción debe tener al menos 10 caracteres';
    }
    
    if (usageType === 'taller' && !mobileUnit) {
      newErrors.mobileUnit = 'Debe seleccionar una unidad móvil';
    }
    
    if (!entryDate) {
      newErrors.entryDate = 'Debe seleccionar una fecha';
    }
    
    if (materialEntries.length === 0) {
      newErrors.materials = 'Debe agregar al menos un material';
    }
    
    materialEntries.forEach(entry => {
      if (!entry.isoCode) {
        newErrors[`material-${entry.id}`] = 'Debe seleccionar un material';
      }
      
      if (entry.quantity <= 0) {
        newErrors[`quantity-${entry.id}`] = 'La cantidad debe ser mayor a 0';
      }
    });
    
    setErrors(newErrors);
    return {
      isValid: Object.keys(newErrors).length === 0,
      errors: newErrors
    };
  }, [storageLocation, reason, entryDate, materialEntries, usageType, mobileUnit]);

  // Show toast
  const showToast = useCallback((type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  }, []);

  // Save entry to Firebase
  const handleSave = useCallback(async () => {
    if (saving) return;
    
    const validation = validateForm();
    
    if (!validation.isValid) {
      showToast('error', 'Por favor complete todos los campos requeridos');
      return;
    }
    
    if (!user?.uid) {
      showToast('error', 'Usuario no autenticado');
      return;
    }
    
    setSaving(true);
    
    try {
      const entryRef = doc(collection(db, 'SMAT01'));
      const entryId = entryRef.id;
      
      // Build quantity object
      const quantity: Record<string, number> = {};
      materialEntries.forEach(entry => {
        if (entry.isoCode && entry.quantity > 0) {
          quantity[entry.isoCode] = entry.quantity;
        }
      });
      
      const entryData: any = {
        entryId,
        createdAt: serverTimestamp(),
        createdBy: user.uid,
        createdByEmail: user.email || '',
        entryDate,
        entryType: 'particular',
        quantity,
        reason: reason.trim(),
        state: false,
        storageLocation
      };
      
      // Add mobileUnit if taller type
      if (usageType === 'taller') {
        entryData.mobileUnit = mobileUnit;
      }
      
      await setDoc(entryRef, entryData);
      console.log('[SMAT01-particular] Entry created:', entryId);
      
      showToast('success', 'Salida de material particular creada exitosamente');
      
      // Reset form after 2 seconds
      setTimeout(() => {
        setUsageType('general');
        setStorageLocation('');
        setReason('');
        setMobileUnit('');
        setMaterialEntries([]);
        setEntryDate(getTodayDate());
        setErrors({});
      }, 2000);
      
    } catch (error) {
      console.error('[SMAT01-particular] Error saving entry:', error);
      showToast('error', 'Error al guardar la salida de material');
    } finally {
      setSaving(false);
    }
  }, [validateForm, user, storageLocation, reason, entryDate, materialEntries, usageType, mobileUnit, showToast]);

  if (loading) {
    return (
      <div className="p-12 text-center">
        <div className="w-12 h-12 border-4 border-red-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-gray-600">Cargando...</p>
      </div>
    );
  }

  return (
    <div>
      {/* Toast */}
      {toast && (
        <Toast 
          message={toast.message} 
          type={toast.type} 
          onClose={() => setToast(null)} 
        />
      )}

      {/* Searcher Modal */}
      <Searcher
        isOpen={searcherOpen}
        onClose={() => setSearcherOpen(false)}
        onSelect={handleMaterialSelect}
      />

      <div className="space-y-6">
        {/* Usage Type Selection */}
        <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
          <h3 className="text-lg font-medium text-gray-900 mb-3 flex items-center gap-2">
            <FileText size={20} />
            Tipo de Uso
          </h3>
          
          <div className="flex gap-6">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="usageType"
                value="general"
                checked={usageType === 'general'}
                onChange={() => {
                  setUsageType('general');
                  setMobileUnit('');
                }}
                disabled={saving}
                className="w-4 h-4 text-red-600 focus:ring-2 focus:ring-red-500"
              />
              <span className="text-sm text-gray-700">Uso General</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="usageType"
                value="taller"
                checked={usageType === 'taller'}
                onChange={() => setUsageType('taller')}
                disabled={saving}
                className="w-4 h-4 text-red-600 focus:ring-2 focus:ring-red-500"
              />
              <span className="text-sm text-gray-700">Taller</span>
            </label>
          </div>
        </div>

        {/* Basic Information */}
        <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
          <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center gap-2">
            <FileText size={20} />
            Información General
          </h3>
          
          <div className="grid grid-cols-2 gap-4">
            <FormField
              label="Fecha de Salida"
              value={entryDate}
              onChange={(e) => setEntryDate(e.target.value)}
              error={errors.entryDate}
              type="date"
              disabled={saving}
            />
            
            <DropdownField
              label="Ubicación de Almacenamiento"
              value={storageLocation}
              onChange={(e) => setStorageLocation(e.target.value)}
              options={storageLocations.map(loc => ({ value: loc, label: loc }))}
              error={errors.storageLocation}
              disabled={saving}
              placeholder="Seleccione una ubicación"
            />
          </div>
          
          {usageType === 'taller' && (
            <div className="mt-4">
              <DropdownField
                label="Unidad Móvil"
                value={mobileUnit}
                onChange={(e) => setMobileUnit(e.target.value)}
                options={internalVehicles.map(v => ({ value: v, label: v }))}
                error={errors.mobileUnit}
                disabled={saving}
                placeholder="Seleccione una unidad móvil"
              />
            </div>
          )}
          
          <div className="mt-4">
            <TextAreaField
              label="Descripción del Uso del Material"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              error={errors.reason}
              disabled={saving}
              placeholder="Describa el propósito o uso de los materiales que se están retirando..."
              rows={3}
            />
          </div>
        </div>

        {/* Material Entries */}
        <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-gray-900 flex items-center gap-2">
              <Package size={20} />
              Materiales
            </h3>
            <button
              onClick={addMaterialEntry}
              disabled={saving}
              className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2 text-sm font-medium"
            >
              <Plus size={16} />
              Agregar Material
            </button>
          </div>
          
          {errors.materials && (
            <div className="mb-4 flex items-center gap-2 text-red-600 text-sm">
              <AlertCircle size={16} />
              <span>{errors.materials}</span>
            </div>
          )}
          
          {materialEntries.length === 0 ? (
            <div className="p-6 text-center text-gray-500 bg-white rounded border border-gray-200">
              <Package size={32} className="mx-auto mb-2 text-gray-400" />
              <p>No hay materiales agregados</p>
              <p className="text-sm mt-1">Haga clic en "Agregar Material" para comenzar</p>
            </div>
          ) : (
            <div className="space-y-3">
              {materialEntries.map((entry, index) => (
                <div key={entry.id} className="bg-white p-4 rounded-lg border border-gray-200">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-medium text-gray-700">Material #{index + 1}</h4>
                    <button
                      onClick={() => removeMaterialEntry(entry.id)}
                      disabled={saving}
                      className="text-red-600 hover:bg-red-50 p-2 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col">
                      <label className="text-sm font-medium text-gray-700 mb-1">
                        Material <span className="text-red-500">*</span>
                      </label>
                      <button
                        onClick={() => openSearcher(entry.id)}
                        disabled={saving}
                        className={`px-3 py-2 border rounded-md transition-colors text-left flex items-center justify-between ${
                          errors[`material-${entry.id}`] ? 'border-red-300 bg-red-50' : 'border-gray-300 bg-white'
                        } ${saving ? 'cursor-not-allowed opacity-50' : 'hover:border-red-500'}`}
                      >
                        <span className={entry.isoCode ? 'text-gray-900' : 'text-gray-400'}>
                          {entry.isoCode ? `${entry.codigo} - ${entry.descripcion}` : 'Buscar material...'}
                        </span>
                        <Search size={16} className="text-gray-400" />
                      </button>
                      {errors[`material-${entry.id}`] && (
                        <div className="mt-1 flex items-center gap-1 text-red-600 text-xs">
                          <AlertCircle size={12} />
                          <span>{errors[`material-${entry.id}`]}</span>
                        </div>
                      )}
                    </div>
                    
                    <FormField
                      label="Cantidad"
                      value={entry.quantity > 0 ? entry.quantity.toString() : ''}
                      onChange={(e) => updateMaterialQuantity(entry.id, e.target.value)}
                      error={errors[`quantity-${entry.id}`]}
                      type="number"
                      disabled={saving}
                      placeholder="0"
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Save Button */}
        {materialEntries.length > 0 && (
          <div className="flex justify-end gap-3">
            <button
              onClick={handleSave}
              disabled={saving}
              className="bg-red-600 text-white px-6 py-3 rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2 font-medium"
            >
              {saving ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Guardando...
                </>
              ) : (
                <>
                  <Save size={20} />
                  Guardar Salida
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}