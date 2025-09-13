import { fetchSchedules } from './scheduleApi.js';
import { openShipmentsForDate } from './scheduleDetails.js';

export let calendarCurrentDate = new Date();
export let activeWarehouseFilter = '';

export function renderStaticCalendar() {
    const monthNames = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
    const currentMonthYearElem = document.getElementById('currentMonthYear');
    if (currentMonthYearElem) {
        currentMonthYearElem.textContent = `${monthNames[calendarCurrentDate.getMonth()]} ${calendarCurrentDate.getFullYear()}`;
    }
    const calendarGrid = document.getElementById('calendarGrid');
    if (!calendarGrid) return;
    calendarGrid.innerHTML = '';
    const firstDay = new Date(calendarCurrentDate.getFullYear(), calendarCurrentDate.getMonth(), 1);
    const lastDay = new Date(calendarCurrentDate.getFullYear(), calendarCurrentDate.getMonth() + 1, 0);
    const startDay = firstDay.getDay() === 0 ? 7 : firstDay.getDay();
    const prevMonthLast = new Date(calendarCurrentDate.getFullYear(), calendarCurrentDate.getMonth(), 0).getDate();
    for (let i=1; i<startDay; i++) {
        const dayNum = prevMonthLast - (startDay - i) + 1;
        calendarGrid.innerHTML += `<div class="calendar-cell" data-date="${getFullDate(calendarCurrentDate.getFullYear(), calendarCurrentDate.getMonth() - 1, dayNum)}"><div class="cell-date">${dayNum}</div></div>`;
    }
    for (let day=1; day<=lastDay.getDate(); day++) {
        const fullDate = `${calendarCurrentDate.getFullYear()}-${String(calendarCurrentDate.getMonth()+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
        const isToday = isDateToday(fullDate);
        const cellClass = isToday ? 'calendar-cell today' : 'calendar-cell';
        calendarGrid.innerHTML += `<div class="${cellClass}" data-date="${fullDate}" onclick="openShipmentsForDate('${fullDate}')"><div class="cell-date">${day}</div></div>`;
    }
    while (calendarGrid.children.length < 42) {
        const nextMonth = new Date(calendarCurrentDate.getFullYear(), calendarCurrentDate.getMonth()+1, 1);
        const nextDay = calendarGrid.children.length - (42 - 1 - lastDay.getDate()) + 1;
        const fullNextDate = getFullDate(nextMonth.getFullYear(), nextMonth.getMonth(), nextDay);
        calendarGrid.innerHTML += `<div class="calendar-cell" data-date="${fullNextDate}" onclick="openShipmentsForDate('${fullNextDate}')"><div class="cell-date">${nextDay}</div></div>`;
    }
}

function getFullDate(year, month, day) {
    if (month < 0) { year--; month = 11; }
    else if (month > 11) { year++; month = 0; }
    return `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
}

function isDateToday(dateStr) {
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
    return dateStr === todayStr;
}

export function fetchDataAndUpdateCalendar() {
    const params = {};
    if (activeWarehouseFilter) params.warehouse = activeWarehouseFilter;
    fetchSchedules(params)
        .then(data => {
            const shipmentsByDate = {};
            data.forEach(item => {
                const d = item.accept_date;
                if (!shipmentsByDate[d]) shipmentsByDate[d] = [];
                shipmentsByDate[d].push(item);
            });
            updateCalendarWithData(shipmentsByDate);
        })
        .catch(err => {
            console.error('Ошибка при fetchDataAndUpdateCalendar:', err);
            const grid = document.getElementById('calendarGrid');
            if (grid) {
                const msg = err?.message ? `Ошибка: ${err.message}` : 'Ошибка загрузки.';
                grid.innerHTML = `<p>${msg}</p>`;
            }
        });
}

function updateCalendarWithData(shipmentsByDate) {
    const cells = document.querySelectorAll('.calendar-cell');
    cells.forEach(cell => {
        const date = cell.getAttribute('data-date');
        const shipments = shipmentsByDate[date] || [];
        cell.innerHTML = '';
        const dateDiv = document.createElement('div');
        dateDiv.className = 'cell-date';
        dateDiv.textContent = date.split('-')[2];
        cell.appendChild(dateDiv);
        if (shipments.length > 0) {
            const firstWh = shipments[0].warehouses || '—';
            const labelText = shipments.length === 1 ? firstWh : firstWh + ` +${shipments.length-1}`;
            const dotColor = getStatusDotColor(shipments[0].status || '');
            const dot = document.createElement('div');
            dot.className = 'shipment-dot';
            dot.style.backgroundColor = dotColor;
            const labelDiv = document.createElement('div');
            labelDiv.className = 'shipment-label';
            labelDiv.textContent = labelText;
            cell.appendChild(dot);
            cell.appendChild(labelDiv);
        }
    });
}

function getStatusDotColor(status) {
    const s = status.toLowerCase();
    if (s.includes('пути')) return 'yellow';
    if (s.includes('ожидан')) return 'green';
    if (s.includes('возврат')) return 'red';
    return 'gray';
}

export function changeMonth(offset) {
    calendarCurrentDate.setMonth(calendarCurrentDate.getMonth()+offset);
    renderStaticCalendar();
    fetchDataAndUpdateCalendar();
}

export function onWarehouseChange(value) {
    activeWarehouseFilter = value;
    fetchDataAndUpdateCalendar();
}
