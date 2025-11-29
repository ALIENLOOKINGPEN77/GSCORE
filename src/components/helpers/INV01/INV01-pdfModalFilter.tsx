"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  RefreshCw,
  AlertCircle,
  FileDown,
  Filter,
  Plus,
  Trash2,
  ArrowLeft,
  Package
} from "lucide-react";
import { Timestamp } from "firebase/firestore";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../../../lib/firebase/client";
import { generateINV01FiltradoPdf } from "../../../lib/utils/pdfDocumentGenerator-INV01-filtrado";
import { generateINV01FiltradoCentrosPdf } from "../../../lib/utils/pdfDocumentGenerator-INV01-filtrado-centros";
import { generateINV01GeneralFiltradoPdf } from "../../../lib/utils/pdfDocumentGenerator-INV01-general-filtrado";
import Searcher, { Material as SearcherMaterial } from "../../searcher";

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

type InventoryLocation = {
  quantity: number;
  lastEntry: string | null;
  lastExit: string | null;
  lastModified: any;
};

type MaterialWithInventory = Material & {
  inventory: Record<string, InventoryLocation>;
};

interface INV01PdfModalFilterProps {
  movements: Movement[];
  materials: Material[];
  rangeStart: string;
  rangeEnd: string;
  onClose: () => void;
  onBack: () => void;
}

type FilterMode = 'include' | 'exclude';
type PdfStyle = 'general' | 'centros';

const isTallerOrParticular = (orderType: string | null | undefined): boolean => {
  return orderType === 'Taller' || orderType === 'Particular';
};

