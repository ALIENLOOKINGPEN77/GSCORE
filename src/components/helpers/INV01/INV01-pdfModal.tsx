"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  Download,
  RefreshCw,
  AlertCircle,
  FileDown,
  Filter
} from "lucide-react";
import { Timestamp } from "firebase/firestore";
import { generateINV01MovimientosPdf } from "../../../lib/utils/pdfDocumentGenerator-INV01-movimientos";
import { generateINV01ActualPdf } from "../../../lib/utils/pdfDocumentGenerator-INV01-taller";
import INV01PdfModalFilter from "./INV01-pdfModalFilter";

export type Movement = {
  moveId: string;
  qty: number;
  effectiveAt: Timestamp;
  recordedAt: Timestamp;
  storageLocation: string;
  source: string;
  sourceId: string;
  reason: string | null;
  approvedByEmail: string | null;
  deleted: boolean;
  materialCode?: string;
  materialDescription?: string;
  unidadDeMedida?: string;
  equipmentOrUnit?: string;
  orderType?: string | null;
};

export type Material = {
  documentId: string;
  codigo: string;
  descripcion: string;
  proveedor: string;
  marca: string;
  unidadDeMedida: string;
};

interface INV01PdfModalProps {
  movements: Movement[];
  materials: Material[];
  rangeStart: string;
  rangeEnd: string;
  onClose: () => void;
  onBack: () => void;
}

export default function INV01PdfModal({ 
  movements,
  materials,
  rangeStart, 
  rangeEnd, 
  onClose, 
  onBack 
}: INV01PdfModalProps) {
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filterModalOpen, setFilterModalOpen] = useState(false);

  const handleGeneratePdf = async () => {
    if (movements.length === 0) {
      setError('No hay movimientos para generar el PDF');
      return;
    }

    try {
      setIsGeneratingPdf(true);
      setError(null);
      await generateINV01MovimientosPdf(movements, rangeStart, rangeEnd);
    } catch (error) {
      console.error('Error generating PDF:', error);
      setError('Error al generar el PDF. Por favor intenta de nuevo.');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handleGenerateCostCenterPdf = async () => {
    if (movements.length === 0) {
      setError('No hay movimientos para generar el PDF');
      return;
    }

    try {
      setIsGeneratingPdf(true);
      setError(null);
      await generateINV01ActualPdf(movements, rangeStart, rangeEnd);
    } catch (error) {
      console.error('Error generating PDF:', error);
      setError('Error al generar el PDF. Por favor intenta de nuevo.');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  if (filterModalOpen) {
    return (
      <INV01PdfModalFilter
        movements={movements}
        materials={materials}
        rangeStart={rangeStart}
        rangeEnd={rangeEnd}
        onClose={onClose}
        onBack={() => setFilterModalOpen(false)}
      />
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-green-50 to-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-full bg-green-100">
                <Download size={28} className="text-green-600" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Generar Reportes PDF</h2>
                <p className="text-sm text-gray-600 mt-1">Selecciona el tipo de reporte</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors p-2 hover:bg-gray-100 rounded-full"
            >
              <X size={24} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="text-sm font-medium text-blue-900 mb-3">Resumen</h3>
            <div className="grid grid-cols-4 gap-4 text-sm">
              <div>
                <div className="text-xs text-blue-700 mb-1">Materiales</div>
                <div className="text-lg font-semibold text-blue-900">
                  {new Set(movements.map(m => m.materialCode)).size}
                </div>
              </div>
              <div>
                <div className="text-xs text-blue-700 mb-1">Total Movimientos</div>
                <div className="text-lg font-semibold text-blue-900">{movements.length}</div>
              </div>
              <div>
                <div className="text-xs text-green-700 mb-1">Entradas</div>
                <div className="text-lg font-semibold text-green-700">
                  {movements.filter(m => m.qty > 0).length}
                </div>
              </div>
              <div>
                <div className="text-xs text-orange-700 mb-1">Salidas</div>
                <div className="text-lg font-semibold text-orange-700">
                  {movements.filter(m => m.qty < 0).length}
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <button
              onClick={handleGeneratePdf}
              disabled={isGeneratingPdf || movements.length === 0}
              className="w-full h-20 bg-red-50 border-2 border-red-200 rounded-lg hover:bg-red-100 transition-all duration-200 flex items-center justify-center gap-4 group disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isGeneratingPdf ? (
                <RefreshCw size={28} className="text-red-600 animate-spin" />
              ) : (
                <FileDown size={28} className="text-red-600 group-hover:scale-110 transition-transform" />
              )}
              <div className="text-left">
                <div className="text-red-900 font-semibold text-lg">
                  {isGeneratingPdf ? 'Generando PDF...' : 'Descargar PDF General'}
                </div>
                <div className="text-red-700 text-sm">
                  Entradas y Salidas separadas
                </div>
              </div>
            </button>

            <button
              onClick={handleGenerateCostCenterPdf}
              disabled={isGeneratingPdf || movements.length === 0}
              className="w-full h-20 bg-blue-50 border-2 border-blue-200 rounded-lg hover:bg-blue-100 transition-all duration-200 flex items-center justify-center gap-4 group disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isGeneratingPdf ? (
                <RefreshCw size={28} className="text-blue-600 animate-spin" />
              ) : (
                <FileDown size={28} className="text-blue-600 group-hover:scale-110 transition-transform" />
              )}
              <div className="text-left">
                <div className="text-blue-900 font-semibold text-lg">
                  {isGeneratingPdf ? 'Generando PDF...' : 'Reporte por Centro de Costos'}
                </div>
                <div className="text-blue-700 text-sm">
                  Salidas agrupadas por equipo (Solo Taller)
                </div>
              </div>
            </button>

            <button
              onClick={() => setFilterModalOpen(true)}
              disabled={isGeneratingPdf || movements.length === 0}
              className="w-full h-20 bg-purple-50 border-2 border-purple-200 rounded-lg hover:bg-purple-100 transition-all duration-200 flex items-center justify-center gap-4 group disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Filter size={28} className="text-purple-600 group-hover:scale-110 transition-transform" />
              <div className="text-left">
                <div className="text-purple-900 font-semibold text-lg">
                  Reporte Filtrado
                </div>
                <div className="text-purple-700 text-sm">
                  Personaliza movimientos y materiales
                </div>
              </div>
            </button>

            <button
              onClick={onBack}
              className="w-full px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
            >
              Nueva Búsqueda
            </button>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-2 mt-4">
              <AlertCircle className="text-red-600 mt-0.5" size={20} />
              <div className="flex-1">
                <div className="font-medium text-red-900">{error}</div>
              </div>
              <button onClick={() => setError(null)} className="text-red-600 hover:text-red-800">
                <X size={16} />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}