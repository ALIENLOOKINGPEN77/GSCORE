// /app/components/signature-pad.tsx
// Touch-friendly signature pad that outputs raw SVG data

"use client";

import React, { useRef, useState, useCallback, useEffect } from 'react';
import { Trash2, Check, Edit3 } from 'lucide-react';
import type { SignatureData } from '../../../lib/firebase/ecom01';

type Point = { x: number; y: number };
type Stroke = Point[];

interface SignaturePadProps {
  onSave: (signature: SignatureData) => void;
  disabled?: boolean;
  className?: string;
}

export default function SignaturePad({ onSave, disabled = false, className = '' }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [currentStroke, setCurrentStroke] = useState<Point[]>([]);

  const canvasWidth = 600;
  const canvasHeight = 600;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set up canvas styling
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Clear canvas
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);

    // Redraw all strokes
    strokes.forEach(stroke => {
      if (stroke.length < 2) return;

      ctx.beginPath();
      ctx.moveTo(stroke[0].x, stroke[0].y);
      stroke.slice(1).forEach(point => {
        ctx.lineTo(point.x, point.y);
      });
      ctx.stroke();
    });
  }, [strokes]);

  const getEventPoint = useCallback((e: React.MouseEvent | React.TouchEvent): Point => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvasWidth / rect.width;
    const scaleY = canvasHeight / rect.height;

    if ('touches' in e) {
      // Touch event
      const touch = e.touches[0] || e.changedTouches[0];
      return {
        x: (touch.clientX - rect.left) * scaleX,
        y: (touch.clientY - rect.top) * scaleY
      };
    } else {
      // Mouse event
      return {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY
      };
    }
  }, [canvasWidth, canvasHeight]);

  const handleStart = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (disabled) return;

    e.preventDefault();
    setIsDrawing(true);
    const point = getEventPoint(e);
    setCurrentStroke([point]);
  }, [disabled, getEventPoint]);

  const handleMove = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing || disabled) return;

    e.preventDefault();
    const point = getEventPoint(e);
    setCurrentStroke(prev => [...prev, point]);

    // Draw current stroke in real-time
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx || currentStroke.length === 0) return;

    ctx.beginPath();
    ctx.moveTo(currentStroke[currentStroke.length - 1].x, currentStroke[currentStroke.length - 1].y);
    ctx.lineTo(point.x, point.y);
    ctx.stroke();
  }, [isDrawing, disabled, getEventPoint, currentStroke]);

  const handleEnd = useCallback(() => {
    if (!isDrawing || disabled) return;

    setIsDrawing(false);
    if (currentStroke.length > 1) {
      setStrokes(prev => [...prev, currentStroke]);
    }
    setCurrentStroke([]);
  }, [isDrawing, disabled, currentStroke]);

  const handleClear = useCallback(() => {
    if (disabled) return;
    setStrokes([]);
    setCurrentStroke([]);
  }, [disabled]);

  const convertToSVGPaths = useCallback((): SignatureData['paths'] => {
    return strokes.map(stroke => {
      if (stroke.length < 2) return { d: '', strokeWidth: 2 };

      let d = `M ${stroke[0].x} ${stroke[0].y}`;
      for (let i = 1; i < stroke.length; i++) {
        d += ` L ${stroke[i].x} ${stroke[i].y}`;
      }

      return { d, strokeWidth: 2 };
    }).filter(path => path.d !== '');
  }, [strokes]);

  const handleSave = useCallback(() => {
    if (disabled || strokes.length === 0) return;

    const signatureData: SignatureData = {
      width: canvasWidth,
      height: canvasHeight,
      paths: convertToSVGPaths()
    };

    onSave(signatureData);
  }, [disabled, strokes.length, canvasWidth, canvasHeight, convertToSVGPaths, onSave]);

  const hasSignature = strokes.length > 0;

  return (
    <div className={`flex flex-col gap-4 ${className}`}>
      <div className="flex items-center gap-2 text-gray-700">
        <span className="font-medium">Firma Digital</span>
      </div>

      <div className="relative border-2 border-dashed border-gray-300 rounded-lg p-0.5 bg-white">
        <canvas
          ref={canvasRef}
          width={canvasWidth}
          height={canvasHeight}
          className={`w-full touch-none border border-gray-200 rounded-md ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-crosshair'
            }`}
          onMouseDown={handleStart}
          onMouseMove={handleMove}
          onMouseUp={handleEnd}
          onMouseLeave={handleEnd}
          onTouchStart={handleStart}
          onTouchMove={handleMove}
          onTouchEnd={handleEnd}
          style={{
            maxHeight: '200px',
            aspectRatio: `${canvasWidth}/${canvasHeight}`
          }}
        />

        {!hasSignature && !disabled && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span className="text-gray-400 text-sm">
              Firme aquí
            </span>
          </div>
        )}
      </div>

      <div className="flex gap-3">
        <button
          type="button"
          onClick={handleClear}
          disabled={disabled || !hasSignature}
          className="flex items-center gap-2 px-4 py-2 text-gray-600 bg-gray-100 rounded-md hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <Trash2 size={16} />
          Limpiar
        </button>

        <button
          type="button"
          onClick={handleSave}
          disabled={disabled || !hasSignature}
          className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium flex-1 justify-center"
        >
          <Check size={16} />
          Guardar Firma
        </button>
      </div>
    </div>
  );
}