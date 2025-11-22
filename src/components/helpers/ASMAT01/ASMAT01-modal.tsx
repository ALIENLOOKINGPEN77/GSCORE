"use client";

import React from "react";
import {
    X,
    Package,
    MapPin,
    Calendar,
    User,
    FileText,
    Wrench,
    ClipboardList,
    AlertCircle,
    CheckCircle,
    Clock,
    Truck,
    Users,
} from "lucide-react";
import { Timestamp } from "firebase/firestore";

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

type Exit = {
    entryId: string;
    materialCode: string;
    materialDisplayCode: string;
    materialDescription: string;
    storageLocation: string;
    entryType: "orden" | "particular" | "ajuste";
    entryDate: string;
    quantity: Record<string, number>;
    reason: string;
    state: boolean;
    createdByEmail: string;
    createdAt: Timestamp;
    acceptedAt?: Timestamp;
    workOrderDetails?: {
        orderType?: string;
        // Taller fields
        mobileUnit?: string;
        vehicleType?: string;
        driver?: string;
        // General fields
        equipment?: string;
        assignedTechnicians?: Record<string, string>;
        workPerformed?: string;
        // Common fields
        description?: string;
    };
};

type MaterialLookup = {
    [key: string]: {
        codigo: string;
        descripcion: string;
    };
};