export default function INV01PdfModalFilter({ 
  movements, 
  materials,
  rangeStart, 
  rangeEnd, 
  onClose, 
  onBack 
}: INV01PdfModalFilterProps) {
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  
  const [includeEntradas, setIncludeEntradas] = useState(true);
  const [includeSalidas, setIncludeSalidas] = useState(true);
  const [includeActual, setIncludeActual] = useState(false);
  
  const [soloTaller, setSoloTaller] = useState(false);
  const [pdfStyle, setPdfStyle] = useState<PdfStyle>('general');
  
  const [filterMode, setFilterMode] = useState<FilterMode>('include');
  const [selectedMaterials, setSelectedMaterials] = useState<SearcherMaterial[]>([]);
  const [searcherOpen, setSearcherOpen] = useState(false);

  useEffect(() => {
    if (includeActual) {
      setIncludeEntradas(false);
      setIncludeSalidas(false);
    }
  }, [includeActual]);

  useEffect(() => {
    if (includeEntradas || includeSalidas) {
      setIncludeActual(false);
    }
  }, [includeEntradas, includeSalidas]);

  const filteredCount = React.useMemo(() => {
    if (includeActual) {
      if (selectedMaterials.length === 0) {
        return materials.length;
      }
      const materialCodes = selectedMaterials.map(m => m.codigo);
      if (filterMode === 'include') {
        return materials.filter(m => materialCodes.includes(m.codigo)).length;
      } else {
        return materials.filter(m => !materialCodes.includes(m.codigo)).length;
      }
    }
    
    let filtered = movements;

    if (!includeEntradas && !includeSalidas) return 0;
    if (!includeEntradas) filtered = filtered.filter(m => m.qty < 0);
    if (!includeSalidas) filtered = filtered.filter(m => m.qty > 0);
    if (soloTaller) filtered = filtered.filter(m => isTallerOrParticular(m.orderType));

    if (selectedMaterials.length > 0) {
      const materialCodes = selectedMaterials.map(m => m.codigo);
      if (filterMode === 'include') {
        filtered = filtered.filter(m => m.materialCode && materialCodes.includes(m.materialCode));
      } else {
        filtered = filtered.filter(m => m.materialCode && !materialCodes.includes(m.materialCode));
      }
    }

    return filtered.length;
  }, [movements, materials, includeEntradas, includeSalidas, includeActual, soloTaller, selectedMaterials, filterMode]);

  const fetchCurrentInventory = async (): Promise<MaterialWithInventory[]> => {
    const BATCH_SIZE = 15;
    const materialsWithInventory: MaterialWithInventory[] = [];
    
    let materialsToProcess = materials;
    if (selectedMaterials.length > 0) {
      const materialCodes = selectedMaterials.map(m => m.codigo);
      if (filterMode === 'include') {
        materialsToProcess = materials.filter(m => materialCodes.includes(m.codigo));
      } else {
        materialsToProcess = materials.filter(m => !materialCodes.includes(m.codigo));
      }
    }

    const totalMaterials = materialsToProcess.length;

    const processMaterial = async (material: Material): Promise<MaterialWithInventory | null> => {
      try {
        const invDocRef = doc(db, 'INV01', material.documentId);
        const invDocSnap = await getDoc(invDocRef);

        if (invDocSnap.exists()) {
          const invData = invDocSnap.data();
          const inventory: Record<string, InventoryLocation> = {};

          Object.keys(invData).forEach(key => {
            if (key !== 'default' && typeof invData[key] === 'object' && invData[key].quantity !== undefined) {
              inventory[key] = {
                quantity: invData[key].quantity || 0,
                lastEntry: invData[key].lastEntry || null,
                lastExit: invData[key].lastExit || null,
                lastModified: invData[key].lastModified || null,
              };
            }
          });

          return { ...material, inventory };
        }

        return null;
      } catch (error) {
        console.error(`Error loading inventory for material ${material.codigo}:`, error);
        return null;
      }
    };

    for (let i = 0; i < materialsToProcess.length; i += BATCH_SIZE) {
      const batch = materialsToProcess.slice(i, Math.min(i + BATCH_SIZE, materialsToProcess.length));
      
      const batchResults = await Promise.all(batch.map(material => processMaterial(material)));

      batchResults.forEach(result => {
        if (result !== null) {
          materialsWithInventory.push(result);
        }
      });

      const processedCount = Math.min(i + BATCH_SIZE, totalMaterials);
      setProgress(Math.round((processedCount / totalMaterials) * 100));
    }

    return materialsWithInventory;
  };

  const handleGenerateFilteredPdf = async () => {
    if (!includeEntradas && !includeSalidas && !includeActual) {
      setError('Debe seleccionar al menos un tipo de reporte');
      return;
    }

    if (filteredCount === 0) {
      setError('No hay datos que cumplan los criterios de filtrado');
      return;
    }

    try {
      setIsGeneratingPdf(true);
      setError(null);
      setProgress(0);

      if (includeActual) {
        const materialsWithInventory = await fetchCurrentInventory();
        
        const today = new Date();
        const reportDate = `${String(today.getDate()).padStart(2, '0')}-${String(today.getMonth() + 1).padStart(2, '0')}-${today.getFullYear()}`;

        await generateINV01GeneralFiltradoPdf(
          materialsWithInventory, 
          reportDate,
          selectedMaterials.length > 0 ? selectedMaterials.map(m => m.codigo) : null,
          filterMode
        );
      } else {
        const materialCodes = selectedMaterials.length > 0 
          ? selectedMaterials.map(m => m.codigo) 
          : null;
        
        if (pdfStyle === 'general') {
          await generateINV01FiltradoPdf(
            movements, rangeStart, rangeEnd,
            includeEntradas, includeSalidas, soloTaller,
            materialCodes, filterMode
          );
        } else {
          await generateINV01FiltradoCentrosPdf(
            movements, rangeStart, rangeEnd,
            includeEntradas, includeSalidas, soloTaller,
            materialCodes, filterMode
          );
        }
      }
      
    } catch (error) {
      console.error('Error generating PDF:', error);
      setError('Error al generar el PDF. Por favor intenta de nuevo.');
    } finally {
      setIsGeneratingPdf(false);
      setProgress(0);
    }
  };

  const handleMaterialSelect = (material: SearcherMaterial) => {
    if (!selectedMaterials.find(m => m.id === material.id)) {
      setSelectedMaterials([...selectedMaterials, material]);
    }
  };

  const handleRemoveMaterial = (materialId: string) => {
    setSelectedMaterials(selectedMaterials.filter(m => m.id !== materialId));
  };

  const handleActualToggle = (checked: boolean) => {
    if (checked) {
      setIncludeActual(true);
      setIncludeEntradas(false);
      setIncludeSalidas(false);
    } else {
      setIncludeActual(false);
    }
  };

  const handleEntradasToggle = (checked: boolean) => {
    setIncludeEntradas(checked);
    if (checked) setIncludeActual(false);
  };

  const handleSalidasToggle = (checked: boolean) => {
    setIncludeSalidas(checked);
    if (checked) setIncludeActual(false);
  };

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onBack();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onBack]);

  return (
    <>
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
          <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-purple-50 to-white">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-full bg-purple-100">
                  <Filter size={28} className="text-purple-600" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">Reporte Filtrado</h2>
                  <p className="text-sm text-gray-600 mt-1">Configura los filtros personalizados</p>
                </div>
              </div>
              <button
                onClick={onBack}
                className="text-gray-400 hover:text-gray-600 transition-colors p-2 hover:bg-gray-100 rounded-full"
              >
                <X size={24} />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-6">
            <div className="bg-purple-50 border-2 border-purple-200 rounded-lg p-4 mb-4">
              <h3 className="text-sm font-semibold text-purple-900 mb-3 flex items-center gap-2">
                <Filter size={16} />
                Opciones de Filtrado
              </h3>
              
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-medium text-purple-800 mb-2 block">
                    Tipo de Movimiento:
                  </label>
                  <div className="flex gap-4 flex-wrap">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={includeEntradas}
                        onChange={(e) => handleEntradasToggle(e.target.checked)}
                        disabled={includeActual}
                        className="w-4 h-4 text-purple-600 rounded focus:ring-2 focus:ring-purple-500 disabled:opacity-50"
                      />
                      <span className={`text-sm ${includeActual ? 'text-gray-400' : 'text-gray-700'}`}>Entradas</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={includeSalidas}
                        onChange={(e) => handleSalidasToggle(e.target.checked)}
                        disabled={includeActual}
                        className="w-4 h-4 text-purple-600 rounded focus:ring-2 focus:ring-purple-500 disabled:opacity-50"
                      />
                      <span className={`text-sm ${includeActual ? 'text-gray-400' : 'text-gray-700'}`}>Salidas</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={includeActual}
                        onChange={(e) => handleActualToggle(e.target.checked)}
                        className="w-4 h-4 text-green-600 rounded focus:ring-2 focus:ring-green-500"
                      />
                      <span className="text-sm text-gray-700 flex items-center gap-1">
                        <Package size={14} className="text-green-600" />
                        Actual
                      </span>
                    </label>
                  </div>
                  {includeActual && (
                    <p className="text-xs text-green-600 mt-2">
                      Genera reporte del inventario actual (stock por ubicación)
                    </p>
                  )}
                </div>

                {!includeActual && (
                  <div className="border-t border-purple-200 pt-3">
                    <label className="text-xs font-medium text-purple-800 mb-2 block">
                      Filtro Adicional:
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={soloTaller}
                        onChange={(e) => setSoloTaller(e.target.checked)}
                        className="w-4 h-4 text-purple-600 rounded focus:ring-2 focus:ring-purple-500"
                      />
                      <span className="text-sm text-gray-700">Solo Taller / Particular</span>
                    </label>
                    <p className="text-xs text-purple-600 mt-1 ml-6">
                      Incluye salidas de órdenes de taller y salidas particulares con equipo asignado
                    </p>
                  </div>
                )}

                {!includeActual && (
                  <div className="border-t border-purple-200 pt-3">
                    <label className="text-xs font-medium text-purple-800 mb-2 block">
                      Estilo de Reporte:
                    </label>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          checked={pdfStyle === 'general'}
                          onChange={() => setPdfStyle('general')}
                          className="w-4 h-4 text-purple-600 focus:ring-2 focus:ring-purple-500"
                        />
                        <span className="text-sm text-gray-700">General</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          checked={pdfStyle === 'centros'}
                          onChange={() => setPdfStyle('centros')}
                          className="w-4 h-4 text-purple-600 focus:ring-2 focus:ring-purple-500"
                        />
                        <span className="text-sm text-gray-700">Por Centro de Costos</span>
                      </label>
                    </div>
                  </div>
                )}

                <div className="border-t border-purple-200 pt-3">
                  <label className="text-xs font-medium text-purple-800 mb-2 block">
                    Filtro de Materiales:
                  </label>
                  <div className="flex gap-4 mb-3">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        checked={filterMode === 'include'}
                        onChange={() => setFilterMode('include')}
                        className="w-4 h-4 text-purple-600 focus:ring-2 focus:ring-purple-500"
                      />
                      <span className="text-sm text-gray-700">Incluir</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        checked={filterMode === 'exclude'}
                        onChange={() => setFilterMode('exclude')}
                        className="w-4 h-4 text-purple-600 focus:ring-2 focus:ring-purple-500"
                      />
                      <span className="text-sm text-gray-700">Excluir</span>
                    </label>
                  </div>

                  <button
                    onClick={() => setSearcherOpen(true)}
                    className="w-full px-3 py-2 bg-purple-600 text-white text-sm rounded-md hover:bg-purple-700 transition-colors flex items-center justify-center gap-2"
                  >
                    <Plus size={16} />
                    Agregar Material
                  </button>

                  {selectedMaterials.length > 0 && (
                    <div className="mt-3 space-y-2 max-h-40 overflow-y-auto">
                      {selectedMaterials.map(material => (
                        <div
                          key={material.id}
                          className="flex items-center justify-between bg-white rounded px-2 py-1.5 text-xs"
                        >
                          <span className="text-gray-700 truncate flex-1">
                            {material.codigo} - {material.descripcion}
                          </span>
                          <button
                            onClick={() => handleRemoveMaterial(material.id)}
                            className="ml-2 text-red-600 hover:text-red-800"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="pt-2 border-t border-purple-200 bg-white rounded-lg p-3">
                  <div className="text-xs text-purple-700">
                    Materiales seleccionados: <span className="font-semibold">{selectedMaterials.length}</span>
                  </div>
                  <div className="text-xs text-purple-700 mt-1">
                    {includeActual 
                      ? `Materiales a incluir: ${filteredCount}`
                      : `Movimientos filtrados: ${filteredCount}`
                    }
                  </div>
                </div>
              </div>
            </div>

            {isGeneratingPdf && progress > 0 && (
              <div className="mb-4 bg-purple-50 border border-purple-200 rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-purple-900">Cargando datos...</span>
                  <span className="text-xs font-semibold text-purple-900">{progress}%</span>
                </div>
                <div className="w-full bg-purple-200 rounded-full h-2">
                  <div
                    className="bg-purple-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            )}

            <button
              onClick={handleGenerateFilteredPdf}
              disabled={isGeneratingPdf || filteredCount === 0}
              className={`w-full h-20 ${includeActual ? 'bg-green-600 border-green-700 hover:bg-green-700' : 'bg-purple-600 border-purple-700 hover:bg-purple-700'} text-white border-2 rounded-lg transition-all duration-200 flex items-center justify-center gap-4 group disabled:opacity-50 disabled:cursor-not-allowed mb-3`}
            >
              {isGeneratingPdf ? (
                <RefreshCw size={28} className="animate-spin" />
              ) : includeActual ? (
                <Package size={28} className="group-hover:scale-110 transition-transform" />
              ) : (
                <FileDown size={28} className="group-hover:scale-110 transition-transform" />
              )}
              <div className="text-left">
                <div className="font-semibold text-lg">
                  {isGeneratingPdf ? 'Generando PDF...' : includeActual ? 'Descargar Inventario Actual' : 'Descargar PDF Filtrado'}
                </div>
                <div className={`${includeActual ? 'text-green-100' : 'text-purple-100'} text-sm`}>
                  {includeActual 
                    ? 'Stock actual por ubicación'
                    : pdfStyle === 'general' ? 'Lista de movimientos' : 'Agrupado por equipo'
                  }
                </div>
              </div>
            </button>

            <button
              onClick={onBack}
              className="w-full px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium flex items-center justify-center gap-2"
            >
              <ArrowLeft size={18} />
              Volver
            </button>

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

      <Searcher
        isOpen={searcherOpen}
        onClose={() => setSearcherOpen(false)}
        onSelect={handleMaterialSelect}
      />
    </>
  );
}