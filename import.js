// Ждём, пока DOM полностью загрузится
document.addEventListener('DOMContentLoaded', () => {
  // Сначала пытаемся найти форму с id="importForm".
  // Если её нет — пробуем вариант importScheduleForm (используется в некоторых шаблонах).
  const importForm =
    document.getElementById('importForm') ||
    document.getElementById('importScheduleForm');

  // Поле выбора файла. Ищем input[name="excel_file"] в найденной форме,
  // а если его нет — пробуем id="excel_file".
  let fileInput = null;
  if (importForm) {
    fileInput =
      importForm.querySelector('input[type="file"][name="excel_file"]') ||
      document.getElementById('excel_file');
  }

  // Если форма или поле не найдены, дальше ничего не делаем
  if (!importForm || !fileInput) {
    return;
  }

  // Обработчик отправки формы
  importForm.addEventListener('submit', function (event) {
    event.preventDefault();

    // Проверяем, выбран ли файл
    if (!fileInput.files.length) {
      alert('Выберите CSV‑файл для импорта.');
      return;
    }

    // Собираем данные формы
    const formData = new FormData(importForm);

    // Отправляем файл на сервер для первичной проверки
    fetch('import_schedule_csv.php', {
      method: 'POST',
      body: formData,
    })
      .then((response) => response.json())
      .then((data) => {
        if (!data || !data.rows) {
          alert('Ошибка обработки файла на сервере.');
          return;
        }
        // Показываем модальное окно с таблицей результатов
        showImportResultsModal(data.rows);
      })
      .catch((err) => {
        console.error('Fetch error:', err);
        alert('Ошибка загрузки данных.');
      });
  });
});



