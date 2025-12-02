import jsPDF from 'jspdf';
import html2canvas from 'html2canvas-pro';

// Helper function to check if movement matches "Taller" filter
// Includes both "Taller" and "Particular" order types
const isTallerOrParticular = (orderType) => {
  return orderType === 'Taller' || orderType === 'Particular';
};

/**
 * Generates a PDF report for inventory movements grouped by equipment/mobile unit (cost centers)
 * Includes SALIDAS (exits) with orderType === "Taller" OR orderType === "Particular"
 * @param {Array} movements - Array of movement objects with material info
 * @param {string} startDate - Start date in DD-MM-YYYY format
 * @param {string} endDate - End date in DD-MM-YYYY format
 */
export const generateINV01ActualPdf = async (movements, startDate, endDate) => {
  if (!movements || movements.length === 0) {
    throw new Error('No hay datos para generar el PDF');
  }

  try {
    // Format dates for display
    const formatDateDisplay = (dateStr) => dateStr.split('-').reverse().join('/');
    const displayStartDate = formatDateDisplay(startDate);
    const displayEndDate = formatDateDisplay(endDate);

    // Format timestamp for display
    const formatDate = (timestamp) => {
      const date = timestamp.toDate();
      return date.toLocaleDateString('es-PY', {
        timeZone: 'America/Asuncion',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      });
    };

    // Filter only SALIDAS (exits) with orderType === "Taller" OR "Particular"
    const salidas = movements.filter(m => 
      m.qty < 0 && 
      isTallerOrParticular(m.orderType)
    );

    if (salidas.length === 0) {
      throw new Error('No hay salidas de tipo "Taller" o "Particular" en el período seleccionado');
    }

    // Group by equipment/mobile unit
    const groupedByEquipment = {};
    salidas.forEach(movement => {
      const equipmentKey = movement.equipmentOrUnit || 'SIN ASIGNAR';
      if (!groupedByEquipment[equipmentKey]) {
        groupedByEquipment[equipmentKey] = [];
      }
      groupedByEquipment[equipmentKey].push(movement);
    });

    // Sort equipment keys alphabetically
    const equipmentKeys = Object.keys(groupedByEquipment).sort();

    // Helper function to generate header
    const generateHeader = () => `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; border-bottom: 2px solid #000; padding-bottom: 10px;">
        <div style="width: 80px; height: 40px; display: flex; align-items: center;">
          <img 
            src="/logoConcretos.png"  
            alt="GS CONCRETOS Logo" 
            style="max-width: 120px; max-height: 60px; width: auto; height: auto; object-fit: contain;"
          />
        </div>
        <div style="text-align: center; flex: 1;">
          <h1 style="margin: 0; font-size: 16px; font-weight: bold; color: #000;">REPORTE DE MOVIMIENTOS DE INVENTARIO - TALLER</h1>
          <p style="margin: 5px 0 0 0; font-size: 11px; color: #000;">Período: ${displayStartDate} - ${displayEndDate}</p>
          <p style="margin: 2px 0 0 0; font-size: 10px; color: #666;">Incluye: Órdenes de Taller y Salidas Particulares</p>
        </div>
        <div style="text-align: right; font-size: 10px; width: 80px; color: #000;">
          <div>FL-TAL-99 R</div>
          <div>Rev. 00</div>
        </div>
      </div>
    `;

    // Helper function to generate table header
    // UPDATED: Adjusted widths for 10px font
    const generateTableHeader = () => `
      <thead>
        <tr style="background-color: #ffffff;">
          <th style="border: 1px solid #000; padding: 6px; text-align: center; width: 220px; color: #000;">DESCRIPCIÓN</th>
          <th style="border: 1px solid #000; padding: 6px; text-align: center; width: 60px; color: #000;">CANTIDAD</th>
          <th style="border: 1px solid #000; padding: 6px; text-align: center; width: 70px; color: #000;">UNIDAD<br/>MEDIDA</th>
          <th style="border: 1px solid #000; padding: 6px; text-align: center; width: 90px; color: #000;">UBICACIÓN</th>
        </tr>
      </thead>
    `;

    // Helper function to generate table rows
    // UPDATED: Font size increased to 10px (9px for description to fit better)
    const generateTableRows = (movementsList) => {
      return movementsList.map(movement => {
        return `
          <tr style="background-color: #ffffff;">
            <td style="border: 1px solid #000; padding: 5px; font-size: 9px; color: #000;">${movement.materialDescription || '-'}</td>
            <td style="border: 1px solid #000; padding: 5px; text-align: right; font-size: 10px; font-weight: bold; color: #000;">${movement.qty}</td>
            <td style="border: 1px solid #000; padding: 5px; text-align: center; font-size: 10px; color: #000;">${movement.unidadDeMedida || '-'}</td>
            <td style="border: 1px solid #000; padding: 5px; text-align: center; font-size: 9px; color: #000;">${movement.storageLocation}</td>
          </tr>
        `;
      }).join('');
    };

    // Helper function to generate equipment section title
    const generateEquipmentTitle = (equipmentName, totalQty) => `
      <div style="margin-bottom: 4px; padding: 2px;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <h2 style="font-size: 13px; font-weight: bold;">${equipmentName}</h2>
        </div>
      </div>
    `;

    // Helper function to generate equipment table
    // UPDATED: Base font size 10px
    const generateEquipmentTable = (equipmentName, movementsList) => {
      const totalQty = Math.abs(movementsList.reduce((sum, m) => sum + m.qty, 0));
      
      return `
        ${generateEquipmentTitle(equipmentName, totalQty)}
        <table style="width: 100%; border-collapse: collapse; font-size: 10px; margin-bottom: 15px;">
          ${generateTableHeader()}
          <tbody>
            ${generateTableRows(movementsList)}
          </tbody>
        </table>
      `;
    };

    // Create PDF
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    let isFirstPage = true;
    let pageNumber = 1;

    // Helper function to estimate table height in pixels
    // UPDATED: Increased rowHeight estimation to account for larger font (25 -> 35)
    const estimateTableHeight = (numRows) => {
      const headerHeight = 90; // Title + header row (slightly taller)
      const rowHeight = 35; // Increased row height for 10px font
      const marginHeight = 30; // Bottom margin
      return headerHeight + (numRows * rowHeight) + marginHeight;
    };

    // Helper function to add content to PDF
    const addContentToPdf = async (htmlContent, pageNum, totalPages) => {
      const tempDiv = document.createElement('div');
      tempDiv.style.position = 'absolute';
      tempDiv.style.left = '-9999px';
      tempDiv.style.top = '0';
      tempDiv.style.width = '800px';
      tempDiv.style.backgroundColor = '#ffffff';
      tempDiv.style.padding = '20px';
      tempDiv.style.fontFamily = 'Arial, sans-serif';
      
      // ZOOM FIX: Force consistent rendering regardless of browser zoom
      tempDiv.style.zoom = '1.0';
      tempDiv.style.transform = 'scale(1)';
      tempDiv.style.transformOrigin = 'top left';
      tempDiv.style.webkitFontSmoothing = 'antialiased';
      tempDiv.style.mozOsxFontSmoothing = 'grayscale';

      const fullContent = `
        <div style="
          width: 100%; 
          max-width: 760px;
          zoom: 1.0;
          transform: scale(1);
          transform-origin: top left;
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
        ">
          ${generateHeader()}
          ${htmlContent}
          <div style="margin-top: 40px; font-size: 9px; color: #000; display: flex; justify-content: space-between;">
            <div>Generado el: ${new Date().toLocaleString('es-ES')} / Encargado de control de inventario: Marco Meza</div>
            <div>Página ${pageNum} de ${totalPages}</div>
          </div>
        </div>
      `;

      tempDiv.innerHTML = fullContent;
      document.body.appendChild(tempDiv);

      // ZOOM FIX: Calculate scale based on devicePixelRatio for consistency
      const targetScale = 2;
      const normalizedScale = targetScale / window.devicePixelRatio;

      const canvas = await html2canvas(tempDiv, {
        scale: normalizedScale,
        useCORS: true,
        allowTaint: false,
        backgroundColor: '#ffffff',
        width: 800,
        height: tempDiv.scrollHeight,
        logging: false,
        windowWidth: 800,
        windowHeight: tempDiv.scrollHeight,
        x: 0,
        y: 0,
        scrollX: 0,
        scrollY: 0,
        foreignObjectRendering: false
      });

      document.body.removeChild(tempDiv);

      if (!isFirstPage) {
        pdf.addPage();
      }
      isFirstPage = false;

      const imgData = canvas.toDataURL('image/jpeg', 0.70);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      
      const imgWidth = pdfWidth;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      if (imgHeight <= pdfHeight) {
        pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
      } else {
        const scale = pdfHeight / imgHeight;
        const scaledWidth = imgWidth * scale;
        const scaledHeight = pdfHeight;
        const xOffset = (pdfWidth - scaledWidth) / 2;
        
        pdf.addImage(imgData, 'PNG', xOffset, 0, scaledWidth, scaledHeight);
      }
    };

    // Smart pagination: group tables that fit on same page
    const MAX_PAGE_HEIGHT = 1000; // Approximate pixels available per page
    let currentPageContent = '';
    let currentPageHeight = 0;
    let totalPagesEstimate = equipmentKeys.length; // Conservative estimate

    for (let i = 0; i < equipmentKeys.length; i++) {
      const equipmentName = equipmentKeys[i];
      const movementsList = groupedByEquipment[equipmentName];
      const tableHeight = estimateTableHeight(movementsList.length);
      const tableHtml = generateEquipmentTable(equipmentName, movementsList);

      // Check if table fits on current page
      if (currentPageHeight + tableHeight > MAX_PAGE_HEIGHT && currentPageContent !== '') {
        // Current page is full, render it
        await addContentToPdf(currentPageContent, pageNumber, totalPagesEstimate);
        pageNumber++;
        
        // Start new page with current table
        currentPageContent = tableHtml;
        currentPageHeight = tableHeight;
      } else {
        // Add table to current page
        currentPageContent += tableHtml;
        currentPageHeight += tableHeight;
      }

      // If this is the last table, render the page
      if (i === equipmentKeys.length - 1) {
        await addContentToPdf(currentPageContent, pageNumber, pageNumber);
      }
    }

    const filename = `Reporte_Taller_${displayStartDate.replace(/\//g, '-')}_${displayEndDate.replace(/\//g, '-')}.pdf`;
    pdf.save(filename);
    
    return true;
  } catch (error) {
    console.error('Error generating INV01 Actual PDF:', error);
    throw error;
  }
};