import jsPDF from 'jspdf';
import html2canvas from 'html2canvas-pro';

/**
 * Generates a filtered PDF report for current inventory status
 * @param {Array} materialsWithInventory - Array of material objects with current inventory data
 * @param {string} reportDate - Report generation date in DD-MM-YYYY format
 * @param {Array|null} materialCodes - Array of material codes that were filtered
 * @param {string} filterMode - 'include' or 'exclude'
 */
export const generateINV01GeneralFiltradoPdf = async (
  materialsWithInventory, 
  reportDate,
  materialCodes = null,
  filterMode = 'include'
) => {
  if (!materialsWithInventory || materialsWithInventory.length === 0) {
    throw new Error('No hay datos para generar el PDF');
  }

  try {
    const formatDateDisplay = (dateStr) => dateStr.split('-').reverse().join('/');
    const displayReportDate = formatDateDisplay(reportDate);

    const materialsWithStock = materialsWithInventory.filter(material => {
      const totalQty = Object.values(material.inventory || {}).reduce((sum, loc) => sum + (loc.quantity || 0), 0);
      return totalQty !== 0;
    });

    materialsWithStock.sort((a, b) => a.codigo.localeCompare(b.codigo));

    let filterText = '';
    if (materialCodes && materialCodes.length > 0) {
      filterText = `${materialCodes.length} material(es) ${filterMode === 'include' ? 'incluidos' : 'excluidos'}`;
    }

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
          <h1 style="margin: 0; font-size: 16px; font-weight: bold; color: #000;">REPORTE INVENTARIO ACTUAL${filterText ? ' - FILTRADO' : ''}</h1>
          <p style="margin: 5px 0 0 0; font-size: 11px; color: #000;">Fecha de Reporte: ${displayReportDate}</p>
          ${filterText ? `<p style="margin: 3px 0 0 0; font-size: 10px; color: #666;">${filterText}</p>` : ''}
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
          <th style="border: 1px solid #000; padding: 6px; text-align: center; width: 200px; color: #000;">DESCRIPCIÓN</th>
          <th style="border: 1px solid #000; padding: 6px; text-align: center; width: 100px; color: #000;">MARCA</th>
          <th style="border: 1px solid #000; padding: 6px; text-align: center; width: 90px; color: #000;">UBICACIÓN</th>
          <th style="border: 1px solid #000; padding: 6px; text-align: center; width: 60px; color: #000;">CANTIDAD</th>
          <th style="border: 1px solid #000; padding: 6px; text-align: center; width: 60px; color: #000;">UNIDAD<br/>MEDIDA</th>
        </tr>
      </thead>
    `;

    const generateMaterialRows = (material) => {
      const inventory = material.inventory || {};
      const locations = Object.keys(inventory).filter(loc => inventory[loc].quantity !== 0);
      
      if (locations.length === 0) return '';

      locations.sort();
      const rowspan = locations.length;

      let rows = '';
      locations.forEach((location, index) => {
        const qty = inventory[location].quantity;
        const isFirstRow = index === 0;

        rows += `
          <tr style="background-color: #ffffff;">
            ${isFirstRow ? `
              <td rowspan="${rowspan}" style="border: 1px solid #000; padding: 5px; font-size: 7px; vertical-align: top; color: #000;">${material.descripcion}</td>
              <td rowspan="${rowspan}" style="border: 1px solid #000; padding: 5px; font-size: 7px; text-align: center; vertical-align: top; color: #000;">${material.marca || '-'}</td>
            ` : ''}
            <td style="border: 1px solid #000; padding: 5px; font-size: 7px; text-align: center; color: #000;">${location}</td>
            <td style="border: 1px solid #000; padding: 5px; text-align: right; font-size: 9px; color: #000;">${qty}</td>
            <td style="border: 1px solid #000; padding: 5px; font-size: 8px; text-align: center; color: #000;">${material.unidadDeMedida || '-'}</td>
          </tr>
        `;
      });

      return rows;
    };

    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    let isFirstPage = true;
    let pageNumber = 1;

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

      if (!isFirstPage) pdf.addPage();
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

    const MATERIALS_PER_PAGE = 36;
    const totalPages = Math.ceil(materialsWithStock.length / MATERIALS_PER_PAGE);
    const materialPages = Math.ceil(materialsWithStock.length / MATERIALS_PER_PAGE);
    
    for (let pageIndex = 0; pageIndex < materialPages; pageIndex++) {
      const startIdx = pageIndex * MATERIALS_PER_PAGE;
      const endIdx = Math.min(startIdx + MATERIALS_PER_PAGE, materialsWithStock.length);
      const pageMaterials = materialsWithStock.slice(startIdx, endIdx);

      const tableRows = pageMaterials.map(material => generateMaterialRows(material)).join('');

      const content = `
        <table style="width: 100%; border-collapse: collapse; font-size: 9px; margin-bottom: 20px;">
          ${generateTableHeader()}
          <tbody>
            ${tableRows}
          </tbody>
        </table>
      `;

      await addContentToPdf(content, pageNumber, totalPages);
      pageNumber++;
    }

    const filterSuffix = materialCodes && materialCodes.length > 0 ? `_${filterMode}_${materialCodes.length}mat` : '';
    const filename = `Reporte_Inventario_Actual_Filtrado_${displayReportDate.replace(/\//g, '-')}${filterSuffix}.pdf`;
    pdf.save(filename);
    
    return true;
  } catch (error) {
    console.error('Error generating INV01 General Filtrado PDF:', error);
    throw error;
  }
};