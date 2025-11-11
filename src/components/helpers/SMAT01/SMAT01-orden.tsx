"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { 
  FileText, 
  Package, 
  MapPin, 
  Save, 
  AlertCircle, 
  CheckCircle, 
  Trash2,
  Plus
} from "lucide-react";
import { useAuth } from "../../auth-context";
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  doc, 
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp
} from "firebase/firestore";
import { db } from "../../../lib/firebase/client";

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

type WorkOrder = {
  id: string;
  tipo?: string;
  equipo?: string;
  equipment?: string;
  descripcion?: string;
  description?: string;
  unidadMovil?: string;
  mobileUnit?: string;
  fechaDeEmision: string;
  componentsUsed?: Record<string, number>;
};

type MaterialDetail = {
  isoCode: string;
  codigo: string;
  descripcion: string;
  quantity: number;
};

type StorageAssignment = {
  id: string;
  storageLocation: string;
  materials: Record<string, number>;
};

type ValidationResult = {
  isValid: boolean;
  errors: Record<string, string>;
};

type ToastMessage = {
  type: 'success' | 'error';
  message: string;
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

const formatDate = (date: Date): string => {
  return date.toISOString().split('T')[0];
};

const getTodayDate = (): string => {
  return formatDate(new Date());
};

// ============================================================================
// FORM FIELD COMPONENTS
// ============================================================================

const DropdownField = ({
  label,
  value,
  onChange,
  options,
  error,
  disabled = false,
  placeholder = 'Seleccione una opción',
  required = true
}: {
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  options: Array<{ value: string; label: string }>;
  error?: string;
  disabled?: boolean;
  placeholder?: string;
  required?: boolean;
}) => {
  return (
    <div className="flex flex-col">
      <label className="text-sm font-medium text-gray-700 mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <select
        value={value}
        onChange={onChange}
        disabled={disabled}
        className={`px-3 py-2 border rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 ${
          error ? 'border-red-300 bg-red-50' : 'border-gray-300'
        } ${disabled ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'}`}
      >
        <option value="">{placeholder}</option>
        {options.map(option => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error && (
        <div className="mt-1 flex items-center gap-1 text-red-600 text-xs">
          <AlertCircle size={12} />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
};

const FormField = ({
  label,
  value,
  onChange,
  error,
  type = 'text',
  disabled = false,
  placeholder = '',
  required = true
}: {
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  error?: string;
  type?: string;
  disabled?: boolean;
  placeholder?: string;
  required?: boolean;
}) => {
  return (
    <div className="flex flex-col">
      <label className="text-sm font-medium text-gray-700 mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={onChange}
        disabled={disabled}
        placeholder={placeholder}
        className={`px-3 py-2 border rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 ${
          error ? 'border-red-300 bg-red-50' : 'border-gray-300'
        } ${disabled ? 'bg-gray-100 cursor-not-allowed' : ''}`}
      />
      {error && (
        <div className="mt-1 flex items-center gap-1 text-red-600 text-xs">
          <AlertCircle size={12} />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// TOAST COMPONENT
// ============================================================================

const Toast = ({ 
  message, 
  type, 
  onClose 
}: { 
  message: string; 
  type: 'success' | 'error'; 
  onClose: () => void;
}) => (
  <div className="fixed top-4 right-4 z-50 animate-slide-in">
    <div className={`rounded-lg shadow-lg p-4 flex items-center gap-3 ${
      type === 'success' ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
    }`}>
      {type === 'success' ? (
        <CheckCircle className="text-green-600" size={20} />
      ) : (
        <AlertCircle className="text-red-600" size={20} />
      )}
      <span className={`font-medium ${
        type === 'success' ? 'text-green-800' : 'text-red-800'
      }`}>
        {message}
      </span>
      <button 
        onClick={onClose}
        className="ml-2 hover:bg-gray-200 rounded p-1 transition-colors"
      >
        <AlertCircle size={16} />
      </button>
    </div>
  </div>
);

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function SMAT01Orden() {
  const { user } = useAuth();

  // State
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [selectedWorkOrder, setSelectedWorkOrder] = useState<string>('');
  const [materialDetails, setMaterialDetails] = useState<MaterialDetail[]>([]);
  const [storageLocations, setStorageLocations] = useState<string[]>([]);
  const [storageAssignments, setStorageAssignments] = useState<StorageAssignment[]>([]);
  const [entryDate, setEntryDate] = useState<string>(getTodayDate());
  
  const [loading, setLoading] = useState(true);
  const [loadingMaterials, setLoadingMaterials] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Load work orders and storage locations on mount
  useEffect(() => {
    loadWorkOrders();
    loadStorageLocations();
  }, []);

  // Load available work orders
  const loadWorkOrders = async () => {
    try {
      setLoading(true);
      const cord01Ref = collection(db, 'CORD01');
      const workOrderQuery = query(
        cord01Ref,
        where('stateAudit', '==', true),
        where('stateUsed', '==', false)
      );
      
      const snapshot = await getDocs(workOrderQuery);
      const orders: WorkOrder[] = [];
      
      snapshot.forEach((doc) => {
        if (doc.id === 'default') return;
        
        const data = doc.data();
        orders.push({
          id: doc.id,
          tipo: data.tipo,
          equipo: data.equipo,
          equipment: data.equipment,
          descripcion: data.descripcion,
          description: data.description,
          unidadMovil: data.unidadMovil,
          mobileUnit: data.mobileUnit,
          fechaDeEmision: data.fechaDeEmision || '',
          componentsUsed: data.componentsUsed || {}
        });
      });
        // Filter out orders without materials
        const ordersWithMaterials = orders.filter(order => {
        return order.componentsUsed && 
                Object.keys(order.componentsUsed).length > 0;
        });

        setWorkOrders(ordersWithMaterials);
    } catch (error) {
      console.error('[SMAT01-orden] Error loading work orders:', error);
      showToast('error', 'Error al cargar órdenes de trabajo');
    } finally {
      setLoading(false);
    }
  };

  // Load storage locations from defaults
  const loadStorageLocations = async () => {
    try {
      const defaultsRef = doc(db, 'defaults', 'storage_defaults');
      const defaultsSnap = await getDoc(defaultsRef);
      
      if (defaultsSnap.exists()) {
        const data = defaultsSnap.data();
        setStorageLocations(data.storage_locations || []);
      } else {
        console.error('[SMAT01-orden] Storage defaults not found');
        showToast('error', 'No se pudieron cargar las ubicaciones de almacenamiento');
      }
    } catch (error) {
      console.error('[SMAT01-orden] Error loading storage locations:', error);
      showToast('error', 'Error al cargar ubicaciones de almacenamiento');
    }
  };

  // Load material details when work order is selected
  const loadMaterialDetails = async (componentsUsed: Record<string, number>) => {
    try {
      setLoadingMaterials(true);
      const details: MaterialDetail[] = [];
      
      for (const [isoCode, quantity] of Object.entries(componentsUsed)) {
        // Search CMAT01 for document with matching name (ISO code)
        const cmat01Ref = collection(db, 'CMAT01');
        const snapshot = await getDocs(cmat01Ref);
        
        let found = false;
        snapshot.forEach((doc) => {
          if (doc.id === isoCode) {
            const data = doc.data();
            details.push({
              isoCode,
              codigo: data.codigo || isoCode,
              descripcion: data.descripcion || 'Sin descripción',
              quantity
            });
            found = true;
          }
        });
        
        if (!found) {
          console.warn(`[SMAT01-orden] Material with ISO code ${isoCode} not found in CMAT01`);
          details.push({
            isoCode,
            codigo: isoCode,
            descripcion: 'Material no encontrado',
            quantity
          });
        }
      }
      
      setMaterialDetails(details);
    } catch (error) {
      console.error('[SMAT01-orden] Error loading material details:', error);
      showToast('error', 'Error al cargar detalles de materiales');
    } finally {
      setLoadingMaterials(false);
    }
  };

  // Handle work order selection
  const handleWorkOrderChange = useCallback(async (orderId: string) => {
    setSelectedWorkOrder(orderId);
    setStorageAssignments([]);
    setMaterialDetails([]);
    setErrors({});
    
    if (!orderId) return;
    
    const order = workOrders.find(wo => wo.id === orderId);
    if (order && order.componentsUsed) {
      await loadMaterialDetails(order.componentsUsed);
    }
  }, [workOrders]);

  // Add new storage assignment
  const addStorageAssignment = useCallback(() => {
    const newAssignment: StorageAssignment = {
      id: `assignment-${Date.now()}`,
      storageLocation: '',
      materials: {}
    };
    setStorageAssignments(prev => [...prev, newAssignment]);
  }, []);

  // Remove storage assignment
  const removeStorageAssignment = useCallback((id: string) => {
    setStorageAssignments(prev => prev.filter(a => a.id !== id));
  }, []);

  // Update storage location for assignment
  const updateStorageLocation = useCallback((id: string, location: string) => {
    // Check if this location is already used in another assignment
    const isDuplicate = storageAssignments.some(
      assignment => assignment.id !== id && assignment.storageLocation === location
    );
    
    if (isDuplicate && location !== '') {
      setErrors(prev => ({
        ...prev,
        [`storage-${id}`]: 'Esta ubicación ya está siendo usada en otra asignación'
      }));
      return;
    }
    
    setStorageAssignments(prev => 
      prev.map(a => a.id === id ? { ...a, storageLocation: location } : a)
    );
    
    // Clear error for this assignment
    if (errors[`storage-${id}`]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[`storage-${id}`];
        return newErrors;
      });
    }
  }, [errors, storageAssignments]);

  // Get available storage locations for a specific assignment (excluding already used ones)
  const getAvailableLocations = useCallback((currentAssignmentId: string): string[] => {
    const usedLocations = storageAssignments
      .filter(a => a.id !== currentAssignmentId)
      .map(a => a.storageLocation)
      .filter(loc => loc !== '');
    
    return storageLocations.filter(loc => !usedLocations.includes(loc));
  }, [storageAssignments, storageLocations]);

  // Update material quantity for assignment
  const updateMaterialQuantity = useCallback((
    assignmentId: string, 
    isoCode: string, 
    quantity: string
  ) => {
    const numQuantity = parseFloat(quantity);
    
    setStorageAssignments(prev => 
      prev.map(a => {
        if (a.id === assignmentId) {
          const newMaterials = { ...a.materials };
          if (quantity === '' || numQuantity === 0) {
            delete newMaterials[isoCode];
          } else {
            newMaterials[isoCode] = numQuantity;
          }
          return { ...a, materials: newMaterials };
        }
        return a;
      })
    );
  }, []);

  // Validate form
  const validateForm = useCallback((): ValidationResult => {
    const newErrors: Record<string, string> = {};
    
    if (!selectedWorkOrder) {
      newErrors.workOrder = 'Debe seleccionar una orden de trabajo';
    }
    
    if (!entryDate) {
      newErrors.entryDate = 'Debe seleccionar una fecha';
    }
    
    if (storageAssignments.length === 0) {
      newErrors.assignments = 'Debe agregar al menos una asignación de almacenamiento';
    }
    
    // Check for duplicate storage locations
    const usedLocations = new Set<string>();
    storageAssignments.forEach(assignment => {
      if (assignment.storageLocation && usedLocations.has(assignment.storageLocation)) {
        newErrors[`storage-${assignment.id}`] = 'Esta ubicación ya está siendo usada en otra asignación';
      }
      if (assignment.storageLocation) {
        usedLocations.add(assignment.storageLocation);
      }
    });
    
    storageAssignments.forEach(assignment => {
      if (!assignment.storageLocation) {
        newErrors[`storage-${assignment.id}`] = 'Debe seleccionar una ubicación';
      }
      
      if (Object.keys(assignment.materials).length === 0) {
        newErrors[`materials-${assignment.id}`] = 'Debe asignar al menos un material';
      }
    });
    
    // Validate that combined quantities don't exceed work order amounts
    if (selectedWorkOrder && storageAssignments.length > 0) {
      const order = workOrders.find(wo => wo.id === selectedWorkOrder);
      if (order && order.componentsUsed) {
        // Calculate total quantities across all storage assignments
        const totalQuantities: Record<string, number> = {};
        
        storageAssignments.forEach(assignment => {
          Object.entries(assignment.materials).forEach(([isoCode, qty]) => {
            if (!totalQuantities[isoCode]) {
              totalQuantities[isoCode] = 0;
            }
            totalQuantities[isoCode] += qty;
          });
        });
        
        // Check if any total exceeds the work order amount
        Object.entries(totalQuantities).forEach(([isoCode, totalQty]) => {
          const workOrderQty = order.componentsUsed![isoCode] || 0;
          if (totalQty > workOrderQty) {
            const material = materialDetails.find(m => m.isoCode === isoCode);
            const materialName = material?.codigo || isoCode;
            newErrors.quantityExceeded = `La cantidad total de ${materialName} (${totalQty}) excede la cantidad requerida en la orden (${workOrderQty})`;
          }
        });
      }
    }
    
    setErrors(newErrors);
    return {
      isValid: Object.keys(newErrors).length === 0,
      errors: newErrors
    };
  }, [selectedWorkOrder, entryDate, storageAssignments, workOrders, materialDetails]);

  // Show toast
  const showToast = useCallback((type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  }, []);

  // Save entries to Firebase
  const handleSave = useCallback(async () => {
    const validation = validateForm();
    
    if (!validation.isValid) {
      showToast('error', 'Por favor complete todos los campos requeridos');
      return;
    }
    
    if (!user?.uid) {
      showToast('error', 'Usuario no autenticado');
      return;
    }
    
    setSaving(true);
    
    try {
      // Create one SMAT01 entry for each storage assignment
      const promises = storageAssignments.map(async (assignment) => {
        const entryRef = doc(collection(db, 'SMAT01'));
        const entryId = entryRef.id;
        
        const entryData = {
          entryId,
          createdAt: serverTimestamp(),
          createdBy: user.uid,
          createdByEmail: user.email || '',
          entryDate,
          entryType: 'orden',
          quantity: assignment.materials,
          reason: selectedWorkOrder,
          state: false,
          storageLocation: assignment.storageLocation
        };
        
        await setDoc(entryRef, entryData);
        console.log('[SMAT01-orden] Entry created:', entryId);
      });
      
      await Promise.all(promises);
      
      // Update work order's stateUsed to true
      const workOrderRef = doc(db, 'CORD01', selectedWorkOrder);
      await updateDoc(workOrderRef, {
        stateUsed: true
      });
      console.log('[SMAT01-orden] Work order stateUsed updated to true:', selectedWorkOrder);
      
      showToast('success', `Se crearon ${storageAssignments.length} salida(s) de materiales exitosamente`);
      
      // Reset form after 2 seconds
      setTimeout(() => {
        setSelectedWorkOrder('');
        setMaterialDetails([]);
        setStorageAssignments([]);
        setEntryDate(getTodayDate());
        setErrors({});
        // Reload work orders to reflect the updated stateUsed
        loadWorkOrders();
      }, 2000);
      
    } catch (error) {
      console.error('[SMAT01-orden] Error saving entries:', error);
      showToast('error', 'Error al guardar las salidas de materiales');
    } finally {
      setSaving(false);
    }
  }, [validateForm, user, storageAssignments, entryDate, selectedWorkOrder, showToast, loadWorkOrders]);

  // Get selected work order details
  const selectedOrderDetails = useMemo(() => {
    if (!selectedWorkOrder) return null;
    return workOrders.find(wo => wo.id === selectedWorkOrder);
  }, [selectedWorkOrder, workOrders]);

  if (loading) {
    return (
      <div className="p-12 text-center">
        <div className="w-12 h-12 border-4 border-red-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-gray-600">Cargando órdenes de trabajo...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toast && (
        <Toast 
          message={toast.message} 
          type={toast.type} 
          onClose={() => setToast(null)} 
        />
      )}

      {/* Work Order Selection */}
      <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
        <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center gap-2">
          <FileText size={20} />
          Seleccionar Orden de Trabajo
        </h3>
        
        <div className="grid grid-cols-2 gap-4">
          <DropdownField
            label="Orden de Trabajo"
            value={selectedWorkOrder}
            onChange={(e) => handleWorkOrderChange(e.target.value)}
            options={workOrders.map(wo => ({
              value: wo.id,
              label: `${wo.id} - ${wo.equipo || wo.equipment || wo.unidadMovil || wo.mobileUnit || 'Sin descripción'}`
            }))}
            error={errors.workOrder}
            disabled={saving}
            placeholder="Seleccione una orden de trabajo"
          />
          
          <FormField
            label="Fecha de Salida"
            value={entryDate}
            onChange={(e) => setEntryDate(e.target.value)}
            error={errors.entryDate}
            type="date"
            disabled={saving}
          />
        </div>
        
        {/* Work Order Details */}
        {selectedOrderDetails && (
          <div className="mt-4 p-3 bg-white rounded border border-gray-200">
            <h4 className="font-medium text-gray-700 mb-2">Detalles de la Orden:</h4>
            <div className="grid grid-cols-2 gap-2 text-sm">
              {selectedOrderDetails.tipo && (
                <div>
                  <span className="text-gray-600">Tipo:</span>{' '}
                  <span className="font-medium">{selectedOrderDetails.tipo}</span>
                </div>
              )}
              {(selectedOrderDetails.equipo || selectedOrderDetails.equipment) && (
                <div>
                  <span className="text-gray-600">Equipo:</span>{' '}
                  <span className="font-medium">{selectedOrderDetails.equipo || selectedOrderDetails.equipment}</span>
                </div>
              )}
              {(selectedOrderDetails.unidadMovil || selectedOrderDetails.mobileUnit) && (
                <div>
                  <span className="text-gray-600">Unidad Móvil:</span>{' '}
                  <span className="font-medium">{selectedOrderDetails.unidadMovil || selectedOrderDetails.mobileUnit}</span>
                </div>
              )}
              {selectedOrderDetails.fechaDeEmision && (
                <div>
                  <span className="text-gray-600">Fecha de Emisión:</span>{' '}
                  <span className="font-medium">{selectedOrderDetails.fechaDeEmision}</span>
                </div>
              )}
            </div>
            {(selectedOrderDetails.descripcion || selectedOrderDetails.description) && (
              <div className="mt-2">
                <span className="text-gray-600">Descripción:</span>{' '}
                <span className="font-medium">{selectedOrderDetails.descripcion || selectedOrderDetails.description}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Materials List */}
      {selectedWorkOrder && (
        <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
          <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center gap-2">
            <Package size={20} />
            Materiales a Salir
          </h3>
          
          {loadingMaterials ? (
            <div className="p-6 text-center">
              <div className="w-8 h-8 border-4 border-red-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              <p className="text-sm text-gray-600">Cargando materiales...</p>
            </div>
          ) : materialDetails.length === 0 ? (
            <div className="p-6 text-center text-gray-500">
              <Package size={32} className="mx-auto mb-2 text-gray-400" />
              <p>No hay materiales asociados a esta orden de trabajo</p>
            </div>
          ) : (
            <div className="bg-white rounded border border-gray-200 overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Código</th>
                    <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Descripción</th>
                    <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Cantidad</th>
                  </tr>
                </thead>
                <tbody>
                  {materialDetails.map((material, index) => (
                    <tr key={material.isoCode} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="px-4 py-2 text-sm text-gray-900">{material.codigo}</td>
                      <td className="px-4 py-2 text-sm text-gray-700">{material.descripcion}</td>
                      <td className="px-4 py-2 text-sm font-medium text-gray-900">{material.quantity}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Storage Assignments */}
      {selectedWorkOrder && materialDetails.length > 0 && (
        <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-gray-900 flex items-center gap-2">
              <MapPin size={20} />
              Asignaciones de Almacenamiento
            </h3>
            <button
              onClick={addStorageAssignment}
              disabled={saving || storageAssignments.length >= storageLocations.length}
              className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2 text-sm font-medium"
              title={storageAssignments.length >= storageLocations.length ? 'Todas las ubicaciones ya están en uso' : 'Agregar nueva ubicación'}
            >
              <Plus size={16} />
              Agregar Ubicación
            </button>
          </div>
          
          {errors.assignments && (
            <div className="mb-4 flex items-center gap-2 text-red-600 text-sm">
              <AlertCircle size={16} />
              <span>{errors.assignments}</span>
            </div>
          )}
          
          {errors.quantityExceeded && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md flex items-start gap-2 text-red-700">
              <AlertCircle size={20} className="flex-shrink-0 mt-0.5" />
              <div>
                <div className="font-medium">Cantidad excedida</div>
                <div className="text-sm">{errors.quantityExceeded}</div>
              </div>
            </div>
          )}
          
          {storageAssignments.length === 0 ? (
            <div className="p-6 text-center text-gray-500 bg-white rounded border border-gray-200">
              <MapPin size={32} className="mx-auto mb-2 text-gray-400" />
              <p>No hay asignaciones de almacenamiento</p>
              <p className="text-sm mt-1">Haga clic en "Agregar Ubicación" para comenzar</p>
            </div>
          ) : (
            <div className="space-y-4">
              {storageAssignments.map((assignment, assignmentIndex) => (
                <div key={assignment.id} className="bg-white p-4 rounded-lg border border-gray-200">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-medium text-gray-700">
                      Ubicación #{assignmentIndex + 1}
                    </h4>
                    <button
                      onClick={() => removeStorageAssignment(assignment.id)}
                      disabled={saving}
                      className="text-red-600 hover:bg-red-50 p-2 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                  
                  {/* Storage Location Selection */}
                  <div className="mb-3">
                    <DropdownField
                      label="Ubicación de Almacenamiento"
                      value={assignment.storageLocation}
                      onChange={(e) => updateStorageLocation(assignment.id, e.target.value)}
                      options={getAvailableLocations(assignment.id).map(loc => ({ value: loc, label: loc }))}
                      error={errors[`storage-${assignment.id}`]}
                      disabled={saving}
                      placeholder="Seleccione una ubicación"
                    />
                  </div>
                  
                  {/* Material Quantities */}
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-2 block">
                      Cantidades de Materiales
                    </label>
                    <div className="space-y-2">
                      {materialDetails.map((material) => (
                        <div key={material.isoCode} className="flex items-center gap-3 bg-gray-50 p-2 rounded">
                          <div className="flex-1">
                            <div className="text-sm font-medium text-gray-900">{material.codigo}</div>
                            <div className="text-xs text-gray-600">{material.descripcion}</div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-600">Max: {material.quantity}</span>
                            <input
                              type="number"
                              value={assignment.materials[material.isoCode] || ''}
                              onChange={(e) => updateMaterialQuantity(assignment.id, material.isoCode, e.target.value)}
                              min="0"
                              max={material.quantity}
                              step="0.01"
                              placeholder="0"
                              disabled={saving}
                              className="w-24 px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                    {errors[`materials-${assignment.id}`] && (
                      <div className="mt-2 flex items-center gap-1 text-red-600 text-xs">
                        <AlertCircle size={12} />
                        <span>{errors[`materials-${assignment.id}`]}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Save Button */}
      {selectedWorkOrder && materialDetails.length > 0 && storageAssignments.length > 0 && (
        <div className="flex justify-end gap-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className="bg-red-600 text-white px-6 py-3 rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2 font-medium"
          >
            {saving ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Guardando...
              </>
            ) : (
              <>
                <Save size={20} />
                Guardar Salidas ({storageAssignments.length})
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}