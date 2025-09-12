"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { 
  Calendar, 
  Truck, 
  User, 
  FileText, 
  Fuel, 
  Clock, 
  CheckCircle, 
  RefreshCw, 
  AlertCircle,
  Eye,
  Search,
  Download
} from "lucide-react";
import { useAuth } from "../auth-context";
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  Timestamp,
  getDocs
} from "firebase/firestore";
import { db } from "../../lib/firebase/client";
import { renderSignatureSVG, type ECOM01Document } from "../../lib/firebase/ecom01";
import { generateEntryPdf } from "../../lib/utils/pdfDocumentGenerator";

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

type FilterOptions = {
  provider: string;
  showDifferencesOnly: boolean;
  sortOrder: 'asc' | 'desc';
};

// ---------------------------
// Signature component for modal display only
// ---------------------------
const SignatureDisplay = ({ signature, className = "" }: { signature: any; className?: string }) => {
  if (!signature || !signature.paths || !signature.height) return null;

  try {
    const originalSvgString = renderSignatureSVG(signature);
    if (!originalSvgString) return null;

    const originalHeight = signature.height;
    const originalWidth = signature.width || 600;

    const parser = new DOMParser();
    const svgDoc = parser.parseFromString(originalSvgString, "image/svg+xml");
    const svgElement = svgDoc.querySelector("svg");

    if (!svgElement) {
      console.error("Failed to parse SVG string from renderSignatureSVG.");
      throw new Error("Invalid SVG string");
    }

    svgElement.removeAttribute("width");
    svgElement.removeAttribute("height");
    svgElement.removeAttribute("style");
    svgElement.setAttribute("viewBox", `0 0 ${originalWidth} ${originalHeight}`);
    svgElement.setAttribute("width", "400px");
    svgElement.setAttribute("height", "120px");
    svgElement.setAttribute("preserveAspectRatio", "xMidYMid meet");

    const modifiedSvgString = svgElement.outerHTML;

    return (
      <div
        className={`border rounded-lg p-3 bg-gray-50 w-fit flex items-center justify-center ${className}`}
        style={{ width: "300px", height: "150px" }}
        dangerouslySetInnerHTML={{ __html: modifiedSvgString }}
      />
    );
  } catch (error) {
    console.warn("Error processing or rendering signature:", error);
    return (
      <div
        className={`border rounded-lg p-3 bg-gray-50 w-fit flex items-center justify-center ${className}`}
        style={{ width: "200px", height: "120px" }}
      >
        <span className="text-gray-500 text-sm italic">Firma no disponible</span>
      </div>
    );
  }
};

