import jsPDF from 'jspdf';
import html2canvas from 'html2canvas-pro';

// Helper function to check if movement matches "Taller" filter
// Includes both "Taller" and "Particular" order types
const isTallerOrParticular = (orderType) => {
  return orderType === 'Taller' || orderType === 'Particular';
};

/**
 * Generates a filtered PDF grouped by cost centers (equipment/mobile units)
 * @param {Array} movements - Array of movement objects
 * @param {string} startDate - Start date in DD-MM-YYYY format
 * @param {string} endDate - End date in DD-MM-YYYY format
 * @param {boolean} includeEntradas - Include entries
 * @param {boolean} includeSalidas - Include exits
 * @param {boolean} soloTaller - Filter only "Taller" or "Particular" order types
 * @param {Array|null} materialCodes - Array of material codes to filter by
 * @param {string} filterMode - 'include' or 'exclude'
 */
export const generateINV01FiltradoCentrosPdf = async (
  movements, 
  startDate, 
  endDate,
  includeEntradas,
  includeSalidas,
  soloTaller,
  materialCodes = null,
  filterMode = 'include'
) => {
  if (!movements || movements.length === 0) {
    throw new Error('No hay datos para generar el PDF');
  }

  try {
    const formatDateDisplay = (dateStr) => dateStr.split('-').reverse().join('/');
    const displayStartDate = formatDateDisplay(startDate);
    const displayEndDate = formatDateDisplay(endDate);

    // Apply filters
    let filtered = movements;

    if (!includeEntradas) filtered = filtered.filter(m => m.qty < 0);
    if (!includeSalidas) filtered = filtered.filter(m => m.qty > 0);
    
    // Updated: Include both Taller and Particular
    if (soloTaller) filtered = filtered.filter(m => isTallerOrParticular(m.orderType));

    if (materialCodes && materialCodes.length > 0) {
      if (filterMode === 'include') {
        filtered = filtered.filter(m => m.materialCode && materialCodes.includes(m.materialCode));
      } else {
        filtered = filtered.filter(m => m.materialCode && !materialCodes.includes(m.materialCode));
      }
    }

    if (filtered.length === 0) {
      throw new Error('No hay movimientos que cumplan los criterios de filtrado');
    }

    // Build filter description
    const filterDescription = [];
    if (includeEntradas && !includeSalidas) {
      filterDescription.push('Solo Entradas');
    } else if (!includeEntradas && includeSalidas) {
      filterDescription.push('Solo Salidas');
    } else {
      filterDescription.push('Entradas y Salidas');
    }
    if (soloTaller) filterDescription.push('Solo Taller/Particular');
    if (materialCodes && materialCodes.length > 0) {
      filterDescription.push(`${materialCodes.length} material(es) ${filterMode === 'include' ? 'incluidos' : 'excluidos'}`);
    }
    const filterText = filterDescription.join(' - ');

    // Group by equipment (for exits) or by type (for entries)
    const groupedData = {};
    
    filtered.forEach(movement => {
      let groupKey;
      
      if (movement.qty < 0) {
        // Salidas: group by equipment
        groupKey = movement.equipmentOrUnit || 'SIN ASIGNAR';
      } else {
        // Entradas: single group
        groupKey = 'ENTRADAS';
      }
      
      if (!groupedData[groupKey]) {
        groupedData[groupKey] = [];
      }
      groupedData[groupKey].push(movement);
    });

    const groupKeys = Object.keys(groupedData).sort((a, b) => {
      if (a === 'ENTRADAS') return -1;
      if (b === 'ENTRADAS') return 1;
      return a.localeCompare(b);
    });

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
          <h1 style="margin: 0; font-size: 16px; font-weight: bold; color: #000;">REPORTE FILTRADO POR CENTRO DE COSTOS</h1>
          <p style="margin: 5px 0 0 0; font-size: 10px; color: #666;">${filterText}</p>
        </div>
        <div style="text-align: right; font-size: 10px; width: 80px; color: #000;">
          <div>FL-TAL-10 R</div>
          <div>Rev. 00</div>
        </div>
      </div>
    `;

    const generateTableHeader = () => `
      <thead>
        <tr style="background-color: #ffffff;">
          <th style="border: 1px solid #000; padding: 6px; text-align: center; width: 250px; color: #000;">DESCRIPCIÓN</th>
          <th style="border: 1px solid #000; padding: 6px; text-align: center; width: 60px; color: #000;">CANTIDAD</th>
          <th style="border: 1px solid #000; padding: 6px; text-align: center; width: 70px; color: #000;">UNIDAD<br/>MEDIDA</th>
          <th style="border: 1px solid #000; padding: 6px; text-align: center; width: 90px; color: #000;">UBICACIÓN</th>
        </tr>
      </thead>
    `;

    const generateTableRows = (movementsList) => {
      return movementsList.map(movement => `
        <tr style="background-color: #ffffff;">
          <td style="border: 1px solid #000; padding: 5px; font-size: 7px; color: #000;">${movement.materialDescription || '-'}</td>
          <td style="border: 1px solid #000; padding: 5px; text-align: right; font-size: 9px; color: #000;">${movement.qty > 0 ? '+' : ''}${movement.qty}</td>
          <td style="border: 1px solid #000; padding: 5px; text-align: center; font-size: 8px; color: #000;">${movement.unidadDeMedida || '-'}</td>
          <td style="border: 1px solid #000; padding: 5px; text-align: center; font-size: 7px; color: #000;">${movement.storageLocation}</td>
        </tr>
      `).join('');
    };

    const generateGroupTitle = (groupName) => `
      <div style="margin-bottom: 4px; padding: 2px;">
        <h2 style="font-size: 12px; font-weight: bold;">${groupName}</h2>
      </div>
    `;

    const generateGroupTable = (groupName, movementsList) => `
      ${generateGroupTitle(groupName)}
      <table style="width: 100%; border-collapse: collapse; font-size: 9px; margin-bottom: 15px;">
        ${generateTableHeader()}
        <tbody>
          ${generateTableRows(movementsList)}
        </tbody>
      </table>
    `;

    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    let isFirstPage = true;
    let pageNumber = 1;

    const estimateTableHeight = (numRows) => {
      const headerHeight = 80;
      const rowHeight = 25;
      const marginHeight = 30;
      return headerHeight + (numRows * rowHeight) + marginHeight;
    };

    const addContentToPdf = async (htmlContent, pageNum, totalPages) => {
      const tempDiv = document.createElement('div');
      tempDiv.style.position = 'absolute';
      tempDiv.style.left = '-9999px';
      tempDiv.style.top = '0';
      tempDiv.style.width = '800px';
      tempDiv.style.backgroundColor = '#ffffff';
      tempDiv.style.padding = '20px';
      tempDiv.style.fontFamily = 'Arial, sans-serif';
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
            <div>Generado el: ${new Date().toLocaleString('es-ES')} / Reporte consolidado al: 31/10/2025 / Encargado de control de inventario: Marco Meza</div>
            <div>Página ${pageNum} de ${totalPages}</div>
          </div>
        </div>  
      `;

      tempDiv.innerHTML = fullContent;
      document.body.appendChild(tempDiv);

      const targetScale = 1.5;
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

    const MAX_PAGE_HEIGHT = 1000;
    let currentPageContent = '';
    let currentPageHeight = 0;
    let totalPagesEstimate = groupKeys.length;

    for (let i = 0; i < groupKeys.length; i++) {
      const groupName = groupKeys[i];
      const movementsList = groupedData[groupName];
      const tableHeight = estimateTableHeight(movementsList.length);
      const tableHtml = generateGroupTable(groupName, movementsList);

      if (currentPageHeight + tableHeight > MAX_PAGE_HEIGHT && currentPageContent !== '') {
        await addContentToPdf(currentPageContent, pageNumber, totalPagesEstimate);
        pageNumber++;
        
        currentPageContent = tableHtml;
        currentPageHeight = tableHeight;
      } else {
        currentPageContent += tableHtml;
        currentPageHeight += tableHeight;
      }

      if (i === groupKeys.length - 1) {
        await addContentToPdf(currentPageContent, pageNumber, pageNumber);
      }
    }

    const filterSuffix = materialCodes && materialCodes.length > 0 ? `_${filterMode}_${materialCodes.length}mat` : '';
    const filename = `Reporte_Centros_Filtrado_${displayStartDate.replace(/\//g, '-')}_${displayEndDate.replace(/\//g, '-')}${filterSuffix}.pdf`;
    pdf.save(filename);
    
    return true;
  } catch (error) {
    console.error('Error generating INV01 Filtrado Centros PDF:', error);
    throw error;
  }
};