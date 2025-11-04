"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Package, Save, AlertCircle, CheckCircle, X, Search } from "lucide-react";
import { useAuth } from "../auth-context";
import { doc, setDoc, serverTimestamp, collection, getDocs, query, getDoc } from "firebase/firestore";
import { db } from "../../lib/firebase/client";

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

// Material search result type
type MaterialResult = {
    documentId: string;
    codigo: string;
    descripcion: string;
    proveedor: string;
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

// Search filter type
type SearchFilter = 'iso_code' | 'internal_code' | 'description' | 'provider';

// Utility function to format date for display
const formatDateForDisplay = (date: Date): string => {
    return date.toISOString().split('T')[0];
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
                className={`px-3 py-2 border rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${error ? 'border-red-300 bg-red-50' : 'border-gray-300'
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
                className={`px-3 py-2 border rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${error ? 'border-red-300 bg-red-50' : 'border-gray-300'
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
                className={`px-3 py-2 border rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${error ? 'border-red-300 bg-red-50' : 'border-gray-300'
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

    // Material search state
    const [searchQuery, setSearchQuery] = useState('');
    const [searchFilter, setSearchFilter] = useState<SearchFilter>('internal_code');
    const [searchResults, setSearchResults] = useState<MaterialResult[]>([]);
    const [showSearchResults, setShowSearchResults] = useState(false);
    const [allMaterials, setAllMaterials] = useState<MaterialResult[]>([]);

    // Load storage defaults from database
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

    // Load all materials from CMAT01
    useEffect(() => {
        const loadMaterials = async () => {
            try {
                const cmat01Ref = collection(db, 'CMAT01');
                const materialsSnapshot = await getDocs(query(cmat01Ref));

                const materials: MaterialResult[] = [];
                materialsSnapshot.forEach((doc) => {
                    const data = doc.data();
                    materials.push({
                        documentId: data.documentId,
                        codigo: data.codigo,
                        descripcion: data.descripcion,
                        proveedor: data.proveedor
                    });
                });

                setAllMaterials(materials);
            } catch (error) {
                console.error('[EMAT01] Error loading materials:', error);
                showToast('error', 'Error al cargar los materiales');
            }
        };

        loadMaterials();
    }, []);

    // Search materials based on filter and query
    useEffect(() => {
        if (!searchQuery.trim()) {
            setSearchResults([]);
            setShowSearchResults(false);
            return;
        }

        const query = searchQuery.toLowerCase();
        const filtered = allMaterials.filter(material => {
            switch (searchFilter) {
                case 'iso_code':
                    return material.documentId?.toLowerCase().includes(query) || false;
                case 'internal_code':
                    return material.codigo?.toLowerCase().includes(query) || false;
                case 'description':
                    return material.descripcion?.toLowerCase().includes(query) || false;
                case 'provider':
                    return material.proveedor?.toLowerCase().includes(query) || false;
                default:
                    return false;
            }
        });

        setSearchResults(filtered);
        setShowSearchResults(true);
    }, [searchQuery, searchFilter, allMaterials]);

    // Select material from search results
    const selectMaterial = useCallback((material: MaterialResult) => {
        setForm(prev => ({
            ...prev,
            materialCode: material.documentId,
            materialDisplayCode: material.codigo
        }));
        setSearchQuery('');
        setShowSearchResults(false);

        // Clear error if exists
        if (validation.errors.materialCode) {
            setValidation(prev => ({
                ...prev,
                errors: { ...prev.errors, materialCode: undefined }
            }));
        }
    }, [validation.errors]);

    // Validate form
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

    // Update dropdown field handler
    const updateDropdownField = useCallback((key: keyof EntryForm) => (e: React.ChangeEvent<HTMLSelectElement>) => {
        const value = e.target.value;
        setForm(prev => ({ ...prev, [key]: value }));

        if (validation.errors[key]) {
            setValidation(prev => ({ ...prev, errors: { ...prev.errors, [key]: undefined } }));
        }
    }, [validation.errors]);

    // Update field handler
    const updateField = useCallback((key: keyof EntryForm) => (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;

        // Only allow numbers for quantity
        if (key === 'quantity' && value && !/^\d*$/.test(value)) {
            return;
        }

        setForm(prev => ({ ...prev, [key]: value }));

        if (validation.errors[key]) {
            setValidation(prev => ({ ...prev, errors: { ...prev.errors, [key]: undefined } }));
        }
    }, [validation.errors]);

    // Update textarea handler
    const updateTextArea = useCallback((key: keyof EntryForm) => (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const value = e.target.value;
        setForm(prev => ({ ...prev, [key]: value }));

        if (validation.errors[key]) {
            setValidation(prev => ({ ...prev, errors: { ...prev.errors, [key]: undefined } }));
        }
    }, [validation.errors]);

    // Show toast
    const showToast = useCallback((type: 'success' | 'error', message: string) => {
        setToast({ type, message });
        setTimeout(() => setToast(null), 4000);
    }, []);

    // Save entry
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
            // Generate random Firebase document ID
            const entryRef = doc(collection(db, 'EMAT01'));
            const entryId = entryRef.id;

            // Prepare entry data
            const entryData = {
                entryId: entryId,
                materialCode: form.materialCode,
                storageLocation: form.storageLocation,
                entryType: form.entryType,
                entryDate: form.entryDate,
                quantity: form.quantity,
                reason: form.reason,
                state: false, // Always false on creation, will be managed elsewhere
                createdAt: serverTimestamp(),
                createdBy: user.uid,
                createdByEmail: user.email || ''
            };

            // Save to EMAT01 collection
            await setDoc(entryRef, entryData);

            console.log('[EMAT01] Entry created successfully. Entry ID:', entryId);
            showToast('success', `Entrada registrada exitosamente (ID: ${entryId})`);

            // Reset form after 2 seconds
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

    // Reset form
    const handleReset = useCallback(() => {
        setForm(initialForm);
        setValidation({ isValid: true, errors: {} });
        setSearchQuery('');
        setShowSearchResults(false);
    }, [initialForm]);

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
                    <div className="p-2 bg-green-100 rounded-lg">
                        <Package className="text-green-600" size={24} />
                    </div>
                    <h1 className="text-2xl font-semibold text-gray-900">
                        EMAT01 — Entrada de Materiales
                    </h1>
                </div>
            </header>

            <div className="bg-white border rounded-lg p-8 shadow-sm max-w-3xl space-y-6">
                {/* Material Search Section */}
                <div className="space-y-4 pb-6 border-b border-gray-200">
                    <h2 className="text-lg font-medium text-gray-900">Seleccionar Material</h2>

                    {/* Search Filter Options */}
                    <div className="flex flex-wrap gap-4">
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="radio"
                                name="searchFilter"
                                value="iso_code"
                                checked={searchFilter === 'iso_code'}
                                onChange={(e) => setSearchFilter(e.target.value as SearchFilter)}
                                className="w-4 h-4 text-blue-600"
                            />
                            <span className="text-sm text-gray-700">Código ISO</span>
                        </label>

                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="radio"
                                name="searchFilter"
                                value="internal_code"
                                checked={searchFilter === 'internal_code'}
                                onChange={(e) => setSearchFilter(e.target.value as SearchFilter)}
                                className="w-4 h-4 text-blue-600"
                            />
                            <span className="text-sm text-gray-700">Código Interno</span>
                        </label>

                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="radio"
                                name="searchFilter"
                                value="description"
                                checked={searchFilter === 'description'}
                                onChange={(e) => setSearchFilter(e.target.value as SearchFilter)}
                                className="w-4 h-4 text-blue-600"
                            />
                            <span className="text-sm text-gray-700">Descripción</span>
                        </label>

                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="radio"
                                name="searchFilter"
                                value="provider"
                                checked={searchFilter === 'provider'}
                                onChange={(e) => setSearchFilter(e.target.value as SearchFilter)}
                                className="w-4 h-4 text-blue-600"
                            />
                            <span className="text-sm text-gray-700">Proveedor</span>
                        </label>
                    </div>

                    {/* Search Input */}
                    <div className="relative">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder={`Buscar por ${searchFilter === 'iso_code' ? 'código ISO' :
                                        searchFilter === 'internal_code' ? 'código interno' :
                                            searchFilter === 'description' ? 'descripción' : 'proveedor'
                                    }...`}
                                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>

                        {/* Search Results Dropdown */}
                        {showSearchResults && searchResults.length > 0 && (
                            <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-80 overflow-y-auto">
                                {searchResults.slice(0, 5).map((material) => (
                                    <button
                                        key={material.documentId}
                                        onClick={() => selectMaterial(material)}
                                        className="w-full px-4 py-3 text-left hover:bg-gray-50 border-b border-gray-100 last:border-b-0 transition-colors"
                                    >
                                        <div className="font-medium text-gray-900">{material.codigo}</div>
                                        <div className="text-sm text-gray-600">{material.descripcion}</div>
                                        <div className="text-xs text-gray-500 mt-1">
                                            ISO: {material.documentId} | Proveedor: {material.proveedor}
                                        </div>
                                    </button>
                                ))}
                                {searchResults.length > 5 && (
                                    <div className="px-4 py-2 text-xs text-gray-500 bg-gray-50 text-center border-t">
                                        Mostrando 5 de {searchResults.length} resultados. Siga escribiendo para refinar la búsqueda.
                                    </div>
                                )}
                            </div>
                        )}

                        {showSearchResults && searchResults.length === 0 && searchQuery && (
                            <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg p-4 text-center text-gray-500">
                                No se encontraron materiales
                            </div>
                        )}
                    </div>

                    {/* Selected Material Display */}
                    {form.materialDisplayCode && (
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                            <p className="text-sm text-gray-600 mb-1">Material seleccionado:</p>
                            <p className="text-lg font-mono font-bold text-blue-900">{form.materialDisplayCode}</p>
                            <p className="text-xs text-gray-500 mt-1">{form.materialCode}</p>
                        </div>
                    )}

                    {validation.errors.materialCode && (
                        <div className="flex items-center gap-1 text-red-600 text-sm">
                            <AlertCircle size={16} />
                            <span>{validation.errors.materialCode}</span>
                        </div>
                    )}
                </div>

                {/* Entry Details Section */}
                <div className="space-y-4">
                    <h2 className="text-lg font-medium text-gray-900">Detalles de Entrada</h2>

                    <div className="grid grid-cols-2 gap-4">
                        <DropdownField
                            label="Ubicación de Almacenamiento"
                            value={form.storageLocation}
                            onChange={updateDropdownField('storageLocation')}
                            options={storageDefaults?.storage_locations || []}
                            error={validation.errors.storageLocation}
                            disabled={saving}
                            placeholder="Seleccione ubicación"
                        />

                        <DropdownField
                            label="Tipo de Entrada"
                            value={form.entryType}
                            onChange={updateDropdownField('entryType')}
                            options={storageDefaults?.movement_types || []}
                            error={validation.errors.entryType}
                            disabled={saving}
                            placeholder="Seleccione tipo"
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
                            placeholder="Ingrese la cantidad"
                        />
                    </div>

                    <TextAreaField
                        label="Razón/Motivo"
                        value={form.reason}
                        onChange={updateTextArea('reason')}
                        error={validation.errors.reason}
                        disabled={saving}
                        placeholder="Ingrese la razón o motivo de la entrada"
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
                                Guardar Entrada
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