// ---------------------------
// Modal component with new PDF generation
// ---------------------------
const EntryDetailModal = ({ 
  entry, 
  onClose 
}: { 
  entry: FuelEntryDisplay | null; 
  onClose: () => void; 
}) => {
  if (!entry) return null;

  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  const handleDownloadPdf = async () => {
    if (!entry) return;

    setIsGeneratingPdf(true);
    try {
      await generateEntryPdf(entry);
    } catch (error) {
      console.error("Error generating PDF:", error);
      // You might want to show a toast notification here
      alert("Error generando el PDF. Por favor, inténtelo de nuevo.");
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 z-10 bg-white p-6 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">
            Detalle de Entrada - {entry.id}
          </h2>
          <div className="flex items-center gap-4">
            <button
              onClick={handleDownloadPdf}
              disabled={isGeneratingPdf}
              className="text-gray-500 hover:text-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="Descargar PDF"
            >
              {isGeneratingPdf ? (
                <RefreshCw className="animate-spin" size={20} />
              ) : (
                <Download size={20} />
              )}
            </button>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Status */}
          <div className="flex items-center gap-2">
            <CheckCircle className="text-green-500" size={20} />
            <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-medium">
              Completado
            </span>
            <span className="text-gray-500 text-sm">{entry.completedTime}</span>
          </div>

          {/* Information Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-800 border-b pb-2">
                Información de la Entrega
              </h3>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <Calendar className="text-gray-400" size={16} />
                  <div>
                    <span className="text-sm text-gray-500">Fecha:</span>
                    <p className="font-medium">{entry.formattedDate}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Truck className="text-gray-400" size={16} />
                  <div>
                    <span className="text-sm text-gray-500">Proveedor:</span>
                    <p className="font-medium">{entry.proveedorExterno}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <FileText className="text-gray-400" size={16} />
                  <div>
                    <span className="text-sm text-gray-500">Chapa:</span>
                    <p className="font-medium">{entry.nroChapa}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <User className="text-gray-400" size={16} />
                  <div>
                    <span className="text-sm text-gray-500">Chofer:</span>
                    <p className="font-medium">{entry.chofer}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-800 border-b pb-2">
                Datos del Documento
              </h3>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <FileText className="text-gray-400" size={16} />
                  <div>
                    <span className="text-sm text-gray-500">Factura:</span>
                    <p className="font-medium">{entry.factura}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Clock className="text-gray-400" size={16} />
                  <div>
                    <span className="text-sm text-gray-500">Hora de Descarga:</span>
                    <p className="font-medium">{entry.formattedTime}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Fuel Quantities */}
          <div className="bg-gray-50 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <Fuel className="text-gray-600" size={20} />
              Cantidades de Combustible
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {parseFloat(entry.cantidadFacturadaLts || '0').toFixed(2)}
                </div>
                <div className="text-sm text-gray-500">Litros Facturados</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {parseFloat(entry.cantidadRecepcionadaLts || '0').toFixed(2)}
                </div>
                <div className="text-sm text-gray-500">Litros Recepcionados</div>
              </div>
              <div className="text-center">
                <div className={`text-2xl font-bold ${
                  entry.quantityDifference > 0 
                    ? 'text-orange-600' 
                    : entry.quantityDifference < 0 
                    ? 'text-red-600' 
                    : 'text-green-600'
                }`}>
                  {entry.quantityDifference > 0 ? '+' : ''}{entry.quantityDifference.toFixed(2)}
                </div>
                <div className="text-sm text-gray-500">
                  Diferencia ({entry.quantityDifference > 0 ? 'Faltante' : entry.quantityDifference < 0 ? 'Sobrante' : 'Exacto'})
                </div>
              </div>
            </div>
          </div>

          {/* Digital Signature */}
          {entry.signature && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-800 border-b pb-2">
                Firma Digital
              </h3>
              <SignatureDisplay signature={entry.signature} className="shadow-sm" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ---------------------------
// Main TCOM01 Module
// ---------------------------
export default function TCOM01Module() {
  const { user } = useAuth();
  
  const [entries, setEntries] = useState<FuelEntryDisplay[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedEntry, setSelectedEntry] = useState<FuelEntryDisplay | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState<FilterOptions>({
    provider: '',
    showDifferencesOnly: false,
    sortOrder: 'desc'
  });

  // today's date range
  const todayRange = useMemo(() => {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfDay = new Date(startOfDay);
    endOfDay.setDate(endOfDay.getDate() + 1);

    return {
      start: Timestamp.fromDate(startOfDay),
      end: Timestamp.fromDate(endOfDay)
    };
  }, []);

  // transform
  const transformEntry = useCallback((id: string, data: ECOM01Document): FuelEntryDisplay => {
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
  }, []);

  // load entries
  useEffect(() => {
    if (!user?.uid) return;

    const q = query(
      collection(db, 'ECOM01'),
      where('status', '==', 'completed'),
      where('completedAt', '>=', todayRange.start),
      where('completedAt', '<', todayRange.end),
      orderBy('completedAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const entriesData = querySnapshot.docs.map(doc => 
        transformEntry(doc.id, doc.data() as ECOM01Document)
      );
      setEntries(entriesData);
      setLoading(false);
    }, (err) => {
      console.error('Error loading entries:', err);
      setError('Error al cargar las entradas de combustible');
      setLoading(false);
    });

    return unsubscribe;
  }, [user?.uid, todayRange.start, todayRange.end, transformEntry]);

  // unique providers
  const uniqueProviders = useMemo(() => {
    const providers = entries.map(entry => entry.proveedorExterno).filter(Boolean) as string[];
    return [...new Set(providers)].sort();
  }, [entries]);

  // filter
  const filteredEntries = useMemo(() => {
    let filtered = entries;

    if (searchTerm) {
      filtered = filtered.filter(entry =>
        entry.proveedorExterno?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        entry.nroChapa?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        entry.chofer?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        entry.factura?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (filters.provider) {
      filtered = filtered.filter(entry => entry.proveedorExterno === filters.provider);
    }

    if (filters.showDifferencesOnly) {
      filtered = filtered.filter(entry => Math.abs(entry.quantityDifference) > 0.01);
    }

    filtered.sort((a, b) => {
      const aValue = a.completedAt?.seconds || 0;
      const bValue = b.completedAt?.seconds || 0;
      return filters.sortOrder === 'asc' ? aValue - bValue : bValue - aValue;
    });

    return filtered;
  }, [entries, searchTerm, filters]);

  const handleRefresh = async () => {
    setLoading(true);
    try {
      const q = query(
        collection(db, 'ECOM01'),
        where('status', '==', 'completed'),
        where('completedAt', '>=', todayRange.start),
        where('completedAt', '<', todayRange.end),
        orderBy('completedAt', 'desc')
      );
      const querySnapshot = await getDocs(q);
      const entriesData = querySnapshot.docs.map(doc => 
        transformEntry(doc.id, doc.data() as ECOM01Document)
      );
      setEntries(entriesData);
    } catch (err) {
      setError('Error al actualizar las entradas');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="w-full p-6 bg-gray-50 min-h-full">
      <header className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-green-100 rounded-lg">
            <CheckCircle className="text-green-600" size={24} />
          </div>
          <h1 className="text-2xl font-semibold text-gray-900">
            TCOM01 – Entradas de Combustible Hoy
          </h1>
        </div>
        <p className="text-gray-600">
          Visualización de todas las entradas de combustible completadas el día de hoy
        </p>
      </header>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-800">
          <AlertCircle size={20} />
          <span>{error}</span>
          <button onClick={handleRefresh} className="ml-auto text-red-600 hover:text-red-800 underline">
            Reintentar
          </button>
        </div>
      )}

      <div className="bg-white border rounded-lg shadow-sm">
        {/* Controls */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex flex-col lg:flex-row gap-4 mb-6">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
              <input
                type="text"
                placeholder="Buscar por proveedor, chapa, chofer o factura..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            
            <div className="flex gap-3">
              <select
                value={filters.provider}
                onChange={(e) => setFilters(prev => ({ ...prev, provider: e.target.value }))}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Todos los proveedores</option>
                {uniqueProviders.map(provider => (
                  <option key={provider} value={provider}>{provider}</option>
                ))}
              </select>

              <label className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-md">
                <input
                  type="checkbox"
                  checked={filters.showDifferencesOnly}
                  onChange={(e) => setFilters(prev => ({ ...prev, showDifferencesOnly: e.target.checked }))}
                />
                <span className="text-sm">Solo diferencias</span>
              </label>

              <button
                onClick={handleRefresh}
                disabled={loading}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                <RefreshCw className={loading ? 'animate-spin' : ''} size={16} />
                {loading ? 'Cargando...' : 'Actualizar'}
              </button>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          {loading && entries.length === 0 ? (
            <div className="p-8 text-center">
              <div className="inline-flex items-center gap-2 text-gray-500">
                <RefreshCw className="animate-spin" size={20} />
                <span>Cargando entradas de hoy...</span>
              </div>
            </div>
          ) : filteredEntries.length === 0 ? (
            <div className="p-8 text-center">
              <div className="text-gray-500 mb-2">
                {searchTerm || filters.provider || filters.showDifferencesOnly 
                  ? 'No se encontraron entradas con los filtros aplicados'
                  : 'No hay entradas de combustible completadas hoy'
                }
              </div>
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left p-4 font-medium text-gray-900">Hora</th>
                  <th className="text-left p-4 font-medium text-gray-900">Proveedor</th>
                  <th className="text-left p-4 font-medium text-gray-900">Chapa</th>
                  <th className="text-left p-4 font-medium text-gray-900">Chofer</th>
                  <th className="text-left p-4 font-medium text-gray-900">Factura</th>
                  <th className="text-right p-4 font-medium text-gray-900">Facturado (L)</th>
                  <th className="text-right p-4 font-medium text-gray-900">Recepcionado (L)</th>
                  <th className="text-right p-4 font-medium text-gray-900">Diferencia</th>
                  <th className="text-center p-4 font-medium text-gray-900">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredEntries.map((entry) => (
                  <tr key={entry.id} className="hover:bg-gray-50">
                    <td className="p-4 text-sm text-gray-900">{entry.formattedTime || '-'}</td>
                    <td className="p-4 text-sm text-gray-900">{entry.proveedorExterno}</td>
                    <td className="p-4 text-sm font-medium text-gray-900">{entry.nroChapa}</td>
                    <td className="p-4 text-sm text-gray-900">{entry.chofer}</td>
                    <td className="p-4 text-sm text-gray-900">{entry.factura}</td>
                    <td className="p-4 text-sm text-right text-gray-900">
                      {parseFloat(entry.cantidadFacturadaLts || '0').toFixed(2)}
                    </td>
                    <td className="p-4 text-sm text-right text-gray-900">
                      {parseFloat(entry.cantidadRecepcionadaLts || '0').toFixed(2)}
                    </td>
                    <td className="p-4 text-sm text-right">
                      <span className={`font-medium ${
                        Math.abs(entry.quantityDifference) < 0.01
                          ? 'text-green-600'
                          : entry.quantityDifference > 0
                          ? 'text-orange-600'
                          : 'text-red-600'
                      }`}>
                        {entry.quantityDifference > 0 ? '+' : ''}{entry.quantityDifference.toFixed(2)}
                      </span>
                    </td>
                    <td className="p-4 text-center">
                      <button
                        onClick={() => setSelectedEntry(entry)}
                        className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 transition-colors text-sm"
                      >
                        <Eye size={14} />
                        Ver
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {selectedEntry && (
        <EntryDetailModal
          entry={selectedEntry}
          onClose={() => setSelectedEntry(null)}
        />
      )}
    </section>
  );
}