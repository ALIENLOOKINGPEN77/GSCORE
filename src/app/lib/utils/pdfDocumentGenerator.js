// utils/pdfDocumentGenerator.js
import { renderSignatureSVG } from "../firebase/ecom01";

/**
 * Creates a clean, professional PDF document element for ECOM01 entries
 */
export function createPdfDocument(entry) {
  // Create the document container
  const doc = document.createElement('div');
  doc.style.cssText = `
    width: 210mm;
    min-height: 297mm;
    padding: 20mm;
    margin: 0;
    background: white;
    font-family: 'Arial', sans-serif;
    font-size: 12px;
    line-height: 1.4;
    color: #000;
    box-sizing: border-box;
  `;

  // Create document content
  doc.innerHTML = `
    <style>
      .pdf-document * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
      }
      .pdf-document {
        width: 100%;
        height: 100%;
      }
      .pdf-header {
        text-align: center;
        margin-bottom: 30px;
        padding-bottom: 15px;
        border-bottom: 2px solid #000;
      }
      .pdf-title {
        font-size: 18px;
        font-weight: bold;
        margin-bottom: 5px;
      }
      .pdf-subtitle {
        font-size: 14px;
        color: #666;
      }
      .pdf-section {
        margin-bottom: 25px;
      }
      .pdf-section-title {
        font-size: 14px;
        font-weight: bold;
        margin-bottom: 10px;
        padding-bottom: 5px;
        border-bottom: 1px solid #ccc;
      }
      .pdf-grid {
        display: flex;
        gap: 30px;
        margin-bottom: 20px;
      }
      .pdf-column {
        flex: 1;
      }
      .pdf-field {
        margin-bottom: 12px;
        display: flex;
        align-items: flex-start;
      }
      .pdf-field-label {
        font-weight: bold;
        min-width: 120px;
        margin-right: 10px;
      }
      .pdf-field-value {
        flex: 1;
      }
      .pdf-status {
        display: inline-block;
        padding: 4px 12px;
        background: #e8f5e8;
        color: #2d5016;
        border-radius: 4px;
        font-size: 11px;
        font-weight: bold;
        margin-bottom: 20px;
      }
      .pdf-fuel-section {
        background: #f8f9fa;
        padding: 20px;
        border-radius: 8px;
        margin: 20px 0;
      }
      .pdf-fuel-grid {
        display: flex;
        justify-content: space-around;
        gap: 20px;
        margin-top: 15px;
      }
      .pdf-fuel-item {
        text-align: center;
        flex: 1;
      }
      .pdf-fuel-value {
        font-size: 20px;
        font-weight: bold;
        margin-bottom: 5px;
      }
      .pdf-fuel-label {
        font-size: 10px;
        color: #666;
      }
      .pdf-fuel-facturado { color: #1976d2; }
      .pdf-fuel-recepcionado { color: #388e3c; }
      .pdf-fuel-diferencia-positiva { color: #f57c00; }
      .pdf-fuel-diferencia-negativa { color: #d32f2f; }
      .pdf-fuel-diferencia-cero { color: #388e3c; }
      .pdf-signature-container {
        margin-top: 30px;
        padding: 20px;
        border: 1px solid #ddd;
        border-radius: 4px;
        background: #fafafa;
      }
      .pdf-signature-title {
        font-weight: bold;
        margin-bottom: 10px;
      }
      .pdf-signature {
        width: 350px;
        height: 150px;
        border: 1px solid #ccc;
        border-radius: 4px;
        background: white;
        display: flex;
        align-items: center;
        justify-content: center;
        margin-top: 10px;
      }
      .pdf-signature svg {
        max-width: 350px;
        max-height: 150px;
      }
      .pdf-signature-fallback {
        color: #999;
        font-style: italic;
        font-size: 11px;
      }
    </style>
    
    <div class="pdf-document">
      <!-- Header -->
      <div class="pdf-header">
        <div class="pdf-title">DETALLE DE ENTRADA DE COMBUSTIBLE</div>
        <div class="pdf-subtitle">Documento ECOM01 - ${entry.id}</div>
      </div>
      

      <!-- Main Information -->
      <div class="pdf-section">
        <div class="pdf-section-title">INFORMACIÓN DE LA ENTREGA</div>
        <div class="pdf-grid">
          <div class="pdf-column">
            <div class="pdf-field">
              <span class="pdf-field-label">Fecha:</span>
              <span class="pdf-field-value">${entry.formattedDate}</span>
            </div>
            <div class="pdf-field">
              <span class="pdf-field-label">Proveedor:</span>
              <span class="pdf-field-value">${entry.proveedorExterno || '-'}</span>
            </div>
            <div class="pdf-field">
              <span class="pdf-field-label">Chapa:</span>
              <span class="pdf-field-value">${entry.nroChapa || '-'}</span>
            </div>
          </div>
          <div class="pdf-column">
            <div class="pdf-field">
              <span class="pdf-field-label">Chofer:</span>
              <span class="pdf-field-value">${entry.chofer || '-'}</span>
            </div>
            <div class="pdf-field">
              <span class="pdf-field-label">Factura:</span>
              <span class="pdf-field-value">${entry.factura || '-'}</span>
            </div>
            <div class="pdf-field">
              <span class="pdf-field-label">Hora de Descarga:</span>
              <span class="pdf-field-value">${entry.formattedTime || '-'}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Fuel Quantities -->
      <div class="pdf-section">
        <div class="pdf-section-title">CANTIDADES DE COMBUSTIBLE</div>
        <div class="pdf-fuel-section">
          <div class="pdf-fuel-grid">
            <div class="pdf-fuel-item">
              <div class="pdf-fuel-value pdf-fuel-facturado">
                ${parseFloat(entry.cantidadFacturadaLts || '0').toFixed(2)}
              </div>
              <div class="pdf-fuel-label">Litros Facturados</div>
            </div>
            <div class="pdf-fuel-item">
              <div class="pdf-fuel-value pdf-fuel-recepcionado">
                ${parseFloat(entry.cantidadRecepcionadaLts || '0').toFixed(2)}
              </div>
              <div class="pdf-fuel-label">Litros Recepcionados</div>
            </div>
          
          </div>
        </div>
      </div>

      <!-- Digital Signature -->
      ${entry.signature ? `
        <div class="pdf-section">
          <div class="pdf-section-title">FIRMA DIGITAL</div>
          <div class="pdf-signature-container">
            <div class="pdf-signature-title">Firma del Responsable:</div>
            <div class="pdf-signature" id="signature-container">
              <!-- Signature will be inserted here -->
            </div>
          </div>
        </div>
      ` : ''}
    </div>
  `;

  // Handle signature rendering
  if (entry.signature) {
    const signatureContainer = doc.querySelector('#signature-container');
    try {
      const svgString = renderSignatureSVG(entry.signature);
      if (svgString) {
        // Parse and optimize SVG
        const parser = new DOMParser();
        const svgDoc = parser.parseFromString(svgString, "image/svg+xml");
        const svgElement = svgDoc.querySelector("svg");
        
        if (svgElement) {
          // Set fixed dimensions for consistent PDF output
          svgElement.setAttribute('width', '350px');
          svgElement.setAttribute('height', '150px');
          svgElement.setAttribute('viewBox', `0 0 ${entry.signature.width || 300} ${entry.signature.height || 150}`);
          svgElement.setAttribute('preserveAspectRatio', 'xMidYMid meet');
          
          signatureContainer.innerHTML = svgElement.outerHTML;
        } else {
          throw new Error('Invalid SVG');
        }
      } else {
        throw new Error('No SVG generated');
      }
    } catch (error) {
      console.warn('Error rendering signature:', error);
      signatureContainer.innerHTML = '<div class="pdf-signature-fallback">Firma no disponible</div>';
    }
  }

  return doc;
}