// Полная замена
function showImportResultsModal(rows) {
    // 1) Создаём/показываем модалку
    let modal = document.getElementById('importModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'importModal';
        modal.className = 'modal';
        document.body.appendChild(modal);
        // Закрытие по клику на фон
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.style.display = 'none';
        });
    }
    modal.innerHTML = ''; // очистка
    modal.style.display = 'flex';

    // 2) Контент модалки
    const content = document.createElement('div');
    content.className = 'modal-content';
    modal.appendChild(content);

    // Крестик закрытия
    const closeBtn = document.createElement('span');
    closeBtn.className = 'modal-close';
    closeBtn.innerHTML = '&times;';
    closeBtn.addEventListener('click', () => { modal.style.display = 'none'; });
    content.appendChild(closeBtn);

    // 3) Таблица
    const table = document.createElement('table');
    table.className = 'import-table';

    const thead = document.createElement('thead');
    thead.innerHTML = `
        <tr>
            <th>#</th>
            <th>Город</th>
            <th>Склад(ы)</th>
            <th>Дата выезда</th>
            <th>Дата сдачи</th>
            <th>Окончание приёмки</th>
            <th>Таймслот</th>
            <th>Маркетплейс</th>
            <th>Номер машины</th>
            <th>Марка машины</th>
            <th>Водитель</th>
            <th>Телефон</th>
        </tr>`;
    table.appendChild(thead);

    const tbody = document.createElement('tbody');

    // 3.1) Рендер строк
    rows.forEach((row, idx) => {
        const tr = document.createElement('tr');
        tr.className = row.success ? 'valid-row data-row' : 'invalid-row data-row';
        tr.setAttribute('data-index', idx + 1); // 1-based

        // #
        const numberCell = document.createElement('td');
        numberCell.textContent = idx + 1;
        tr.appendChild(numberCell);

        const vals = row.values || {};
        const fieldsOrder = [
            "city","warehouses","departureDate","deliveryDate",
            "acceptanceEnd","timeslot","marketplace",
            "carNumber","carBrand","driverName","driverPhone"
        ];

        fieldsOrder.forEach(fieldKey => {
            const td = document.createElement('td');
            const input = document.createElement('input');
            input.type = 'text';
            input.value = (vals[fieldKey] ?? '').toString();

            // Подсветка ошибок, пришедших из CSV-валидации
            if (row.errors && row.errors.some(e =>
                e.field && e.field.toLowerCase().includes(fieldKey.toLowerCase())
            )) {
                input.classList.add('error-field');
            }

            td.appendChild(input);
            tr.appendChild(td);
        });

        tbody.appendChild(tr);
    });

    table.appendChild(tbody);
    content.appendChild(table);

    // 4) Кнопка Подтвердить
    const confirmBtn = document.createElement('button');
    confirmBtn.textContent = 'Подтвердить';
    confirmBtn.id = 'confirmImportBtn';
    confirmBtn.classList.add('confirm-btn');
    content.appendChild(confirmBtn);

    // 5) Инфопанель (сообщения/спиннер)
    const info = document.createElement('div');
    info.id = 'importInfo';
    info.style = 'margin-top:8px;font-size:13px;color:#444;';
    content.appendChild(info);

    // 6) Обработчик подтверждения (защита от повторов)
    confirmBtn.addEventListener('click', function onConfirm() {
        if (confirmBtn.disabled) return; // уже отправили

        // Блокируем кнопку
        confirmBtn.disabled = true;
        const originalLabel = confirmBtn.textContent;
        confirmBtn.textContent = 'Отправка...';
        info.textContent = '';

        // 6.1) Считываем строки таблицы
        const allRows = Array.from(content.querySelectorAll('tr.data-row'));
        const raw = allRows.map(tr => ({
            city:          tr.querySelector('td:nth-child(2)  input').value.trim(),
            warehouses:    tr.querySelector('td:nth-child(3)  input').value.trim(),
            departureDate: tr.querySelector('td:nth-child(4)  input').value.trim(),
            deliveryDate:  tr.querySelector('td:nth-child(5)  input').value.trim(),
            acceptanceEnd: tr.querySelector('td:nth-child(6)  input').value.trim(),
            timeslot:      tr.querySelector('td:nth-child(7)  input').value.trim(),
            marketplace:   tr.querySelector('td:nth-child(8)  input').value.trim(),
            carNumber:     tr.querySelector('td:nth-child(9)  input').value.trim(),
            carBrand:      tr.querySelector('td:nth-child(10) input').value.trim(),
            driverName:    tr.querySelector('td:nth-child(11) input').value.trim(),
            driverPhone:   tr.querySelector('td:nth-child(12) input').value.trim()
        }));

        // 6.2) КЛИЕНТСКОЕ УДАЛЕНИЕ ДУБЛЕЙ внутри текущей загрузки:
        // ключ = city|warehouses|departureDate (как вы и просили — в один и тот же день дубли не нужны)
        const seen = new Set();
        const sendData = [];
        let skippedDup = 0;

        for (const r of raw) {
            const key = `${r.city}|${r.warehouses}|${r.departureDate}`;
            if (seen.has(key)) { skippedDup++; continue; }
            seen.add(key);
            sendData.push(r);
        }

        if (skippedDup > 0) {
            info.textContent = `Пропущено (как дубликаты внутри файла): ${skippedDup}.`;
        }

        // Если после фильтрации нечего отправлять
        if (sendData.length === 0) {
            alert('Нет данных для отправки (все строки — дубликаты).');
            confirmBtn.disabled = false;
            confirmBtn.textContent = originalLabel;
            return;
        }

        // 6.3) Отправка на сервер
        fetch('import_schedule_confirm.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json; charset=UTF-8' },
            body: JSON.stringify(sendData)
        })
        .then(r => r.json())
        .then(result => {
            if (!result) { alert('Ошибка сервера при подтверждении.'); return; }

            const added    = result.added     || 0;
            const notAdded = result.not_added || 0;

            if (notAdded === 0) {
                alert(`✅ Успешно добавлено записей: ${added}`);
                // Закрываем модалку полностью
                modal.style.display = 'none';
            } else {
                alert(`Добавлено: ${added}, не добавлено: ${notAdded}. Исправьте ошибки и попробуйте снова.`);

                // Снятие старой подсветки
                content.querySelectorAll('input.error-field').forEach(inp => inp.classList.remove('error-field'));
                content.querySelectorAll('tr.data-row').forEach(tr => {
                    tr.classList.remove('invalid-row');
                    tr.classList.add('valid-row');
                });

                // Подсветка ошибок по ответу сервера
                if (Array.isArray(result.errors)) {
                    result.errors.forEach(errInfo => {
                        const rowIdx = errInfo.row; // 1-based
                        const tr = content.querySelector(`tr.data-row[data-index='${rowIdx}']`);
                        if (!tr) return;

                        tr.classList.add('invalid-row');
                        tr.classList.remove('valid-row');

                        if (Array.isArray(errInfo.messages)) {
                            errInfo.messages.forEach(msg => {
                                const m = (msg || '').toLowerCase();
                                if (m.includes('город'))        tr.querySelector('td:nth-child(2)  input')?.classList.add('error-field');
                                if (m.includes('склад'))        tr.querySelector('td:nth-child(3)  input')?.classList.add('error-field');
                                if (m.includes('выезд'))        tr.querySelector('td:nth-child(4)  input')?.classList.add('error-field');
                                if (m.includes('сдач'))         tr.querySelector('td:nth-child(5)  input')?.classList.add('error-field');
                                if (m.includes('приём'))        tr.querySelector('td:nth-child(6)  input')?.classList.add('error-field');
                                if (m.includes('таймслот'))     tr.querySelector('td:nth-child(7)  input')?.classList.add('error-field');
                                if (m.includes('маркетплейс'))  tr.querySelector('td:nth-child(8)  input')?.classList.add('error-field');
                                if (m.includes('номер'))        tr.querySelector('td:nth-child(9)  input')?.classList.add('error-field');
                                if (m.includes('марка'))        tr.querySelector('td:nth-child(10) input')?.classList.add('error-field');
                                if (m.includes('водител'))      tr.querySelector('td:nth-child(11) input')?.classList.add('error-field');
                                if (m.includes('телефон'))      tr.querySelector('td:nth-child(12) input')?.classList.add('error-field');
                            });
                        }
                    });

                    // Удаляем из таблицы те строки, которые успешно добавлены (их нет в списке errors)
                    const errorRows = new Set(result.errors.map(e => e.row));
                    content.querySelectorAll('tr.data-row').forEach(tr => {
                        const idx = parseInt(tr.getAttribute('data-index'), 10);
                        if (!errorRows.has(idx)) tr.remove();
                    });
                }
            }
        })
        .catch(err => {
            console.error('Confirm fetch error:', err);
            alert('Ошибка сети при подтверждении.');
        })
        .finally(() => {
            confirmBtn.disabled = false;
            confirmBtn.textContent = originalLabel;
        });
    });
}



