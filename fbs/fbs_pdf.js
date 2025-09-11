/**
 * fbs_pdf.js
 *
 * Генерация и скачивание PDF-файла для FBS‑заказа.
 * Подключать после:
 * 1) основной логики FBS (fbs.js)
 * 2) библиотеки pdfMake и vfs_fonts.js
 *
 * Ожидает, что в window.lastFbsData будут доступны поля:
 *   - company (ИП)
 *   - phone   (номер телефона)
 *   - city    (город приёмки)
 */

;(function() {
  /**
   * Формирует и скачивает PDF размером 120×75 мм (landscape) со всеми полями.
   */
  function downloadFbsPdf() {
  // Извлекаем данные последней заявки
  var data     = window.lastFbsData || {};
  var company  = data.company  || "";
  var phone    = data.phone    || "";
  var city     = data.city     || "";
  // Количество страниц — ровно то, что указал пользователь
  var quantity = parseInt(data.quantity, 10) || 1;

  // Формируем массив контента
  var content = [];
  for (var i = 1; i <= quantity; i++) {
    content.push(
      { text: 'ИП: ' + company,        fontSize: 24, margin: [0, 0, 0, 4] },
      { text: 'Телефон: ' + phone,     fontSize: 24, margin: [0, 0, 0, 4] },
      { text: 'Город приёмки: ' + city, fontSize: 24 }
    );
    // Разрыв страницы после каждой, кроме последней
    if (i < quantity) {
      content.push({ text: '', pageBreak: 'after' });
    }
  }

  // Собираем описание PDF
  var docDefinition = {
    pageSize: { width: 340, height: 212 },      // 120×75 мм
    pageMargins: [15, 15, 15, 20],
    defaultStyle: { font: 'Roboto' },
    content: content,
    // Динамический футер: номер страницы из общего числа
    footer: function(currentPage, pageCount) {
      return {
        text: currentPage + '/' + pageCount,
        alignment: 'center',
        fontSize: 16,
        margin: [0, 0, 0, 10]
      };
    }
  };

  // Генерируем и сразу скачиваем
  pdfMake.createPdf(docDefinition)
         .download('fbs_labels_' + Date.now() + '.pdf');
}


  // Экспортируем в глобальную область видимости для onclick
  window.downloadFbsPdf = downloadFbsPdf;
})();
