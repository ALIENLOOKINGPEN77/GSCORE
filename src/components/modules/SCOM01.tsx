"use client";

import React, { useCallback, useEffect, useMemo, useState, useRef } from "react";
import {
  Truck,
  User,
  FileText,
  Fuel,
  Clock,
  RefreshCw,
  AlertCircle,
  Eye,
  Download,
  FileStack,
  Building,
  ToggleLeft,
  ToggleRight,
  X,
  ChevronLeft,
  ChevronRight,
  Gauge
} from "lucide-react";
import { useAuth } from "../auth-context";
import {
  collection,
  query,
  orderBy,
  limit,
  startAfter,
  getDocs,
  doc,
  onSnapshot,
  DocumentSnapshot
} from "firebase/firestore";
import { db } from "../../lib/firebase/client";
import SCOM01DownloadModal from '../helpers/SCOM01/SCOM01-list';
import SCOM01Compuesto from '../helpers/SCOM01/SCOM01-compuesto';

// ---------------------------
// Types
// ---------------------------
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

type HistoricalDocument = {
  id: string;
  date: string;
  displayDate: string;
  totalCargas: number;
};

type SCOM01Document = {
  metadata?: {
    createdAt: any;
    userId: string;
    userEmail: string;
  };
  docData?: {
    Tinicial: string;
    Tfinal?: string;
  };
  CargasFlota?: Record<string, Omit<CargaFlota, 'id' | 'type'>>;
  CargasExternas?: Record<string, Omit<CargaExterna, 'id' | 'type'>>;
};

// ---------------------------
// SVG Signature Display Component
// ---------------------------
const SignatureDisplay = ({ svgString }: { svgString: string }) => {
  if (!svgString) return null;

  try {
    const parser = new DOMParser();
    const svgDoc = parser.parseFromString(svgString, "image/svg+xml");
    const svgElement = svgDoc.querySelector("svg");

    if (!svgElement) {
      console.error("Failed to parse SVG string");
      return (
        <div className="border rounded-lg p-4 bg-gray-50 max-w-md">
          <span className="text-gray-500 text-sm italic">Firma no disponible</span>
        </div>
      );
    }

    const originalWidth = svgElement.getAttribute("width") || "600";
    const originalHeight = svgElement.getAttribute("height") || "600";

    svgElement.removeAttribute("width");
    svgElement.removeAttribute("height");
    svgElement.removeAttribute("style");

    if (!svgElement.getAttribute("viewBox")) {
      svgElement.setAttribute("viewBox", `0 0 ${originalWidth} ${originalHeight}`);
    }

    svgElement.setAttribute("width", "100%");
    svgElement.setAttribute("height", "auto");
    svgElement.setAttribute("style", "max-width: 400px; max-height: 150px;");
    svgElement.setAttribute("preserveAspectRatio", "xMidYMid meet");

    const modifiedSvgString = svgElement.outerHTML;

    return (
      <div className="border rounded-lg p-4 bg-gray-50 flex items-center justify-center" style={{ minHeight: '150px' }}>
        <div
          dangerouslySetInnerHTML={{ __html: modifiedSvgString }}
          className="w-full flex items-center justify-center"
        />
      </div>
    );
  } catch (error) {
    console.error("Error processing signature SVG:", error);
    return (
      <div className="border rounded-lg p-4 bg-gray-50 max-w-md">
        <span className="text-gray-500 text-sm italic">Error al mostrar firma</span>
      </div>
    );
  }
};

