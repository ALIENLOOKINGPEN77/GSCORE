import jsPDF from 'jspdf';
import html2canvas from 'html2canvas-pro';

export const generateSCOM01CompuestoUnicoPdf = async (entries, dateString, filter, Tinicial = '', Tfinal = '') => {
  if (!entries || entries.length === 0) {
    throw new Error('No hay datos para generar el PDF');
  }

  try {
    // Calculate totals
    const internalLoads = entries.filter(e => e.type === 'flota');
    const externalLoads = entries.filter(e => e.type === 'externa');
    
    const totalInternalLitros = internalLoads.reduce((sum, entry) => 
      sum + parseFloat(entry.Litros || '0'), 0);
    const totalExternalLitros = externalLoads.reduce((sum, entry) => 
      sum + parseFloat(entry.LitrosCargados || '0'), 0);
    const totalGeneral = totalInternalLitros + totalExternalLitros;

    // Format date for display
    const displayDate = dateString ? 
      dateString.split('-').reverse().join('/') : 
      new Date().toLocaleString('es-ES');

    // Sort all entries by timestamp
    const allEntries = [...entries].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

    // Pagination: Reduced from 12 to 10 to fit taller rows (10px font) in Landscape
    const ENTRIES_PER_PAGE = 10;
    const totalPages = Math.ceil(allEntries.length / ENTRIES_PER_PAGE);

    // Helper function to render signature or placeholder
    const renderSignatureCell = (entry) => {
      if (entry.HasFirma && entry.FirmaSvg) {
        try {
          const parser = new DOMParser();
          const svgDoc = parser.parseFromString(entry.FirmaSvg, "image/svg+xml");
          const svgElement = svgDoc.querySelector("svg");
          
          if (svgElement) {
            svgElement.removeAttribute("width");
            svgElement.removeAttribute("height");
            svgElement.setAttribute("width", "90px");
            svgElement.setAttribute("height", "30px");
            svgElement.setAttribute("preserveAspectRatio", "xMidYMid meet");
            
            return svgElement.outerHTML;
          }
        } catch (e) {
          console.error('Error processing signature SVG:', e);
        }
      }
      return '<span style="color: #999;">-</span>';
    };

    // Generate filter description
    const getFilterDescription = () => {
      if (!filter || !filter.values || filter.values.length === 0) {
        return 'Sin filtros aplicados';
      }
      
      const filterTypeNames = {
        'nroMovil': 'Nro. Móvil',
        'empresa': 'Empresa',
        'numeroChapa': 'Nro. Chapa'
      };
      
      return `Filtrado por ${filterTypeNames[filter.type]}: ${filter.values.join(', ')}`;
    };

    // Helper function to generate header HTML
    const generateHeader = (pageNum) => `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; border-bottom: 2px solid #000; padding-bottom: 10px;">
        <div style="width: 80px; height: 40px; display: flex; align-items: center;">
          <img 
            src="/logoConcretos.png"  
            alt="GS CONCRETOS Logo" 
            style="max-width: 120px; max-height: 60px; width: auto; height: auto; object-fit: contain;"
          />
        </div>
        <div style="text-align: center; flex: 1;">
          <h1 style="margin: 0; font-size: 18px; font-weight: bold;">CONTROL DE DESPACHO DE COMBUSTIBLE</h1>
        </div>
        <div style="text-align: right; font-size: 10px; width: 80px;">
          <div>FL-TAL-05</div>
          <div>Rev. 00</div>
        </div>
      </div>

      <div style="margin-bottom: 20px; font-size: 12px;">
        <div style="margin-bottom: 5px;"><strong>EMPRESA:</strong> GS CONCRETOS S.A.</div>
        <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
          <div><strong>TIPO DE COMBUSTIBLE:</strong> Diesel Tipo 3</div>
          <div><strong>FECHA:</strong> ${displayDate}</div>
        </div>
        <div style="font-size: 10px; color: #666;"><strong>FILTRO:</strong> ${getFilterDescription()}</div>
      </div>
    `;

    // Helper function to generate table header
    const generateTableHeader = () => `
      <thead>
        <tr style="background-color: #f0f0f0;">
          <th style="border: 1px solid #000; padding: 6px; text-align: center; width: 65px;">FECHA</th>
          <th style="border: 1px solid #000; padding: 6px; text-align: center; width: 50px;">TIPO</th>
          <th style="border: 1px solid #000; padding: 6px; text-align: center; width: 100px;">EMPRESA /<br>NRO. MÓVIL</th>
          <th style="border: 1px solid #000; padding: 6px; text-align: center; width: 70px;">NRO. CHAPA</th>
          <th style="border: 1px solid #000; padding: 6px; text-align: center; width: 110px;">CHOFER</th>
          <th style="border: 1px solid #000; padding: 6px; text-align: center; width: 60px;">LITROS<br>CARGADOS</th>
          <th style="border: 1px solid #000; padding: 6px; text-align: center; width: 50px;">HORA</th>
          <th style="border: 1px solid #000; padding: 6px; text-align: center; width: 65px;">KILOMETRAJE</th>
          <th style="border: 1px solid #000; padding: 6px; text-align: center; width: 65px;">HORÓMETRO</th>
          <th style="border: 1px solid #000; padding: 6px; text-align: center; width: 60px;">PRECINTO</th>
          <th style="border: 1px solid #000; padding: 6px; text-align: center; width: 95px;">FIRMA</th>
        </tr>
      </thead>
    `;

    // Helper function to generate table rows
    // UPDATED: Font sizes increased to 10px (9px for dense text)
    const generateTableRows = (pageEntries) => {
      return pageEntries.map(entry => {
        const isFlota = entry.type === 'flota';
        const entryDate = entry.sourceDate ? entry.sourceDate.split('-').reverse().join('/') : '-';
        return `
          <tr style="background-color: #fafafa;">
            <td style="border: 1px solid #000; padding: 5px; text-align: center; font-size: 10px;">${entryDate}</td>
            <td style="border: 1px solid #000; padding: 5px; text-align: center; font-size: 10px;">${isFlota ? 'INTERNO' : 'EXTERNO'}</td>
            <td style="border: 1px solid #000; padding: 5px; font-size: 10px; font-weight: bold;">${isFlota ? entry.NroMovil : entry.Empresa}</td>
            <td style="border: 1px solid #000; padding: 5px; text-align: center; font-size: 10px;">${isFlota ? '-' : (entry.NumeroChapa || '-')}</td>
            <td style="border: 1px solid #000; padding: 5px; font-size: 9px;">${isFlota ? entry.Chofer : entry.NombreChofer}</td>
            <td style="border: 1px solid #000; padding: 5px; text-align: right; font-weight: bold; font-size: 10px;">${parseFloat(isFlota ? entry.Litros : entry.LitrosCargados).toFixed(2)}</td>
            <td style="border: 1px solid #000; padding: 5px; text-align: center; font-size: 10px;">${isFlota ? entry.HoraCarga : entry.Hora}</td>
            <td style="border: 1px solid #000; padding: 5px; text-align: right; font-size: 10px;">${entry.Kilometraje || '-'}</td>
            <td style="border: 1px solid #000; padding: 5px; text-align: right; font-size: 10px;">${entry.Horometro || '-'}</td>
            <td style="border: 1px solid #000; padding: 5px; text-align: center; font-size: 10px;">${entry.Precinto || '-'}</td>
            <td style="border: 1px solid #000; padding: 3px; text-align: center; vertical-align: middle;">
              <div style="display: flex; align-items: center; justify-content: center; height: 30px;">
                ${renderSignatureCell(entry)}
              </div>
            </td>
          </tr>
        `;
      }).join('');
    };

    // Create PDF
    const pdf = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4'
    });

    // Generate each page
    for (let pageIndex = 0; pageIndex < totalPages; pageIndex++) {
      const startIdx = pageIndex * ENTRIES_PER_PAGE;
      const endIdx = Math.min(startIdx + ENTRIES_PER_PAGE, allEntries.length);
      const pageEntries = allEntries.slice(startIdx, endIdx);
      const isLastPage = pageIndex === totalPages - 1;
      const currentPage = pageIndex + 1;

      // Create temporary HTML element for this page
      const tempDiv = document.createElement('div');
      tempDiv.style.position = 'absolute';
      tempDiv.style.left = '-9999px';
      tempDiv.style.top = '0';
      tempDiv.style.width = '1200px';
      tempDiv.style.backgroundColor = '#ffffff';
      tempDiv.style.padding = '20px';
      tempDiv.style.fontFamily = 'Arial, sans-serif';
      
      // ZOOM FIX: Force consistent rendering regardless of browser zoom
      tempDiv.style.zoom = '1.0';
      tempDiv.style.transform = 'scale(1)';
      tempDiv.style.transformOrigin = 'top left';
      tempDiv.style.webkitFontSmoothing = 'antialiased';
      tempDiv.style.mozOsxFontSmoothing = 'grayscale';

      tempDiv.innerHTML = `
        <div style="
          width: 100%; 
          max-width: 1160px;
          zoom: 1.0;
          transform: scale(1);
          transform-origin: top left;
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
        ">
          ${generateHeader(currentPage)}

          <table style="width: 100%; border-collapse: collapse; font-size: 10px; margin-bottom: 20px;">
            ${generateTableHeader()}
            <tbody>
              ${generateTableRows(pageEntries)}
            </tbody>
          </table>

          ${isLastPage ? `
            <!-- Summary (only on last page) -->
            <div style="font-size: 11px; font-weight: bold; margin-top: 15px;">
              ${(Tinicial || Tfinal) ? `
                <div style="margin-bottom: 5px;">TOTALIZADOR INICIAL: ${Tinicial || '-'}</div>
                <div style="margin-bottom: 5px;">TOTALIZADOR FINAL: ${Tfinal || '-'}</div>
                <div style="margin-bottom: 10px; border-bottom: 1px solid #000; padding-bottom: 5px;"></div>
              ` : ''}
              <div style="margin-bottom: 5px;">TOTAL FLOTA INTERNA: ${totalInternalLitros.toFixed(2)}L</div>
              <div style="margin-bottom: 5px;">TOTAL FLOTA EXTERNA: ${totalExternalLitros.toFixed(2)}L</div>
              <div style="margin-bottom: 5px;">TOTAL GENERAL: ${totalGeneral.toFixed(2)}L</div>
              <div style="margin-bottom: 5px;">TOTAL VEHICULOS CARGADOS: ${internalLoads.length + externalLoads.length}</div>
            </div>
          ` : ''}

          <!-- Footer -->
          <div style="margin-top: ${isLastPage ? '20px' : '40px'}; font-size: 9px; color: #666; display: flex; justify-content: space-between;">
            <div>Generado el: ${new Date().toLocaleString('es-ES')}</div>
            <div>Página ${currentPage} de ${totalPages}</div>
          </div>
        </div>
      `;

      // Add to document temporarily
      document.body.appendChild(tempDiv);

      // ZOOM FIX: Calculate scale based on devicePixelRatio for consistency
      const targetScale = 2;
      const normalizedScale = targetScale / window.devicePixelRatio;

      // Generate canvas with zoom-independent settings
      const canvas = await html2canvas(tempDiv, {
        scale: normalizedScale,
        useCORS: true,
        allowTaint: false,
        backgroundColor: '#ffffff',
        width: 1200,
        height: tempDiv.scrollHeight,
        logging: false,
        windowWidth: 1200,
        windowHeight: tempDiv.scrollHeight,
        x: 0,
        y: 0,
        scrollX: 0,
        scrollY: 0,
        foreignObjectRendering: false
      });

      // Remove temporary element
      document.body.removeChild(tempDiv);

      // Add page to PDF (add new page if not first)
      if (pageIndex > 0) {
        pdf.addPage();
      }

      const imgData = canvas.toDataURL('image/jpeg', 0.70);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      
      const imgWidth = pdfWidth;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      // Add image to PDF
      if (imgHeight <= pdfHeight) {
        pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
      } else {
        const scale = pdfHeight / imgHeight;
        const scaledWidth = imgWidth * scale;
        const scaledHeight = pdfHeight;
        const xOffset = (pdfWidth - scaledWidth) / 2;
        
        pdf.addImage(imgData, 'PNG', xOffset, 0, scaledWidth, scaledHeight);
      }
    }

    // Generate filename
    const filename = `Despacho_Diario_SCOM01_${displayDate.replace(/\//g, '-')}.pdf`;
    
    // Save the PDF
    pdf.save(filename);
    
    return true;
  } catch (error) {
    console.error('Error generating SCOM01 Compuesto Unico PDF:', error);
    throw error;
  }
};