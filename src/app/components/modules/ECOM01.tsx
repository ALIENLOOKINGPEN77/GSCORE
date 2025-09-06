// /app/components/modules/ECOM01.tsx
// ECOM01 – Entrada de Combustible
// Enhanced fuel entry module with improved UX and validation

"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Calendar, Truck, User, FileText, Fuel, Clock, AlertCircle, CheckCircle, ArrowRight, Minus } from "lucide-react";

// Form data type with clear field definitions
type FuelEntry = {
  fecha: string;
  proveedorExterno: string;
  nroChapa: string;
  chofer: string;
  factura: string;
  cantidadFacturadaLts: string;
  horaDescarga: string;
  cantidadRecepcionadaLts: string;
};

// Validation result type
type ValidationResult = {
  isValid: boolean;
  errors: Partial<Record<keyof FuelEntry, string>>;
};

// **IMPROVEMENT**: We can still use the config, but we will render it within our new layout sections.
const FORM_FIELDS_CONFIG = {
  fecha: { label: 'Fecha', placeholder: 'dd/mm/aaaa', icon: Calendar, type: 'date', required: true },
  proveedorExterno: { label: 'Proveedor Externo', placeholder: 'Nombre del proveedor', icon: Truck, type: 'text', required: true },
  nroChapa: { label: 'Nro. Chapa', placeholder: 'ABC123', icon: FileText, type: 'text', required: true },
  chofer: { label: 'Chofer', placeholder: 'Nombre del chofer', icon: User, type: 'text', required: true },
  factura: { label: 'Factura', placeholder: 'Nº de factura', icon: FileText, type: 'text', required: true },
  cantidadFacturadaLts: { label: 'Cantidad Facturada (Lts)', placeholder: '0.00', icon: Fuel, type: 'number', required: true },
  horaDescarga: { label: 'Hora de Descarga', placeholder: 'HH:MM', icon: Clock, type: 'time', required: true },
  cantidadRecepcionadaLts: { label: 'Cantidad Recepcionada (Lts)', placeholder: '0.00', icon: Fuel, type: 'number', required: true },
};

// **NEW**: A reusable FormField component to keep the main return statement clean.
const FormField = ({ id, label, icon: Icon, error, ...props }: any) => (
  <div className="flex flex-col">
    <label htmlFor={id} className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
      <Icon size={16} className="text-gray-400" />
      {label}
      {props.required && <span className="text-red-500">*</span>}
    </label>
    <input
      id={id}
      className={`px-3 py-2 border rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${
        error ? 'border-red-300 bg-red-50 focus:border-red-400' : 'border-gray-300 focus:border-blue-400'
      }`}
      {...props}
    />
    {error && (
      <div className="mt-1 flex items-center gap-1 text-red-600 text-xs">
        <AlertCircle size={12} />
        <span>{error}</span>
      </div>
    )}
  </div>
);