// schedule.js

// 1. Отправка CSV-файла на сервер и отображение полученных данных
function handleScheduleImport() {
    const importForm = document.getElementById("importScheduleForm");
    const fileInput = importForm ? importForm.querySelector("input[name='excel_file']") : null;
    if (!fileInput || !fileInput.files.length) {
        alert("Выберите CSV-файл для импорта.");
        return;
    }
    // Подготовка данных формы
    const formData = new FormData(importForm);
    // Отправляем файл на сервер для первичной проверки
    fetch('import_schedule_csv.php', {
        method: 'POST',
        body: formData
    })
    .then(response => response.json())
    .then(data => {
        if (!data) {
            alert("Ошибка: пустой ответ от сервера.");
            return;
        }
        if (data.success === false) {
            // Общая ошибка (не удалось обработать файл)
            alert("❌ " + (data.message || "Ошибка обработки файла"));
            return;
        }
        if (!data.rows || data.rows.length === 0) {
            alert("Файл не содержит данных для импорта.");
            return;
        }
        // Отрисовываем модальное окно с таблицей импортированных данных
        renderEditableImportModal(data.rows);
        // Закрываем модал выбора файла и открываем модал с данными
        closeModal('importScheduleModal');
        const dataModal = document.getElementById('importDataModal');
        if (dataModal) {
            dataModal.style.display = 'block';
        }
    })
    .catch(err => {
        console.error("Fetch error:", err);
        alert("Ошибка загрузки данных: " + err.message);
    });
}

