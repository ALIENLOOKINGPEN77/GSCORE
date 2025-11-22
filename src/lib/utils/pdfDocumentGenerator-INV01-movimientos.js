import jsPDF from 'jspdf';
import html2canvas from 'html2canvas-pro';

/**
 * Generates a PDF report for inventory movements across all materials
 * Separate tables for entries and exits
 * @param {Array} movements - Array of movement objects with material info
 * @param {string} startDate - Start date in DD-MM-YYYY format
 * @param {string} endDate - End date in DD-MM-YYYY format
 */
export const generateINV01MovimientosPdf = async (movements, startDate, endDate) => {
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

    // Separate movements into entries and exits
    const entradas = movements.filter(m => m.qty > 0);
    const salidas = movements.filter(m => m.qty < 0);

    // Calculate totals
    const totalQtyIn = entradas.reduce((sum, m) => sum + m.qty, 0);
    const totalQtyOut = salidas.reduce((sum, m) => sum + Math.abs(m.qty), 0);

    // Helper function to generate header
    const generateHeader = () => `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; border-bottom: 2px solid #000; padding-bottom: 10px;">
        <div style="width: 80px; height: 40px; display: flex; align-items: center;">
          <img 
            src="/logo.png" 
            alt="GS CONCRETOS Logo" 
            style="max-width: 120px; max-height: 60px; width: auto; height: auto; object-fit: contain;"
          />
        </div>
        <div style="text-align: center; flex: 1;">
          <h1 style="margin: 0; font-size: 16px; font-weight: bold;">REPORTE DE MOVIMIENTOS DE INVENTARIO</h1>
        </div>
        <div style="text-align: right; font-size: 10px; width: 80px;">
          <div>FL-TAL-99 R</div>
          <div>Rev. 00</div>
        </div>
      </div>
    `;

    // Helper function to generate table header (without TIPO column)
    const generateTableHeader = () => `
      <thead>
        <tr style="background-color: #f0f0f0;">
          <th style="border: 1px solid #000; padding: 6px; text-align: center; width: 60px;">FECHA</th>
          <th style="border: 1px solid #000; padding: 6px; text-align: center; width: 70px;">CÓDIGO<br/>MATERIAL</th>
          <th style="border: 1px solid #000; padding: 6px; text-align: center; width: 130px;">DESCRIPCIÓN<br/>MATERIAL</th>
          <th style="border: 1px solid #000; padding: 6px; text-align: center; width: 50px;">CANTIDAD</th>
          <th style="border: 1px solid #000; padding: 6px; text-align: center; width: 70px;">UBICACIÓN</th>
          <th style="border: 1px solid #000; padding: 6px; text-align: center; width: 75px;">MÓVIL/<br/>MÁQUINA</th>
          <th style="border: 1px solid #000; padding: 6px; text-align: center; width: 90px;">ID<br/>OPERACIÓN</th>
        </tr>
      </thead>
    `;

    // Helper function to generate table rows (without TIPO column, no colors)
    const generateTableRows = (pageMovements) => {
      return pageMovements.map(movement => {
        return `
          <tr style="background-color: #ffffff;">
            <td style="border: 1px solid #000; padding: 5px; text-align: center; font-size: 8px;">${formatDate(movement.effectiveAt)}</td>
            <td style="border: 1px solid #000; padding: 5px; text-align: center; font-size: 8px; font-weight: bold; font-family: monospace;">${movement.materialCode || '-'}</td>
            <td style="border: 1px solid #000; padding: 5px; font-size: 7px;">${movement.materialDescription || '-'}</td>
            <td style="border: 1px solid #000; padding: 5px; text-align: right; font-size: 9px; font-weight: bold;">${movement.qty > 0 ? '+' : ''}${movement.qty}</td>
            <td style="border: 1px solid #000; padding: 5px; text-align: center; font-size: 7px;">${movement.storageLocation}</td>
            <td style="border: 1px solid #000; padding: 5px; text-align: center; font-size: 7px; font-weight: ${movement.equipmentOrUnit && movement.equipmentOrUnit !== '-' ? 'bold' : 'normal'};">${movement.equipmentOrUnit || '-'}</td>
            <td style="border: 1px solid #000; padding: 5px; font-size: 6px; text-align: center; font-family: monospace;">${movement.sourceId || '-'}</td>
          </tr>
        `;
      }).join('');
    };

    // Helper function to generate section title
    const generateSectionTitle = (title) => `
      <div style="margin: 25px 0 10px 0; padding: 8px; background-color: #f0f0f0; border: 1px solid #000; text-align: center;">
        <h2 style="margin: 0; font-size: 13px; font-weight: bold;">${title}</h2>
      </div>
    `;

    // Create PDF
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    let isFirstPage = true;

    // Helper function to add content to PDF
    const addContentToPdf = async (htmlContent) => {
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

      tempDiv.innerHTML = htmlContent;
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

      const imgData = canvas.toDataURL('image/png', 1.0);
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

    // Pagination settings
    const ENTRIES_PER_PAGE = 18; // Slightly less to account for section titles
    let pageNumber = 1;
    let totalPagesEstimate = Math.ceil(entradas.length / ENTRIES_PER_PAGE) + Math.ceil(salidas.length / ENTRIES_PER_PAGE);

    // Generate ENTRADAS pages
    if (entradas.length > 0) {
      const entradasPages = Math.ceil(entradas.length / ENTRIES_PER_PAGE);
      
      for (let pageIndex = 0; pageIndex < entradasPages; pageIndex++) {
        const startIdx = pageIndex * ENTRIES_PER_PAGE;
        const endIdx = Math.min(startIdx + ENTRIES_PER_PAGE, entradas.length);
        const pageMovements = entradas.slice(startIdx, endIdx);
        const isFirstEntradasPage = pageIndex === 0;

        const content = `
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
            ${isFirstEntradasPage ? generateSectionTitle('TABLA DE ENTRADAS DE DEPÓSITO') : ''}

            <table style="width: 100%; border-collapse: collapse; font-size: 9px; margin-bottom: 20px;">
              ${generateTableHeader()}
              <tbody>
                ${generateTableRows(pageMovements)}
              </tbody>
            </table>

            <div style="margin-top: 40px; font-size: 9px; color: #666; display: flex; justify-content: space-between;">
              <div>Generado el: ${new Date().toLocaleString('es-ES')}</div>
              <div>Página ${pageNumber} de ${totalPagesEstimate}</div>
            </div>
          </div>
        `;

        await addContentToPdf(content);
        pageNumber++;
      }
    }

    // Generate SALIDAS pages
    if (salidas.length > 0) {
      const salidasPages = Math.ceil(salidas.length / ENTRIES_PER_PAGE);
      
      for (let pageIndex = 0; pageIndex < salidasPages; pageIndex++) {
        const startIdx = pageIndex * ENTRIES_PER_PAGE;
        const endIdx = Math.min(startIdx + ENTRIES_PER_PAGE, salidas.length);
        const pageMovements = salidas.slice(startIdx, endIdx);
        const isFirstSalidasPage = pageIndex === 0;

        const content = `
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
            ${isFirstSalidasPage ? generateSectionTitle('TABLA DE SALIDAS DE DEPÓSITO') : ''}

            <table style="width: 100%; border-collapse: collapse; font-size: 9px; margin-bottom: 20px;">
              ${generateTableHeader()}
              <tbody>
                ${generateTableRows(pageMovements)}
              </tbody>
            </table>

            <div style="margin-top: 40px; font-size: 9px; color: #666; display: flex; justify-content: space-between;">
              <div>Generado el: ${new Date().toLocaleString('es-ES')}</div>
              <div>Página ${pageNumber} de ${totalPagesEstimate}</div>
            </div>
          </div>
        `;

        await addContentToPdf(content);
        pageNumber++;
      }
    }

    // Generate summary page
    const summaryContent = `
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

        <div style="background-color: #f0f0f0; padding: 20px; border: 1px solid #000; margin-top: 30px;">
          <div style="font-size: 14px; font-weight: bold; margin-bottom: 20px; text-align: center;">RESUMEN DEL PERÍODO</div>
          <div style="font-size: 12px; line-height: 1.8;">
            <div style="margin-bottom: 10px;"><strong>Período:</strong> ${displayStartDate} - ${displayEndDate}</div>
            <div style="margin-bottom: 10px;"><strong>Total Movimientos:</strong> ${movements.length}</div>
            <div style="margin-bottom: 10px;"><strong>Total Entradas:</strong> ${entradas.length} movimientos</div>
            <div style="margin-bottom: 10px;"><strong>Cantidad Total Entradas:</strong> +${totalQtyIn}</div>
            <div style="margin-bottom: 10px;"><strong>Total Salidas:</strong> ${salidas.length} movimientos</div>
            <div style="margin-bottom: 10px;"><strong>Cantidad Total Salidas:</strong> -${totalQtyOut}</div>
          </div>
        </div>

        <div style="margin-top: 40px; font-size: 9px; color: #666; display: flex; justify-content: space-between;">
          <div>Generado el: ${new Date().toLocaleString('es-ES')}</div>
          <div>Página ${pageNumber} de ${totalPagesEstimate + 1}</div>
        </div>
      </div>
    `;

    await addContentToPdf(summaryContent);

    const filename = `Reporte_Inventario_General_${displayStartDate.replace(/\//g, '-')}_${displayEndDate.replace(/\//g, '-')}.pdf`;
    pdf.save(filename);
    
    return true;
  } catch (error) {
    console.error('Error generating INV01 Movimientos PDF:', error);
    throw error;
  }
};