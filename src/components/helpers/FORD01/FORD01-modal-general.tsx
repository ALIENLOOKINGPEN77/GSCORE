"use client";

import React, { useState, useEffect, useCallback } from "react";
import { X, Save, Search, Trash2, AlertCircle, Package } from "lucide-react";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../../../lib/firebase/client";
import Searcher, { Material } from "../../searcher";
import { GlobalToast } from "../../Globaltoast";

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

type WorkOrder = {
  orderId: string;
  orderType: string;
  type?: string;
  equipment?: string;
  issueDate?: string;
  executionDate?: string;
  assignedTechnicians?: string[];
  description?: string;
  workPerformed?: string;
  verifiedBy?: string;
  componentsUsed?: { [key: string]: number };
  state: boolean;
  [key: string]: any;
};

type MaterialUsed = {
  materialCode: string;
  codigo: string;
  descripcion: string;
  quantity: number | string;
};

// ============================================================================
// FORM FIELD COMPONENTS
// ============================================================================

const FormField = ({
  label,
  value,
  onChange,
  error,
  placeholder = '',
  required = true
}: {
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  error?: string;
  placeholder?: string;
  required?: boolean;
}) => (
  <div className="flex flex-col">
    <label className="text-sm font-medium text-gray-700 mb-1">
      {label} {required && <span className="text-red-500">*</span>}
    </label>
    <input
      type="text"
      value={value}
      onChange={onChange}
      placeholder={placeholder}
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
  </div>
);

