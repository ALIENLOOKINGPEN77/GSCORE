"use client";

import React, { useState } from "react";
import { X, FileDown, FileSpreadsheet, RefreshCw } from "lucide-react";
import * as XLSX from 'xlsx';
import { generateSCOM01Pdf } from '../../../lib/utils/pdfDocumentGenerator-SCOM01';

// Types
type CargaFlota = {
  id: string;
  Litros: string;
  NroMovil: string;
  Chofer: string;
  HoraCarga: string;
  Kilometraje?: string;
  Horometro?: string;
  Precinto?: string;
  HasFirma: boolean;
  FirmaSvg?: string;
  createdAt: number;
  type: 'flota';
};

type CargaExterna = {
  id: string;
  Empresa: string;
  NumeroChapa: string;
  LitrosCargados: string;
  NombreChofer: string;
  Hora: string;
  Kilometraje?: string;
  Horometro?: string;
  Precinto?: string;
  HasFirma: boolean;
  FirmaSvg?: string;
  createdAt: number;
  type: 'externa';
};

type CargaDisplay = CargaFlota | CargaExterna;

type SCOM01DownloadModalProps = {
  isOpen: boolean;
  onClose: () => void;
  entries: CargaDisplay[];
  dateString: string;
  Tinicial?: string;
  Tfinal?: string;
};

