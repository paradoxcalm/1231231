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
  function downloadReceptionPdf() {
    const data         = window.lastReceptionData || {};
    const city         = data.city        || '';
    const warehouse    = data.warehouse   || '';
    const acceptDate   = data.acceptDate  || '';
    const deliveryDate = data.deliveryDate|| '';
    const boxCount     = parseInt(data.boxCount, 10) || 1;
    const type         = data.type        || '';
    const phone        = data.phone       || '';

    const itemLabel = type === 'Pallet' ? 'Паллета' : 'Короб';

    // Функция для преобразования YYYY-MM-DD -> DD.MM.YYYY
    function formatDate(dateString) {
      if (!dateString) return '';
      const parts = dateString.split('-'); // [YYYY, MM, DD]
      return parts[2] + '.' + parts[1] + '.' + parts[0];
    }

    const formattedAcceptDate   = formatDate(acceptDate);
    const formattedDeliveryDate = formatDate(deliveryDate);

    const content = [];
    for (let i = 1; i <= boxCount; i++) {
      content.push(
        { text: city,      fontSize: 28, margin: [0, 0, 0, 1] },
        { text: warehouse, fontSize: 28, margin: [0, 0, 0, 2] },
        // Даты объединяем в одну строку и форматируем
        { text: 'Дата:' + formattedAcceptDate + '-' + formattedDeliveryDate, fontSize: 22, margin: [0, 0, 0, 2] },
        { text: 'Телефон: ' + phone,                         fontSize: 20, margin: [0, 0, 0, 2] },
        { text: itemLabel + ': ' + i + ' из ' + boxCount,    fontSize: 20 }
      );
      if (i < boxCount) {
        content.push({ text: '', pageBreak: 'after' });
      }
    }

    const docDefinition = {
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

    pdfMake.createPdf(docDefinition)
           .download('reception_labels_' + Date.now() + '.pdf');
  }

  window.downloadReceptionPdf = downloadReceptionPdf;
})();

