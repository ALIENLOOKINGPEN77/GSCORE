"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Calendar,
  Truck,
  User,
  FileText,
  Fuel,
  Clock,
  RefreshCw,
  AlertCircle,
  Eye,
  Search,
  X,
  Download,
  FileDown
} from "lucide-react";
import {
  collection,
  query,
  where,
  orderBy,
  getDocs,
  Timestamp
} from "firebase/firestore";
import { db } from "../../../lib/firebase/client";
import { type ECOM01Document } from "../../../lib/firebase/ecom01";
import * as XLSX from 'xlsx';
import { generateTCOM01Pdf } from '../../../lib/utils/pdfDocumentGenerator-TCOM01';

// ---------------------------
// Types
// ---------------------------
type FuelEntryDisplay = ECOM01Document & {
  id: string;
  quantityDifference: number;
  formattedDate: string;
  formattedTime: string;
  completedTime: string;
};

type TCOM01ListProps = {
  isOpen: boolean;
  onClose: () => void;
};

// ---------------------------
// Entry Detail Modal (simplified version)
// ---------------------------
const QuickEntryModal = ({
  entry,
  onClose
}: {
  entry: FuelEntryDisplay | null;
  onClose: () => void;
}) => {
  if (!entry) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[80vh] overflow-hidden">
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">
            Entrada - {entry.id}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-4 overflow-y-auto">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-500">Fecha:</span>
              <p className="font-medium">{entry.formattedDate}</p>
            </div>
            <div>
              <span className="text-gray-500">Hora:</span>
              <p className="font-medium">{entry.formattedTime}</p>
            </div>
            <div>
              <span className="text-gray-500">Proveedor:</span>
              <p className="font-medium">{entry.proveedorExterno}</p>
            </div>
            <div>
              <span className="text-gray-500">Chapa:</span>
              <p className="font-medium">{entry.nroChapa}</p>
            </div>
            <div>
              <span className="text-gray-500">Chofer:</span>
              <p className="font-medium">{entry.chofer}</p>
            </div>
            <div>
              <span className="text-gray-500">Factura:</span>
              <p className="font-medium">{entry.factura}</p>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-gray-200">
            <h4 className="font-medium text-gray-800 mb-3">Cantidades</h4>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-lg font-bold text-blue-600">
                  {parseFloat(entry.cantidadFacturadaLts || '0').toFixed(2)}
                </div>
                <div className="text-xs text-gray-500">Facturado (L)</div>
              </div>
              <div>
                <div className="text-lg font-bold text-green-600">
                  {parseFloat(entry.cantidadRecepcionadaLts || '0').toFixed(2)}
                </div>
                <div className="text-xs text-gray-500">Recepcionado (L)</div>
              </div>
              <div>
                <div className={`text-lg font-bold ${Math.abs(entry.quantityDifference) < 0.01
                  ? 'text-green-600'
                  : entry.quantityDifference > 0
                    ? 'text-orange-600'
                    : 'text-red-600'
                  }`}>
                  {entry.quantityDifference > 0 ? '+' : ''}{entry.quantityDifference.toFixed(2)}
                </div>
                <div className="text-xs text-gray-500">Diferencia</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ---------------------------
// Main List Modal Component
// ---------------------------
export default function TCOM01List({ isOpen, onClose }: TCOM01ListProps) {
  const [entries, setEntries] = useState<FuelEntryDisplay[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedEntry, setSelectedEntry] = useState<FuelEntryDisplay | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  // Date range state
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Transform entry function
  const transformEntry = (id: string, data: ECOM01Document): FuelEntryDisplay => {
    const facturada = parseFloat(data.cantidadFacturadaLts || '0');
    const recepcionada = parseFloat(data.cantidadRecepcionadaLts || '0');
    const quantityDifference = facturada - recepcionada;

    let formattedDate = '';
    if (data.fecha) {
      const date = new Date(data.fecha + 'T00:00:00');
      if (!isNaN(date.getTime())) {
        formattedDate = date.toLocaleDateString('es-ES', {
          day: '2-digit', month: '2-digit', year: 'numeric'
        });
      }
    }

    let completedTime = '';
    if (data.completedAt) {
      const completedDate = data.completedAt.toDate();
      completedTime = completedDate.toLocaleDateString('es-ES', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
      });
    }

    return {
      ...data,
      id,
      quantityDifference,
      formattedDate,
      formattedTime: data.horaDescarga || '',
      completedTime
    };
  };

  // Download Excel function
  const downloadExcel = async () => {
    if (entries.length === 0) {
      alert('No hay datos para descargar');
      return;
    }

    setIsDownloading(true);
    try {
      // Prepare data for Excel
      const excelData = entries.map(entry => ({
        'Fecha': entry.formattedDate,
        'Hora': entry.formattedTime || '-',
        'Proveedor': entry.proveedorExterno || '-',
        'Chapa': entry.nroChapa || '-',
        'Chofer': entry.chofer || '-',
        'Factura': entry.factura || '-',
        'Litros Facturados': parseFloat(entry.cantidadFacturadaLts || '0').toFixed(2),
        'Litros Recepcionados': parseFloat(entry.cantidadRecepcionadaLts || '0').toFixed(2),
        'Diferencia': entry.quantityDifference.toFixed(2),
        'Completado': entry.completedTime
      }));

      // Create workbook and worksheet
      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.json_to_sheet(excelData);

      // Set column widths
      const columnWidths = [
        { wch: 12 }, // Fecha
        { wch: 8 },  // Hora
        { wch: 20 }, // Proveedor
        { wch: 12 }, // Chapa
        { wch: 18 }, // Chofer
        { wch: 15 }, // Factura
        { wch: 18 }, // Litros Facturados
        { wch: 20 }, // Litros Recepcionados
        { wch: 12 }, // Diferencia
        { wch: 18 }  // Completado
      ];
      worksheet['!cols'] = columnWidths;

      // Add worksheet to workbook
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Entradas de Combustible');

      // Generate filename with date range
      const filename = `entradas_combustible_${startDate}_${endDate}.xlsx`;

      // Save file
      XLSX.writeFile(workbook, filename);
    } catch (error) {
      console.error('Error downloading Excel:', error);
      alert('Error al descargar el archivo Excel');
    } finally {
      setIsDownloading(false);
    }
  };

  // Download PDF function
  const downloadPDF = async () => {
    if (entries.length === 0) {
      alert('No hay datos para descargar');
      return;
    }

    setIsGeneratingPdf(true);
    try {
      await generateTCOM01Pdf(entries, startDate, endDate);
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Error al generar el archivo PDF. Asegúrate de tener jsPDF instalado.');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // Fetch entries for date range
  const fetchEntriesInRange = async () => {
    if (!startDate || !endDate) {
      setError('Por favor selecciona ambas fechas');
      return;
    }

    if (new Date(startDate) > new Date(endDate)) {
      setError('La fecha de inicio debe ser anterior a la fecha de fin');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const startTimestamp = Timestamp.fromDate(new Date(startDate + 'T00:00:00'));
      const endTimestamp = Timestamp.fromDate(new Date(endDate + 'T23:59:59'));

      const q = query(
        collection(db, 'ECOM01'),
        where('status', '==', 'completed'),
        where('completedAt', '>=', startTimestamp),
        where('completedAt', '<=', endTimestamp),
        orderBy('completedAt', 'desc')
      );

      const querySnapshot = await getDocs(q);
      const entriesData = querySnapshot.docs.map(doc =>
        transformEntry(doc.id, doc.data() as ECOM01Document)
      );

      setEntries(entriesData);
    } catch (err) {
      console.error('Error fetching entries:', err);
      setError('Error al cargar las entradas');
    } finally {
      setLoading(false);
    }
  };

  // Reset when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setEntries([]);
      setError(null);
      // Set default dates (last 7 days)
      const today = new Date();
      const weekAgo = new Date(today);
      weekAgo.setDate(weekAgo.getDate() - 7);

      setEndDate(today.toISOString().split('T')[0]);
      setStartDate(weekAgo.toISOString().split('T')[0]);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg w-full max-w-6xl max-h-[90vh] overflow-hidden">
          {/* Header */}
          <div className="p-6 border-b border-gray-200 flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">
              Historial de Entradas de Combustible
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <X size={24} />
            </button>
          </div>

          {/* Date Range Controls */}
          <div className="p-6 border-b border-gray-200 bg-gray-50">
            <div className="flex flex-col md:flex-row gap-4 items-end">
              <div className="flex gap-4 flex-1">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Fecha Inicio
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Fecha Fin
                  </label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <button
                  onClick={fetchEntriesInRange}
                  disabled={loading || !startDate || !endDate}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {loading ? (
                    <RefreshCw className="animate-spin" size={16} />
                  ) : (
                    <Search size={16} />
                  )}
                  Buscar
                </button>
              </div>

              {entries.length > 0 && (
                <div className="flex gap-2">
                  <button
                    onClick={downloadExcel}
                    disabled={isDownloading}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {isDownloading ? (
                      <RefreshCw className="animate-spin" size={16} />
                    ) : (
                      <Download size={16} />
                    )}
                    {isDownloading ? 'Generando...' : 'Descargar Excel'}
                  </button>

                  <button
                    onClick={downloadPDF}
                    disabled={isGeneratingPdf}
                    className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {isGeneratingPdf ? (
                      <RefreshCw className="animate-spin" size={16} />
                    ) : (
                      <FileDown size={16} />
                    )}
                    {isGeneratingPdf ? 'Generando...' : 'Descargar PDF'}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Error Display */}
          {error && (
            <div className="p-4 bg-red-50 border-b border-red-200 flex items-center gap-2 text-red-800">
              <AlertCircle size={20} />
              <span>{error}</span>
            </div>
          )}

          {/* Results */}
          <div className="flex-1 overflow-y-auto" style={{ maxHeight: 'calc(90vh - 280px)' }}>
            {loading ? (
              <div className="p-8 text-center">
                <div className="inline-flex items-center gap-2 text-gray-500">
                  <RefreshCw className="animate-spin" size={20} />
                  <span>Cargando entradas...</span>
                </div>
              </div>
            ) : entries.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                {startDate && endDate
                  ? 'No se encontraron entradas en el rango de fechas seleccionado'
                  : 'Selecciona un rango de fechas para buscar entradas'
                }
              </div>
            ) : (
              <div className="p-6">
                <div className="mb-4 text-sm text-gray-600">
                  Mostrando {entries.length} entradas
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full border border-gray-200 rounded-lg">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="text-left p-3 font-medium text-gray-900 border-b">Fecha</th>
                        <th className="text-left p-3 font-medium text-gray-900 border-b">Hora</th>
                        <th className="text-left p-3 font-medium text-gray-900 border-b">Proveedor</th>
                        <th className="text-left p-3 font-medium text-gray-900 border-b">Chapa</th>
                        <th className="text-left p-3 font-medium text-gray-900 border-b">Chofer</th>
                        <th className="text-right p-3 font-medium text-gray-900 border-b">Facturado (L)</th>
                        <th className="text-right p-3 font-medium text-gray-900 border-b">Recepcionado (L)</th>
                        <th className="text-right p-3 font-medium text-gray-900 border-b">Diferencia</th>
                        <th className="text-center p-3 font-medium text-gray-900 border-b">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {entries.map((entry) => (
                        <tr key={entry.id} className="hover:bg-gray-50">
                          <td className="p-3 text-sm text-gray-900">{entry.formattedDate}</td>
                          <td className="p-3 text-sm text-gray-900">{entry.formattedTime || '-'}</td>
                          <td className="p-3 text-sm text-gray-900">{entry.proveedorExterno}</td>
                          <td className="p-3 text-sm font-medium text-gray-900">{entry.nroChapa}</td>
                          <td className="p-3 text-sm text-gray-900">{entry.chofer}</td>
                          <td className="p-3 text-sm text-right text-gray-900">
                            {parseFloat(entry.cantidadFacturadaLts || '0').toFixed(2)}
                          </td>
                          <td className="p-3 text-sm text-right text-gray-900">
                            {parseFloat(entry.cantidadRecepcionadaLts || '0').toFixed(2)}
                          </td>
                          <td className="p-3 text-sm text-right">
                            <span className={`font-medium ${Math.abs(entry.quantityDifference) < 0.01
                              ? 'text-green-600'
                              : entry.quantityDifference > 0
                                ? 'text-orange-600'
                                : 'text-red-600'
                              }`}>
                              {entry.quantityDifference > 0 ? '+' : ''}{entry.quantityDifference.toFixed(2)}
                            </span>
                          </td>
                          <td className="p-3 text-center">
                            <button
                              onClick={() => setSelectedEntry(entry)}
                              className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors text-sm"
                            >
                              <Eye size={12} />
                              Ver
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Quick Entry Detail Modal */}
      {selectedEntry && (
        <QuickEntryModal
          entry={selectedEntry}
          onClose={() => setSelectedEntry(null)}
        />
      )}
    </>
  );
}