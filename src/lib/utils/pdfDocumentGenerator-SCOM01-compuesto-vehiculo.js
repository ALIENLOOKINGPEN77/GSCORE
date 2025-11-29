import jsPDF from 'jspdf';
import html2canvas from 'html2canvas-pro';

export const generateSCOM01CompuestoVehiculoPdf = async (entries, startDate, endDate, filter) => {
  if (!entries || entries.length === 0) {
    throw new Error('No hay datos para generar el PDF');
  }

  try {
    // Group entries by vehicle
    const internalVehicles = {};
    const externalVehicles = {};
    const internalLoads = entries.filter(e => e.type === 'flota');
    const externalLoads = entries.filter(e => e.type === 'externa');

    // Group internal vehicles by NroMovil
    internalLoads.forEach(entry => {
      const vehicleKey = entry.NroMovil;
      if (!internalVehicles[vehicleKey]) {
        internalVehicles[vehicleKey] = [];
      }
      internalVehicles[vehicleKey].push(entry);
    });

    // Group external vehicles by NumeroChapa
    externalLoads.forEach(entry => {
      const vehicleKey = `${entry.Empresa} - ${entry.NumeroChapa}`;
      if (!externalVehicles[vehicleKey]) {
        externalVehicles[vehicleKey] = {
          empresa: entry.Empresa,
          entries: []
        };
      }
      externalVehicles[vehicleKey].entries.push(entry);
    });

    // Sort each vehicle's entries by date and time
    Object.values(internalVehicles).forEach(vehicleEntries => {
      vehicleEntries.sort((a, b) => {
        const dateCompare = a.sourceDate.localeCompare(b.sourceDate);
        if (dateCompare !== 0) return dateCompare;
        return (a.createdAt || 0) - (b.createdAt || 0);
      });
    });

    Object.values(externalVehicles).forEach(vehicleData => {
      vehicleData.entries.sort((a, b) => {
        const dateCompare = a.sourceDate.localeCompare(b.sourceDate);
        if (dateCompare !== 0) return dateCompare;
        return (a.createdAt || 0) - (b.createdAt || 0);
      });
    });

    // Calculate totals
    const totalInternalLitros = internalLoads.reduce((sum, entry) => 
      sum + parseFloat(entry.Litros || '0'), 0);
    const totalExternalLitros = externalLoads.reduce((sum, entry) => 
      sum + parseFloat(entry.LitrosCargados || '0'), 0);
    const totalGeneral = totalInternalLitros + totalExternalLitros;

    // Format dates
    const formatDateDisplay = (dateStr) => dateStr.split('-').reverse().join('/');
    const displayStartDate = formatDateDisplay(startDate);
    const displayEndDate = formatDateDisplay(endDate);
    const dateRangeText = startDate === endDate 
      ? displayStartDate 
      : `${displayStartDate} - ${displayEndDate}`;

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
          <h1 style="margin: 0; font-size: 18px; font-weight: bold; color: #000;">CONTROL DE DESPACHO DE COMBUSTIBLE / POR VEHÍCULO</h1>
        </div>
        <div style="text-align: right; font-size: 10px; width: 80px; color: #000;">
          <div>FL-TAL-05</div>
          <div>Rev. 00</div>
        </div>
      </div>

      <div style="margin-bottom: 20px; font-size: 12px; color: #000;">
        <div style="margin-bottom: 5px;"><strong>EMPRESA:</strong> GS CONCRETOS S.A.</div>
        <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
          <div><strong>TIPO DE COMBUSTIBLE:</strong> Diesel Tipo 3</div>
          <div><strong>PERÍODO:</strong> ${dateRangeText}</div>
        </div>
        <div style="font-size: 10px; color: #666;"><strong>FILTRO:</strong> ${getFilterDescription()}</div>
      </div>
    `;

    const generateSectionHeader = (sectionTitle) => `
      <div style="margin-bottom: 4px; padding: 2px;">
        <h2 style="font-size: 12px; font-weight: bold; color: #000;">${sectionTitle}</h2>
      </div>
    `;

    const generateTableHeader = () => `
      <thead>
        <tr style="background-color: #f0f0f0;">
          <th style="border: 1px solid #000; padding: 6px; text-align: center; width: 60px; color: #000;">FECHA</th>
          <th style="border: 1px solid #000; padding: 6px; text-align: center; width: 95px; color: #000;">CHOFER</th>
          <th style="border: 1px solid #000; padding: 6px; text-align: center; width: 55px; color: #000;">LITROS<br>CARGADOS</th>
          <th style="border: 1px solid #000; padding: 6px; text-align: center; width: 45px; color: #000;">HORA</th>
          <th style="border: 1px solid #000; padding: 6px; text-align: center; width: 60px; color: #000;">KILOMETRAJE</th>
          <th style="border: 1px solid #000; padding: 6px; text-align: center; width: 60px; color: #000;">HORÓMETRO</th>
          <th style="border: 1px solid #000; padding: 6px; text-align: center; width: 55px; color: #000;">PRECINTO</th>
          <th style="border: 1px solid #000; padding: 6px; text-align: center; width: 90px; color: #000;">FIRMA</th>
        </tr>
      </thead>
    `;

    const generateVehicleSection = (vehicleId, vehicleEntries) => {
      const vehicleTotal = vehicleEntries.reduce((sum, entry) => 
        sum + parseFloat(entry.type === 'flota' ? entry.Litros : entry.LitrosCargados), 0);

      const rows = vehicleEntries.map(entry => {
        const isFlota = entry.type === 'flota';
        const entryDate = entry.sourceDate ? entry.sourceDate.split('-').reverse().join('/') : '-';
        return `
          <tr style="background-color: #fafafa;">
            <td style="border: 1px solid #000; padding: 5px; text-align: center; font-size: 8px; color: #000;">${entryDate}</td>
            <td style="border: 1px solid #000; padding: 5px; color: #000;">${isFlota ? entry.Chofer : entry.NombreChofer}</td>
            <td style="border: 1px solid #000; padding: 5px; text-align: right; font-weight: bold; color: #000;">${parseFloat(isFlota ? entry.Litros : entry.LitrosCargados).toFixed(2)}</td>
            <td style="border: 1px solid #000; padding: 5px; text-align: center; color: #000;">${isFlota ? entry.HoraCarga : entry.Hora}</td>
            <td style="border: 1px solid #000; padding: 5px; text-align: right; color: #000;">${entry.Kilometraje || '-'}</td>
            <td style="border: 1px solid #000; padding: 5px; text-align: right; color: #000;">${entry.Horometro || '-'}</td>
            <td style="border: 1px solid #000; padding: 5px; text-align: center; color: #000;">${entry.Precinto || '-'}</td>
            <td style="border: 1px solid #000; padding: 3px; text-align: center; vertical-align: middle;">
              <div style="display: flex; align-items: center; justify-content: center; height: 30px;">
                ${renderSignatureCell(entry)}
              </div>
            </td>
          </tr>
        `;
      }).join('');

      return `
        <div style="margin-bottom: 25px; page-break-inside: avoid;">
          <div style="background-color: #e0e0e0; color: #000; padding: 8px 12px; margin-bottom: 10px; border: 1px solid #000; display: flex; justify-content: space-between; align-items: center;">
            <div style="font-size: 14px; font-weight: bold;">${vehicleId}</div>
            <div style="text-align: right;">
              <div style="font-size: 10px;">Cargas: ${vehicleEntries.length}</div>
              <div style="font-size: 12px; font-weight: bold;">Total: ${vehicleTotal.toFixed(2)}L</div>
            </div>
          </div>
          
          <table style="width: 100%; border-collapse: collapse; font-size: 9px;">
            ${generateTableHeader()}
            <tbody>
              ${rows}
            </tbody>
          </table>
        </div>
      `;
    };

    // Create PDF
    const pdf = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4'
    });

    let isFirstPage = true;
    const internalKeys = Object.keys(internalVehicles).sort();
    const externalKeys = Object.keys(externalVehicles).sort();

    // Process internal vehicles
    if (internalKeys.length > 0) {
      for (let i = 0; i < internalKeys.length; i++) {
        const vehicleKey = internalKeys[i];
        const vehicleEntries = internalVehicles[vehicleKey];
        
        const tempDiv = document.createElement('div');
        tempDiv.style.position = 'absolute';
        tempDiv.style.left = '-9999px';
        tempDiv.style.top = '0';
        tempDiv.style.width = '1200px';
        tempDiv.style.backgroundColor = '#ffffff';
        tempDiv.style.padding = '20px';
        tempDiv.style.fontFamily = 'Arial, sans-serif';
        tempDiv.style.zoom = '1.0';
        tempDiv.style.transform = 'scale(1)';
        tempDiv.style.transformOrigin = 'top left';
        tempDiv.style.webkitFontSmoothing = 'antialiased';
        tempDiv.style.mozOsxFontSmoothing = 'grayscale';

        tempDiv.innerHTML = `
          <div style="width: 100%; max-width: 1160px; zoom: 1.0; transform: scale(1); transform-origin: top left;">
            ${generateHeader()}
            ${i === 0 ? generateSectionHeader('VEHÍCULOS INTERNOS') : ''}
            ${generateVehicleSection(vehicleKey, vehicleEntries)}
          </div>
        `;

        document.body.appendChild(tempDiv);

        const targetScale = 1.5;
        const normalizedScale = targetScale / window.devicePixelRatio;

        const canvas = await html2canvas(tempDiv, {
          scale: normalizedScale,
          useCORS: true,
          allowTaint: false,
          backgroundColor: '#ffffff',
          width: 1200,
          height: tempDiv.scrollHeight,
          logging: false,
          windowWidth: 1200,
          windowHeight: tempDiv.scrollHeight
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
      }
    }

    // Process external vehicles
    if (externalKeys.length > 0) {
      for (let i = 0; i < externalKeys.length; i++) {
        const vehicleKey = externalKeys[i];
        const vehicleData = externalVehicles[vehicleKey];
        
        const tempDiv = document.createElement('div');
        tempDiv.style.position = 'absolute';
        tempDiv.style.left = '-9999px';
        tempDiv.style.top = '0';
        tempDiv.style.width = '1200px';
        tempDiv.style.backgroundColor = '#ffffff';
        tempDiv.style.padding = '20px';
        tempDiv.style.fontFamily = 'Arial, sans-serif';
        tempDiv.style.zoom = '1.0';
        tempDiv.style.transform = 'scale(1)';
        tempDiv.style.transformOrigin = 'top left';
        tempDiv.style.webkitFontSmoothing = 'antialiased';
        tempDiv.style.mozOsxFontSmoothing = 'grayscale';

        tempDiv.innerHTML = `
          <div style="width: 100%; max-width: 1160px; zoom: 1.0; transform: scale(1); transform-origin: top left;">
            ${generateHeader()}
            ${i === 0 ? generateSectionHeader('VEHÍCULOS EXTERNOS') : ''}
            ${generateVehicleSection(vehicleKey, vehicleData.entries)}
          </div>
        `;

        document.body.appendChild(tempDiv);

        const targetScale = 1.5;
        const normalizedScale = targetScale / window.devicePixelRatio;

        const canvas = await html2canvas(tempDiv, {
          scale: normalizedScale,
          useCORS: true,
          allowTaint: false,
          backgroundColor: '#ffffff',
          width: 1200,
          height: tempDiv.scrollHeight,
          logging: false,
          windowWidth: 1200,
          windowHeight: tempDiv.scrollHeight
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
      }
    }

    // Add summary page
    pdf.addPage();
    const summaryDiv = document.createElement('div');
    summaryDiv.style.position = 'absolute';
    summaryDiv.style.left = '-9999px';
    summaryDiv.style.width = '1200px';
    summaryDiv.style.backgroundColor = '#ffffff';
    summaryDiv.style.padding = '20px';
    summaryDiv.style.fontFamily = 'Arial, sans-serif';
    summaryDiv.style.zoom = '1.0';

    summaryDiv.innerHTML = `
      <div style="width: 100%; max-width: 1160px;">
        ${generateHeader()}
        
        <div style="margin-top: 40px;">
          <h2 style="font-size: 16px; margin-bottom: 20px; border-bottom: 2px solid #000; padding-bottom: 10px; color: #000;">RESUMEN GENERAL</h2>
          
          <div style="font-size: 14px; line-height: 2;">
            <div style="display: flex; justify-content: space-between; padding: 10px; background-color: #f0f0f0; margin-bottom: 5px; border: 1px solid #000;">
              <strong>TOTAL FLOTA INTERNA:</strong>
              <span style="font-weight: bold;">${totalInternalLitros.toFixed(2)}L</span>
            </div>
            <div style="display: flex; justify-content: space-between; padding: 10px; background-color: #f0f0f0; margin-bottom: 5px; border: 1px solid #000;">
              <strong>TOTAL FLOTA EXTERNA:</strong>
              <span style="font-weight: bold;">${totalExternalLitros.toFixed(2)}L</span>
            </div>
            <div style="display: flex; justify-content: space-between; padding: 10px; background-color: #e0e0e0; margin-bottom: 5px; border: 1px solid #000;">
              <strong>TOTAL GENERAL:</strong>
              <span style="font-weight: bold;">${totalGeneral.toFixed(2)}L</span>
            </div>
            <div style="display: flex; justify-content: space-between; padding: 10px; background-color: #f0f0f0; border: 1px solid #000;">
              <strong>TOTAL VEHÍCULOS CARGADOS:</strong>
              <span style="font-weight: bold;">${internalKeys.length + externalKeys.length}</span>
            </div>
          </div>
        </div>

        <div style="margin-top: 40px; font-size: 9px; color: #666;">
          Generado el: ${new Date().toLocaleString('es-ES')}
        </div>
      </div>
    `;

    document.body.appendChild(summaryDiv);

    const summaryCanvas = await html2canvas(summaryDiv, {
      scale: 1.5 / window.devicePixelRatio,
      useCORS: true,
      backgroundColor: '#ffffff',
      width: 1200
    });

    document.body.removeChild(summaryDiv);

    const summaryImgData = summaryCanvas.toDataURL('image/jpeg', 0.70);
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();
    const imgWidth = pdfWidth;
    const imgHeight = (summaryCanvas.height * imgWidth) / summaryCanvas.width;

    if (imgHeight <= pdfHeight) {
      pdf.addImage(summaryImgData, 'PNG', 0, 0, imgWidth, imgHeight);
    } else {
      const scale = pdfHeight / imgHeight;
      const scaledWidth = imgWidth * scale;
      const xOffset = (pdfWidth - scaledWidth) / 2;
      pdf.addImage(summaryImgData, 'PNG', xOffset, 0, scaledWidth, pdfHeight);
    }

    const filename = `Despacho_Vehiculo_SCOM01_${displayStartDate.replace(/\//g, '-')}_${displayEndDate.replace(/\//g, '-')}.pdf`;
    pdf.save(filename);
    
    return true;
  } catch (error) {
    console.error('Error generating SCOM01 Compuesto Vehiculo PDF:', error);
    throw error;
  }
};