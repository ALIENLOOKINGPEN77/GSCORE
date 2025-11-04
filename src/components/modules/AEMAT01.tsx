"use client";

import React, { useCallback, useEffect, useState, useMemo } from "react";
import { CheckSquare, Square, Check, X, AlertCircle, CheckCircle, Package, Calendar as CalendarIcon } from "lucide-react";
import { useAuth } from "../auth-context";
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  doc, 
  updateDoc, 
  deleteDoc, 
  getDocs, 
  getDoc,
  setDoc,
  Timestamp, 
  serverTimestamp,
  runTransaction,
  orderBy,
  QueryDocumentSnapshot,
  DocumentData
} from "firebase/firestore";
import { db } from "../../lib/firebase/client";

// ============================================================================
// TIMEZONE HELPERS (America/Asuncion)
// ============================================================================

/**
 * Returns "yyyyMMdd" string for the given date in America/Asuncion timezone.
 */
function dayKey(date: Date): string {
  const localStr = date.toLocaleString("en-US", { timeZone: "America/Asuncion" });
  const localDate = new Date(localStr);
  const year = localDate.getFullYear();
  const month = String(localDate.getMonth() + 1).padStart(2, '0');
  const day = String(localDate.getDate()).padStart(2, '0');
  return `${year}${month}${day}`;
}

/**
 * Returns the start of day (00:00:00) in America/Asuncion for the given date.
 */
function startOfLocalDay(date: Date): Date {
  const localStr = date.toLocaleString("en-US", { timeZone: "America/Asuncion" });
  const localDate = new Date(localStr);
  localDate.setHours(0, 0, 0, 0);
  return localDate;
}

/**
 * Converts acceptedAt (if available) or entryDate string to a Timestamp for effectiveAt.
 * If acceptedAt is provided, use it. Otherwise, parse entryDate as YYYY-MM-DD and 
 * set to midnight in America/Asuncion.
 */
function toEffectiveAt(acceptedAt: Timestamp | undefined, entryDate: string): Timestamp {
  if (acceptedAt) {
    return acceptedAt;
  }
  // Parse entryDate (YYYY-MM-DD) and create midnight in America/Asuncion
  const [year, month, day] = entryDate.split('-').map(Number);
  const localMidnight = new Date(year, month - 1, day, 0, 0, 0, 0);
  return Timestamp.fromDate(localMidnight);
}

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