const TextAreaField = ({
  label,
  value,
  onChange,
  error,
  placeholder = '',
  rows = 3,
  required = true
}: {
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  error?: string;
  placeholder?: string;
  rows?: number;
  required?: boolean;
}) => (
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

// ============================================================================
// MAIN MODAL COMPONENT
// ============================================================================

export default function GeneralModal({
  order,
  onClose,
  onSuccess,
  onError
}: {
  order: WorkOrder;
  onClose: () => void;
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
}) {
  const [workPerformed, setWorkPerformed] = useState(order.workPerformed || '');
  const [verifiedBy, setVerifiedBy] = useState(order.verifiedBy || '');
  const [materialsUsed, setMaterialsUsed] = useState<MaterialUsed[]>([]);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [saving, setSaving] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [searcherOpen, setSearcherOpen] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error', message: string } | null>(null);

  // Initialize materials from order
  useEffect(() => {
    if (order.componentsUsed && typeof order.componentsUsed === 'object') {
      const materials: MaterialUsed[] = [];
      Object.entries(order.componentsUsed).forEach(([code, qty]) => {
        materials.push({
          materialCode: code,
          codigo: code,
          descripcion: 'Material existente',
          quantity: Number(qty)
        });
      });
      setMaterialsUsed(materials);
    }
    setLoadingData(false);
  }, [order]);

  const showToast = useCallback((type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 5000);
  }, []);

  // Add material to list
  const handleAddMaterial = useCallback((material: Material) => {
    const exists = materialsUsed.find(m => m.materialCode === material.id);
    
    if (exists) {
      showToast('error', 'Este material ya ha sido agregado');
      return;
    }
    
    setMaterialsUsed(prev => [...prev, {
      materialCode: material.id,
      codigo: material.codigo,
      descripcion: material.descripcion,
      quantity: 1
    }]);
  }, [materialsUsed, showToast]);

  // Update material quantity
  const handleUpdateQuantity = useCallback((materialCode: string, value: string) => {
    setMaterialsUsed(prev => prev.map(m =>
      m.materialCode === materialCode ? { ...m, quantity: value } : m
    ));
  }, []);

  // Handle blur event to validate and clean up quantity
  const handleQuantityBlur = useCallback((materialCode: string) => {
    setMaterialsUsed(prev => prev.map(m => {
      if (m.materialCode === materialCode) {
        const numValue = typeof m.quantity === 'string' ? parseInt(m.quantity) : m.quantity;
        // If invalid or zero, set to 1
        if (isNaN(numValue) || numValue <= 0) {
          return { ...m, quantity: 1 };
        }
        return { ...m, quantity: numValue };
      }
      return m;
    }));
  }, []);

  // Remove material
  const handleRemoveMaterial = useCallback((materialCode: string) => {
    setMaterialsUsed(prev => prev.filter(m => m.materialCode !== materialCode));
  }, []);

  // Validate form
  const validateForm = useCallback(() => {
    const newErrors: { [key: string]: string } = {};

    if (!workPerformed.trim()) {
      newErrors.workPerformed = 'El trabajo realizado es requerido';
    }

    if (!verifiedBy.trim()) {
      newErrors.verifiedBy = 'El verificador es requerido';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [workPerformed, verifiedBy]);

  // Save work order
  const handleSave = async () => {
    if (!validateForm()) {
      onError('Por favor complete todos los campos requeridos');
      return;
    }

    setSaving(true);
    try {
      // Convert materials to componentsUsed map
      const componentsUsed: { [key: string]: number } = {};
      materialsUsed.forEach(material => {
        const qty = typeof material.quantity === 'string' ? parseInt(material.quantity) : material.quantity;
        if (!isNaN(qty) && qty > 0) {
          componentsUsed[material.materialCode] = qty;
        }
      });

      const orderRef = doc(db, "CORD01", order.orderId);
      await updateDoc(orderRef, {
        workPerformed: workPerformed.trim(),
        verifiedBy: verifiedBy.trim(),
        componentsUsed,
        state: true,
        stateSig: true
      });

      onSuccess('Orden de trabajo finalizada exitosamente');
    } catch (error) {
      console.error("Error updating order:", error);
      onError('Error al actualizar la orden de trabajo');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      {toast && <GlobalToast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <Searcher
        isOpen={searcherOpen}
        onClose={() => setSearcherOpen(false)}
        onSelect={handleAddMaterial}
      />

      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Finalizar Orden General</h2>
            <p className="text-sm text-gray-600 mt-1">N° Orden: {order.orderId}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Loading State */}
        {loadingData ? (
          <div className="flex-1 flex items-center justify-center p-6">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Cargando datos...</p>
            </div>
          </div>
        ) : (
          <>
            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Order Information */}
              <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                <h3 className="font-semibold text-gray-900 mb-3">Información de la Orden</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">Tipo:</span>
                    <span className="ml-2 font-medium">{order.type}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Equipo:</span>
                    <span className="ml-2 font-medium">{order.equipment}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Fecha Emisión:</span>
                    <span className="ml-2 font-medium">{order.issueDate}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Fecha Ejecución:</span>
                    <span className="ml-2 font-medium">{order.executionDate}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-gray-600">Descripción:</span>
                    <p className="mt-1 text-gray-900">{order.description}</p>
                  </div>
                </div>
              </div>

              {/* Work Performed */}
              <TextAreaField
                label="Trabajo Realizado"
                value={workPerformed}
                onChange={(e) => setWorkPerformed(e.target.value)}
                error={errors.workPerformed}
                placeholder="Describa el trabajo realizado..."
                rows={4}
              />

              {/* Verified By */}
              <FormField
                label="Verificado Por"
                value={verifiedBy}
                onChange={(e) => setVerifiedBy(e.target.value)}
                error={errors.verifiedBy}
                placeholder="Nombre del verificador"
              />

              {/* Materials Used Section */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Package className="text-blue-600" size={20} />
                  <h3 className="font-semibold text-gray-900">Materiales Utilizados</h3>
                </div>

                <button
                  onClick={() => setSearcherOpen(true)}
                  className="w-full flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                >
                  <Search size={18} className="text-gray-400" />
                  <span className="text-sm text-gray-600">Buscar y agregar material...</span>
                </button>

                {/* Materials List */}
                {materialsUsed.length > 0 && (
                  <div className="space-y-2">
                    {materialsUsed.map((material) => (
                      <div
                        key={material.materialCode}
                        className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg"
                      >
                        <div className="flex-1">
                          <div className="font-medium text-sm text-gray-900">{material.codigo}</div>
                          <div className="text-xs text-gray-600">{material.descripcion}</div>
                        </div>
                        <input
                          type="text"
                          value={material.quantity}
                          onChange={(e) => handleUpdateQuantity(material.materialCode, e.target.value)}
                          onBlur={() => handleQuantityBlur(material.materialCode)}
                          className="w-20 px-2 py-1 border border-gray-300 rounded text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <button
                          onClick={() => handleRemoveMaterial(material.materialCode)}
                          className="text-red-600 hover:text-red-700 transition-colors"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
            disabled={saving}
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save size={18} />
            {saving ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  );
}