interface ASMAT01ModalProps {
    exit: Exit;
    materialLookup: MaterialLookup;
    onClose: () => void;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

const formatTimestamp = (timestamp: Timestamp | undefined): string => {
    if (!timestamp) return "N/A";
    const date = timestamp.toDate();
    return date.toLocaleString("es-ES", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
    });
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function ASMAT01Modal({
    exit,
    materialLookup,
    onClose,
}: ASMAT01ModalProps) {
    const getTypeLabel = (type: string): string => {
        switch (type) {
            case "orden":
                return "Orden de Trabajo";
            case "particular":
                return "Particular";
            case "ajuste":
                return "Ajuste";
            default:
                return type;
        }
    };

    const getTypeColor = (type: string): string => {
        switch (type) {
            case "orden":
                return "bg-blue-100 text-blue-800 border-blue-200";
            case "particular":
                return "bg-purple-100 text-purple-800 border-purple-200";
            case "ajuste":
                return "bg-orange-100 text-orange-800 border-orange-200";
            default:
                return "bg-gray-100 text-gray-800 border-gray-200";
        }
    };

    // Get all materials from the quantity record
    const materials = Object.entries(exit.quantity).map(
        ([materialCode, quantity]) => ({
            materialCode,
            displayCode: materialLookup[materialCode]?.codigo || materialCode,
            description: materialLookup[materialCode]?.descripcion || "Desconocido",
            quantity,
        })
    );

    const totalQuantity = materials.reduce((sum, mat) => sum + mat.quantity, 0);

    // Determine work order type
    const isWorkOrder = exit.entryType === "orden";
    const workOrderType = exit.workOrderDetails?.orderType || "";
    const isTaller = workOrderType.toLowerCase() === "taller";
    const isGeneral = workOrderType.toLowerCase() === "general";

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            onClick={onClose}
        >
            <div
                className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-gray-100 rounded-lg">
                            <FileText className="text-gray-600" size={24} />
                        </div>
                        <div>
                            <h2 className="text-xl font-semibold text-gray-900">
                                Detalles de Salida
                            </h2>
                            <p className="text-gray-500 text-sm">ID: {exit.entryId}</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                        aria-label="Cerrar modal"
                    >
                        <X className="text-gray-600" size={24} />
                    </button>
                </div>

                {/* Content */}
                <div className="overflow-y-auto flex-1 p-6">
                    <div className="space-y-6">
                        {/* Status Banner */}
                        <div
                            className={`flex items-center gap-3 p-4 rounded-lg border ${exit.state
                                    ? "bg-green-50 border-green-200"
                                    : "bg-yellow-50 border-yellow-200"
                                }`}
                        >
                            {exit.state ? (
                                <>
                                    <CheckCircle className="text-green-600" size={24} />
                                    <div className="flex-1">
                                        <p className="font-semibold text-green-900">
                                            Salida Aceptada
                                        </p>
                                        <p className="text-sm text-green-700">
                                            {exit.acceptedAt
                                                ? `Aceptada el ${formatTimestamp(exit.acceptedAt)}`
                                                : "Fecha de aceptación no disponible"}
                                        </p>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <AlertCircle className="text-yellow-600" size={24} />
                                    <div className="flex-1">
                                        <p className="font-semibold text-yellow-900">
                                            Pendiente de Aprobación
                                        </p>
                                        <p className="text-sm text-yellow-700">
                                            Esta salida está esperando ser revisada y aceptada
                                        </p>
                                    </div>
                                </>
                            )}
                        </div>

                        {/* General Information */}
                        <div className="bg-gray-50 rounded-lg p-5 border border-gray-200">
                            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                                <ClipboardList size={20} className="text-gray-600" />
                                Información General
                            </h3>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                                        Tipo de Salida
                                    </label>
                                    <div className="mt-1">
                                        <span
                                            className={`inline-flex px-3 py-1 text-sm font-medium rounded-md border ${getTypeColor(
                                                exit.entryType
                                            )}`}
                                        >
                                            {getTypeLabel(exit.entryType)}
                                        </span>
                                    </div>
                                </div>
                                <div>
                                    <label className="text-xs font-medium text-gray-500 uppercase tracking-wide flex items-center gap-1">
                                        <Calendar size={14} />
                                        Fecha de Salida
                                    </label>
                                    <p className="mt-1 text-sm font-medium text-gray-900">
                                        {exit.entryDate}
                                    </p>
                                </div>
                                <div>
                                    <label className="text-xs font-medium text-gray-500 uppercase tracking-wide flex items-center gap-1">
                                        <User size={14} />
                                        Creado Por
                                    </label>
                                    <p className="mt-1 text-sm text-gray-900">
                                        {exit.createdByEmail}
                                    </p>
                                </div>
                                <div>
                                    <label className="text-xs font-medium text-gray-500 uppercase tracking-wide flex items-center gap-1">
                                        <Clock size={14} />
                                        Fecha de Creación
                                    </label>
                                    <p className="mt-1 text-sm text-gray-900">
                                        {formatTimestamp(exit.createdAt)}
                                    </p>
                                </div>
                                <div>
                                    <label className="text-xs font-medium text-gray-500 uppercase tracking-wide flex items-center gap-1">
                                        <MapPin size={14} />
                                        Ubicación de Almacenamiento
                                    </label>
                                    <p className="mt-1 text-sm font-medium text-gray-900">
                                        {exit.storageLocation}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Work Order Information - TALLER */}
                        {isWorkOrder && isTaller && exit.workOrderDetails && (
                            <div className="bg-blue-50 rounded-lg p-5 border border-blue-200">
                                <h3 className="text-lg font-semibold text-blue-900 mb-4 flex items-center gap-2">
                                    <Truck size={20} className="text-blue-600" />
                                    Orden de Trabajo - Taller
                                </h3>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-xs font-medium text-blue-700 uppercase tracking-wide">
                                            Número de Orden
                                        </label>
                                        <p className="mt-1 text-sm font-bold text-blue-900">
                                            {exit.reason}
                                        </p>
                                    </div>
                                    <div>
                                        <label className="text-xs font-medium text-blue-700 uppercase tracking-wide">
                                            Unidad Móvil
                                        </label>
                                        <p className="mt-1 text-sm font-medium text-blue-900">
                                            {exit.workOrderDetails.mobileUnit || "N/A"}
                                        </p>
                                    </div>
                                    {exit.workOrderDetails.vehicleType && (
                                        <div>
                                            <label className="text-xs font-medium text-blue-700 uppercase tracking-wide">
                                                Tipo de Vehículo
                                            </label>
                                            <p className="mt-1 text-sm text-blue-900">
                                                {exit.workOrderDetails.vehicleType}
                                            </p>
                                        </div>
                                    )}
                                    {exit.workOrderDetails.driver && (
                                        <div>
                                            <label className="text-xs font-medium text-blue-700 uppercase tracking-wide">
                                                Conductor
                                            </label>
                                            <p className="mt-1 text-sm text-blue-900">
                                                {exit.workOrderDetails.driver}
                                            </p>
                                        </div>
                                    )}
                                    {exit.workOrderDetails.description && (
                                        <div className="col-span-2">
                                            <label className="text-xs font-medium text-blue-700 uppercase tracking-wide">
                                                Descripción
                                            </label>
                                            <p className="mt-1 text-sm text-blue-900">
                                                {exit.workOrderDetails.description}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Work Order Information - GENERAL */}
                        {isWorkOrder && isGeneral && exit.workOrderDetails && (
                            <div className="bg-blue-50 rounded-lg p-5 border border-blue-200">
                                <h3 className="text-lg font-semibold text-blue-900 mb-4 flex items-center gap-2">
                                    <Wrench size={20} className="text-blue-600" />
                                    Orden de Trabajo - General
                                </h3>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-xs font-medium text-blue-700 uppercase tracking-wide">
                                            Número de Orden
                                        </label>
                                        <p className="mt-1 text-sm font-bold text-blue-900">
                                            {exit.reason}
                                        </p>
                                    </div>
                                    <div>
                                        <label className="text-xs font-medium text-blue-700 uppercase tracking-wide">
                                            Equipo
                                        </label>
                                        <p className="mt-1 text-sm font-medium text-blue-900">
                                            {exit.workOrderDetails.equipment || "N/A"}
                                        </p>
                                    </div>
                                    {exit.workOrderDetails.assignedTechnicians &&
                                        Object.keys(exit.workOrderDetails.assignedTechnicians)
                                            .length > 0 && (
                                            <div className="col-span-2">
                                                <label className="text-xs font-medium text-blue-700 uppercase tracking-wide flex items-center gap-1">
                                                    <Users size={14} />
                                                    Técnicos Asignados
                                                </label>
                                                <div className="mt-2 flex flex-wrap gap-2">
                                                    {Object.values(
                                                        exit.workOrderDetails.assignedTechnicians
                                                    ).map((tech, index) => (
                                                        <span
                                                            key={index}
                                                            className="inline-flex items-center px-3 py-1 bg-blue-100 text-blue-800 text-sm rounded-full border border-blue-200"
                                                        >
                                                            {tech}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    {exit.workOrderDetails.description && (
                                        <div className="col-span-2">
                                            <label className="text-xs font-medium text-blue-700 uppercase tracking-wide">
                                                Descripción
                                            </label>
                                            <p className="mt-1 text-sm text-blue-900">
                                                {exit.workOrderDetails.description}
                                            </p>
                                        </div>
                                    )}
                                    {exit.workOrderDetails.workPerformed && (
                                        <div className="col-span-2">
                                            <label className="text-xs font-medium text-blue-700 uppercase tracking-wide">
                                                Trabajo Realizado
                                            </label>
                                            <p className="mt-1 text-sm text-blue-900">
                                                {exit.workOrderDetails.workPerformed}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Reason (for non-work order exits) */}
                        {!isWorkOrder && (
                            <div className="bg-gray-50 rounded-lg p-5 border border-gray-200">
                                <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                                    <FileText size={20} className="text-gray-600" />
                                    Razón de Salida
                                </h3>
                                <p className="text-sm text-gray-900">{exit.reason}</p>
                            </div>
                        )}

                        {/* Materials List */}
                        <div className="bg-white rounded-lg border border-gray-200">
                            <div className="bg-gray-50 px-5 py-3 border-b border-gray-200">
                                <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                                    <Package size={20} className="text-gray-600" />
                                    Materiales ({materials.length})
                                </h3>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-5 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wide">
                                                Código
                                            </th>
                                            <th className="px-5 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wide">
                                                Descripción
                                            </th>
                                            <th className="px-5 py-3 text-right text-xs font-medium text-gray-700 uppercase tracking-wide">
                                                Cantidad
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-200">
                                        {materials.map((material, index) => (
                                            <tr
                                                key={material.materialCode}
                                                className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}
                                            >
                                                <td className="px-5 py-4">
                                                    <span className="text-sm font-medium text-gray-900">
                                                        {material.displayCode}
                                                    </span>
                                                    <p className="text-xs text-gray-500 mt-0.5">
                                                        {material.materialCode}
                                                    </p>
                                                </td>
                                                <td className="px-5 py-4">
                                                    <p className="text-sm text-gray-900">
                                                        {material.description}
                                                    </p>
                                                </td>
                                                <td className="px-5 py-4 text-right">
                                                    <span className="text-sm font-bold text-gray-900">
                                                        {material.quantity}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot className="bg-gray-100 border-t-2 border-gray-300">
                                        <tr>
                                            <td
                                                colSpan={2}
                                                className="px-5 py-3 text-right text-sm font-semibold text-gray-900"
                                            >
                                                Total:
                                            </td>
                                            <td className="px-5 py-3 text-right">
                                                <span className="text-lg font-bold text-gray-900">
                                                    {totalQuantity}
                                                </span>
                                            </td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="bg-gray-50 px-6 py-4 border-t border-gray-200 flex justify-end">
                    <button
                        onClick={onClose}
                        className="bg-gray-600 text-white px-6 py-2 rounded-lg hover:bg-gray-700 transition-colors font-medium"
                    >
                        Cerrar
                    </button>
                </div>
            </div>
        </div>
    );
}