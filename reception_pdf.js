/**
 * reception_pdf.js
 *
 * Генерация и скачивание PDF‑файла для ручной приёмки по образцу FBS.
 * Ожидает, что в window.lastReceptionData записаны поля:
 *   - city         — город отправления
 *   - warehouse    — направление/склад (берётся из hidden‑поля directionInput)
 *   - acceptDate   — дата приёмки (обычно текущая дата)
 *   - deliveryDate — дата сдачи, выбранная в форме
 *   - boxCount     — количество коробок
 */

;(function() {
  function buildDocDefinition() {
    const data         = window.lastReceptionData || {};
    const city         = data.city        || '';
    const warehouse    = data.warehouse   || '';
    const acceptDate   = data.acceptDate  || '';
    const deliveryDate = data.deliveryDate|| '';
    const boxCount     = parseInt(data.boxCount, 10) || 1;
    const type         = data.type        || '';
    const phone        = data.phone       || '';

    const itemLabel = type === 'Pallet' ? 'Паллета' : 'Короб';

    function formatDate(dateString) {
      if (!dateString) return '';
      const parts = dateString.split('-');
      return parts[2] + '.' + parts[1] + '.' + parts[0];
    }

    const formattedAcceptDate   = formatDate(acceptDate);
    const formattedDeliveryDate = formatDate(deliveryDate);

    const content = [];
    for (let i = 1; i <= boxCount; i++) {
      content.push(
        { text: city,      fontSize: 28, margin: [0, 0, 0, 1] },
        { text: warehouse, fontSize: 28, margin: [0, 0, 0, 2] },
        { text: 'Дата:' + formattedAcceptDate + '-' + formattedDeliveryDate, fontSize: 22, margin: [0, 0, 0, 2] },
        { text: 'Телефон: ' + phone, fontSize: 20, margin: [0, 0, 0, 2] },
        { text: itemLabel + ': ' + i + ' из ' + boxCount, fontSize: 20 }
      );
      if (i < boxCount) {
        content.push({ text: '', pageBreak: 'after' });
      }
    }

    return {
      pageSize: { width: 340, height: 212 },
      pageMargins: [15, 15, 15, 20],
      defaultStyle: { font: 'Roboto' },
      content: content,
      footer: function(currentPage, pageCount) {
        return {
          text: currentPage + '/' + pageCount,
          alignment: 'center',
          fontSize: 16,
          margin: [0, 0, 0, 10]
        };
      }
    };
  }

  function buildFileName() {
    return 'reception_labels_' + Date.now() + '.pdf';
  }

  function getPdfBlob() {
    return new Promise((resolve, reject) => {
      try {
        const docDefinition = buildDocDefinition();
        pdfMake.createPdf(docDefinition).getBlob(function(blob) {
          resolve({ blob, fileName: buildFileName() });
        });
      } catch (err) {
        reject(err);
      }
    });
  }

  function downloadBlob(blob, fileName) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  async function downloadReceptionPdf() {
    const { blob, fileName } = await getPdfBlob();
    downloadBlob(blob, fileName);
  }

  async function printReceptionPdf(options = {}) {
    const { downloadOnFail = false } = options;
    const { blob, fileName } = await getPdfBlob();

    const formData = new FormData();
    formData.append('type', 'file');
    formData.append('file', blob, fileName);

    try {
      const response = await fetch('printer.php', {
        method: 'POST',
        body: formData
      });
      const data = await response.json().catch(() => null);

      const success = response.ok && data && data.success;
      const message = data && data.message ? data.message : (response.ok ? '' : 'Сервер печати недоступен');

      if (!success && downloadOnFail) {
        downloadBlob(blob, fileName);
      }

      return { success, message: message || '' };
    } catch (error) {
      if (downloadOnFail) {
        downloadBlob(blob, fileName);
      }
      return { success: false, message: error && error.message ? error.message : 'Не удалось подключиться к серверу печати' };
    }
  }

  window.downloadReceptionPdf = downloadReceptionPdf;
  window.printReceptionPdf = printReceptionPdf;
})();