export default function SCOM01DownloadModal({
  isOpen,
  onClose,
  entries,
  dateString,
  Tinicial = '',
  Tfinal = ''
}: SCOM01DownloadModalProps) {
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [isDownloadingExcel, setIsDownloadingExcel] = useState(false);

  if (!isOpen) return null;

  // Format date for display
  const displayDate = dateString ?
    dateString.split('-').reverse().join('/') :
    new Date().toLocaleDateString('es-ES');

  // Download PDF function
  const handleDownloadPdf = async () => {
    if (entries.length === 0) {
      alert('No hay datos para descargar');
      return;
    }

    setIsDownloadingPdf(true);
    try {
      await generateSCOM01Pdf(entries, dateString, Tinicial, Tfinal);
      onClose(); // Close modal after successful download
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Error al generar el archivo PDF');
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  // Download Excel function
  const handleDownloadExcel = async () => {
    if (entries.length === 0) {
      alert('No hay datos para descargar');
      return;
    }

    setIsDownloadingExcel(true);
    try {
      // Sort all entries by timestamp
      const sortedEntries = [...entries].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

      // Prepare data for Excel - Main sheet
      const excelData = sortedEntries.map(entry => {
        const isFlota = entry.type === 'flota';
        return {
          'TIPO': isFlota ? 'INTERNO' : 'EXTERNO',
          'EMPRESA / NRO. MÓVIL': isFlota ? (entry as CargaFlota).NroMovil : (entry as CargaExterna).Empresa,
          'NRO. CHAPA': isFlota ? '-' : ((entry as CargaExterna).NumeroChapa || '-'),
          'CHOFER': isFlota ? (entry as CargaFlota).Chofer : (entry as CargaExterna).NombreChofer,
          'LITROS CARGADOS': parseFloat(isFlota ? (entry as CargaFlota).Litros : (entry as CargaExterna).LitrosCargados).toFixed(2),
          'HORA': isFlota ? (entry as CargaFlota).HoraCarga : (entry as CargaExterna).Hora,
          'KILOMETRAJE': entry.Kilometraje || '-',
          'HORÓMETRO': entry.Horometro || '-',
          'PRECINTO': entry.Precinto || '-',
          'FIRMA': entry.HasFirma ? 'SÍ' : 'NO'
        };
      });

      // Create workbook
      const workbook = XLSX.utils.book_new();

      // Create main worksheet
      const worksheet = XLSX.utils.json_to_sheet(excelData);

      // Set column widths for main sheet
      const columnWidths = [
        { wch: 12 },  // TIPO
        { wch: 20 },  // EMPRESA / NRO. MÓVIL
        { wch: 12 },  // NRO. CHAPA
        { wch: 25 },  // CHOFER
        { wch: 16 },  // LITROS CARGADOS
        { wch: 10 },  // HORA
        { wch: 14 },  // KILOMETRAJE
        { wch: 14 },  // HORÓMETRO
        { wch: 12 },  // PRECINTO
        { wch: 10 }   // FIRMA
      ];
      worksheet['!cols'] = columnWidths;

      // Add main worksheet to workbook
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Despacho Combustible');

      // Create Totalizadores sheet
      const totalizadoresData = [
        {
          'Inicial': Tinicial || '-',
          'Final': Tfinal || '-'
        }
      ];

      const totalizadoresSheet = XLSX.utils.json_to_sheet(totalizadoresData);

      // Set column widths for totalizadores sheet
      const totalizadoresColumnWidths = [
        { wch: 20 },  // Inicial
        { wch: 20 }   // Final
      ];
      totalizadoresSheet['!cols'] = totalizadoresColumnWidths;

      // Add totalizadores worksheet to workbook
      XLSX.utils.book_append_sheet(workbook, totalizadoresSheet, 'Totalizadores');

      // Generate filename
      const filename = `Despacho_Diario_SCOM01_${displayDate.replace(/\//g, '-')}.xlsx`;

      // Save file
      XLSX.writeFile(workbook, filename);

      onClose(); // Close modal after successful download
    } catch (error) {
      console.error('Error generating Excel:', error);
      alert('Error al generar el archivo Excel');
    } finally {
      setIsDownloadingExcel(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-md w-full shadow-xl">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">
            Descargar Documento Diario
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            disabled={isDownloadingPdf || isDownloadingExcel}
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          <div className="mb-6">
            <div className="text-sm text-gray-600 mb-1">Fecha del documento:</div>
            <div className="text-lg font-semibold text-gray-900">{displayDate}</div>
            <div className="text-sm text-gray-500 mt-2">
              {entries.length} {entries.length === 1 ? 'carga registrada' : 'cargas registradas'}
            </div>
          </div>

          <div className="space-y-3">
            {/* PDF Download Button */}
            <button
              onClick={handleDownloadPdf}
              disabled={isDownloadingPdf || isDownloadingExcel}
              className="w-full h-24 bg-red-50 border-2 border-red-200 rounded-lg hover:bg-red-100 transition-all duration-200 flex items-center justify-center gap-4 group disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isDownloadingPdf ? (
                <RefreshCw size={32} className="text-red-600 animate-spin" />
              ) : (
                <FileDown size={32} className="text-red-600 group-hover:scale-110 transition-transform" />
              )}
              <div className="text-left">
                <div className="text-red-900 font-semibold text-lg">
                  {isDownloadingPdf ? 'Generando PDF...' : 'Formato PDF'}
                </div>
                <div className="text-red-700 text-sm">
                  Documento con formato oficial
                </div>
              </div>
            </button>

            {/* Excel Download Button */}
            <button
              onClick={handleDownloadExcel}
              disabled={isDownloadingPdf || isDownloadingExcel}
              className="w-full h-24 bg-green-50 border-2 border-green-200 rounded-lg hover:bg-green-100 transition-all duration-200 flex items-center justify-center gap-4 group disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isDownloadingExcel ? (
                <RefreshCw size={32} className="text-green-600 animate-spin" />
              ) : (
                <FileSpreadsheet size={32} className="text-green-600 group-hover:scale-110 transition-transform" />
              )}
              <div className="text-left">
                <div className="text-green-900 font-semibold text-lg">
                  {isDownloadingExcel ? 'Generando Excel...' : 'Formato Excel'}
                </div>
                <div className="text-green-700 text-sm">
                  Archivo editable para análisis
                </div>
              </div>
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-gray-50 rounded-b-lg border-t border-gray-200">
          <button
            onClick={onClose}
            disabled={isDownloadingPdf || isDownloadingExcel}
            className="w-full px-4 py-2 text-gray-700 hover:text-gray-900 transition-colors text-sm font-medium disabled:opacity-50"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}