type Entry = {
  entryId: string;
  materialCode: string;
  materialDisplayCode: string;
  materialDescription: string;
  storageLocation: string;
  entryType: string;
  entryDate: string;
  quantity: string;
  reason: string;
  state: boolean;
  createdByEmail: string;
  createdAt: any;
  acceptedAt?: Timestamp;
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
// INVENTORY MANAGEMENT FUNCTIONS
// ============================================================================

/**
 * Computes opening quantities by replaying moves before a specific timestamp.
 * This is called OUTSIDE of transactions to avoid read-after-write issues.
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
    orderBy('effectiveAt', 'asc')
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
 * Approves a single entry with full snapshot and inventory management.
 * This function runs inside a transaction to ensure atomicity and idempotency.
 * 
 * SIMPLIFIED VERSION: Only writes to moves and snapshots subcollections.
 * No entries/exits mirrors - use source field to filter move types.
 * 
 * CRITICAL: All transaction reads must happen before any transaction writes.
 */
async function approveEntryWithSnapshot(
  entry: Entry,
  approvedByEmail: string | null
): Promise<void> {
  const materialCode = entry.materialCode;
  const entryId = entry.entryId;
  const storageLocation = entry.storageLocation;
  
  // Validate and parse quantity
  const qty = Number(entry.quantity);
  if (isNaN(qty) || qty <= 0) {
    throw new Error(`Invalid quantity for entry ${entryId}: ${entry.quantity}`);
  }

  // Compute dates and keys outside transaction
  const effectiveAt = toEffectiveAt(entry.acceptedAt, entry.entryDate);
  const effectiveDate = effectiveAt.toDate();
  const todayKey = dayKey(effectiveDate);
  const dayStart = startOfLocalDay(effectiveDate);
  const dayStartTimestamp = Timestamp.fromDate(dayStart);
  
  const yesterday = new Date(effectiveDate);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayKey = dayKey(yesterday);

  await runTransaction(db, async (transaction) => {
    // ========================================================================
    // PHASE 1: ALL READS - Must complete before any writes
    // ========================================================================
    
    // Read 1: Idempotency check - does this move already exist?
    const moveRef = doc(db, 'INV01', materialCode, 'moves', entryId);
    const moveSnap = await transaction.get(moveRef);
    
    if (moveSnap.exists()) {
      console.log(`[AEMAT01] Move ${entryId} already exists, skipping`);
      return; // Already processed, exit early
    }

    // Read 2: Check today's snapshot
    const snapshotRef = doc(db, 'INV01', materialCode, 'snapshots', todayKey);
    const snapshotSnap = await transaction.get(snapshotRef);
    
    // Read 3: Check yesterday's snapshot (might be needed for opening calculation)
    const yesterdaySnapshotRef = doc(db, 'INV01', materialCode, 'snapshots', yesterdayKey);
    const yesterdaySnap = await transaction.get(yesterdaySnapshotRef);
    
    // Read 4: Check INV01 live cache
    const invRef = doc(db, 'INV01', materialCode);
    const invSnap = await transaction.get(invRef);

    // ========================================================================
    // PHASE 1.5: Compute opening if needed (BEFORE starting writes)
    // ========================================================================
    
    let openingQtyByLocation: { [location: string]: number } = {};
    let needsSnapshotCreation = false;
    let currentClosingQty = 0;
    
    if (!snapshotSnap.exists()) {
      needsSnapshotCreation = true;
      
      if (yesterdaySnap.exists()) {
        // Use yesterday's closing as today's opening
        const yesterdayData = yesterdaySnap.data();
        openingQtyByLocation = yesterdayData.closingQtyByLocation || {};
      } else {
        // No yesterday snapshot - compute from moves
        openingQtyByLocation = await computeOpeningFromMoves(materialCode, dayStartTimestamp);
      }
    } else {
      // Snapshot exists, get current closing quantity for this location
      const snapshotData = snapshotSnap.data();
      const closingQty = snapshotData.closingQtyByLocation || {};
      currentClosingQty = closingQty[storageLocation] || 0;
    }

    // ========================================================================
    // PHASE 2: ALL WRITES - After all reads are complete
    // ========================================================================

    const recordedAt = serverTimestamp();

    // Write 1: Create or update snapshot
    if (needsSnapshotCreation) {
      // Create new snapshot with closing quantity already including this entry
      const closingQtyByLocation = { ...openingQtyByLocation };
      closingQtyByLocation[storageLocation] = (closingQtyByLocation[storageLocation] || 0) + qty;
      
      transaction.set(snapshotRef, {
        openingQtyByLocation,
        closingQtyByLocation,
        builtAt: recordedAt
      });
    } else {
      // Update existing snapshot's closing quantity
      transaction.update(snapshotRef, {
        [`closingQtyByLocation.${storageLocation}`]: currentClosingQty + qty
      });
    }

    // Write 2: Create immutable move document (ONLY subcollection now)
    transaction.set(moveRef, {
      materialCode: materialCode,       // Duplicate for collection-group queries
      qty: qty,                         // Positive for entries
      effectiveAt: effectiveAt,
      recordedAt: recordedAt,
      storageLocation: storageLocation,
      source: 'EMAT01',                 // Identifies this as an entry move
      sourceId: entryId,                // Links back to EMAT01/{entryId}
      reason: entry.reason || null,
      approvedByEmail: approvedByEmail, // Who approved this entry
      deleted: false
    });

    // Write 3: Update or create INV01 live cache
    if (invSnap.exists()) {
      const currentData = invSnap.data();
      const locationData = currentData[storageLocation] || { quantity: 0 };
      const newQuantity = (locationData.quantity || 0) + qty;

      transaction.update(invRef, {
        [`${storageLocation}.quantity`]: newQuantity,
        [`${storageLocation}.lastEntry`]: entryId,
        [`${storageLocation}.lastModified`]: recordedAt
      });
    } else {
      transaction.set(invRef, {
        [storageLocation]: {
          quantity: qty,
          lastEntry: entryId,
          lastExit: null,
          lastModified: recordedAt
        }
      });
    }

    // Write 4: Update EMAT01 entry status
    const emat01Ref = doc(db, 'EMAT01', entryId);
    transaction.update(emat01Ref, {
      state: true,
      acceptedAt: recordedAt
    });
  });
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function AEMAT01Module() {
  const { user } = useAuth();

  const [pendingEntries, setPendingEntries] = useState<Entry[]>([]);
  const [acceptedEntries, setAcceptedEntries] = useState<Entry[]>([]);
  const [selectedPending, setSelectedPending] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  const [materialLookup, setMaterialLookup] = useState<MaterialLookup>({});
  const [selectedDate, setSelectedDate] = useState<string>(getTodayDate());

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
        console.error('[AEMAT01] Error loading materials:', error);
      }
    };

    loadMaterials();
  }, []);

  // Listen to pending entries (state = false)
  useEffect(() => {
    const emat01Ref = collection(db, 'EMAT01');
    const pendingQuery = query(emat01Ref, where('state', '==', false));

    const unsubscribe = onSnapshot(
      pendingQuery,
      (snapshot) => {
        const entries: Entry[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          const material = materialLookup[data.materialCode];
          entries.push({
            entryId: data.entryId,
            materialCode: data.materialCode,
            materialDisplayCode: material?.codigo || data.materialCode,
            materialDescription: material?.descripcion || 'Desconocido',
            storageLocation: data.storageLocation,
            entryType: data.entryType,
            entryDate: data.entryDate,
            quantity: data.quantity,
            reason: data.reason,
            state: data.state,
            createdByEmail: data.createdByEmail,
            createdAt: data.createdAt,
            acceptedAt: data.acceptedAt
          });
        });
        
        // Sort by creation date (newest first)
        entries.sort((a, b) => {
          if (!a.createdAt || !b.createdAt) return 0;
          return b.createdAt.toMillis() - a.createdAt.toMillis();
        });
        
        setPendingEntries(entries);
        setLoading(false);
      },
      (error) => {
        console.error('[AEMAT01] Error loading pending entries:', error);
        showToast('error', 'Error al cargar las entradas pendientes');
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [materialLookup]);

  // Listen to accepted entries (state = true)
  useEffect(() => {
    const emat01Ref = collection(db, 'EMAT01');
    const acceptedQuery = query(emat01Ref, where('state', '==', true));

    const unsubscribe = onSnapshot(
      acceptedQuery,
      (snapshot) => {
        const entries: Entry[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          const material = materialLookup[data.materialCode];
          entries.push({
            entryId: data.entryId,
            materialCode: data.materialCode,
            materialDisplayCode: material?.codigo || data.materialCode,
            materialDescription: material?.descripcion || 'Desconocido',
            storageLocation: data.storageLocation,
            entryType: data.entryType,
            entryDate: data.entryDate,
            quantity: data.quantity,
            reason: data.reason,
            state: data.state,
            createdByEmail: data.createdByEmail,
            createdAt: data.createdAt,
            acceptedAt: data.acceptedAt
          });
        });
        
        // Sort by accepted date (newest first)
        entries.sort((a, b) => {
          if (!a.acceptedAt || !b.acceptedAt) return 0;
          return b.acceptedAt.toMillis() - a.acceptedAt.toMillis();
        });
        
        setAcceptedEntries(entries);
      },
      (error) => {
        console.error('[AEMAT01] Error loading accepted entries:', error);
      }
    );

    return () => unsubscribe();
  }, [materialLookup]);

  // Filter accepted entries by selected date
  const filteredAcceptedEntries = useMemo(() => {
    return acceptedEntries.filter(entry => timestampMatchesDate(entry.acceptedAt, selectedDate));
  }, [acceptedEntries, selectedDate]);

  // Toggle selection for pending entry
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

  // Select all pending entries
  const selectAll = useCallback(() => {
    if (selectedPending.size === pendingEntries.length) {
      setSelectedPending(new Set());
    } else {
      setSelectedPending(new Set(pendingEntries.map(e => e.entryId)));
    }
  }, [pendingEntries, selectedPending]);

  // Show toast
  const showToast = useCallback((type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  }, []);

  // Accept selected entries with proper inventory management
  const handleAccept = useCallback(async () => {
    if (selectedPending.size === 0) return;

    setProcessing(true);

    try {
      const entriesToAccept = pendingEntries.filter(e => selectedPending.has(e.entryId));
      const approvedByEmail = user?.email || null;

      // Process each entry sequentially to avoid transaction contention
      for (const entry of entriesToAccept) {
        await approveEntryWithSnapshot(entry, approvedByEmail);
      }

      console.log('[AEMAT01] Successfully approved entries:', Array.from(selectedPending));
      showToast('success', `${selectedPending.size} entrada(s) aceptada(s) e inventario actualizado`);
      setSelectedPending(new Set());

    } catch (error) {
      console.error('[AEMAT01] Error accepting entries:', error);
      showToast('error', 'Error al aceptar las entradas y actualizar el inventario');
    } finally {
      setProcessing(false);
    }
  }, [selectedPending, pendingEntries, user, showToast]);

  // Deny selected entries (delete)
  const handleDeny = useCallback(async () => {
    if (selectedPending.size === 0) return;

    if (!window.confirm(`¿Está seguro de que desea denegar y eliminar ${selectedPending.size} entrada(s)?`)) {
      return;
    }

    setProcessing(true);

    try {
      const promises: Promise<void>[] = [];
      
      selectedPending.forEach((entryId) => {
        const entryRef = doc(db, 'EMAT01', entryId);
        promises.push(deleteDoc(entryRef));
      });

      await Promise.all(promises);

      console.log('[AEMAT01] Denied entries:', Array.from(selectedPending));
      showToast('success', `${selectedPending.size} entrada(s) denegada(s) y eliminada(s)`);
      setSelectedPending(new Set());

    } catch (error) {
      console.error('[AEMAT01] Error denying entries:', error);
      showToast('error', 'Error al denegar las entradas');
    } finally {
      setProcessing(false);
    }
  }, [selectedPending, showToast]);

  if (loading) {
    return (
      <section className="w-full p-6 bg-gray-50 min-h-full flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Cargando entradas...</p>
        </div>
      </section>
    );
  }

  return (
    <section className="w-full p-6 bg-gray-50 min-h-full">
      <header className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-blue-100 rounded-lg">
            <Package className="text-blue-600" size={24} />
          </div>
          <h1 className="text-2xl font-semibold text-gray-900">
            AEMAT01 — Administración de Entradas de Materiales
          </h1>
        </div>
      </header>

      {/* Pending Entries Section */}
      <div className="bg-white border rounded-lg shadow-sm mb-6">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Entradas Pendientes</h2>
              <p className="text-sm text-gray-600 mt-1">
                {pendingEntries.length} entrada(s) esperando aprobación
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
                    Aceptar Entrada
                  </>
                )}
              </button>

              <button
                onClick={handleDeny}
                disabled={selectedPending.size === 0 || processing}
                className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-medium flex items-center gap-2"
              >
                <X size={18} />
                Denegar Entrada
              </button>
            </div>
          </div>
        </div>

        {/* Pending Entries Table */}
        <div className="overflow-x-auto">
          {pendingEntries.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              <Package size={48} className="mx-auto mb-3 text-gray-400" />
              <p className="text-lg font-medium">No hay entradas pendientes</p>
              <p className="text-sm mt-1">Todas las entradas han sido procesadas</p>
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left">
                    <button
                      onClick={selectAll}
                      className="hover:bg-gray-200 rounded p-1 transition-colors"
                    >
                      {selectedPending.size === pendingEntries.length ? (
                        <CheckSquare size={20} className="text-blue-600" />
                      ) : (
                        <Square size={20} className="text-gray-400" />
                      )}
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Material
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Descripción
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Cantidad
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Ubicación
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Tipo
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Fecha
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Razón
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Creado Por
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {pendingEntries.map((entry) => (
                  <tr
                    key={entry.entryId}
                    className={`hover:bg-gray-50 transition-colors ${
                      selectedPending.has(entry.entryId) ? 'bg-blue-50' : ''
                    }`}
                  >
                    <td className="px-4 py-3">
                      <button
                        onClick={() => toggleSelection(entry.entryId)}
                        className="hover:bg-gray-200 rounded p-1 transition-colors"
                      >
                        {selectedPending.has(entry.entryId) ? (
                          <CheckSquare size={20} className="text-blue-600" />
                        ) : (
                          <Square size={20} className="text-gray-400" />
                        )}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-sm font-mono font-medium text-gray-900">
                      {entry.materialDisplayCode}
                    </td>
                    <td className="px-4 py-3">
                      <TooltipCell text={entry.materialDescription} maxWidth="max-w-xs" />
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 font-medium">
                      {entry.quantity}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {entry.storageLocation}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {entry.entryType}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {entry.entryDate}
                    </td>
                    <td className="px-4 py-3">
                      <TooltipCell text={entry.reason} maxWidth="max-w-xs" />
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {entry.createdByEmail}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Accepted Entries Section */}
      <div className="bg-white border rounded-lg shadow-sm">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Entradas Aceptadas</h2>
              <p className="text-sm text-gray-600 mt-1">
                {filteredAcceptedEntries.length} entrada(s) confirmada(s) para {selectedDate}
              </p>
            </div>

            {/* Date Picker */}
            <div className="flex items-center gap-2">
              <CalendarIcon size={18} className="text-gray-500" />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={() => setSelectedDate(getTodayDate())}
                className="px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors font-medium"
              >
                Hoy
              </button>
            </div>
          </div>
        </div>

        {/* Accepted Entries Table */}
        <div className="overflow-x-auto">
          {filteredAcceptedEntries.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              <CheckCircle size={48} className="mx-auto mb-3 text-gray-400" />
              <p className="text-lg font-medium">No hay entradas aceptadas para esta fecha</p>
              <p className="text-sm mt-1">Seleccione otra fecha para ver las entradas aceptadas</p>
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Material
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Descripción
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Cantidad
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Ubicación
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Tipo
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Fecha Entrada
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Razón
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Creado Por
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredAcceptedEntries.map((entry) => (
                  <tr key={entry.entryId} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-sm font-mono font-medium text-gray-900">
                      {entry.materialDisplayCode}
                    </td>
                    <td className="px-4 py-3">
                      <TooltipCell text={entry.materialDescription} maxWidth="max-w-xs" />
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 font-medium">
                      {entry.quantity}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {entry.storageLocation}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {entry.entryType}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {entry.entryDate}
                    </td>
                    <td className="px-4 py-3">
                      <TooltipCell text={entry.reason} maxWidth="max-w-xs" />
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {entry.createdByEmail}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Toast Notification */}
      {toast && (
        <div
          role="alert"
          aria-live="polite"
          className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 w-[min(95vw,420px)] shadow-lg border bg-white px-4 py-3 rounded-md text-sm flex items-center gap-2"
        >
          {toast.type === 'success' ? (
            <CheckCircle className="text-green-500 shrink-0" size={18} />
          ) : (
            <AlertCircle className="text-red-500 shrink-0" size={18} />
          )}
          <span className="text-gray-800">{toast.message}</span>
          <button
            onClick={() => setToast(null)}
            className="ml-auto text-gray-500 hover:text-gray-700"
            aria-label="Dismiss message"
          >
            <X size={16} />
          </button>
        </div>
      )}
    </section>
  );
}