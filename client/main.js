// 📄 main.js

// Функция для отображения раздела "Приёмка"
function loadForm() {
    const dynamicContent = document.getElementById('dynamicContent');
    if (!dynamicContent) return;

    dynamicContent.style.display = 'block';
    dynamicContent.innerHTML = `
        <div class="section-container" style="padding-top: 20px;">
            <h2>Сканирование QR-кода</h2>
            <button class="icon-button" onclick="startScanner()">📷 Запустить сканер</button>
            <button class="icon-button" onclick="stopScanner()">⛔ Остановить сканер</button>
            <div id="reader" style="width: 100%; max-width: 400px; margin: auto; padding-top: 20px;"></div>
        </div>
    `;
}

// 🔘 Ручной запуск сканера
function startScanner() {
    if (typeof initScanner === 'function') {
        initScanner();
    } else {
        console.error("❌ initScanner() не найден — проверь подключение scan.js");
    }
}

// ⛔ Остановка сканера
function stopScanner() {
    if (typeof stopScan === 'function') {
        stopScan();
        console.log("⛔ Сканер остановлен вручную");
    } else {
        console.error("❌ stopScan() не найден — проверь подключение scan.js");
    }
}

// Переключение между вкладками "Форма / Скан"
function switchReceptionTab(tabId) {
    const sections = ['formSection', 'scanSection'];
    sections.forEach(id => {
        const tab = document.getElementById(id);
        const btn = document.querySelector(`.tab-button[onclick*="${id}"]`);
        if (tab) tab.style.display = (id === tabId) ? 'block' : 'none';
        if (btn) btn.classList.toggle('active', id === tabId);
    });

    if (tabId === 'formSection') {
        console.log("🔄 Переключено на Приёмку");
    } else if (tabId === 'scanSection') {
        if (typeof initScanner === 'function') {
            initScanner();
        } else {
            console.error("❌ initScanner() не найден — проверь подключение scan.js");
        }
    }
}

// Функция для отображения раздела "Таблица"
function loadTable() {
    const dynamicContent = document.getElementById('dynamicContent');
    if (!dynamicContent) return;
    dynamicContent.style.display = 'block';
    dynamicContent.innerHTML = `
        <h2>Таблица отправлений</h2>
        <div id="tableContainer"></div>
        <div id="paginationContainer"></div>
        <button class="icon-button" onclick="exportAllDataToExcel()" style="margin-top: 10px;">
            <i class="fas fa-download"></i> Выгрузить в Excel
        </button>
    `;
    fetchDataAndDisplayTable();
}


// Функция для отображения раздела "Расписание"
function loadChart() {
    const scheduleSection = document.getElementById('scheduleSection');
    if (!scheduleSection) return;

    document.getElementById('dynamicContent').style.display = 'none';
    const tableSection = document.getElementById('tableSection');
    if (tableSection) tableSection.style.display = 'none';

    scheduleSection.style.display = 'block';

    const scheduleContainer = document.getElementById('scheduleContainer');
    scheduleContainer.innerHTML = '';

    const tableContainer = document.createElement('div');
    tableContainer.id = 'scheduleTable';
    tableContainer.classList.add('schedule-container');
    tableContainer.innerHTML = generateScheduleTable();

    scheduleContainer.appendChild(tableContainer);
}

function generateScheduleTable(weekOffset = 0) {
    const today = new Date();
    today.setDate(today.getDate() + weekOffset * 7);
    const firstDayOfWeek = new Date(today);
    firstDayOfWeek.setDate(today.getDate() - today.getDay() + 1);
    const monthNames = ["янв", "фев", "мар", "апр", "май", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];
    let tableHTML = `<h2 class="schedule-title">Расписание отправок</h2>`;
    tableHTML += `<table class="schedule-table"><thead><tr>`;
    for (let i = 0; i < 7; i++) {
        const currentDate = new Date(firstDayOfWeek);
        currentDate.setDate(firstDayOfWeek.getDate() + i);
        const dayNames = ['ПН', 'ВТ', 'СР', 'ЧТ', 'ПТ', 'СБ', 'ВС'];
        const dayName = dayNames[i];
        const day = currentDate.getDate();
        const month = monthNames[currentDate.getMonth()];
        tableHTML += `<th>${dayName} <br> ${day} ${month}</th>`;
    }
    tableHTML += `</tr></thead><tbody><tr>`;
    for (let i = 0; i < 7; i++) {
        tableHTML += `<td class="schedule-cell"></td>`;
    }
    tableHTML += `</tr></tbody></table>`;
    tableHTML += `
        <div class="schedule-controls">
            <button onclick="changeWeek(-1)">← Предыдущая неделя</button>
            <button onclick="changeWeek(1)">Следующая неделя →</button>
        </div>
    `;
    return tableHTML;
}

let currentWeekOffset = 0;
function changeWeek(offset) {
    currentWeekOffset += offset;
    const scheduleTable = document.getElementById('scheduleTable');
    if (scheduleTable) {
        scheduleTable.innerHTML = generateScheduleTable(currentWeekOffset);
    }
}

function toggleMobileProfileMenu() {
  const menu = document.getElementById("mobileProfileMenu");
  if (!menu) return;
  menu.classList.toggle("visible");
  menu.classList.toggle("hidden");
}
