"use client";

import React, { useEffect, useState } from "react";
import { X, FileText, Wrench } from "lucide-react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../../../lib/firebase/client";

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

type WorkOrder = {
  orderId: string;
  orderType: 'General' | 'Taller';
  state: boolean;
  stateSig: boolean;
  createdAt: any;
  [key: string]: any;
};

type MaterialData = {
  codigo: string;
  descripcion: string;
};

// ============================================================================
// SVG SIGNATURE DISPLAY COMPONENT
// ============================================================================

const SignatureDisplay = ({ svgString }: { svgString: string }) => {
  if (!svgString) return null;

  try {
    const parser = new DOMParser();
    const svgDoc = parser.parseFromString(svgString, "image/svg+xml");
    const svgElement = svgDoc.querySelector("svg");

    if (!svgElement) {
      console.error("Failed to parse SVG string");
      return (
        <div className="border rounded-lg p-4 bg-gray-50 max-w-md">
          <span className="text-gray-500 text-sm italic">Firma no disponible</span>
        </div>
      );
    }

    const originalWidth = svgElement.getAttribute("width") || "600";
    const originalHeight = svgElement.getAttribute("height") || "600";

    svgElement.removeAttribute("width");
    svgElement.removeAttribute("height");
    svgElement.removeAttribute("style");

    if (!svgElement.getAttribute("viewBox")) {
      svgElement.setAttribute("viewBox", `0 0 ${originalWidth} ${originalHeight}`);
    }

    svgElement.setAttribute("width", "100%");
    svgElement.setAttribute("height", "auto");
    svgElement.setAttribute("style", "max-width: 400px; max-height: 150px;");
    svgElement.setAttribute("preserveAspectRatio", "xMidYMid meet");

    const modifiedSvgString = svgElement.outerHTML;

    return (
      <div className="border rounded-lg p-4 bg-gray-50 flex items-center justify-center" style={{ minHeight: '150px' }}>
        <div
          dangerouslySetInnerHTML={{ __html: modifiedSvgString }}
          className="w-full flex items-center justify-center"
        />
      </div>
    );
  } catch (error) {
    console.error("Error processing signature SVG:", error);
    return (
      <div className="border rounded-lg p-4 bg-gray-50 max-w-md">
        <span className="text-gray-500 text-sm italic">Error al mostrar firma</span>
      </div>
    );
  }
};

// ============================================================================
// MATERIALS LIST COMPONENT
// ============================================================================

const MaterialsList = ({ componentsUsed }: { componentsUsed: { [key: string]: number } }) => {
  const [materials, setMaterials] = useState<{ [key: string]: MaterialData }>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadMaterials = async () => {
      try {
        const materialCodes = Object.keys(componentsUsed);
        const materialsData: { [key: string]: MaterialData } = {};

        const materialsSnapshot = await getDocs(collection(db, "CMAT01"));
        materialsSnapshot.forEach((doc) => {
          if (doc.id !== 'default' && materialCodes.includes(doc.id)) {
            const data = doc.data();
            materialsData[doc.id] = {
              codigo: data.codigo || doc.id,
              descripcion: data.descripcion || 'Sin descripción'
            };
          }
        });

        setMaterials(materialsData);
      } catch (error) {
        console.error("Error loading materials:", error);
      } finally {
        setLoading(false);
      }
    };

    loadMaterials();
  }, [componentsUsed]);

  if (loading) {
    return <div className="text-sm text-gray-500">Cargando materiales...</div>;
  }

  return (
    <div className="space-y-2">
      {Object.entries(componentsUsed).map(([isoCode, qty]) => {
        const material = materials[isoCode];
        return (
          <div
            key={isoCode}
            className="flex items-center justify-between p-3 bg-gray-50 rounded-lg text-sm"
          >
            <div className="flex-1">
              <div className="font-medium text-gray-900">
                {material?.codigo || isoCode}
              </div>
              <div className="text-xs text-gray-600">
                {material?.descripcion || 'Material no encontrado'}
              </div>
            </div>
            <span className="text-gray-600 ml-4">Cantidad: {qty as number}</span>
          </div>
        );
      })}
    </div>
  );
};

// ============================================================================
// MAIN MODAL COMPONENT
// ============================================================================