// 2. Построение таблицы с результатами импорта (с возможностью редактирования ошибок)
function renderEditableImportModal(rows) {
    const modal = document.getElementById("importDataModal");
    if (!modal) {
        alert("Модальное окно для данных импорта не найдено.");
        return;
    }
    // Контейнер, куда поместим таблицу (предполагается div с id="importTableContainer")
    const container = document.getElementById("importTableContainer") || modal;
    // Начинаем формировать HTML таблицы
    let tableHtml = '<table class="import-table"><thead><tr>' +
        '<th>#</th><th>Город</th><th>Склад(ы)</th><th>Дата выезда</th>' +
        '<th>Дата сдачи</th><th>Окончание приёмки</th><th>Таймслот</th>' +
        '<th>Маркетплейс</th><th>Номер авто</th><th>Марка</th>' +
        '<th>Водитель</th><th>Телефон</th>' +
        '</tr></thead><tbody>';
    rows.forEach((row, idx) => {
        const rowIndex = idx + 1;
        const vals = row.values || {};
        const isValid = row.success === true;
        // Добавляем строку, помечая классами valid/invalid
        tableHtml += `<tr class="${isValid ? 'valid-row' : 'invalid-row'} data-row" data-index="${rowIndex}">`;
        tableHtml += `<td>${rowIndex}</td>`;
        // Поля в том же порядке, что и заголовки
        const fieldOrder = ["city", "warehouses", "departureDate", "deliveryDate",
                            "acceptanceEnd", "timeslot", "marketplace", "carNumber",
                            "carBrand", "driverName", "driverPhone"];
        fieldOrder.forEach(key => {
            let value = vals[key] !== undefined && vals[key] !== null ? vals[key] : "";
            value = String(value);
            // Создаём ячейку с input (readonly для валидных строк, редактируемый для ошибочных)
            if (isValid) {
                // Строка без ошибок: поле только для чтения
                tableHtml += `<td><input type="text" value="${value.replace(/"/g, '&quot;')}" readonly></td>`;
            } else {
                // Строка с ошибками: поле редактируемое
                // Проверяем, есть ли ошибка, относящаяся к этому полю, чтобы подсветить
                let inputClass = 'editable-cell';
                if (row.errors && row.errors.some(err => {
                    // Если ошибка содержит указание на поле (по названию)
                    if (err.field) {
                        return err.field.toLowerCase().includes("город") && key === "city" ||
                               err.field.toLowerCase().includes("склад") && key === "warehouses" ||
                               err.field.toLowerCase().includes("выезд") && key === "departureDate" ||
                               err.field.toLowerCase().includes("сдач") && key === "deliveryDate" ||
                               err.field.toLowerCase().includes("приём") && key === "acceptanceEnd" ||
                               err.field.toLowerCase().includes("таймслот") && key === "timeslot" ||
                               err.field.toLowerCase().includes("маркетплейс") && key === "marketplace" ||
                               err.field.toLowerCase().includes("номер") && key === "carNumber" ||
                               err.field.toLowerCase().includes("марка") && key === "carBrand" ||
                               err.field.toLowerCase().includes("водител") && key === "driverName" ||
                               err.field.toLowerCase().includes("телефон") && key === "driverPhone";
                    } else if (typeof err === 'string') {
                        // Если ошибка представлена строкой, проверяем по ключевым словам
                        return err.toLowerCase().includes("город") && key === "city" ||
                               err.toLowerCase().includes("склад") && key === "warehouses" ||
                               err.toLowerCase().includes("выезд") && key === "departureDate" ||
                               err.toLowerCase().includes("сдач") && key === "deliveryDate" ||
                               err.toLowerCase().includes("приём") && key === "acceptanceEnd" ||
                               err.toLowerCase().includes("таймслот") && key === "timeslot" ||
                               err.toLowerCase().includes("маркетплейс") && key === "marketplace" ||
                               err.toLowerCase().includes("номер") && key === "carNumber" ||
                               err.toLowerCase().includes("марка") && key === "carBrand" ||
                               err.toLowerCase().includes("водител") && key === "driverName" ||
                               err.toLowerCase().includes("телефон") && key === "driverPhone";
                    }
                    return false;
                })) {
                    inputClass += ' error-field';
                }
                tableHtml += `<td><input type="text" class="${inputClass}" value="${value.replace(/"/g, '&quot;')}"></td>`;
            }
        });
        tableHtml += '</tr>';
    });
    tableHtml += '</tbody></table>';
    // Вставляем таблицу в контейнер модального окна
    container.innerHTML = tableHtml;
}

