"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Package, Save, AlertCircle, CheckCircle, X, Search } from "lucide-react";
import { useAuth } from "../auth-context";
import { doc, setDoc, serverTimestamp, getDoc, collection } from "firebase/firestore";
import { db } from "../../lib/firebase/client";
import Searcher, { Material } from "../searcher";

// Form data type
type EntryForm = {
    materialCode: string;
    materialDisplayCode: string;
    storageLocation: string;
    entryType: string;
    entryDate: string;
    quantity: string;
    reason: string;
};

// Validation result type
type ValidationResult = {
    isValid: boolean;
    errors: Partial<Record<keyof EntryForm, string>>;
};

// Storage defaults type
type StorageDefaults = {
    storage_locations: string[];
    movement_types: string[];
};

// Utility function to format date for Firebase
const formatDateForFirebase = (): string => {
    return new Date().toISOString().split('T')[0];
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
                className={`px-3 py-2 border rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-green-500 ${error ? 'border-red-300 bg-red-50' : 'border-gray-300'
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
                className={`px-3 py-2 border rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-green-500 ${error ? 'border-red-300 bg-red-50' : 'border-gray-300'
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

// Text Area Component
const TextAreaField = ({
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
    onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
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
            <textarea
                value={value}
                onChange={onChange}
                disabled={disabled}
                placeholder={placeholder}
                rows={3}
                className={`px-3 py-2 border rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-green-500 resize-none ${error ? 'border-red-300 bg-red-50' : 'border-gray-300'
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

// Toast Component
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

export default function EMAT01Module() {
    const { user } = useAuth();

    const initialForm: EntryForm = useMemo(() => ({
        materialCode: '',
        materialDisplayCode: '',
        storageLocation: '',
        entryType: '',
        entryDate: formatDateForFirebase(),
        quantity: '',
        reason: ''
    }), []);

    const [form, setForm] = useState<EntryForm>(initialForm);
    const [validation, setValidation] = useState<ValidationResult>({ isValid: true, errors: {} });
    const [saving, setSaving] = useState(false);
    const [toast, setToast] = useState<{ type: 'success' | 'error', message: string } | null>(null);
    const [storageDefaults, setStorageDefaults] = useState<StorageDefaults | null>(null);
    const [loadingDefaults, setLoadingDefaults] = useState(true);
    const [searcherOpen, setSearcherOpen] = useState(false);

    useEffect(() => {
        const loadDefaults = async () => {
            try {
                const defaultsRef = doc(db, 'defaults', 'storage_defaults');
                const defaultsSnap = await getDoc(defaultsRef);

                if (defaultsSnap.exists()) {
                    const data = defaultsSnap.data();
                    setStorageDefaults({
                        storage_locations: data.storage_locations || [],
                        movement_types: data.movement_types || []
                    });
                } else {
                    console.error('[EMAT01] Storage defaults document not found');
                    showToast('error', 'No se pudieron cargar las opciones por defecto');
                }
            } catch (error) {
                console.error('[EMAT01] Error loading storage defaults:', error);
                showToast('error', 'Error al cargar las opciones por defecto');
            } finally {
                setLoadingDefaults(false);
            }
        };

        loadDefaults();
    }, []);

    const selectMaterial = useCallback((material: Material) => {
        setForm(prev => ({
            ...prev,
            materialCode: material.id,
            materialDisplayCode: material.codigo
        }));

        if (validation.errors.materialCode) {
            setValidation(prev => ({
                ...prev,
                errors: { ...prev.errors, materialCode: undefined }
            }));
        }
    }, [validation.errors]);

    const validateForm = useCallback((data: EntryForm): ValidationResult => {
        const errors: Partial<Record<keyof EntryForm, string>> = {};

        if (!data.materialCode) errors.materialCode = 'Debe seleccionar un material';
        if (!data.storageLocation) errors.storageLocation = 'La ubicación es requerida';
        if (!data.entryType) errors.entryType = 'El tipo de entrada es requerido';
        if (!data.entryDate) errors.entryDate = 'La fecha es requerida';
        if (!data.quantity.trim()) errors.quantity = 'La cantidad es requerida';
        if (!data.reason.trim()) errors.reason = 'La razón es requerida';

        return { isValid: Object.keys(errors).length === 0, errors };
    }, []);

    const updateDropdownField = useCallback((key: keyof EntryForm) => (e: React.ChangeEvent<HTMLSelectElement>) => {
        const value = e.target.value;
        setForm(prev => ({ ...prev, [key]: value }));

        if (validation.errors[key]) {
            setValidation(prev => ({ ...prev, errors: { ...prev.errors, [key]: undefined } }));
        }
    }, [validation.errors]);

    const updateField = useCallback((key: keyof EntryForm) => (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;

        if (key === 'quantity' && value && !/^\d*$/.test(value)) {
            return;
        }

        setForm(prev => ({ ...prev, [key]: value }));

        if (validation.errors[key]) {
            setValidation(prev => ({ ...prev, errors: { ...prev.errors, [key]: undefined } }));
        }
    }, [validation.errors]);

    const updateTextArea = useCallback((key: keyof EntryForm) => (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const value = e.target.value;
        setForm(prev => ({ ...prev, [key]: value }));

        if (validation.errors[key]) {
            setValidation(prev => ({ ...prev, errors: { ...prev.errors, [key]: undefined } }));
        }
    }, [validation.errors]);

    const showToast = useCallback((type: 'success' | 'error', message: string) => {
        setToast({ type, message });
        setTimeout(() => setToast(null), 4000);
    }, []);

    const handleSave = useCallback(async () => {
        const validationResult = validateForm(form);
        setValidation(validationResult);

        if (!validationResult.isValid) {
            showToast('error', 'Por favor complete todos los campos requeridos');
            return;
        }

        if (!user?.uid) {
            showToast('error', 'Usuario no autenticado');
            return;
        }

        setSaving(true);

        try {
            // Create a reference with auto-generated Firebase ID
            const entryRef = doc(collection(db, 'EMAT01'));
            const entryId = entryRef.id;

            const entryData = {
                entryId: entryId,
                materialCode: form.materialCode,
                storageLocation: form.storageLocation,
                entryType: form.entryType,
                entryDate: form.entryDate,
                quantity: form.quantity,
                reason: form.reason,
                state: false,
                createdAt: serverTimestamp(),
                createdBy: user.uid,
                createdByEmail: user.email || ''
            };

            await setDoc(entryRef, entryData);

            console.log('[EMAT01] Entry created successfully. Entry ID:', entryId);
            showToast('success', 'Entrada registrada exitosamente');

            setTimeout(() => {
                setForm(initialForm);
                setValidation({ isValid: true, errors: {} });
            }, 2000);

        } catch (error) {
            console.error('[EMAT01] Error saving entry:', error);
            showToast('error', 'Error al guardar la entrada');
        } finally {
            setSaving(false);
        }
    }, [form, validateForm, user, initialForm, showToast]);

    const handleReset = useCallback(() => {
        setForm(initialForm);
        setValidation({ isValid: true, errors: {} });
    }, [initialForm]);

    if (loadingDefaults) {
        return (
            <div className="min-h-screen bg-gray-50 p-6">
                <div className="max-w-4xl mx-auto">
                    <div className="p-12 text-center">
                        <div className="w-12 h-12 border-4 border-green-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                        <p className="text-gray-600">Cargando...</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 p-6">
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
            
            <Searcher
                isOpen={searcherOpen}
                onClose={() => setSearcherOpen(false)}
                onSelect={selectMaterial}
            />

            <div className="max-w-4xl mx-auto">
                <div className="mb-6">
                    <div className="flex items-center gap-3 mb-2">
                        <Package size={32} className="text-green-600" />
                        <h1 className="text-3xl font-bold text-gray-900">Entrada de Materiales</h1>
                    </div>

                </div>

                <div className="space-y-6">
                    {/* Material Selection */}
                    <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                        <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center gap-2">
                            <Package size={20} />
                            Seleccionar Material
                        </h3>

                        <button
                            onClick={() => setSearcherOpen(true)}
                            disabled={saving}
                            className="w-full flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-md hover:bg-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <Search size={18} className="text-gray-400" />
                            <span className="text-sm text-gray-600">Buscar material...</span>
                        </button>

                        {form.materialDisplayCode && (
                            <div className="mt-4 bg-white border border-gray-200 rounded-lg p-4">
                                <p className="text-sm text-gray-600 mb-1">Material seleccionado:</p>
                                <p className="text-lg font-medium text-gray-900">{form.materialDisplayCode}</p>
                                <p className="text-xs text-gray-500 mt-1">ID: {form.materialCode}</p>
                            </div>
                        )}

                        {validation.errors.materialCode && (
                            <div className="mt-2 flex items-center gap-1 text-red-600 text-sm">
                                <AlertCircle size={16} />
                                <span>{validation.errors.materialCode}</span>
                            </div>
                        )}
                    </div>

                    {/* Entry Details */}
                    <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                        <h3 className="text-lg font-medium text-gray-900 mb-4">Detalles de Entrada</h3>

                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <DropdownField
                                    label="Ubicación de Almacenamiento"
                                    value={form.storageLocation}
                                    onChange={updateDropdownField('storageLocation')}
                                    options={storageDefaults?.storage_locations || []}
                                    error={validation.errors.storageLocation}
                                    disabled={saving}
                                />

                                <DropdownField
                                    label="Tipo de Entrada"
                                    value={form.entryType}
                                    onChange={updateDropdownField('entryType')}
                                    options={storageDefaults?.movement_types || []}
                                    error={validation.errors.entryType}
                                    disabled={saving}
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <FormField
                                    label="Fecha de Entrada"
                                    value={form.entryDate}
                                    onChange={updateField('entryDate')}
                                    error={validation.errors.entryDate}
                                    disabled={saving}
                                    type="date"
                                />

                                <FormField
                                    label="Cantidad"
                                    value={form.quantity}
                                    onChange={updateField('quantity')}
                                    error={validation.errors.quantity}
                                    disabled={saving}
                                    placeholder="0"
                                />
                            </div>

                            <TextAreaField
                                label="Razón/Motivo"
                                value={form.reason}
                                onChange={updateTextArea('reason')}
                                error={validation.errors.reason}
                                disabled={saving}
                                placeholder="Describa el motivo de la entrada..."
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
                            disabled={saving}
                            className="bg-green-600 text-white px-6 py-3 rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2 font-medium"
                        >
                            {saving ? (
                                <>
                                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                    Guardando...
                                </>
                            ) : (
                                <>
                                    <Save size={20} />
                                    Guardar Entrada
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}