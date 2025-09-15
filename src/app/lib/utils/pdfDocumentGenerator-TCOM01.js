import jsPDF from 'jspdf';
import html2canvas from 'html2canvas-pro';

export const generateTCOM01Pdf = async (entries, startDate, endDate) => {
  if (!entries || entries.length === 0) {
    throw new Error('No hay datos para generar el PDF');
  }

  try {
    // Create a temporary HTML element with the table
    const tempDiv = document.createElement('div');
    tempDiv.style.position = 'absolute';
    tempDiv.style.left = '-9999px';
    tempDiv.style.top = '0';
    tempDiv.style.width = '1200px';
    tempDiv.style.backgroundColor = '#ffffff';
    tempDiv.style.padding = '20px';
    tempDiv.style.fontFamily = 'Arial, sans-serif';

    // Add empty rows to fill the page if needed
    const minRows = 15;
    const displayEntries = [...entries];
    while (displayEntries.length < minRows) {
      displayEntries.push({
        id: `empty-${displayEntries.length}`,
        formattedDate: '',
        proveedorExterno: '',
        nroChapa: '',
        chofer: '',
        factura: '',
        cantidadFacturadaLts: '',
        formattedTime: '',
        cantidadRecepcionadaLts: '',
        quantityDifference: 0,
        isEmpty: true
      });
    }

    // Calculate totals
    const totalFacturado = entries.reduce((sum, entry) => 
      sum + parseFloat(entry.cantidadFacturadaLts || '0'), 0);
    const totalRecepcionado = entries.reduce((sum, entry) => 
      sum + parseFloat(entry.cantidadRecepcionadaLts || '0'), 0);
    const totalDiferencia = totalFacturado - totalRecepcionado;

    tempDiv.innerHTML = `
      <div style="width: 100%; max-width: 1160px;">
        <!-- Header -->
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; border-bottom: 2px solid #000; padding-bottom: 10px;">
          <div style="width: 80px; height: 40px; display: flex; align-items: center;">
            <img 
              src="/logo.png" 
              alt="GS CONCRETOS Logo" 
              style="max-width: 120px; max-height: 60px; width: auto; height: auto; object-fit: contain;"
            />
          </div>
          <div style="text-align: center; flex: 1;">
            <h1 style="margin: 0; font-size: 18px; font-weight: bold;">CONTROL DE ENTRADA DE COMBUSTIBLE</h1>
          </div>
          <div style="text-align: right; font-size: 10px; width: 80px;">
            <div>FL-TAL-06</div>
            <div>Rev. 00</div>
          </div>
        </div>

        <!-- Company Info -->
        <div style="margin-bottom: 20px; font-size: 12px;">
          <div style="margin-bottom: 5px;"><strong>EMPRESA:</strong> GS CONCRETOS S.A.</div>
          <div style="display: flex; justify-content: space-between;">
            <div><strong>TIPO DE COMBUSTIBLE:</strong> Diesel Tipo 3</div>
            <div><strong>PERÍODO:</strong> ${startDate} - ${endDate}</div>
          </div>
        </div>

        <!-- Table -->
        <table style="width: 100%; border-collapse: collapse; font-size: 10px; margin-bottom: 20px;">
          <thead>
            <tr style="background-color: #f0f0f0;">
              <th style="border: 1px solid #000; padding: 8px; text-align: center; width: 80px;">FECHA</th>
              <th style="border: 1px solid #000; padding: 8px; text-align: center; width: 120px;">PROVEEDOR<br>EXTERNO</th>
              <th style="border: 1px solid #000; padding: 8px; text-align: center; width: 80px;">NRO CHAPA</th>
              <th style="border: 1px solid #000; padding: 8px; text-align: center; width: 100px;">CHOFER</th>
              <th style="border: 1px solid #000; padding: 8px; text-align: center; width: 80px;">N° DE REMISIÓN /<br>FACTURA</th>
              <th style="border: 1px solid #000; padding: 8px; text-align: center; width: 90px;">CANTIDAD<br>FACTURADA (L)</th>
              <th style="border: 1px solid #000; padding: 8px; text-align: center; width: 80px;">HORA DE<br>DESCARGA</th>
              <th style="border: 1px solid #000; padding: 8px; text-align: center; width: 90px;">CANTIDAD<br>RECEPCIONADA (L)</th>
              <th style="border: 1px solid #000; padding: 8px; text-align: center; width: 120px;">OBSERVACIONES</th>
            </tr>
          </thead>
          <tbody>
            ${entries.map(entry => `
              <tr style="background-color: #fafafa;">
                <td style="border: 1px solid #000; padding: 6px; text-align: center;">${entry.formattedDate || ''}</td>
                <td style="border: 1px solid #000; padding: 6px;">${entry.proveedorExterno || ''}</td>
                <td style="border: 1px solid #000; padding: 6px; text-align: center;">${entry.nroChapa || ''}</td>
                <td style="border: 1px solid #000; padding: 6px;">${entry.chofer || ''}</td>
                <td style="border: 1px solid #000; padding: 6px; text-align: center;">${entry.factura || ''}</td>
                <td style="border: 1px solid #000; padding: 6px; text-align: right;">${parseFloat(entry.cantidadFacturadaLts || '0').toFixed(2)}</td>
                <td style="border: 1px solid #000; padding: 6px; text-align: center;">${entry.formattedTime || ''}</td>
                <td style="border: 1px solid #000; padding: 6px; text-align: right;">${parseFloat(entry.cantidadRecepcionadaLts || '0').toFixed(2)}</td>
                <td style="border: 1px solid #000; padding: 6px; font-size: 9px;">${
                  Math.abs(entry.quantityDifference) > 0.01 
                    ? `Dif: ${entry.quantityDifference > 0 ? '+' : ''}${entry.quantityDifference.toFixed(2)}L` 
                    : ''
                }</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <!-- Summary -->
        <div style="font-size: 11px; font-weight: bold; margin-top: 20px;">
          <div style="margin-bottom: 5px;">TOTAL FACTURADO: ${totalFacturado.toFixed(2)} L</div>
          <div style="margin-bottom: 5px;">TOTAL RECEPCIONADO: ${totalRecepcionado.toFixed(2)} L</div>
          <div style="margin-bottom: 15px;">DIFERENCIA TOTAL: ${totalDiferencia > 0 ? '+' : ''}${totalDiferencia.toFixed(2)} L</div>
        </div>

        <!-- Footer -->
        <div style="margin-top: 30px; font-size: 9px; color: #666; display: flex; justify-content: space-between;">
          <div>Generado el: ${new Date().toLocaleString('es-ES')}</div>
          <div>Página 1 de 1</div>
        </div>
      </div>
    `;

    // Add to document temporarily
    document.body.appendChild(tempDiv);

    // Generate canvas using html2canvas-pro
    const canvas = await html2canvas(tempDiv, {
      scale: 2,
      useCORS: true,
      allowTaint: false,
      backgroundColor: '#ffffff',
      width: 1200,
      height: tempDiv.scrollHeight,
      logging: false
    });

    // Remove temporary element
    document.body.removeChild(tempDiv);

    // Create PDF
    const pdf = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4'
    });

    const imgData = canvas.toDataURL('image/png', 1.0);
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();
    
    // Calculate dimensions to fit the page
    const imgWidth = pdfWidth;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    // Add image to PDF - should fit in one page
    if (imgHeight <= pdfHeight) {
      // Fits in one page
      pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
    } else {
      // If it doesn't fit, scale it down
      const scale = pdfHeight / imgHeight;
      const scaledWidth = imgWidth * scale;
      const scaledHeight = pdfHeight;
      const xOffset = (pdfWidth - scaledWidth) / 2;
      
      pdf.addImage(imgData, 'PNG', xOffset, 0, scaledWidth, scaledHeight);
    }

    // Generate filename
    const filename = `control_entrada_combustible_${startDate}_${endDate}.pdf`;
    
    // Save the PDF
    pdf.save(filename);
    
    return true;
  } catch (error) {
    console.error('Error generating PDF:', error);
    throw error;
  }
};