// ---------------------------
// Entry Detail Modal Component
// ---------------------------
const EntryDetailModal = ({
  entry,
  onClose
}: {
  entry: CargaDisplay | null;
  onClose: () => void;
}) => {
  if (!entry) return null;

  const isFlota = entry.type === 'flota';

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">
            Detalle de {isFlota ? 'Vehículo Interno' : 'Vehículo Externo'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium ${isFlota
              ? 'bg-blue-100 text-blue-800'
              : 'bg-green-100 text-green-800'
              }`}>
              {isFlota ? <Building size={16} /> : <Truck size={16} />}
              {isFlota ? 'Vehículo Interno' : 'Vehículo Externo'}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {isFlota ? (
              <>
                <div className="flex items-center gap-3">
                  <Building className="text-gray-400" size={16} />
                  <div>
                    <span className="text-sm text-gray-500">Móvil:</span>
                    <p className="font-medium">{(entry as CargaFlota).NroMovil}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <User className="text-gray-400" size={16} />
                  <div>
                    <span className="text-sm text-gray-500">Chofer:</span>
                    <p className="font-medium">{(entry as CargaFlota).Chofer}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Fuel className="text-gray-400" size={16} />
                  <div>
                    <span className="text-sm text-gray-500">Litros:</span>
                    <p className="font-medium">{(entry as CargaFlota).Litros}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Clock className="text-gray-400" size={16} />
                  <div>
                    <span className="text-sm text-gray-500">Hora de Carga:</span>
                    <p className="font-medium">{(entry as CargaFlota).HoraCarga}</p>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-3">
                  <Truck className="text-gray-400" size={16} />
                  <div>
                    <span className="text-sm text-gray-500">Empresa:</span>
                    <p className="font-medium">{(entry as CargaExterna).Empresa}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <FileText className="text-gray-400" size={16} />
                  <div>
                    <span className="text-sm text-gray-500">Chapa:</span>
                    <p className="font-medium">{(entry as CargaExterna).NumeroChapa}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <User className="text-gray-400" size={16} />
                  <div>
                    <span className="text-sm text-gray-500">Chofer:</span>
                    <p className="font-medium">{(entry as CargaExterna).NombreChofer}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Fuel className="text-gray-400" size={16} />
                  <div>
                    <span className="text-sm text-gray-500">Litros Cargados:</span>
                    <p className="font-medium">{(entry as CargaExterna).LitrosCargados}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Clock className="text-gray-400" size={16} />
                  <div>
                    <span className="text-sm text-gray-500">Hora:</span>
                    <p className="font-medium">{(entry as CargaExterna).Hora}</p>
                  </div>
                </div>
              </>
            )}

            {entry.Kilometraje && (
              <div className="flex items-center gap-3">
                <FileText className="text-gray-400" size={16} />
                <div>
                  <span className="text-sm text-gray-500">Kilometraje:</span>
                  <p className="font-medium">{entry.Kilometraje}</p>
                </div>
              </div>
            )}
            {entry.Horometro && (
              <div className="flex items-center gap-3">
                <Clock className="text-gray-400" size={16} />
                <div>
                  <span className="text-sm text-gray-500">Horómetro:</span>
                  <p className="font-medium">{entry.Horometro}</p>
                </div>
              </div>
            )}
            {entry.Precinto && (
              <div className="flex items-center gap-3">
                <FileText className="text-gray-400" size={16} />
                <div>
                  <span className="text-sm text-gray-500">Precinto:</span>
                  <p className="font-medium">{entry.Precinto}</p>
                </div>
              </div>
            )}
          </div>

          {entry.HasFirma && entry.FirmaSvg && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-800 border-b pb-2 flex items-center gap-2">
                <User className="text-gray-600" size={20} />
                Firma Digital
              </h3>
              <SignatureDisplay svgString={entry.FirmaSvg} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ---------------------------
// Pagination Component
// ---------------------------
const Pagination = ({
  currentPage,
  totalPages,
  onPageChange
}: {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}) => {
  if (totalPages <= 1) return null;

  return (
    <div className="p-4 border-t border-gray-200 flex items-center justify-between bg-gray-50">
      <div className="text-sm text-gray-600">
        Página {currentPage} de {totalPages}
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="inline-flex items-center gap-1 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeft size={16} />
          Anterior
        </button>
        
        {/* Page numbers */}
        <div className="flex items-center gap-1">
          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
            let pageNum;
            if (totalPages <= 5) {
              pageNum = i + 1;
            } else if (currentPage <= 3) {
              pageNum = i + 1;
            } else if (currentPage >= totalPages - 2) {
              pageNum = totalPages - 4 + i;
            } else {
              pageNum = currentPage - 2 + i;
            }

            return (
              <button
                key={pageNum}
                onClick={() => onPageChange(pageNum)}
                className={`w-10 h-10 flex items-center justify-center rounded-md transition-colors ${
                  currentPage === pageNum
                    ? 'bg-blue-600 text-white font-semibold'
                    : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
              >
                {pageNum}
              </button>
            );
          })}
        </div>

        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="inline-flex items-center gap-1 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Siguiente
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
};

