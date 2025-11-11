"use client";

import React, { useState, useEffect } from "react";
import { X, Plus, Trash2, AlertCircle } from "lucide-react";

export type StorageAllocation = {
    storageLocation: string;
    quantity: string;
};

export type MaterialAllocation = {
    materialCode: string;
    materialDisplayCode: string;
    totalQuantity: number;
    allocations: StorageAllocation[];
};

type SMAT01ModalProps = {
    materials: MaterialAllocation[];
    storageLocations: string[];
    onSave: (allocations: MaterialAllocation[]) => void;
    onClose: () => void;
};

export default function SMAT01Modal({ materials, storageLocations, onSave, onClose }: SMAT01ModalProps) {
    const [allocations, setAllocations] = useState<MaterialAllocation[]>(materials);
    const [errors, setErrors] = useState<string[]>([]);

    useEffect(() => {
        setAllocations(materials);
    }, [materials]);

    const addAllocation = (materialIndex: number) => {
        const updated = [...allocations];
        updated[materialIndex].allocations.push({ storageLocation: '', quantity: '' });
        setAllocations(updated);
    };

    const removeAllocation = (materialIndex: number, allocIndex: number) => {
        const updated = [...allocations];
        updated[materialIndex].allocations = updated[materialIndex].allocations.filter((_, i) => i !== allocIndex);
        setAllocations(updated);
    };

    const updateAllocation = (
        materialIndex: number,
        allocIndex: number,
        field: 'storageLocation' | 'quantity',
        value: string
    ) => {
        const updated = [...allocations];
        updated[materialIndex].allocations[allocIndex][field] = value;
        setAllocations(updated);
        setErrors([]);
    };

    const validate = (): boolean => {
        const newErrors: string[] = [];

        allocations.forEach((material) => {
            const totalAllocated = material.allocations.reduce((sum, alloc) => {
                const qty = Number(alloc.quantity);
                return sum + (isNaN(qty) ? 0 : qty);
            }, 0);

            if (totalAllocated !== material.totalQuantity) {
                newErrors.push(
                    `${material.materialDisplayCode}: cantidad asignada (${totalAllocated}) debe ser ${material.totalQuantity}`
                );
            }

            material.allocations.forEach((alloc, index) => {
                if (!alloc.storageLocation) {
                    newErrors.push(`${material.materialDisplayCode}: depósito ${index + 1} no seleccionado`);
                }
                if (!alloc.quantity || Number(alloc.quantity) <= 0) {
                    newErrors.push(`${material.materialDisplayCode}: cantidad ${index + 1} inválida`);
                }
            });
        });

        setErrors(newErrors);
        return newErrors.length === 0;
    };

    const handleSave = () => {
        if (validate()) {
            onSave(allocations);
            onClose();
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
                <div className="p-6 border-b border-gray-200 flex items-center justify-between">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-900">Asignación de Depósitos</h2>
                        <p className="text-sm text-gray-600 mt-1">
                            Especifique de qué depósito(s) se tomarán los materiales
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 transition-colors p-2"
                    >
                        <X size={24} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6">
                    {errors.length > 0 && (
                        <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-4">
                            <div className="flex items-start gap-2">
                                <AlertCircle className="text-red-600 shrink-0 mt-0.5" size={18} />
                                <div className="text-red-800 text-sm">
                                    <p className="font-medium mb-1">Errores de validación:</p>
                                    <ul className="list-disc list-inside space-y-1">
                                        {errors.map((error, index) => (
                                            <li key={index}>{error}</li>
                                        ))}
                                    </ul>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="space-y-4">
                        {allocations.map((material, materialIndex) => {
                            const totalAllocated = material.allocations.reduce((sum, alloc) => {
                                const qty = Number(alloc.quantity);
                                return sum + (isNaN(qty) ? 0 : qty);
                            }, 0);
                            const remaining = material.totalQuantity - totalAllocated;
                            const isComplete = remaining === 0 && material.allocations.every(
                                a => a.storageLocation && Number(a.quantity) > 0
                            );
                            const hasError = remaining < 0;

                            return (
                                <div key={material.materialCode} className="bg-gray-50 border rounded-lg p-4">
                                    <div className="flex items-start justify-between mb-3">
                                        <div>
                                            <p className="font-medium text-gray-900">{material.materialDisplayCode}</p>
                                            <p className="text-xs text-gray-500">ISO: {material.materialCode}</p>
                                            <p className="text-sm text-gray-600 mt-1">
                                                Total requerido: <span className="font-semibold">{material.totalQuantity}</span>
                                            </p>
                                        </div>
                                        <div className="text-right">
                                            <p className={`text-sm font-semibold ${
                                                isComplete ? 'text-green-600' :
                                                hasError ? 'text-red-600' : 'text-yellow-600'
                                            }`}>
                                                {isComplete ? '✓ Completo' :
                                                 hasError ? '✗ Excedido' : `Falta: ${remaining}`}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        {material.allocations.map((alloc, allocIndex) => (
                                            <div key={allocIndex} className="flex gap-2 items-start bg-white rounded p-2">
                                                <div className="flex-1">
                                                    <label className="text-xs text-gray-600 mb-1 block">Depósito</label>
                                                    <select
                                                        value={alloc.storageLocation}
                                                        onChange={(e) => updateAllocation(
                                                            materialIndex,
                                                            allocIndex,
                                                            'storageLocation',
                                                            e.target.value
                                                        )}
                                                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                                                    >
                                                        <option value="">Seleccione depósito</option>
                                                        {storageLocations.map(loc => (
                                                            <option key={loc} value={loc}>{loc}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                                <div className="w-32">
                                                    <label className="text-xs text-gray-600 mb-1 block">Cantidad</label>
                                                    <input
                                                        type="number"
                                                        value={alloc.quantity}
                                                        onChange={(e) => updateAllocation(
                                                            materialIndex,
                                                            allocIndex,
                                                            'quantity',
                                                            e.target.value
                                                        )}
                                                        placeholder="0"
                                                        min="0"
                                                        step="1"
                                                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                                                    />
                                                </div>
                                                <button
                                                    onClick={() => removeAllocation(materialIndex, allocIndex)}
                                                    disabled={material.allocations.length === 1}
                                                    className="mt-6 p-2 text-red-600 hover:bg-red-50 rounded-md transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>

                                    <button
                                        onClick={() => addAllocation(materialIndex)}
                                        className="mt-3 w-full px-3 py-2 bg-white hover:bg-gray-100 border border-gray-300 text-gray-700 rounded-md text-sm font-medium transition-colors flex items-center justify-center gap-2"
                                    >
                                        <Plus size={16} />
                                        Agregar Depósito
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                </div>

                <div className="p-6 border-t border-gray-200 bg-gray-50 flex items-center justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-6 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors font-medium"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleSave}
                        className="px-6 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors font-medium"
                    >
                        Guardar Asignaciones
                    </button>
                </div>
            </div>
        </div>
    );
}