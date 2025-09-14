import { fetchAndDisplayUpcoming, archiveView } from './scheduleUpcoming.js';
import { renderStaticCalendar, fetchDataAndUpdateCalendar } from './scheduleCalendar.js';
import { showCreateForm } from './scheduleCreateForm.js';
import { openScheduleManagementModal } from './scheduleManagement.js';

export function loadSchedule() {
    const dynamicContent = document.getElementById('dynamicContent');
    if (!dynamicContent) return;
    dynamicContent.innerHTML = `
        <div class="schedule-container">
            <h1 class="section-title">Расписание</h1>
            <div class="tab-header">
                <button class="tab-button active" id="tab-upcoming">Ближайшие отправления</button>
                <button class="tab-button" id="tab-calendar">Календарь</button>
            </div>
            <div id="upcomingList"></div>
            <div id="calendarView" style="display:none;">
                <div class="calendar-controls">
                    <button id="prevMonth">&lt;</button>
                    <span id="currentMonthYear"></span>
                    <button id="nextMonth">&gt;</button>
                </div>
                <div id="calendarGrid" class="calendar-grid"></div>
            </div>
            <div class="schedule-actions">
                <button id="createBtn">Создать отправление</button>
                <button id="manageBtn">⚙️ Управление</button>
            </div>
        </div>`;

    document.getElementById('tab-upcoming').addEventListener('click', () => switchTab('upcoming'));
    document.getElementById('tab-calendar').addEventListener('click', () => switchTab('calendar'));
    document.getElementById('createBtn').addEventListener('click', showCreateForm);
    document.getElementById('manageBtn').addEventListener('click', openScheduleManagementModal);
    document.getElementById('prevMonth').addEventListener('click', () => changeMonth(-1));
    document.getElementById('nextMonth').addEventListener('click', () => changeMonth(1));

    fetchAndDisplayUpcoming(archiveView);
    renderStaticCalendar();
    fetchDataAndUpdateCalendar();
}

function switchTab(tab) {
    const upcomingList = document.getElementById('upcomingList');
    const calendarView = document.getElementById('calendarView');
    if (tab === 'upcoming') {
        upcomingList.style.display = 'block';
        calendarView.style.display = 'none';
    } else {
        upcomingList.style.display = 'none';
        calendarView.style.display = 'block';
    }
}

function changeMonth(offset) {
    import('./scheduleCalendar.js').then(mod => {
        mod.changeMonth(offset);
    });
}
