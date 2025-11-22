"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { 
  PackageMinus, 
  Check, 
  XCircle, 
  AlertCircle,
  FileText,
  Clock,
  Eye
} from "lucide-react";
import { useAuth } from "../auth-context";
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  doc, 
  getDoc,
  updateDoc,
  deleteDoc,
  setDoc,
  onSnapshot,
  runTransaction,
  Timestamp,
  serverTimestamp
} from "firebase/firestore";
import { db } from "../../lib/firebase/client";
import ASMAT01Modal from "../helpers/ASMAT01/ASMAT01-modal";

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

type Exit = {
  entryId: string;
  materialCode: string;
  materialDisplayCode: string;
  materialDescription: string;
  storageLocation: string;
  entryType: 'orden' | 'particular' | 'ajuste';
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

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

const formatDateForDisplay = (date: Date): string => {
  return date.toISOString().split('T')[0];
};

const getTodayDate = (): string => {
  return formatDateForDisplay(new Date());
};

const timestampToDateString = (timestamp: Timestamp): string => {
  return formatDateForDisplay(timestamp.toDate());
};

const timestampMatchesDate = (timestamp: Timestamp | undefined, dateString: string): boolean => {
  if (!timestamp) return false;
  return timestampToDateString(timestamp) === dateString;
};

/**
 * Parse entry date string to start of day in local timezone
 */
function parseEntryDate(entryDate: string): Date {
  const [year, month, day] = entryDate.split('-').map(Number);
  return new Date(year, month - 1, day, 0, 0, 0, 0);
}

/**
 * Get start of local day
 */
function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
}

/**
 * Convert local date to day key (YYYY-MM-DD)
 */
function dayKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}${month}${day}`;
}

/**
 * Convert acceptedAt timestamp and entryDate to effectiveAt timestamp
 */
function toEffectiveAt(acceptedAt: Timestamp | undefined, entryDate: string): Timestamp {
  if (!acceptedAt) {
    return Timestamp.now();
  }
  const parsedDate = parseEntryDate(entryDate);
  return Timestamp.fromDate(parsedDate);
}

/**
 * Compute opening quantities by replaying moves before a specific timestamp.
 */
async function computeOpeningFromMoves(
  materialCode: string,
  beforeTimestamp: Timestamp
): Promise<{ [location: string]: number }> {
  const movesRef = collection(db, 'INV01', materialCode, 'moves');
  const movesQuery = query(
    movesRef,
    where('deleted', '==', false),
    where('effectiveAt', '<', beforeTimestamp),
  );
  
  const movesSnapshot = await getDocs(movesQuery);
  const openingQtyByLocation: { [location: string]: number } = {};
  
  movesSnapshot.forEach((moveDoc) => {
    const moveData = moveDoc.data();
    const loc = moveData.storageLocation;
    const qty = moveData.qty || 0;
    openingQtyByLocation[loc] = (openingQtyByLocation[loc] || 0) + qty;
  });
  
  return openingQtyByLocation;
}

/**
 * Approves a single exit with full snapshot and inventory management.
 * This creates NEGATIVE quantity moves to decrease inventory.
 * Note: Assumes all validations have been done beforehand in handleAccept.
 */
async function approveExitWithSnapshot(
  exit: Exit,
  approvedByEmail: string | null
): Promise<void> {
  // Get all materials in this exit
  const materials = Object.entries(exit.quantity);
  
  // Process each material
  for (const [materialCode, qtyToExit] of materials) {
    const exitId = exit.entryId;
    const storageLocation = exit.storageLocation;
    
    // Parse quantity (validation already done in handleAccept)
    const qty = Number(qtyToExit);

    // Compute dates and keys outside transaction
    const effectiveAt = toEffectiveAt(exit.acceptedAt, exit.entryDate);
    const effectiveDate = effectiveAt.toDate();
    const todayKey = dayKey(effectiveDate);
    const dayStart = startOfLocalDay(effectiveDate);
    const dayStartTimestamp = Timestamp.fromDate(dayStart);
    
    const yesterday = new Date(effectiveDate);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayKey = dayKey(yesterday);

    await runTransaction(db, async (transaction) => {
      // PHASE 1: ALL READS
      
      // Read 1: Check if move already exists (idempotency)
      const moveRef = doc(db, 'INV01', materialCode, 'moves', exitId);
      const moveSnap = await transaction.get(moveRef);
      
      if (moveSnap.exists()) {
        console.log(`[ASMAT01] Move already exists for exit ${exitId}, skipping`);
        return;
      }

      // Read 2: Get current inventory (should exist due to pre-validation)
      const invRef = doc(db, 'INV01', materialCode);
      const invSnap = await transaction.get(invRef);

      // Read 3: Compute opening quantities
      const openingQtyByLocation = await computeOpeningFromMoves(materialCode, dayStartTimestamp);

      // Read 4: Get today's snapshot
      const snapshotRef = doc(db, 'INV01', materialCode, 'snapshots', todayKey);
      const snapshotSnap = await transaction.get(snapshotRef);

      // Read 5: Get yesterday's snapshot
      const yesterdaySnapshotRef = doc(db, 'INV01', materialCode, 'snapshots', yesterdayKey);
      const yesterdaySnapshotSnap = await transaction.get(yesterdaySnapshotRef);

      // PHASE 2: ALL WRITES
      
      const recordedAt = Timestamp.now();

      // Write 1: Create or update snapshot
      if (!snapshotSnap.exists()) {
        let openingForToday = { ...openingQtyByLocation };
        
        if (yesterdaySnapshotSnap.exists()) {
          const yesterdayData = yesterdaySnapshotSnap.data();
          openingForToday = yesterdayData.closingQtyByLocation || openingQtyByLocation;
        }
        
        const closingQtyByLocation = { ...openingForToday };
        closingQtyByLocation[storageLocation] = (closingQtyByLocation[storageLocation] || 0) - qty;
        
        transaction.set(snapshotRef, {
          openingQtyByLocation: openingForToday,
          closingQtyByLocation,
          builtAt: recordedAt
        });
      } else {
        const currentSnapshotData = snapshotSnap.data();
        const currentClosingQty = currentSnapshotData.closingQtyByLocation?.[storageLocation] || 0;
        
        transaction.update(snapshotRef, {
          [`closingQtyByLocation.${storageLocation}`]: currentClosingQty - qty
        });
      }

      // Write 2: Create immutable move document with NEGATIVE quantity
      transaction.set(moveRef, {
        materialCode: materialCode,
        qty: -qty,                        // NEGATIVE for exits
        effectiveAt: effectiveAt,
        recordedAt: recordedAt,
        storageLocation: storageLocation,
        source: 'SMAT01',                 // Identifies this as an exit move
        sourceId: exitId,
        reason: exit.reason || null,
        approvedByEmail: approvedByEmail,
        deleted: false
      });

      // Write 3: Update INV01 live cache
      if (invSnap.exists()) {
        const currentData = invSnap.data();
        const locationData = currentData[storageLocation] || { quantity: 0 };
        const newQuantity = (locationData.quantity || 0) - qty;

        transaction.update(invRef, {
          [`${storageLocation}.quantity`]: newQuantity,
          [`${storageLocation}.lastExit`]: exitId,
          [`${storageLocation}.lastModified`]: recordedAt
        });
      } else {
        // Should never happen due to pre-validation, but handle gracefully
        console.error(`[ASMAT01] INV01 document missing for ${materialCode} during transaction`);
      }
    });
  }

  // After all materials processed, update SMAT01 state
  const smat01Ref = doc(db, 'SMAT01', exit.entryId);
  await updateDoc(smat01Ref, {
    state: true,
    acceptedAt: serverTimestamp()
  });

  // If work order exit, update CORD01
  if (exit.entryType === 'orden') {
    const workOrderRef = doc(db, 'CORD01', exit.reason);
    await updateDoc(workOrderRef, {
      stateUsedAudit: true
    });
  }
}

// ============================================================================
// TOOLTIP CELL COMPONENT
// ============================================================================

const TooltipCell = ({ text, maxWidth = 'max-w-xs' }: { text: string; maxWidth?: string }) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const [isOverflowing, setIsOverflowing] = useState(false);
  const cellRef = React.useRef<HTMLDivElement>(null);

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

export default function ASMAT01Module() {
  const { user } = useAuth();

  const [pendingExits, setPendingExits] = useState<Exit[]>([]);
  const [acceptedOrdenExits, setAcceptedOrdenExits] = useState<Exit[]>([]);
  const [acceptedParticularExits, setAcceptedParticularExits] = useState<Exit[]>([]);
  const [acceptedAjusteExits, setAcceptedAjusteExits] = useState<Exit[]>([]);
  const [selectedPending, setSelectedPending] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  const [materialLookup, setMaterialLookup] = useState<MaterialLookup>({});
  const [selectedDate, setSelectedDate] = useState<string>(getTodayDate());
  const [selectedExit, setSelectedExit] = useState<Exit | null>(null);
  const [showModal, setShowModal] = useState(false);

  // Load material lookup table
  useEffect(() => {
    const loadMaterials = async () => {
      try {
        const cmat01Ref = collection(db, 'CMAT01');
        const materialsSnapshot = await getDocs(query(cmat01Ref));
        
        const lookup: MaterialLookup = {};
        materialsSnapshot.forEach((doc) => {
          const data = doc.data();
          lookup[data.documentId] = {
            codigo: data.codigo,
            descripcion: data.descripcion
          };
        });
        
        setMaterialLookup(lookup);
      } catch (error) {
        console.error('[ASMAT01] Error loading materials:', error);
      }
    };

    loadMaterials();
  }, []);

  // Listen to pending exits (state = false)
  useEffect(() => {
    const smat01Ref = collection(db, 'SMAT01');
    const pendingQuery = query(smat01Ref, where('state', '==', false));

    const unsubscribe = onSnapshot(
      pendingQuery,
      async (snapshot) => {
        const exits: Exit[] = [];
        
        for (const docSnapshot of snapshot.docs) {
          const data = docSnapshot.data();
          
          // Get first material code for display
          const firstMaterialCode = Object.keys(data.quantity)[0] || '';
          const material = materialLookup[firstMaterialCode];
          
          // Load work order details if applicable
          let workOrderDetails = undefined;
          if (data.entryType === 'orden' && data.reason) {
            try {
              const woRef = doc(db, 'CORD01', data.reason);
              const woSnap = await getDoc(woRef);
              if (woSnap.exists()) {
                const woData = woSnap.data();
                workOrderDetails = {
                  orderType: woData.orderType,
                  // Taller fields
                  mobileUnit: woData.mobileUnit,
                  vehicleType: woData.vehicleType,
                  driver: woData.driver,
                  // General fields
                  equipment: woData.equipment,
                  assignedTechnicians: woData.assignedTechnicians,
                  workPerformed: woData.workPerformed,
                  // Common
                  description: woData.description
                };
              }
            } catch (error) {
              console.error('[ASMAT01] Error loading work order:', error);
            }
          }
          
          exits.push({
            entryId: data.entryId,
            materialCode: firstMaterialCode,
            materialDisplayCode: material?.codigo || firstMaterialCode,
            materialDescription: material?.descripcion || 'Desconocido',
            storageLocation: data.storageLocation,
            entryType: data.entryType,
            entryDate: data.entryDate,
            quantity: data.quantity,
            reason: data.reason,
            state: data.state,
            createdByEmail: data.createdByEmail,
            createdAt: data.createdAt,
            acceptedAt: data.acceptedAt,
            workOrderDetails
          });
        }
        
        // Sort by creation date (newest first)
        exits.sort((a, b) => {
          if (!a.createdAt || !b.createdAt) return 0;
          return b.createdAt.toMillis() - a.createdAt.toMillis();
        });
        
        setPendingExits(exits);
        setLoading(false);
      },
      (error) => {
        console.error('[ASMAT01] Error loading pending exits:', error);
        showToast('error', 'Error al cargar las salidas pendientes');
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [materialLookup]);

  // Listen to accepted exits (state = true)
  useEffect(() => {
    const smat01Ref = collection(db, 'SMAT01');
    const acceptedQuery = query(smat01Ref, where('state', '==', true));

    const unsubscribe = onSnapshot(
      acceptedQuery,
      async (snapshot) => {
        const ordenExits: Exit[] = [];
        const particularExits: Exit[] = [];
        const ajusteExits: Exit[] = [];
        
        for (const docSnapshot of snapshot.docs) {
          const data = docSnapshot.data();
          
          // Get first material code for display
          const firstMaterialCode = Object.keys(data.quantity)[0] || '';
          const material = materialLookup[firstMaterialCode];
          
          // Load work order details if applicable
          let workOrderDetails = undefined;
          if (data.entryType === 'orden' && data.reason) {
            try {
              const woRef = doc(db, 'CORD01', data.reason);
              const woSnap = await getDoc(woRef);
              if (woSnap.exists()) {
                const woData = woSnap.data();
                workOrderDetails = {
                  orderType: woData.orderType,
                  // Taller fields
                  mobileUnit: woData.mobileUnit,
                  vehicleType: woData.vehicleType,
                  driver: woData.driver,
                  // General fields
                  equipment: woData.equipment,
                  assignedTechnicians: woData.assignedTechnicians,
                  workPerformed: woData.workPerformed,
                  // Common
                  description: woData.description
                };
              }
            } catch (error) {
              console.error('[ASMAT01] Error loading work order:', error);
            }
          }
          
          const exit: Exit = {
            entryId: data.entryId,
            materialCode: firstMaterialCode,
            materialDisplayCode: material?.codigo || firstMaterialCode,
            materialDescription: material?.descripcion || 'Desconocido',
            storageLocation: data.storageLocation,
            entryType: data.entryType,
            entryDate: data.entryDate,
            quantity: data.quantity,
            reason: data.reason,
            state: data.state,
            createdByEmail: data.createdByEmail,
            createdAt: data.createdAt,
            acceptedAt: data.acceptedAt,
            workOrderDetails
          };
          
          // Separate by type
          if (data.entryType === 'orden') {
            ordenExits.push(exit);
          } else if (data.entryType === 'particular') {
            particularExits.push(exit);
          } else if (data.entryType === 'ajuste') {
            ajusteExits.push(exit);
          }
        }
        
        // Sort by accepted date (newest first)
        const sortByAcceptedDate = (a: Exit, b: Exit) => {
          if (!a.acceptedAt || !b.acceptedAt) return 0;
          return b.acceptedAt.toMillis() - a.acceptedAt.toMillis();
        };
        
        ordenExits.sort(sortByAcceptedDate);
        particularExits.sort(sortByAcceptedDate);
        ajusteExits.sort(sortByAcceptedDate);
        
        setAcceptedOrdenExits(ordenExits);
        setAcceptedParticularExits(particularExits);
        setAcceptedAjusteExits(ajusteExits);
      },
      (error) => {
        console.error('[ASMAT01] Error loading accepted exits:', error);
      }
    );

    return () => unsubscribe();
  }, [materialLookup]);

  // Filter accepted exits by selected date
  const filteredAcceptedOrdenExits = useMemo(() => {
    return acceptedOrdenExits.filter(exit => timestampMatchesDate(exit.acceptedAt, selectedDate));
  }, [acceptedOrdenExits, selectedDate]);

  const filteredAcceptedParticularExits = useMemo(() => {
    return acceptedParticularExits.filter(exit => timestampMatchesDate(exit.acceptedAt, selectedDate));
  }, [acceptedParticularExits, selectedDate]);

  const filteredAcceptedAjusteExits = useMemo(() => {
    return acceptedAjusteExits.filter(exit => timestampMatchesDate(exit.acceptedAt, selectedDate));
  }, [acceptedAjusteExits, selectedDate]);

  // Toggle selection for pending exit
  const toggleSelection = useCallback((entryId: string) => {
    setSelectedPending(prev => {
      const newSet = new Set(prev);
      if (newSet.has(entryId)) {
        newSet.delete(entryId);
      } else {
        newSet.add(entryId);
      }
      return newSet;
    });
  }, []);

  // Select all pending exits
  const selectAll = useCallback(() => {
    if (selectedPending.size === pendingExits.length) {
      setSelectedPending(new Set());
    } else {
      setSelectedPending(new Set(pendingExits.map(e => e.entryId)));
    }
  }, [pendingExits, selectedPending]);

  // Show toast
  const showToast = useCallback((type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    // Longer duration for errors (8 seconds) vs success (4 seconds)
    const duration = type === 'error' ? 8000 : 4000;
    setTimeout(() => setToast(null), duration);
  }, []);

  // Open modal with exit details
  const openModal = useCallback((exit: Exit) => {
    setSelectedExit(exit);
    setShowModal(true);
  }, []);

  // Close modal
  const closeModal = useCallback(() => {
    setShowModal(false);
    setSelectedExit(null);
  }, []);

  // Accept selected exits with proper inventory management
  const handleAccept = useCallback(async () => {
    if (selectedPending.size === 0) return;

    setProcessing(true);

    try {
      const exitsToAccept = pendingExits.filter(e => selectedPending.has(e.entryId));
      const approvedByEmail = user?.email || null;

      // CRITICAL: Pre-validate ALL exits and ALL materials BEFORE processing any
      console.log('[ASMAT01] Pre-validating all exits before processing...');
      const validationErrors: string[] = [];
      
      for (const exit of exitsToAccept) {
        const materials = Object.entries(exit.quantity);
        
        for (const [materialCode, qtyToExit] of materials) {
          const storageLocation = exit.storageLocation;
          const qty = Number(qtyToExit);
          
          if (isNaN(qty) || qty <= 0) {
            validationErrors.push(`Salida ${exit.entryId}: Cantidad inválida para material ${materialCode}: ${qtyToExit}`);
            continue;
          }
          
          // Check if inventory document exists
          const invRef = doc(db, 'INV01', materialCode);
          const invSnap = await getDoc(invRef);
          
          if (!invSnap.exists()) {
            validationErrors.push(`Salida ${exit.entryId}: No existe inventario para el material ${materialCode}. Debe registrar una entrada primero.`);
            continue;
          }
          
          const currentData = invSnap.data();
          const locationData = currentData[storageLocation] || { quantity: 0 };
          const currentQty = locationData.quantity || 0;
          
          if (currentQty < qty) {
            validationErrors.push(`Salida ${exit.entryId}: Inventario insuficiente para ${materialCode} en ${storageLocation}. Disponible: ${currentQty}, Requerido: ${qty}`);
          }
        }
      }
      
      // If ANY validation failed, abort ALL processing
      if (validationErrors.length > 0) {
        console.error('[ASMAT01] Validation failed:', validationErrors);
        
        // Show first error in toast, log all errors
        const firstError = validationErrors[0];
        const totalErrors = validationErrors.length;
        
        if (totalErrors === 1) {
          showToast('error', firstError);
        } else {
          showToast('error', `${firstError} (y ${totalErrors - 1} error(es) más. Ver consola para detalles)`);
        }
        
        return; // Don't process ANY exits
      }
      
      console.log('[ASMAT01] All validations passed, processing exits...');

      // Process each exit sequentially to avoid transaction contention
      for (const exit of exitsToAccept) {
        await approveExitWithSnapshot(exit, approvedByEmail);
      }

      console.log('[ASMAT01] Successfully approved exits:', Array.from(selectedPending));
      showToast('success', `${selectedPending.size} salida(s) aceptada(s) e inventario actualizado`);
      setSelectedPending(new Set());

    } catch (error) {
      console.error('[ASMAT01] Error accepting exits:', error);
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      showToast('error', `Error: ${errorMessage}`);
    } finally {
      setProcessing(false);
    }
  }, [selectedPending, pendingExits, user, showToast]);

  // Deny selected exits (delete and reset work order if needed)
  const handleDeny = useCallback(async () => {
    if (selectedPending.size === 0) return;

    if (!window.confirm(`¿Está seguro de que desea denegar y eliminar ${selectedPending.size} salida(s)?`)) {
      return;
    }

    setProcessing(true);

    try {
      const exitsToDelete = pendingExits.filter(e => selectedPending.has(e.entryId));
      
      for (const exit of exitsToDelete) {
        // Delete SMAT01 document
        const exitRef = doc(db, 'SMAT01', exit.entryId);
        await deleteDoc(exitRef);
        
        // If work order exit, reset stateUsed to false
        if (exit.entryType === 'orden') {
          const workOrderRef = doc(db, 'CORD01', exit.reason);
          await updateDoc(workOrderRef, {
            stateUsed: false
          });
          console.log('[ASMAT01] Reset stateUsed for work order:', exit.reason);
        }
      }

      console.log('[ASMAT01] Denied exits:', Array.from(selectedPending));
      showToast('success', `${selectedPending.size} salida(s) denegada(s) y eliminada(s)`);
      setSelectedPending(new Set());

    } catch (error) {
      console.error('[ASMAT01] Error denying exits:', error);
      showToast('error', 'Error al denegar las salidas');
    } finally {
      setProcessing(false);
    }
  }, [selectedPending, pendingExits, showToast]);

  if (loading) {
    return (
      <section className="w-full p-6 bg-gray-50 min-h-full flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-red-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Cargando salidas...</p>
        </div>
      </section>
    );
  }

  return (
    <section className="w-full p-6 bg-gray-50 min-h-full">
      <header className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-red-100 rounded-lg">
            <PackageMinus className="text-red-600" size={24} />
          </div>
          <h1 className="text-2xl font-semibold text-gray-900">
             Administración de Salidas de Materiales
          </h1>
        </div>
      </header>

      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 animate-slide-in max-w-md">
          <div className={`rounded-lg shadow-lg p-4 flex items-start gap-3 ${
            toast.type === 'success' ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
          }`}>
            {toast.type === 'success' ? (
              <Check className="text-green-600 flex-shrink-0 mt-0.5" size={20} />
            ) : (
              <AlertCircle className="text-red-600 flex-shrink-0 mt-0.5" size={20} />
            )}
            <span className={`font-medium flex-1 ${
              toast.type === 'success' ? 'text-green-800' : 'text-red-800'
            }`}>
              {toast.message}
            </span>
            <button
              onClick={() => setToast(null)}
              className="text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0"
              aria-label="Cerrar"
            >
              <XCircle size={18} />
            </button>
          </div>
        </div>
      )}

      {/* Modal */}
      {showModal && selectedExit && (
        <ASMAT01Modal
          exit={selectedExit}
          materialLookup={materialLookup}
          onClose={closeModal}
        />
      )}

      {/* Pending Exits Section */}
      <div className="bg-white border rounded-lg shadow-sm mb-6">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Salidas Pendientes</h2>
              <p className="text-sm text-gray-600 mt-1">
                {pendingExits.length} salida(s) esperando aprobación
                {selectedPending.size > 0 && ` • ${selectedPending.size} seleccionada(s)`}
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <button
                onClick={handleAccept}
                disabled={selectedPending.size === 0 || processing}
                className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-medium flex items-center gap-2"
              >
                {processing ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Procesando...
                  </>
                ) : (
                  <>
                    <Check size={18} />
                    Aceptar
                  </>
                )}
              </button>
              <button
                onClick={handleDeny}
                disabled={selectedPending.size === 0 || processing}
                className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-medium flex items-center gap-2"
              >
                <XCircle size={18} />
                Denegar
              </button>
            </div>
          </div>
        </div>

        {/* Pending Table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={selectedPending.size === pendingExits.length && pendingExits.length > 0}
                    onChange={selectAll}
                    className="w-4 h-4 text-red-600 rounded focus:ring-red-500"
                  />
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Tipo</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Fecha</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Razón</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Creado Por</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-700 uppercase">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {pendingExits.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                    No hay salidas pendientes
                  </td>
                </tr>
              ) : (
                pendingExits.map((exit) => (
                  <tr key={exit.entryId} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedPending.has(exit.entryId)}
                        onChange={() => toggleSelection(exit.entryId)}
                        className="w-4 h-4 text-red-600 rounded focus:ring-red-500"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 text-xs font-medium rounded ${
                        exit.entryType === 'orden' 
                          ? 'bg-blue-100 text-blue-800'
                          : exit.entryType === 'particular'
                          ? 'bg-purple-100 text-purple-800'
                          : 'bg-orange-100 text-orange-800'
                      }`}>
                        {exit.entryType.charAt(0).toUpperCase() + exit.entryType.slice(1)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-gray-900">{exit.entryDate}</span>
                    </td>
                    <td className="px-4 py-3">
                      {exit.entryType === 'orden' && exit.workOrderDetails ? (
                        <div>
                          <div className="text-sm font-medium text-gray-900">{exit.reason}</div>
                          <TooltipCell 
                            text={
                              exit.workOrderDetails.mobileUnit || 
                              exit.workOrderDetails.equipment || 
                              'N/A'
                            } 
                            maxWidth="max-w-xs" 
                          />
                        </div>
                      ) : (
                        <TooltipCell text={exit.reason} maxWidth="max-w-xs" />
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-gray-600">{exit.createdByEmail}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => openModal(exit)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-md transition-colors"
                      >
                        <Eye size={16} />
                        Ver Detalles
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Accepted Exits Sections */}
      <div className="space-y-6">
        {/* Date Filter */}
        <div className="bg-white border rounded-lg shadow-sm p-4">
          <div className="flex items-center gap-4">
            <Clock size={20} className="text-gray-600" />
            <label className="text-sm font-medium text-gray-700">Filtrar salidas aceptadas por fecha:</label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>
        </div>

        {/* Orden de Trabajo Exits */}
        <div className="bg-white border rounded-lg shadow-sm">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center gap-2">
              <FileText size={20} className="text-blue-600" />
              <h2 className="text-xl font-semibold text-gray-900">
                Salidas por Orden de Trabajo
              </h2>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Tipo</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Fecha</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Razón</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Creado Por</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-700 uppercase">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredAcceptedOrdenExits.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                      No hay salidas por orden de trabajo en esta fecha
                    </td>
                  </tr>
                ) : (
                  filteredAcceptedOrdenExits.map((exit) => (
                    <tr key={exit.entryId} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <span className="px-2 py-1 text-xs font-medium rounded bg-blue-100 text-blue-800">
                          Orden
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-gray-900">{exit.entryDate}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div>
                          <div className="text-sm font-medium text-gray-900">{exit.reason}</div>
                          <TooltipCell 
                            text={
                              exit.workOrderDetails?.mobileUnit || 
                              exit.workOrderDetails?.equipment || 
                              'N/A'
                            } 
                            maxWidth="max-w-xs" 
                          />
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-gray-600">{exit.createdByEmail}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => openModal(exit)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-md transition-colors"
                        >
                          <Eye size={16} />
                          Ver Detalles
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Particular Exits */}
        <div className="bg-white border rounded-lg shadow-sm">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center gap-2">
              <PackageMinus size={20} className="text-purple-600" />
              <h2 className="text-xl font-semibold text-gray-900">
                Salidas Particulares
              </h2>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Tipo</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Fecha</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Razón</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Creado Por</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-700 uppercase">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredAcceptedParticularExits.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                      No hay salidas particulares en esta fecha
                    </td>
                  </tr>
                ) : (
                  filteredAcceptedParticularExits.map((exit) => (
                    <tr key={exit.entryId} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <span className="px-2 py-1 text-xs font-medium rounded bg-purple-100 text-purple-800">
                          Particular
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-gray-900">{exit.entryDate}</span>
                      </td>
                      <td className="px-4 py-3">
                        <TooltipCell text={exit.reason} maxWidth="max-w-xs" />
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-gray-600">{exit.createdByEmail}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => openModal(exit)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-md transition-colors"
                        >
                          <Eye size={16} />
                          Ver Detalles
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Ajuste Exits */}
        <div className="bg-white border rounded-lg shadow-sm">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center gap-2">
              <AlertCircle size={20} className="text-orange-600" />
              <h2 className="text-xl font-semibold text-gray-900">
                Salidas por Ajuste
              </h2>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Tipo</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Fecha</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Razón</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Creado Por</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-700 uppercase">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredAcceptedAjusteExits.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                      No hay salidas por ajuste en esta fecha
                    </td>
                  </tr>
                ) : (
                  filteredAcceptedAjusteExits.map((exit) => (
                    <tr key={exit.entryId} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <span className="px-2 py-1 text-xs font-medium rounded bg-orange-100 text-orange-800">
                          Ajuste
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-gray-900">{exit.entryDate}</span>
                      </td>
                      <td className="px-4 py-3">
                        <TooltipCell text={exit.reason} maxWidth="max-w-xs" />
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-gray-600">{exit.createdByEmail}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => openModal(exit)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-md transition-colors"
                        >
                          <Eye size={16} />
                          Ver Detalles
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
}