// /app/lib/utils/date-helpers.ts
// Date and time utilities for the ECOM01 system

export function formatDateForInput(date: Date): string {
  return date.toISOString().split('T')[0];
}

export function formatTimeForInput(date: Date): string {
  return date.toTimeString().slice(0, 5);
}

export function getCurrentDate(): string {
  return formatDateForInput(new Date());
}

export function getCurrentTime(): string {
  return formatTimeForInput(new Date());
}

export function parseInputDate(dateStr: string): Date | null {
  if (!dateStr) return null;
  const date = new Date(dateStr + 'T00:00:00');
  return isNaN(date.getTime()) ? null : date;
}

export function parseInputTime(timeStr: string): Date | null {
  if (!timeStr) return null;
  const today = new Date();
  const [hours, minutes] = timeStr.split(':').map(Number);
  if (isNaN(hours) || isNaN(minutes)) return null;
  
  const date = new Date(today.getFullYear(), today.getMonth(), today.getDate(), hours, minutes);
  return isNaN(date.getTime()) ? null : date;
}

// /app/lib/utils/validation-helpers.ts
// Validation utilities for fuel entry forms

export function validateLicensePlate(plate: string): boolean {
  // Basic validation for license plates (adjust regex for your country)
  const plateRegex = /^[A-Z]{2,3}[0-9]{3,4}$/;
  return plateRegex.test(plate.replace(/\s/g, '').toUpperCase());
}

export function validateInvoiceNumber(invoice: string): boolean {
  // Basic validation for invoice numbers
  return invoice.trim().length >= 3;
}

export function validateFuelQuantity(quantity: string): { isValid: boolean; error?: string } {
  const num = Number(quantity);
  
  if (isNaN(num)) {
    return { isValid: false, error: 'Debe ser un número válido' };
  }
  
  if (num <= 0) {
    return { isValid: false, error: 'Debe ser mayor a 0' };
  }
  
  if (num > 50000) {
    return { isValid: false, error: 'Cantidad demasiado alta' };
  }
  
  // Check for reasonable decimal places
  if (quantity.includes('.') && quantity.split('.')[1].length > 3) {
    return { isValid: false, error: 'Máximo 3 decimales' };
  }
  
  return { isValid: true };
}

export function validateDriverName(name: string): boolean {
  return name.trim().length >= 2 && /^[a-zA-ZáéíóúüñÁÉÍÓÚÜÑ\s]+$/.test(name);
}

export function validateSupplierName(supplier: string): boolean {
  return supplier.trim().length >= 2;
}

// /app/lib/utils/error-helpers.ts
// Error handling utilities

export interface AppError {
  code: string;
  message: string;
  details?: any;
}

export function createAppError(code: string, message: string, details?: any): AppError {
  return { code, message, details };
}

export function getFirebaseErrorMessage(error: any): string {
  if (typeof error === 'string') return error;
  
  const errorCode = error?.code;
  const errorMessage = error?.message;
  
  // Firebase-specific error messages
  switch (errorCode) {
    case 'auth/network-request-failed':
      return 'Error de conexión. Verifique su internet.';
    case 'auth/too-many-requests':
      return 'Demasiados intentos. Intente más tarde.';
    case 'firestore/permission-denied':
      return 'Sin permisos para realizar esta operación.';
    case 'firestore/unavailable':
      return 'Servicio temporalmente no disponible.';
    case 'firestore/deadline-exceeded':
      return 'Operación demorada. Intente nuevamente.';
    default:
      return errorMessage || 'Error desconocido';
  }
}

// /app/lib/utils/storage-helpers.ts
// Local storage utilities (for temporary data only)

export function setTemporaryData(key: string, data: any, expirationMinutes = 60): void {
  const item = {
    data,
    expiration: Date.now() + (expirationMinutes * 60 * 1000)
  };
  
  try {
    localStorage.setItem(key, JSON.stringify(item));
  } catch (error) {
    console.warn('Failed to save to localStorage:', error);
  }
}

export function getTemporaryData<T>(key: string): T | null {
  try {
    const itemStr = localStorage.getItem(key);
    if (!itemStr) return null;
    
    const item = JSON.parse(itemStr);
    if (Date.now() > item.expiration) {
      localStorage.removeItem(key);
      return null;
    }
    
    return item.data;
  } catch (error) {
    console.warn('Failed to read from localStorage:', error);
    return null;
  }
}

export function clearTemporaryData(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch (error) {
    console.warn('Failed to clear localStorage:', error);
  }
}

// /app/hooks/use-online-status.ts
// Hook to detect online/offline status

"use client";

import { useEffect, useState } from 'react';

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(true);
  
  useEffect(() => {
    function handleOnline() {
      setIsOnline(true);
    }
    
    function handleOffline() {
      setIsOnline(false);
    }
    
    // Set initial state
    setIsOnline(navigator.onLine);
    
    // Add event listeners
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);
  
  return isOnline;
}