/**
 * Generates PDF from a document element with A4 optimization
 */
export async function generatePdfFromDocument(documentElement, filename) {
  const { jsPDF } = await import("jspdf");
  const { default: html2canvas } = await import("html2canvas-pro");

  // Render the document to canvas with high quality
  const canvas = await html2canvas(documentElement, {
    backgroundColor: "#ffffff",
    scale: 2, // High quality
    useCORS: true,
    width: documentElement.scrollWidth,
    height: documentElement.scrollHeight,
    windowWidth: 1200, // Fixed width for consistency
  });

  // Create A4 PDF in portrait mode
  const pdf = new jsPDF({
    unit: "mm",
    format: "a4",
    orientation: "portrait",
    compress: true,
  });

  const pageWidth = 210; // A4 width in mm
  const pageHeight = 297; // A4 height in mm
  const margin = 10; // 10mm margins
  const contentWidth = pageWidth - (margin * 2);
  const contentHeight = pageHeight - (margin * 2);

  // Calculate scaling to fit content
  const imgWidthMM = canvas.width * 0.264583; // Convert px to mm (96 DPI)
  const imgHeightMM = canvas.height * 0.264583;
  
  let scale = Math.min(contentWidth / imgWidthMM, contentHeight / imgHeightMM);
  scale = Math.min(scale, 1); // Don't scale up

  const finalWidth = imgWidthMM * scale;
  const finalHeight = imgHeightMM * scale;

  // Center the content
  const xOffset = margin + (contentWidth - finalWidth) / 2;
  const yOffset = margin + (contentHeight - finalHeight) / 2;

  // Add image to PDF
  const imgData = canvas.toDataURL("image/jpeg", 0.95);
  pdf.addImage(imgData, "JPEG", xOffset, yOffset, finalWidth, finalHeight);

  // Save the PDF
  pdf.save(filename);
}

/**
 * Main function to generate PDF from entry data
 */
export async function generateEntryPdf(entry) {
  try {
    // Create the document element
    const documentElement = createPdfDocument(entry);
    
    // Temporarily add to DOM for rendering (hidden)
    documentElement.style.position = 'absolute';
    documentElement.style.left = '-9999px';
    documentElement.style.top = '0';
    document.body.appendChild(documentElement);
    
    // Generate filename
    const filename = `Detalle_ECOM01_${entry.id}.pdf`;
    
    // Generate PDF
    await generatePdfFromDocument(documentElement, filename);
    
    // Clean up
    document.body.removeChild(documentElement);
    
    return true;
  } catch (error) {
    console.error('Error generating PDF:', error);
    throw error;
  }
}