export default function ECOM01Module() {
  const initialForm: FuelEntry = useMemo(() => ({
    fecha: '',
    proveedorExterno: '',
    nroChapa: '',
    chofer: '',
    factura: '',
    cantidadFacturadaLts: '',
    horaDescarga: '',
    cantidadRecepcionadaLts: ''
  }), []);

  const [form, setForm] = useState<FuelEntry>(initialForm);
  const [loading, setLoading] = useState(false);
  const [validation, setValidation] = useState<ValidationResult>({ isValid: true, errors: {} });
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    console.log("[ECOM01] Module mounted – Entrada de Combustible");
  }, []);

  // Validation logic (updated for better date/time handling if native inputs are used)
  const validateForm = useCallback((data: FuelEntry): ValidationResult => {
    const errors: Partial<Record<keyof FuelEntry, string>> = {};
    if (!data.fecha) errors.fecha = 'La fecha es requerida';
    if (!data.proveedorExterno.trim()) errors.proveedorExterno = 'El proveedor es requerido';
    if (!data.nroChapa.trim()) errors.nroChapa = 'El número de chapa es requerido';
    if (!data.chofer.trim()) errors.chofer = 'El nombre del chofer es requerido';
    if (!data.factura.trim()) errors.factura = 'El número de factura es requerido';
    if (!data.horaDescarga) errors.horaDescarga = 'La hora de descarga es requerida';

    if (!data.cantidadFacturadaLts) errors.cantidadFacturadaLts = 'La cantidad facturada es requerida';
    else if (isNaN(Number(data.cantidadFacturadaLts)) || Number(data.cantidadFacturadaLts) <= 0) errors.cantidadFacturadaLts = 'Debe ser un número mayor a 0';

    if (!data.cantidadRecepcionadaLts) errors.cantidadRecepcionadaLts = 'La cantidad recepcionada es requerida';
    else if (isNaN(Number(data.cantidadRecepcionadaLts)) || Number(data.cantidadRecepcionadaLts) <= 0) errors.cantidadRecepcionadaLts = 'Debe ser un número mayor a 0';
    
    return { isValid: Object.keys(errors).length === 0, errors };
  }, []);

  const updateField = useCallback((key: keyof FuelEntry) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const newForm = { ...form, [key]: e.target.value };
    setForm(newForm);
    if (validation.errors[key]) {
      setValidation(prev => ({ ...prev, errors: { ...prev.errors, [key]: undefined } }));
    }
  }, [form, validation.errors]);
  
  const quantityDifference = useMemo(() => {
    const facturada = Number(form.cantidadFacturadaLts) || 0;
    const recepcionada = Number(form.cantidadRecepcionadaLts) || 0;
    return facturada - recepcionada;
  }, [form.cantidadFacturadaLts, form.cantidadRecepcionadaLts]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    const validationResult = validateForm(form);
    setValidation(validationResult);
    if (!validationResult.isValid) return;
    
    setLoading(true);
    try {
      console.log("[ECOM01] Submitting fuel entry:", form);
      await new Promise(resolve => setTimeout(resolve, 1500));
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
      setForm(initialForm);
      setValidation({ isValid: true, errors: {} });
    } catch (error) {
      console.error("[ECOM01] Failed to save fuel entry:", error);
    } finally {
      setLoading(false);
    }
  }, [form, validateForm, initialForm]);

  const handleReset = useCallback(() => {
    setForm(initialForm);
    setValidation({ isValid: true, errors: {} });
    setShowSuccess(false);
  }, [initialForm]);
  
  // **NEW**: Helper to render a field using the new component
  const renderField = (key: keyof FuelEntry) => {
    const config = FORM_FIELDS_CONFIG[key];
    return (
      <FormField
        id={key}
        key={key}
        {...config}
        value={form[key]}
        onChange={updateField(key)}
        error={validation.errors[key]}
        disabled={loading}
      />
    );
  };

  return (
    <section className="h-full w-full p-6 bg-gray-50">
      {showSuccess && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2 text-green-800 animate-fade-in">
          <CheckCircle size={20} />
          <span>Entrada de combustible registrada exitosamente</span>
        </div>
      )}

      <header className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-blue-100 rounded-lg">
            <Fuel className="text-blue-600" size={24} />
          </div>
          <h1 className="text-2xl font-semibold text-gray-900">
            ECOM01 – Entrada de Combustible
          </h1>
        </div>
        <p className="text-gray-600">
          Registre los datos de la entrada de combustible.
        </p>
      </header>

      <form
        onSubmit={handleSubmit}
        className="bg-white border rounded-lg p-8 shadow-sm max-w-6xl space-y-8"
        noValidate
      >
        {/* **IMPROVEMENT: Main info in a two-column layout** */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
          
          {/* **Section 1: Delivery Information** */}
          <div className="space-y-6">
            <h2 className="text-lg font-semibold text-gray-800 border-b pb-2">Información de la Entrega</h2>
            {renderField('proveedorExterno')}
            {renderField('nroChapa')}
            {renderField('chofer')}
          </div>
          
          {/* **Section 2: Document Information** */}
          <div className="space-y-6">
            <h2 className="text-lg font-semibold text-gray-800 border-b pb-2">Datos del Documento</h2>
            {renderField('factura')}
            {renderField('fecha')}
            {renderField('horaDescarga')}
          </div>
        </div>

        {/* **IMPROVEMENT: Dedicated section for quantities** */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-800 border-b pb-2">Cantidades de Combustible</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 items-end gap-6 bg-gray-50 p-6 rounded-lg">
            
            {renderField('cantidadFacturadaLts')}
            
            {renderField('cantidadRecepcionadaLts')}

            {/* **IMPROVEMENT: Contextual difference display** */}
            <div className="flex flex-col">
              <label className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                <Minus size={16} className="text-gray-400" />
                Diferencia
              </label>
              <div className="h-10 px-3 py-2 border border-gray-200 bg-white rounded-md flex items-center">
                <span className={`font-bold text-lg ${quantityDifference > 0 ? 'text-orange-600' : quantityDifference < 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {quantityDifference.toFixed(2)} Lts
                </span>
                {quantityDifference !== 0 && (
                  <span className="ml-2 text-xs text-gray-500 font-medium">
                    ({quantityDifference > 0 ? 'Faltante' : 'Sobrante'})
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Form Actions */}
        <div className="flex gap-64 pt-6 border-t border-gray-200">
          <button
            type="submit"
            disabled={loading}
            className="bg-blue-600 text-white px-6 py-2.5 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-medium flex items-center gap-2"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Guardando...
              </>
            ) : (
              <>
                <CheckCircle size={16} />
                Guardar Entrada
              </>
            )}
          </button>
          
          <button
            type="button"
            onClick={handleReset}
            disabled={loading}
            className="bg-gray-100 text-gray-700 px-6 py-2.5 rounded-md hover:bg-gray-200 disabled:opacity-50 transition-colors font-medium"
          >
            Limpiar Formulario
          </button>
        </div>
      </form>
      
      {/* START: CSS to remove number input spinners */}
      <style jsx global>{`
        /* Hide spin buttons on number inputs for a cleaner UI */
        
        /* Chrome, Safari, Edge, Opera */
        input[type=number]::-webkit-outer-spin-button,
        input[type=number]::-webkit-inner-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }

        /* Firefox */
        input[type=number] {
          -moz-appearance: textfield;
        }
      `}</style>
      {/* END: CSS to remove number input spinners */}

    </section>
  );
}