// searcher.tsx
"use client";

import React, { useEffect, useState, useRef } from "react";
import { Search, X, Package, ChevronDown } from "lucide-react";
import { collection, getDocs, query, limit } from "firebase/firestore";
import { db } from "../lib/firebase/client";

export type Material = {
  id: string;
  codigo: string;
  descripcion: string;
  marca?: string;
  proveedor?: string;
};

type SearcherProps = {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (material: Material) => void;
};

type SearchField = 'codigo' | 'descripcion';

export default function Searcher({ 
  isOpen,
  onClose,
  onSelect
}: SearcherProps) {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [filteredMaterials, setFilteredMaterials] = useState<Material[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchField, setSearchField] = useState<SearchField>('descripcion');
  const [loading, setLoading] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Load materials once when component opens
  useEffect(() => {
    if (isOpen && materials.length === 0) {
      loadMaterials();
    }
    if (isOpen) {
      setSearchTerm('');
      setFilteredMaterials([]);
    }
  }, [isOpen]);

  // Debounced search
  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      filterMaterials();
    }, 300);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [searchTerm, searchField, materials]);

  const loadMaterials = async () => {
    try {
      setLoading(true);
      const cmat01Ref = collection(db, 'CMAT01');
      const q = query(cmat01Ref, limit(1000)); // Limit to reasonable amount
      const snapshot = await getDocs(q);
      const loadedMaterials: Material[] = [];
      
      snapshot.forEach((doc) => {
        if (doc.id === 'default') return;
        
        const data = doc.data();
        const materialId = data.documentId || doc.id;
        
        loadedMaterials.push({
          id: materialId,
          codigo: data.codigo || materialId,
          descripcion: data.descripcion || 'Sin descripción',
          marca: data.marca,
          proveedor: data.proveedor
        });
      });
      
      loadedMaterials.sort((a, b) => a.codigo.localeCompare(b.codigo));
      setMaterials(loadedMaterials);
    } catch (error) {
      console.error('[Searcher] Error loading materials:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterMaterials = () => {
    if (searchTerm.trim() === '') {
      setFilteredMaterials([]);
      return;
    }

    const term = searchTerm.toLowerCase();
    const filtered = materials.filter(material => {
      const fieldValue = material[searchField].toLowerCase();
      return fieldValue.includes(term);
    });
    
    setFilteredMaterials(filtered.slice(0, 50)); // Show max 50 results
  };

  const handleSelect = (material: Material) => {
    onSelect(material);
    onClose();
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
      setDropdownOpen(false);
    }
  };

  const handleFieldChange = (field: SearchField) => {
    setSearchField(field);
    setDropdownOpen(false);
  };

  if (!isOpen) return null;

  const searchFieldLabels: Record<SearchField, string> = {
    codigo: 'Código',
    descripcion: 'Descripción'
  };

  return (
    <div 
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-start justify-center pt-20 px-4 z-50"
      onClick={handleBackdropClick}
    >
      <div className="bg-white rounded-lg w-full max-w-2xl shadow-2xl flex flex-col max-h-[70vh]">
        <div className="p-4 border-b">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-gray-900">Buscar Material</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 p-1 rounded hover:bg-gray-100"
            >
              <X size={20} />
            </button>
          </div>
          
          <div className="flex gap-2">
            {/* Search Field Dropdown */}
            <div className="relative">
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 whitespace-nowrap"
              >
                {searchFieldLabels[searchField]}
                <ChevronDown size={16} />
              </button>
              
              {dropdownOpen && (
                <div className="absolute top-full mt-1 left-0 bg-white border border-gray-300 rounded-md shadow-lg z-10 min-w-[140px]">
                  <button
                    onClick={() => handleFieldChange('codigo')}
                    className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 ${
                      searchField === 'codigo' ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'
                    }`}
                  >
                    Código
                  </button>
                  <button
                    onClick={() => handleFieldChange('descripcion')}
                    className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 ${
                      searchField === 'descripcion' ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'
                    }`}
                  >
                    Descripción
                  </button>
                </div>
              )}
            </div>

            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={`Buscar por ${searchFieldLabels[searchField].toLowerCase()}...`}
                className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                autoFocus
              />
            </div>
          </div>
        </div>

        <div className="overflow-y-auto flex-1 p-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-3" />
              <p className="text-sm text-gray-600">Cargando materiales...</p>
            </div>
          ) : searchTerm.trim() === '' ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-500">
              <Search size={40} className="mb-3 text-gray-300" />
              <p className="text-sm">Comienza a escribir para buscar materiales</p>
            </div>
          ) : filteredMaterials.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-500">
              <Package size={40} className="mb-3 text-gray-300" />
              <p className="text-sm">No se encontraron materiales</p>
            </div>
          ) : (
            <div className="space-y-1">
              {filteredMaterials.map((material) => (
                <button
                  key={material.id}
                  onClick={() => handleSelect(material)}
                  className="w-full text-left p-3 rounded-md border border-transparent hover:border-blue-300 hover:bg-blue-50 transition-all"
                >
                  <div className="font-medium text-gray-900 text-sm">
                    {material.codigo} - {material.descripcion}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    ID: {material.id}
                    {material.marca && ` | Marca: ${material.marca}`}
                    {material.proveedor && ` | Proveedor: ${material.proveedor}`}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}