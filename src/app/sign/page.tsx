// /app/sign/page.tsx
// Phone signing route for anonymous signature capture

"use client";

import React, { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { signInAnonymously } from 'firebase/auth';
import { CheckCircle, AlertCircle, Smartphone, FileText } from 'lucide-react';
import { auth } from '../lib/firebase/client';
import { getEntryDocument, updateSignature, type ECOM01Document, type SignatureData } from '../lib/firebase/ecom01';
import SignaturePad from '../components/signature-pad';

type PageState = 'loading' | 'invalid' | 'ready' | 'saving' | 'success' | 'error';

function SigningPageContent() {
  const searchParams = useSearchParams();
  const [state, setState] = useState<PageState>('loading');
  const [document, setDocument] = useState<ECOM01Document | null>(null);
  const [error, setError] = useState<string>('');

  const docId = searchParams.get('doc');
  const token = searchParams.get('t');

  useEffect(() => {
    async function initializeAndValidate() {
      try {
        console.log('[SigningPage] Initializing anonymous auth...');
        
        // Sign in anonymously
        await signInAnonymously(auth);
        console.log('[SigningPage] Anonymous auth successful');

        // Validate parameters
        if (!docId || !token) {
          console.error('[SigningPage] Missing doc or token parameters');
          setState('invalid');
          setError('Enlace inválido: faltan parámetros requeridos');
          return;
        }

        // Get and validate document
        console.log('[SigningPage] Fetching document:', docId);
        const doc = await getEntryDocument(docId);
        
        if (!doc) {
          console.error('[SigningPage] Document not found:', docId);
          setState('invalid');
          setError('Documento no encontrado');
          return;
        }

        if (doc.status !== 'pending') {
          console.error('[SigningPage] Document not pending:', doc.status);
          setState('invalid');
          setError('Este enlace ya fue utilizado o ha expirado');
          return;
        }

        if (doc.signatureToken !== token) {
          console.error('[SigningPage] Token mismatch');
          setState('invalid');
          setError('Token de seguridad inválido');
          return;
        }

        console.log('[SigningPage] Validation successful');
        setDocument(doc);
        setState('ready');

      } catch (error) {
        console.error('[SigningPage] Initialization error:', error);
        setState('error');
        setError('Error al inicializar la página de firma');
      }
    }

    initializeAndValidate();
  }, [docId, token]);

  const handleSignatureSave = async (signature: SignatureData) => {
    if (!docId || state !== 'ready') return;

    setState('saving');
    try {
      console.log('[SigningPage] Saving signature...', signature);
      await updateSignature(docId, signature);
      console.log('[SigningPage] Signature saved successfully');
      setState('success');
    } catch (error) {
      console.error('[SigningPage] Error saving signature:', error);
      setState('error');
      setError('Error al guardar la firma');
    }
  };

  if (state === 'loading') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <h2 className="text-xl font-semibold text-gray-800 mb-2">Cargando...</h2>
          <p className="text-gray-600">Validando enlace de firma</p>
        </div>
      </div>
    );
  }

  if (state === 'invalid' || state === 'error') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
          <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-800 mb-2">
            {state === 'invalid' ? 'Enlace Inválido' : 'Error'}
          </h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <p className="text-sm text-gray-500">
            Por favor, solicite un nuevo enlace de firma desde el sistema.
          </p>
        </div>
      </div>
    );
  }

  if (state === 'success') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
          <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-800 mb-2">¡Firma Guardada!</h2>
          <p className="text-gray-600 mb-6">
            Su firma ha sido registrada exitosamente. Puede cerrar esta ventana.
          </p>
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <p className="text-green-800 text-sm font-medium">
              El documento será procesado automáticamente en el sistema principal.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-blue-100 rounded-lg">
              <FileText className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-gray-800">
                Firma de Documento
              </h1>
              <p className="text-gray-600">ECOM01 – Entrada de Combustible</p>
            </div>
          </div>
          
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start gap-2">
              <Smartphone className="h-5 w-5 text-blue-600 mt-0.5" />
              <div>
                <p className="text-blue-800 font-medium text-sm">Instrucciones</p>
                <p className="text-blue-700 text-sm">
                  Por favor firme en el área designada usando su dedo o un stylus. 
                  Su firma será asociada al documento correspondiente.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Signature Pad */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <SignaturePad
            onSave={handleSignatureSave}
            disabled={state === 'saving'}
            className="w-full"
          />
          
          {state === 'saving' && (
            <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center gap-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                <span className="text-blue-800 font-medium">Guardando firma...</span>
              </div>
            </div>
          )}
        </div>

        {/* Footer Info */}
        <div className="mt-6 text-center">
          <p className="text-xs text-gray-500">
            Esta página utiliza conexión segura y autenticación anónima.
            <br />
            Su firma será asociada únicamente al documento solicitado.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function SigningPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    }>
      <SigningPageContent />
    </Suspense>
  );
}