// 3. Подтверждение импорта: отправка исправленных данных на сервер и обработка результатов
function confirmImport() {
    const dataModal = document.getElementById("importDataModal");
    if (!dataModal) return;
    // Собираем текущие данные из таблицы
    const rows = Array.from(document.querySelectorAll("#importDataModal tr.data-row"));
    if (rows.length === 0) {
        // Нет строк для подтверждения (все уже импортированы или отсутствуют)
        closeModal('importDataModal');
        return;
    }
    const sendData = [];
    rows.forEach(tr => {
        // Получаем значения из каждой ячейки (пропуская первую колонку #)
        const cells = tr.querySelectorAll("td");
        if (!cells || cells.length < 12) return;
        sendData.push({
            city:           cells[1].querySelector("input").value.trim(),
            warehouses:     cells[2].querySelector("input").value.trim(),
            departureDate:  cells[3].querySelector("input").value.trim(),
            deliveryDate:   cells[4].querySelector("input").value.trim(),
            acceptanceEnd:  cells[5].querySelector("input").value.trim(),
            timeslot:       cells[6].querySelector("input").value.trim(),
            marketplace:    cells[7].querySelector("input").value.trim(),
            carNumber:      cells[8].querySelector("input").value.trim(),
            carBrand:       cells[9].querySelector("input").value.trim(),
            driverName:     cells[10].querySelector("input").value.trim(),
            driverPhone:    cells[11].querySelector("input").value.trim()
        });
    });
    // Отправляем данные на сервер для окончательного добавления
    fetch('import_schedule_confirm.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=UTF-8' },
        body: JSON.stringify(sendData)
    })
    .then(response => response.json())
    .then(result => {
        if (!result) {
            alert("Ошибка сервера при подтверждении импорта.");
            return;
        }
        const added = result.added || 0;
        const notAdded = result.not_added || 0;
        if (notAdded === 0) {
            // Все записи успешно добавлены
            alert(`✅ Успешно добавлено записей: ${added}`);
            // Закрываем окно импорта данных
            closeModal('importDataModal');
            // Можно добавить перезагрузку расписания или обновление UI, если необходимо
        } else {
            // Есть ошибки – уведомляем и остаёмся в окне для исправления
            alert(`Добавлено: ${added}, не добавлено: ${notAdded}. Исправьте ошибки в отмеченных строках и повторите.`);
            if (result.errors) {
                // Удаляем прежние отметки ошибок
                document.querySelectorAll('#importDataModal .error-field').forEach(input => {
                    input.classList.remove('error-field');
                });
                // Помечаем все строки как валидные сначала
                document.querySelectorAll('#importDataModal tr.data-row').forEach(tr => {
                    tr.classList.remove('invalid-row');
                    tr.classList.add('valid-row');
                });
                // Обрабатываем ошибки по строкам
                result.errors.forEach(errInfo => {
                    const rowIdx = errInfo.row;
                    const tr = document.querySelector(`#importDataModal tr.data-row[data-index='${rowIdx}']`);
                    if (!tr) return;
                    // Отмечаем строку как содержащую ошибки
                    tr.classList.remove('valid-row');
                    tr.classList.add('invalid-row');
                    if (errInfo.messages) {
                        errInfo.messages.forEach(msg => {
                            const msgLower = msg.toLowerCase();
                            if (msgLower.includes("город")) {
                                tr.querySelector("td:nth-child(2) input").classList.add('error-field');
                            }
                            if (msgLower.includes("склад")) {
                                tr.querySelector("td:nth-child(3) input").classList.add('error-field');
                            }
                            if (msgLower.includes("выезд")) {
                                tr.querySelector("td:nth-child(4) input").classList.add('error-field');
                            }
                            if (msgLower.includes("сдач")) {
                                tr.querySelector("td:nth-child(5) input").classList.add('error-field');
                            }
                            if (msgLower.includes("приём")) {
                                tr.querySelector("td:nth-child(6) input").classList.add('error-field');
                            }
                            if (msgLower.includes("таймслот")) {
                                tr.querySelector("td:nth-child(7) input").classList.add('error-field');
                            }
                            if (msgLower.includes("маркетплейс")) {
                                tr.querySelector("td:nth-child(8) input").classList.add('error-field');
                            }
                            if (msgLower.includes("номер")) {
                                tr.querySelector("td:nth-child(9) input").classList.add('error-field');
                            }
                            if (msgLower.includes("марка")) {
                                tr.querySelector("td:nth-child(10) input").classList.add('error-field');
                            }
                            if (msgLower.includes("водител")) {
                                tr.querySelector("td:nth-child(11) input").classList.add('error-field');
                            }
                            if (msgLower.includes("телефон")) {
                                tr.querySelector("td:nth-child(12) input").classList.add('error-field');
                            }
                        });
                    }
                });
                // Удаляем из таблицы строки, которые были успешно добавлены (не перечислены в errors)
                const errorRows = result.errors.map(e => e.row);
                document.querySelectorAll('#importDataModal tr.data-row').forEach(tr => {
                    const idx = parseInt(tr.getAttribute('data-index'));
                    if (!errorRows.includes(idx)) {
                        tr.remove();
                    }
                });
            }
        }
    })
    .catch(err => {
        console.error("Confirm fetch error:", err);
        alert("Ошибка сети при подтверждении: " + err.message);
    });
}
