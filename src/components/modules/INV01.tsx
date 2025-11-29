"use client";

import React, { useCallback, useEffect, useState, useMemo, useRef } from "react";
import { Search, CheckSquare, Square, Package, Eye, FileText } from "lucide-react";
import { useAuth } from "../auth-context";
import { 
  collection, 
  query, 
  getDocs,
  doc,
  getDoc
} from "firebase/firestore";
import { db } from "../../lib/firebase/client";
import INV01Modal from "../helpers/INV01/INV01-materialDetailModal";
import INV01CalendarModal from "../helpers/INV01/INV01-calendarModal";

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

type SearchType = 'descripcion' | 'codigo' | 'proveedor';

type Material = {
  documentId: string;
  codigo: string;
  descripcion: string;
  proveedor: string;
  marca: string;
  zona: string;
  categoria: string;
  subcategoria: string;
  unidadDeMedida: string;
  stockMinimo: string;
};

type InventoryData = {
  [location: string]: {
    quantity: number;
    lastEntry: string | null;
    lastExit: string | null;
    lastModified: any;
  };
};

// ============================================================================
// TOOLTIP CELL COMPONENT
// ============================================================================

const TooltipCell = ({ text, maxWidth = 'max-w-xs' }: { text: string; maxWidth?: string }) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const [isOverflowing, setIsOverflowing] = useState(false);
  const cellRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (cellRef.current) {
      setIsOverflowing(cellRef.current.scrollWidth > cellRef.current.clientWidth);
    }
  }, [text]);

  return (
    <div className="relative">
      <div
        ref={cellRef}
        className={`text-sm text-gray-600 ${maxWidth} truncate cursor-default`}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        {text}
      </div>
      {showTooltip && isOverflowing && (
        <div className="absolute z-50 left-0 top-full mt-1 bg-gray-900 text-white text-xs rounded-md px-3 py-2 shadow-lg max-w-md whitespace-normal break-words">
          {text}
          <div className="absolute -top-1 left-4 w-2 h-2 bg-gray-900 transform rotate-45" />
        </div>
      )}
    </div>
  );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function INV01() {
  const { user } = useAuth();
  
  // State
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchType, setSearchType] = useState<SearchType>('descripcion');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMaterial, setSelectedMaterial] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [selectedMaterialData, setSelectedMaterialData] = useState<Material | null>(null);

  // Load materials on mount
  useEffect(() => {
    loadMaterials();
  }, []);

  const loadMaterials = async () => {
    try {
      setLoading(true);
      const materialsQuery = query(collection(db, 'CMAT01'));
      const snapshot = await getDocs(materialsQuery);
      
      const loadedMaterials: Material[] = [];
      snapshot.forEach((doc) => {
        if (doc.id === 'default') return;
        
        const data = doc.data();
        loadedMaterials.push({
          documentId: doc.id,
          codigo: data.codigo || '',
          descripcion: data.descripcion || '',
          proveedor: data.proveedor || '',
          marca: data.marca || '',
          zona: data.zona || '',
          categoria: data.categoria || '',
          subcategoria: data.subcategoria || '',
          unidadDeMedida: data.unidadDeMedida || '',
          stockMinimo: data.stockMinimo || '',
        });
      });

      loadedMaterials.sort((a, b) => a.codigo.localeCompare(b.codigo));
      setMaterials(loadedMaterials);
    } catch (error) {
      console.error('Error loading materials:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredMaterials = useMemo(() => {
    if (!searchTerm.trim()) {
      return materials;
    }

    const term = searchTerm.toLowerCase().trim();
    
    return materials.filter(material => {
      switch (searchType) {
        case 'descripcion':
          return material.descripcion.toLowerCase().includes(term);
        case 'codigo':
          return material.codigo.toLowerCase().includes(term);
        case 'proveedor':
          return material.proveedor.toLowerCase().includes(term);
        default:
          return false;
      }
    });
  }, [materials, searchTerm, searchType]);

  const toggleSelection = useCallback((documentId: string) => {
    setSelectedMaterial(prev => prev === documentId ? null : documentId);
  }, []);

  const handleOpenModal = useCallback(() => {
    if (selectedMaterial) {
      const material = materials.find(m => m.documentId === selectedMaterial);
      if (material) {
        setSelectedMaterialData(material);
        setModalOpen(true);
      }
    }
  }, [selectedMaterial, materials]);

  const handleCloseModal = useCallback(() => {
    setModalOpen(false);
    setSelectedMaterialData(null);
  }, []);

  const handleReporte = useCallback(() => {
    setReportModalOpen(true);
  }, []);

  const handleCloseReportModal = useCallback(() => {
    setReportModalOpen(false);
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <Package size={32} className="text-blue-600" />
            <h1 className="text-3xl font-bold text-gray-900">Inventario</h1>
          </div>
        </div>

        <div className="sticky top-0 z-10 bg-white border rounded-lg shadow-sm mb-6 p-6">
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => setSearchType('descripcion')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                searchType === 'descripcion'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Descripción
            </button>
            <button
              onClick={() => setSearchType('codigo')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                searchType === 'codigo'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Código Interno
            </button>
            <button
              onClick={() => setSearchType('proveedor')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                searchType === 'proveedor'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Proveedor
            </button>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={`Buscar por ${searchType === 'descripcion' ? 'descripción' : searchType === 'codigo' ? 'código interno' : 'proveedor'}...`}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <button
              onClick={handleReporte}
              className="bg-green-600 text-white px-6 py-2 rounded-md hover:bg-green-700 transition-all font-medium flex items-center gap-2"
            >
              <FileText size={18} />
              Reporte
            </button>

            <button
              onClick={handleOpenModal}
              disabled={!selectedMaterial}
              className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-medium flex items-center gap-2"
            >
              <Eye size={18} />
              Ver Detalles
            </button>
          </div>

          {searchTerm && (
            <div className="mt-3 text-sm text-gray-600">
              {filteredMaterials.length} material(es) encontrado(s)
            </div>
          )}

          {selectedMaterial && (
            <div className="mt-3 bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-sm text-blue-900">
                <strong>Material seleccionado:</strong> {materials.find(m => m.documentId === selectedMaterial)?.codigo} - {materials.find(m => m.documentId === selectedMaterial)?.descripcion}
              </p>
            </div>
          )}
        </div>

        <div className="bg-white border rounded-lg shadow-sm">
          {loading ? (
            <div className="p-12 text-center">
              <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className="text-gray-600">Cargando materiales...</p>
            </div>
          ) : filteredMaterials.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              <Package size={48} className="mx-auto mb-3 text-gray-400" />
              <p className="text-lg font-medium">No se encontraron materiales</p>
              <p className="text-sm mt-1">
                {searchTerm ? 'Intenta con otros términos de búsqueda' : 'No hay materiales registrados'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left w-12"></th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Código Interno
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Descripción
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Proveedor
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Marca
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredMaterials.map((material) => (
                    <tr
                      key={material.documentId}
                      className={`hover:bg-gray-50 transition-colors ${
                        selectedMaterial === material.documentId ? 'bg-blue-50' : ''
                      }`}
                    >
                      <td className="px-4 py-3">
                        <button
                          onClick={() => toggleSelection(material.documentId)}
                          className="hover:bg-gray-200 rounded p-1 transition-colors"
                        >
                          {selectedMaterial === material.documentId ? (
                            <CheckSquare size={20} className="text-blue-600" />
                          ) : (
                            <Square size={20} className="text-gray-400" />
                          )}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-sm font-mono font-medium text-gray-900">
                        {material.codigo}
                      </td>
                      <td className="px-4 py-3">
                        <TooltipCell text={material.descripcion} maxWidth="max-w-md" />
                      </td>
                      <td className="px-4 py-3">
                        <TooltipCell text={material.proveedor} maxWidth="max-w-xs" />
                      </td>
                      <td className="px-4 py-3">
                        <TooltipCell text={material.marca} maxWidth="max-w-xs" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {modalOpen && selectedMaterialData && (
        <INV01Modal
          material={selectedMaterialData}
          onClose={handleCloseModal}
        />
      )}

      {reportModalOpen && (
        <INV01CalendarModal
          onClose={handleCloseReportModal}
        />
      )}
    </div>
  );
}