export default function OrderModal({
  order,
  onClose
}: {
  order: WorkOrder;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            {order.orderType === 'General' ? (
              <FileText className="text-blue-600" size={24} />
            ) : (
              <Wrench className="text-blue-600" size={24} />
            )}
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                Orden {order.orderType}
              </h2>
              <p className="text-sm text-gray-600 mt-1">N° {order.orderId}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {order.orderType === 'General' ? (
            <GeneralOrderDetails order={order} />
          ) : (
            <TallerOrderDetails order={order} />
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// GENERAL ORDER DETAILS
// ============================================================================

function GeneralOrderDetails({ order }: { order: WorkOrder }) {
  return (
    <div className="space-y-6">
      {/* Basic Info */}
      <div className="bg-gray-50 p-4 rounded-lg space-y-3">
        <h3 className="font-semibold text-gray-900 mb-3">Información General</h3>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-600">Tipo:</span>
            <span className="ml-2 font-medium">{order.type}</span>
          </div>
          <div>
            <span className="text-gray-600">Equipo:</span>
            <span className="ml-2 font-medium">{order.equipment}</span>
          </div>
          <div>
            <span className="text-gray-600">Fecha Emisión:</span>
            <span className="ml-2 font-medium">{order.issueDate}</span>
          </div>
          <div>
            <span className="text-gray-600">Fecha Ejecución:</span>
            <span className="ml-2 font-medium">{order.executionDate}</span>
          </div>
        </div>
      </div>

      {/* Technicians */}
      {order.assignedTechnicians && order.assignedTechnicians.length > 0 && (
        <div>
          <h3 className="font-semibold text-gray-900 mb-2">Técnicos Asignados</h3>
          <div className="flex flex-wrap gap-2">
            {order.assignedTechnicians.map((tech: string, index: number) => (
              <span
                key={index}
                className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm"
              >
                {tech}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Description */}
      {order.description && (
        <div>
          <h3 className="font-semibold text-gray-900 mb-2">Descripción</h3>
          <p className="text-gray-700 text-sm whitespace-pre-wrap">{order.description}</p>
        </div>
      )}

      {/* Work Performed */}
      {order.workPerformed && (
        <div>
          <h3 className="font-semibold text-gray-900 mb-2">Trabajo Realizado</h3>
          <p className="text-gray-700 text-sm whitespace-pre-wrap">{order.workPerformed}</p>
        </div>
      )}

      {/* Verified By */}
      {order.verifiedBy && (
        <div>
          <h3 className="font-semibold text-gray-900 mb-2">Verificado Por</h3>
          <p className="text-gray-700 text-sm">{order.verifiedBy}</p>
        </div>
      )}

      {/* Components Used */}
      {order.componentsUsed && Object.keys(order.componentsUsed).length > 0 && (
        <div>
          <h3 className="font-semibold text-gray-900 mb-2">Materiales Utilizados</h3>
          <MaterialsList componentsUsed={order.componentsUsed} />
        </div>
      )}

    </div>
  );
}

// ============================================================================
// TALLER ORDER DETAILS
// ============================================================================

function TallerOrderDetails({ order }: { order: WorkOrder }) {
  return (
    <div className="space-y-6">
      {/* Basic Info */}
      <div className="bg-gray-50 p-4 rounded-lg space-y-3">
        <h3 className="font-semibold text-gray-900 mb-3">Información del Vehículo</h3>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-600">Tipo:</span>
            <span className="ml-2 font-medium capitalize">{order.vehicleType}</span>
          </div>
          <div>
            <span className="text-gray-600">Unidad Móvil:</span>
            <span className="ml-2 font-medium">{order.mobileUnit}</span>
          </div>
          <div>
            <span className="text-gray-600">Conductor:</span>
            <span className="ml-2 font-medium">{order.driver}</span>
          </div>
          <div>
            <span className="text-gray-600">Kilometraje:</span>
            <span className="ml-2 font-medium">{order.mileage} km</span>
          </div>
          <div>
            <span className="text-gray-600">Horómetro:</span>
            <span className="ml-2 font-medium">{order.hourmeter} hrs</span>
          </div>
          <div>
            <span className="text-gray-600">Fecha Ejecución:</span>
            <span className="ml-2 font-medium">{order.executionDate}</span>
          </div>
        </div>
      </div>

      {/* Description */}
      {order.description && (
        <div>
          <h3 className="font-semibold text-gray-900 mb-2">Descripción</h3>
          <p className="text-gray-700 text-sm whitespace-pre-wrap">{order.description}</p>
        </div>
      )}

      {/* Observations */}
      {order.observations && (
        <div>
          <h3 className="font-semibold text-gray-900 mb-2">Observaciones</h3>
          <p className="text-gray-700 text-sm whitespace-pre-wrap">{order.observations}</p>
        </div>
      )}

      {/* Verified By */}
      {order.verifiedBy && (
        <div>
          <h3 className="font-semibold text-gray-900 mb-2">Verificado Por</h3>
          <p className="text-gray-700 text-sm">{order.verifiedBy}</p>
        </div>
      )}

      {/* Components Used */}
      {order.componentsUsed && Object.keys(order.componentsUsed).length > 0 && (
        <div>
          <h3 className="font-semibold text-gray-900 mb-2">Materiales Utilizados</h3>
          <MaterialsList componentsUsed={order.componentsUsed} />
        </div>
      )}

      {/* Signature */}
      {order.signatureConformity && (
        <div>
          <h3 className="font-semibold text-gray-900 mb-2">Firma de Conformidad</h3>
          <SignatureDisplay svgString={order.signatureConformity} />
        </div>
      )}


    </div>
  );
}