// ---------------------------
// Compose Modal Component
// ---------------------------
const ComposeModal = ({
  isOpen,
  onClose
}: {
  isOpen: boolean;
  onClose: () => void;
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-md w-full">
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
            <FileStack className="text-green-600" size={24} />
            Armar Documento Compuesto
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={20} />
          </button>
        </div>
        <div className="p-6">
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <p className="text-green-800 text-sm">
              <strong>Próximamente:</strong> Creación de documentos multi-período con filtros avanzados
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

// ---------------------------
// Main SCOM01 Module
// ---------------------------
export default function SCOM01Module() {
  const { user } = useAuth();

  // Daily mode states
  const [entries, setEntries] = useState<CargaDisplay[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Totalizador states
  const [Tinicial, setTinitial] = useState<string>('');
  const [Tfinal, setTfinal] = useState<string>('');

  // Historical mode states
  const [historicalDocs, setHistoricalDocs] = useState<HistoricalDocument[]>([]);
  const [historicalLoading, setHistoricalLoading] = useState(false);
  const [hasMoreHistorical, setHasMoreHistorical] = useState(true);
  
  // Use ref to avoid dependency issues
  const lastDocRef = useRef<DocumentSnapshot | null>(null);

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  // UI states
  const [selectedEntry, setSelectedEntry] = useState<CargaDisplay | null>(null);
  const [showHistorical, setShowHistorical] = useState(false);
  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const [showComposeModal, setShowComposeModal] = useState(false);

  // Get today's document ID
  const todayDocId = useMemo(() => {
    const today = new Date();
    const day = String(today.getDate()).padStart(2, '0');
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const year = today.getFullYear();
    return `${day}-${month}-${year}`;
  }, []);

  // Transform entry data from document
  const transformEntries = useCallback((docData: SCOM01Document): CargaDisplay[] => {
    const entries: CargaDisplay[] = [];

    if (docData.CargasFlota) {
      Object.entries(docData.CargasFlota).forEach(([id, data]) => {
        entries.push({
          ...data,
          id,
          type: 'flota'
        });
      });
    }

    if (docData.CargasExternas) {
      Object.entries(docData.CargasExternas).forEach(([id, data]) => {
        entries.push({
          ...data,
          id,
          type: 'externa'
        });
      });
    }

    return entries.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  }, []);

  // Real-time subscription to today's document
  useEffect(() => {
    if (!user?.uid || showHistorical) return;

    console.log('[SCOM01] Subscribing to today data:', todayDocId);
    setLoading(true);
    setError(null);

    const docRef = doc(db, 'SCOM01', todayDocId);
    const unsubscribe = onSnapshot(
      docRef,
      (docSnap) => {
        if (docSnap.exists()) {
          const docData = docSnap.data() as SCOM01Document;
          const transformedEntries = transformEntries(docData);
          setEntries(transformedEntries);

          // Extract Totalizador values
          if (docData.docData) {
            setTinitial(docData.docData.Tinicial || '');
            setTfinal(docData.docData.Tfinal || '');
          } else {
            setTinitial('');
            setTfinal('');
          }

          console.log('[SCOM01] Today data updated:', transformedEntries.length, 'entries');
          console.log('[SCOM01] Totalizadores:', { Tinicial: docData.docData?.Tinicial, Tfinal: docData.docData?.Tfinal });
        } else {
          console.log('[SCOM01] No data found for today');
          setEntries([]);
          setTinitial('');
          setTfinal('');
        }
        setLoading(false);
      },
      (err) => {
        console.error('[SCOM01] Error subscribing to today data:', err);
        setError('Error al cargar los datos de hoy');
        setLoading(false);
      }
    );

    return unsubscribe;
  }, [user?.uid, todayDocId, transformEntries, showHistorical]);

  // Reset page when switching views
  useEffect(() => {
    setCurrentPage(1);
  }, [showHistorical]);

  // Validate document ID format (dd-MM-yyyy)
  const isValidDocumentFormat = useCallback((docId: string): boolean => {
    const dateRegex = /^\d{2}-\d{2}-\d{4}$/;
    if (!dateRegex.test(docId)) return false;

    const [day, month, year] = docId.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return date.getDate() === day &&
      date.getMonth() === month - 1 &&
      date.getFullYear() === year;
  }, []);

  // Load historical documents - Fixed to use ref
  const loadHistoricalDocs = useCallback(async (isLoadMore = false) => {
    if (!user?.uid) return;

    setHistoricalLoading(true);
    if (!isLoadMore) {
      setHistoricalDocs([]);
      lastDocRef.current = null;
      setHasMoreHistorical(true);
    }

    try {
      let q = query(
        collection(db, 'SCOM01'),
        orderBy('__name__', 'desc'),
        limit(40)
      );

      if (isLoadMore && lastDocRef.current) {
        q = query(
          collection(db, 'SCOM01'),
          orderBy('__name__', 'desc'),
          startAfter(lastDocRef.current),
          limit(40)
        );
      }

      const querySnapshot = await getDocs(q);
      const docs: HistoricalDocument[] = [];
      let validDocsCount = 0;

      querySnapshot.forEach((docSnap) => {
        const docId = docSnap.id;

        if (!isValidDocumentFormat(docId)) {
          console.log('[SCOM01] Skipping invalid document format:', docId);
          return;
        }

        const docData = docSnap.data() as SCOM01Document;

        const flotaCount = docData.CargasFlota ? Object.keys(docData.CargasFlota).length : 0;
        const externasCount = docData.CargasExternas ? Object.keys(docData.CargasExternas).length : 0;
        const totalCargas = flotaCount + externasCount;

        const [day, month, year] = docId.split('-');
        const displayDate = `${day}/${month}/${year}`;

        docs.push({
          id: docId,
          date: docId,
          displayDate,
          totalCargas
        });

        validDocsCount++;
        if (validDocsCount >= 20) return;
      });

      if (isLoadMore) {
        setHistoricalDocs(prev => [...prev, ...docs]);
      } else {
        setHistoricalDocs(docs);
      }

      setHasMoreHistorical(docs.length === 20);
      lastDocRef.current = querySnapshot.docs[querySnapshot.docs.length - 1] || null;

      console.log('[SCOM01] Historical docs loaded:', docs.length, isLoadMore ? '(more)' : '(initial)', 'valid documents');
    } catch (err) {
      console.error('[SCOM01] Error loading historical docs:', err);
      setError('Error al cargar documentos históricos');
    } finally {
      setHistoricalLoading(false);
    }
  }, [user?.uid, isValidDocumentFormat]);

  // Load historical data when switching to historical mode - Fixed dependencies
  useEffect(() => {
    if (showHistorical && user?.uid) {
      loadHistoricalDocs(false);
    }
  }, [showHistorical, user?.uid]); // Removed loadHistoricalDocs from dependencies

  // Paginated entries for daily view
  const paginatedEntries = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    return entries.slice(startIndex, endIndex);
  }, [entries, currentPage]);

  // Paginated documents for historical view
  const paginatedHistoricalDocs = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    return historicalDocs.slice(startIndex, endIndex);
  }, [historicalDocs, currentPage]);

  // Calculate total pages
  const totalPages = useMemo(() => {
    if (showHistorical) {
      return Math.ceil(historicalDocs.length / ITEMS_PER_PAGE);
    }
    return Math.ceil(entries.length / ITEMS_PER_PAGE);
  }, [showHistorical, entries.length, historicalDocs.length]);

  // Handle page change
  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  // Calculate summary stats
  const summaryStats = useMemo(() => {
    const flotaEntries = entries.filter(e => e.type === 'flota');
    const externaEntries = entries.filter(e => e.type === 'externa');

    const totalFlotaLitros = flotaEntries.reduce((sum, entry) =>
      sum + parseFloat((entry as CargaFlota).Litros || '0'), 0);
    const totalExternaLitros = externaEntries.reduce((sum, entry) =>
      sum + parseFloat((entry as CargaExterna).LitrosCargados || '0'), 0);

    return {
      totalFlota: flotaEntries.length,
      totalExterna: externaEntries.length,
      totalFlotaLitros,
      totalExternaLitros,
      totalGeneral: totalFlotaLitros + totalExternaLitros
    };
  }, [entries]);

  return (
    <section className="w-full p-6 bg-gray-50 min-h-full">
      <header className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-orange-100 rounded-lg">
            <Fuel className="text-orange-600" size={24} />
          </div>
          <h1 className="text-2xl font-semibold text-gray-900">
            SCOM01 – Despacho de Combustible
          </h1>
        </div>
      </header>

      <div className="flex gap-6">
        {/* Side Buttons */}
        <div className="w-64 flex flex-col gap-4 shrink-0">
          <button
            onClick={() => setShowDownloadModal(true)}
            disabled={entries.length === 0}
            className="h-32 bg-blue-100 border-2 border-blue-300 rounded-lg hover:bg-blue-200 transition-all duration-200 flex flex-col items-center justify-center gap-3 group shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download size={32} className="text-blue-600 group-hover:scale-110 transition-transform" />
            <span className="text-blue-800 font-medium text-center text-sm px-2">
              Descargar Documento Diario
            </span>
          </button>

          <button
            onClick={() => setShowComposeModal(true)}
            className="h-32 bg-green-100 border-2 border-green-300 rounded-lg hover:bg-green-200 transition-all duration-200 flex flex-col items-center justify-center gap-3 group shadow-sm hover:shadow-md"
          >
            <FileStack size={32} className="text-green-600 group-hover:scale-110 transition-transform" />
            <span className="text-green-800 font-medium text-center text-sm px-2">
              Armar Documento Compuesto
            </span>
          </button>

          {/* Summary Stats - Only in daily mode */}
          {!showHistorical && (
            <div className="bg-white border-2 border-gray-200 rounded-lg p-4 shadow-sm">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Resumen de Hoy</h3>
              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Flota Interna:</span>
                  <span className="font-semibold text-blue-600">{summaryStats.totalFlota}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Flota Externa:</span>
                  <span className="font-semibold text-green-600">{summaryStats.totalExterna}</span>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-gray-200">
                  <span className="text-gray-600">Total Litros:</span>
                  <span className="font-bold text-orange-600">{summaryStats.totalGeneral.toFixed(2)}L</span>
                </div>
              </div>
            </div>
          )}

          {/* Totalizadores Display - Only in daily mode */}
          {!showHistorical && (Tinicial || Tfinal) && (
            <div className="bg-gradient-to-br from-purple-50 to-indigo-50 border-2 border-purple-200 rounded-lg p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <Gauge className="text-purple-600" size={18} />
                <h3 className="text-sm font-semibold text-purple-900">Totalizadores</h3>
              </div>
              <div className="space-y-2">
                <div className="bg-white/70 rounded px-3 py-2">
                  <div className="text-xs text-gray-600 mb-0.5">Inicial</div>
                  <div className="text-lg font-bold text-purple-700">
                    {Tinicial || '-'}
                  </div>
                </div>
                <div className="bg-white/70 rounded px-3 py-2">
                  <div className="text-xs text-gray-600 mb-0.5">Final</div>
                  <div className="text-lg font-bold text-indigo-700">
                    {Tfinal || '-'}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Main Content */}
        <div className="flex-1 bg-white border rounded-lg shadow-sm min-w-0">
          {/* Controls */}
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-600">
                {showHistorical ? (
                  <>Mostrando documentos históricos ({historicalDocs.length} total)</>
                ) : (
                  <>Mostrando registros de hoy ({entries.length} total)</>
                )}
              </div>

              <button
                onClick={() => setShowHistorical(!showHistorical)}
                className="flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-blue-600 transition-colors"
              >
                {showHistorical ? (
                  <ToggleRight className="text-blue-600" size={24} />
                ) : (
                  <ToggleLeft className="text-gray-400" size={24} />
                )}
                <span>{showHistorical ? 'Histórico' : 'Diario'}</span>
              </button>
            </div>
          </div>

          {/* Error Display */}
          {error && (
            <div className="p-4 bg-red-50 border-b border-red-200 flex items-center gap-2 text-red-800">
              <AlertCircle size={20} />
              <span>{error}</span>
              <button
                onClick={() => setError(null)}
                className="ml-auto text-red-600 hover:text-red-800"
              >
                <X size={16} />
              </button>
            </div>
          )}

          {/* Content Area */}
          <div className="overflow-x-auto">
            {showHistorical ? (
              // Historical View
              <>
                {historicalLoading && historicalDocs.length === 0 ? (
                  <div className="p-8 text-center">
                    <div className="inline-flex items-center gap-2 text-gray-500">
                      <RefreshCw className="animate-spin" size={20} />
                      <span>Cargando documentos históricos...</span>
                    </div>
                  </div>
                ) : paginatedHistoricalDocs.length === 0 ? (
                  <div className="p-8 text-center text-gray-500">
                    No se encontraron documentos históricos
                  </div>
                ) : (
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="text-left p-4 font-medium text-gray-900">Fecha</th>
                        <th className="text-right p-4 font-medium text-gray-900">Total Cargas</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {paginatedHistoricalDocs.map((doc) => (
                        <tr key={doc.id} className="hover:bg-gray-50 transition-colors">
                          <td className="p-4 text-sm font-medium text-gray-900">
                            {doc.displayDate}
                          </td>
                          <td className="p-4 text-sm text-right text-gray-900">
                            {doc.totalCargas}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </>
            ) : (
              // Daily View
              <>
                {loading && entries.length === 0 ? (
                  <div className="p-8 text-center">
                    <div className="inline-flex items-center gap-2 text-gray-500">
                      <RefreshCw className="animate-spin" size={20} />
                      <span>Cargando datos de hoy...</span>
                    </div>
                  </div>
                ) : paginatedEntries.length === 0 ? (
                  <div className="p-8 text-center text-gray-500">
                    No hay cargas registradas para hoy
                  </div>
                ) : (
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="text-left p-4 font-medium text-gray-900">Tipo</th>
                        <th className="text-left p-4 font-medium text-gray-900">Empresa/Móvil</th>
                        <th className="text-left p-4 font-medium text-gray-900">Chofer</th>
                        <th className="text-left p-4 font-medium text-gray-900">Chapa/ID</th>
                        <th className="text-right p-4 font-medium text-gray-900">Litros</th>
                        <th className="text-left p-4 font-medium text-gray-900">Hora</th>
                        <th className="text-center p-4 font-medium text-gray-900">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {paginatedEntries.map((entry) => (
                        <tr key={entry.id} className="hover:bg-gray-50 transition-colors">
                          <td className="p-4">
                            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${entry.type === 'flota'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-green-100 text-green-800'
                              }`}>
                              {entry.type === 'flota' ? <Building size={12} /> : <Truck size={12} />}
                              {entry.type === 'flota' ? 'Interno' : 'Externo'}
                            </span>
                          </td>
                          <td className="p-4 text-sm text-gray-900 font-medium">
                            {entry.type === 'flota'
                              ? (entry as CargaFlota).NroMovil
                              : (entry as CargaExterna).Empresa
                            }
                          </td>
                          <td className="p-4 text-sm text-gray-900">
                            {entry.type === 'flota'
                              ? (entry as CargaFlota).Chofer
                              : (entry as CargaExterna).NombreChofer
                            }
                          </td>
                          <td className="p-4 text-sm text-gray-900">
                            {entry.type === 'flota'
                              ? '-'
                              : (entry as CargaExterna).NumeroChapa
                            }
                          </td>
                          <td className="p-4 text-sm text-right text-gray-900 font-medium">
                            {entry.type === 'flota'
                              ? (entry as CargaFlota).Litros
                              : (entry as CargaExterna).LitrosCargados
                            }
                          </td>
                          <td className="p-4 text-sm text-gray-900">
                            {entry.type === 'flota'
                              ? (entry as CargaFlota).HoraCarga
                              : (entry as CargaExterna).Hora
                            }
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
              </>
            )}
          </div>

          {/* Pagination */}
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={handlePageChange}
          />
        </div>
      </div>

      {/* Modals */}
      {selectedEntry && (
        <EntryDetailModal
          entry={selectedEntry}
          onClose={() => setSelectedEntry(null)}
        />
      )}

      <SCOM01DownloadModal
        isOpen={showDownloadModal}
        onClose={() => setShowDownloadModal(false)}
        entries={entries}
        dateString={todayDocId}
        Tinicial={Tinicial}
        Tfinal={Tfinal}
      />

      <SCOM01Compuesto
        isOpen={showComposeModal}
        onClose={() => setShowComposeModal(false)}
      />
    </section>
  );
}