// /app/lib/firebase/ecom01.ts
// Firebase utilities for ECOM01 fuel entry operations

import { 
  doc, 
  setDoc, 
  updateDoc, 
  getDoc, 
  onSnapshot, 
  deleteDoc,
  serverTimestamp,
  Timestamp
} from "firebase/firestore";
import { db, auth } from "./client";

// Data types
export type FuelEntryStatus = 'pending' | 'signed' | 'completed';

export type SignatureData = {
  width: number;
  height: number;
  paths: Array<{
    d: string;
    strokeWidth: number;
  }>;
};

export type ECOM01Document = {
  // Initial fields (on QR generation)
  status: FuelEntryStatus;
  signatureToken: string;
  signature: SignatureData | null;
  createdBy: string;
  createdAt: Timestamp;
  signedAt?: Timestamp;
  completedAt?: Timestamp;
  
  // Form fields (added on save)
  fecha?: string;
  proveedorExterno?: string;
  nroChapa?: string;
  chofer?: string;
  factura?: string;
  cantidadFacturadaLts?: string;
  horaDescarga?: string;
  cantidadRecepcionadaLts?: string;
};

export type FuelEntryFormData = {
  fecha: string;
  proveedorExterno: string;
  nroChapa: string;
  chofer: string;
  factura: string;
  cantidadFacturadaLts: string;
  horaDescarga: string;
  cantidadRecepcionadaLts: string;
};

// Utility functions
export function generateDocId(): string {
  const now = new Date();
  const day = String(now.getDate()).padStart(2, '0');
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const year = now.getFullYear();
  const random = Math.random().toString(36).substr(2, 8);
  return `${day}-${month}-${year}_${random}`;
}

export function generateSignatureToken(): string {
  // Generate 128-bit hex token
  return Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

export function buildSigningUrl(docId: string, token: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || window.location.origin;
  return `${baseUrl}/sign?doc=${docId}&t=${token}`;
}

// Enhanced error logging
const logError = (operation: string, error: any, context?: any) => {
  console.error(`[ECOM01] ${operation} failed:`, {
    error: error.message || error,
    code: error.code,
    context,
    userId: auth.currentUser?.uid,
    userEmail: auth.currentUser?.email
  });
};

// Firestore operations with enhanced error handling
export async function createPendingEntry(userId: string) {
  try {
    if (!auth.currentUser) {
      throw new Error('User not authenticated');
    }

    const docId = generateDocId();
    const signatureToken = generateSignatureToken();
    
    const docData: Omit<ECOM01Document, 'createdAt'> = {
      status: 'pending',
      signatureToken,
      signature: null,
      createdBy: userId,
    };

    console.log('[ECOM01] Creating pending entry:', { docId, userId });
    
    await setDoc(doc(db, 'ECOM01', docId), {
      ...docData,
      createdAt: serverTimestamp()
    });

    console.log('[ECOM01] Pending entry created successfully');
    return { docId, signatureToken };
  } catch (error) {
    logError('createPendingEntry', error, { userId });
    throw error;
  }
}

export async function getEntryDocument(docId: string): Promise<ECOM01Document | null> {
  try {
    const docRef = doc(db, 'ECOM01', docId);
    const docSnap = await getDoc(docRef);
    
    if (!docSnap.exists()) {
      console.log('[ECOM01] Document not found:', docId);
      return null;
    }
    
    return docSnap.data() as ECOM01Document;
  } catch (error) {
    logError('getEntryDocument', error, { docId });
    throw error;
  }
}

export function subscribeToEntry(docId: string, callback: (doc: ECOM01Document | null) => void) {
  const docRef = doc(db, 'ECOM01', docId);
  return onSnapshot(docRef, 
    (docSnap) => {
      if (docSnap.exists()) {
        callback(docSnap.data() as ECOM01Document);
      } else {
        callback(null);
      }
    },
    (error) => {
      logError('subscribeToEntry', error, { docId });
    }
  );
}

export async function updateSignature(docId: string, signature: SignatureData) {
  try {
    console.log('[ECOM01] Updating signature for document:', docId);
    
    const docRef = doc(db, 'ECOM01', docId);
    
    // First check if document exists and get current data
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) {
      throw new Error(`Document ${docId} not found`);
    }

    await updateDoc(docRef, {
      signature,
      status: 'signed',
      signedAt: serverTimestamp()
    });

    console.log('[ECOM01] Signature updated successfully');
  } catch (error) {
    logError('updateSignature', error, { docId });
    throw error;
  }
}

export async function completeEntry(docId: string, formData: FuelEntryFormData) {
  try {
    if (!auth.currentUser) {
      throw new Error('User not authenticated');
    }

    console.log('[ECOM01] Completing entry for document:', docId);
    console.log('[ECOM01] Form data:', formData);
    
    const docRef = doc(db, 'ECOM01', docId);
    
    // First check if document exists and get current data
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) {
      throw new Error(`Document ${docId} not found`);
    }

    const currentData = docSnap.data() as ECOM01Document;
    console.log('[ECOM01] Current document data:', {
      status: currentData.status,
      createdBy: currentData.createdBy,
      hasSignature: !!currentData.signature
    });

    // Verify the document is in the correct state
    if (currentData.status !== 'signed') {
      throw new Error(`Document ${docId} is not in signed state (current: ${currentData.status})`);
    }

    // Verify user is the creator (for security)
    if (currentData.createdBy !== auth.currentUser.uid) {
      throw new Error(`User ${auth.currentUser.uid} is not authorized to complete document ${docId}`);
    }

    // Update with form data and change status
    await updateDoc(docRef, {
      ...formData,
      status: 'completed',
      completedAt: serverTimestamp()
    });

    console.log('[ECOM01] Entry completed successfully');
  } catch (error) {
    logError('completeEntry', error, { docId, formData: Object.keys(formData) });
    throw error;
  }
}

export async function deletePendingEntry(docId: string) {
  try {
    if (!auth.currentUser) {
      throw new Error('User not authenticated');
    }

    console.log('[ECOM01] Deleting pending entry:', docId);
    
    const docRef = doc(db, 'ECOM01', docId);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      const data = docSnap.data() as ECOM01Document;
      
      // Only allow deletion of pending documents by their creator
      if (data.status === 'pending' && data.createdBy === auth.currentUser.uid) {
        await deleteDoc(docRef);
        console.log('[ECOM01] Pending entry deleted successfully');
        return true;
      } else {
        console.warn('[ECOM01] Cannot delete document - not pending or not creator');
        return false;
      }
    }
    
    console.log('[ECOM01] Document not found for deletion');
    return false;
  } catch (error) {
    logError('deletePendingEntry', error, { docId });
    throw error;
  }
}

// SVG rendering utility
export function renderSignatureSVG(signature: SignatureData): string {
  const { width, height, paths } = signature;
  
  const pathElements = paths
    .map(path => 
      `<path d="${path.d}" fill="none" stroke="black" stroke-width="${path.strokeWidth}" stroke-linecap="round" stroke-linejoin="round" />`
    )
    .join('\n    ');

  return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
    ${pathElements}
  </svg>`;
}