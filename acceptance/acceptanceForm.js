(function () {
    'use strict';

    const state = {
        schedules: [],
        filteredSchedules: [],
        selectedId: null
    };

    let isLoading = false;

    function loadForm() {
        const container = document.getElementById('dynamicContent');
        if (!container) {
            console.error('Контейнер для динамического контента не найден');
            return;
        }

        state.schedules = [];
        state.filteredSchedules = [];
        state.selectedId = null;

        container.innerHTML = `
            <div class="acceptance-root">
                <style>
                    .acceptance-root {
                        display: flex;
                        flex-direction: column;
                        gap: 20px;
                    }
                    .acceptance-header {
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        gap: 12px;
                    }
                    .acceptance-header h1 {
                        margin: 0;
                        font-size: 26px;
                        font-weight: 600;
                        color: #1f1f1f;
                    }
                    .acceptance-reload {
                        background: #4CAF50;
                        color: #fff;
                        border: none;
                        border-radius: 8px;
                        padding: 10px 18px;
                        font-size: 14px;
                        cursor: pointer;
                        transition: background-color 0.2s ease, box-shadow 0.2s ease;
                    }
                    .acceptance-reload:hover:not(:disabled) {
                        background: #43a047;
                        box-shadow: 0 4px 10px rgba(76, 175, 80, 0.25);
                    }
                    .acceptance-reload:disabled {
                        background: #a5d6a7;
                        cursor: default;
                        box-shadow: none;
                    }
                    .acceptance-layout {
                        display: flex;
                        gap: 24px;
                        align-items: stretch;
                    }
                    .acceptance-sidebar {
                        width: 320px;
                        max-width: 100%;
                        display: flex;
                        flex-direction: column;
                        gap: 16px;
                    }
                    .acceptance-filters {
                        background: #ffffff;
                        border: 1px solid #dfe3eb;
                        border-radius: 12px;
                        padding: 16px;
                        display: flex;
                        flex-direction: column;
                        gap: 12px;
                    }
                    .acceptance-filters label {
                        font-size: 13px;
                        font-weight: 600;
                        color: #4a4f5a;
                    }
                    .acceptance-filters input,
                    .acceptance-filters select {
                        padding: 10px 12px;
                        border: 1px solid #ccd4e0;
                        border-radius: 8px;
                        font-size: 14px;
                        transition: border-color 0.2s ease, box-shadow 0.2s ease;
                    }
                    .acceptance-filters input:focus,
                    .acceptance-filters select:focus {
                        border-color: #4CAF50;
                        outline: none;
                        box-shadow: 0 0 0 3px rgba(76, 175, 80, 0.2);
                    }
                    .acceptance-schedule-list {
                        flex: 1;
                        background: #ffffff;
                        border: 1px solid #dfe3eb;
                        border-radius: 12px;
                        padding: 12px;
                        overflow-y: auto;
                        max-height: calc(100vh - 250px);
                        display: flex;
                        flex-direction: column;
                        gap: 10px;
                    }
                    .acceptance-schedule-item {
                        display: flex;
                        flex-direction: column;
                        gap: 6px;
                        padding: 12px 14px;
                        border: 1px solid #dfe3eb;
                        border-radius: 10px;
                        background: #fbfbfc;
                        text-align: left;
                        cursor: pointer;
                        transition: border-color 0.2s ease, box-shadow 0.2s ease, background 0.2s ease;
                    }
                    .acceptance-schedule-item:hover {
                        border-color: #4CAF50;
                        box-shadow: 0 4px 12px rgba(76, 175, 80, 0.15);
                    }
                    .acceptance-schedule-item.active {
                        border-color: #4CAF50;
                        background: #f1fff3;
                        box-shadow: 0 0 0 3px rgba(76, 175, 80, 0.18);
                    }
                    .acceptance-schedule-heading {
                        display: flex;
                        flex-wrap: wrap;
                        gap: 6px;
                        align-items: baseline;
                        font-weight: 600;
                        color: #2c3142;
                    }
                    .acceptance-city {
                        font-size: 15px;
                    }
                    .acceptance-arrow {
                        color: #9da3b4;
                    }
                    .acceptance-warehouse {
                        font-size: 15px;
                        color: #374151;
                    }
                    .acceptance-meta {
                        display: flex;
                        flex-wrap: wrap;
                        gap: 8px 14px;
                        font-size: 13px;
                        color: #526079;
                    }
                    .acceptance-status-tag {
                        display: inline-flex;
                        align-items: center;
                        padding: 2px 10px;
                        font-size: 12px;
                        font-weight: 600;
                        border-radius: 999px;
                        background: #edf7ed;
                        color: #2e7d32;
                        width: fit-content;
                    }
                    .acceptance-status-tag.waiting { background: #fff8e1; color: #ad6800; }
                    .acceptance-status-tag.active { background: #e8f5e9; color: #2e7d32; }
                    .acceptance-status-tag.ready { background: #e3f2fd; color: #1565c0; }
                    .acceptance-status-tag.done { background: #eceff1; color: #546e7a; }
                    .acceptance-main {
                        flex: 1;
                        min-width: 0;
                        display: flex;
                        flex-direction: column;
                        gap: 16px;
                    }
                    .acceptance-placeholder,
                    .acceptance-message,
                    .acceptance-error {
                        background: #ffffff;
                        border: 1px dashed #d0d7e2;
                        border-radius: 12px;
                        padding: 32px;
                        text-align: center;
                        font-size: 15px;
                        color: #5b6475;
                    }
                    .acceptance-error {
                        border-color: #f44336;
                        color: #c62828;
                    }
                    .acceptance-details-card {
                        background: #ffffff;
                        border: 1px solid #dfe3eb;
                        border-radius: 12px;
                        padding: 16px 18px;
                        display: grid;
                        grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
                        gap: 12px 20px;
                        font-size: 13px;
                        color: #3c4251;
                    }
                    .acceptance-details-item {
                        display: flex;
                        flex-direction: column;
                        gap: 4px;
                    }
                    .acceptance-details-label {
                        font-weight: 600;
                        color: #6b7280;
                    }
                    .acceptance-details-value {
                        font-size: 14px;
                        color: #242a37;
                        word-break: break-word;
                    }
                    @media (max-width: 1024px) {
                        .acceptance-layout {
                            flex-direction: column;
                        }
                        .acceptance-sidebar {
                            width: 100%;
                        }
                        .acceptance-schedule-list {
                            max-height: 360px;
                        }
                    }
                    @media (max-width: 640px) {
                        .acceptance-header {
                            flex-direction: column;
                            align-items: flex-start;
                        }
                        .acceptance-reload {
                            width: 100%;
                            text-align: center;
                        }
                        .acceptance-details-card {
                            grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
                        }
                    }
                </style>
                <div class="acceptance-header">
                    <h1>Приёмка отправлений</h1>
                    <button id="acceptanceReloadBtn" class="acceptance-reload">Обновить</button>
                </div>
                <div class="acceptance-layout">
                    <aside class="acceptance-sidebar">
                        <div class="acceptance-filters">
                            <label for="acceptanceSearchInput">Поиск</label>
                            <input id="acceptanceSearchInput" type="search" placeholder="Город, склад, водитель, машина...">
                            <label for="acceptanceDateInput">Дата приёмки</label>
                            <input id="acceptanceDateInput" type="date">
                            <label for="acceptanceMarketplaceFilter">Маркетплейс</label>
                            <select id="acceptanceMarketplaceFilter">
                                <option value="">Все маркетплейсы</option>
                            </select>
                            <label for="acceptanceStatusFilter">Статус</label>
                            <select id="acceptanceStatusFilter">
                                <option value="">Все статусы</option>
                            </select>
                        </div>
                        <div id="acceptanceScheduleList" class="acceptance-schedule-list">
                            <div class="acceptance-message">Загрузка расписания...</div>
                        </div>
                    </aside>
                    <section class="acceptance-main" id="acceptanceFormContainer">
                        <div class="acceptance-placeholder">
                            Выберите отправление из списка слева, чтобы открыть форму приёмки.
                        </div>
                    </section>
                </div>
            </div>
        `;

        const list = document.getElementById('acceptanceScheduleList');
        if (list) {
            list.addEventListener('click', handleScheduleClick);
        }

        const reloadBtn = document.getElementById('acceptanceReloadBtn');
        if (reloadBtn) {
            reloadBtn.addEventListener('click', () => fetchSchedules(true));
        }

        const searchInput = document.getElementById('acceptanceSearchInput');
        const dateInput = document.getElementById('acceptanceDateInput');
        const marketplaceSelect = document.getElementById('acceptanceMarketplaceFilter');
        const statusSelect = document.getElementById('acceptanceStatusFilter');

        if (searchInput) searchInput.addEventListener('input', () => applyFilters());
        if (dateInput) dateInput.addEventListener('change', applyFilters);
        if (marketplaceSelect) marketplaceSelect.addEventListener('change', applyFilters);
        if (statusSelect) statusSelect.addEventListener('change', applyFilters);

        fetchSchedules();
    }

    function handleScheduleClick(event) {
        const item = event.target.closest('.acceptance-schedule-item');
        if (!item) return;

        const scheduleId = Number(item.dataset.id);
        if (!scheduleId) return;

        const schedule = state.schedules.find((entry) => Number(entry.id) === scheduleId);
        if (!schedule) return;

        state.selectedId = scheduleId;
        renderScheduleList();
        renderSelectedSchedule(schedule);
    }

    async function fetchSchedules(forceReload = false) {
        if (isLoading) return;

        const list = document.getElementById('acceptanceScheduleList');
        const reloadBtn = document.getElementById('acceptanceReloadBtn');

        isLoading = true;
        if (reloadBtn) {
            reloadBtn.disabled = true;
            reloadBtn.textContent = 'Загрузка...';
        }
        if (list) {
            list.innerHTML = '<div class="acceptance-message">Загрузка расписания...</div>';
        }

        try {
            const response = await fetch('fetch_schedule.php');
            if (!response.ok) {
                throw new Error(`Ошибка ${response.status}: ${response.statusText}`);
            }
            const data = await response.json();
            if (!Array.isArray(data)) {
                throw new Error('Некорректный ответ сервера');
            }

            data.sort(compareSchedules);

            state.schedules = data;
            populateFilterOptions();
            applyFilters();

            if (forceReload && state.selectedId) {
                const selectedAgain = state.schedules.find((entry) => Number(entry.id) === state.selectedId);
                if (selectedAgain) {
                    renderSelectedSchedule(selectedAgain);
                }
            }
        } catch (error) {
            console.error('Ошибка загрузки расписания приёмки:', error);
            if (list) {
                list.innerHTML = '<div class="acceptance-error">Не удалось загрузить отправления. Попробуйте обновить страницу позже.</div>';
            }
            const formContainer = document.getElementById('acceptanceFormContainer');
            if (formContainer && !formContainer.querySelector('.acceptance-placeholder')) {
                formContainer.innerHTML = '<div class="acceptance-error">Форма недоступна из-за ошибки загрузки расписания.</div>';
            }
        } finally {
            isLoading = false;
            if (reloadBtn) {
                reloadBtn.disabled = false;
                reloadBtn.textContent = 'Обновить';
            }
        }
    }

    function applyFilters() {
        const searchValue = (document.getElementById('acceptanceSearchInput')?.value || '').trim().toLowerCase();
        const dateValue = document.getElementById('acceptanceDateInput')?.value || '';
        const marketplaceValue = document.getElementById('acceptanceMarketplaceFilter')?.value || '';
        const statusValue = document.getElementById('acceptanceStatusFilter')?.value || '';

        state.filteredSchedules = state.schedules.filter((schedule) => {
            const matchesSearch = !searchValue || buildSearchString(schedule).includes(searchValue);
            const matchesDate = !dateValue || (schedule.accept_date && schedule.accept_date.startsWith(dateValue));
            const matchesMarketplace = !marketplaceValue || schedule.marketplace === marketplaceValue;
            const matchesStatus = !statusValue || schedule.status === statusValue;
            return matchesSearch && matchesDate && matchesMarketplace && matchesStatus;
        });

        if (state.filteredSchedules.length === 0) {
            state.selectedId = null;
        } else if (!state.selectedId || !state.filteredSchedules.some((item) => Number(item.id) === state.selectedId)) {
            state.selectedId = Number(state.filteredSchedules[0].id);
        }

        renderScheduleList();

        const selectedSchedule = state.filteredSchedules.find((entry) => Number(entry.id) === state.selectedId) || null;
        renderSelectedSchedule(selectedSchedule);
    }

    function renderScheduleList() {
        const list = document.getElementById('acceptanceScheduleList');
        if (!list) return;

        if (isLoading) {
            list.innerHTML = '<div class="acceptance-message">Загрузка расписания...</div>';
            return;
        }

        if (state.filteredSchedules.length === 0) {
            list.innerHTML = '<div class="acceptance-placeholder">Нет отправлений, подходящих под выбранные фильтры.</div>';
            return;
        }

        const html = state.filteredSchedules
            .map((schedule) => {
                const id = Number(schedule.id);
                const isActive = id === state.selectedId;
                const acceptDate = formatDate(schedule.accept_date);
                const deliveryDate = formatDate(schedule.delivery_date);
                const acceptTime = schedule.accept_time ? escapeHtml(schedule.accept_time) : '';
                const deadline = formatDateTime(schedule.acceptance_end || schedule.accept_deadline);
                const marketplace = schedule.marketplace ? `<span>${escapeHtml(schedule.marketplace)}</span>` : '';
                const statusTag = schedule.status ? `<span class="acceptance-status-tag ${getStatusClass(schedule.status)}">${escapeHtml(schedule.status)}</span>` : '';
                const timeslot = schedule.timeslot ? `<span>Таймслот: ${escapeHtml(schedule.timeslot)}</span>` : '';
                const driver = schedule.driver_name || schedule.driver_phone
                    ? `<span>Водитель: ${escapeHtml([schedule.driver_name, schedule.driver_phone].filter(Boolean).join(' • '))}</span>`
                    : '';
                const car = schedule.car_brand || schedule.car_number
                    ? `<span>Авто: ${escapeHtml([schedule.car_brand, schedule.car_number].filter(Boolean).join(' '))}</span>`
                    : '';
                const deadlineBlock = deadline && deadline !== '—'
                    ? `<span>Дедлайн: ${escapeHtml(deadline)}</span>`
                    : '';

                return `
                    <button type="button" class="acceptance-schedule-item${isActive ? ' active' : ''}" data-id="${escapeAttr(id)}">
                        <div class="acceptance-schedule-heading">
                            <span class="acceptance-city">${escapeHtml(schedule.city || '—')}</span>
                            <span class="acceptance-arrow">→</span>
                            <span class="acceptance-warehouse">${escapeHtml(schedule.warehouses || '—')}</span>
                            ${statusTag}
                        </div>
                        <div class="acceptance-meta">
                            <span>Приёмка: ${escapeHtml(acceptDate)}${acceptTime ? ' • ' + acceptTime : ''}</span>
                            <span>Сдача: ${escapeHtml(deliveryDate)}</span>
                            ${deadlineBlock}
                        </div>
                        <div class="acceptance-meta">
                            ${marketplace}
                            ${timeslot}
                            ${driver}
                            ${car}
                        </div>
                    </button>
                `;
            })
            .join('');

        list.innerHTML = html;
    }

    function renderSelectedSchedule(schedule) {
        const container = document.getElementById('acceptanceFormContainer');
        if (!container) return;

        if (!schedule) {
            container.innerHTML = '<div class="acceptance-placeholder">Выберите отправление из списка слева, чтобы открыть форму приёмки.</div>';
            return;
        }

        const detailsHtml = createDetailsCard(schedule);

        if (typeof window.renderFormHTML !== 'function') {
            container.innerHTML = `${detailsHtml}<div class="acceptance-error">Форма приёмки недоступна: функция renderFormHTML не найдена.</div>`;
            return;
        }

        try {
            const formHtml = window.renderFormHTML({
                id: schedule.id,
                city: schedule.city,
                warehouses: schedule.warehouses,
                accept_date: schedule.accept_date,
                delivery_date: schedule.delivery_date,
                driver_name: schedule.driver_name,
                driver_phone: schedule.driver_phone,
                car_number: schedule.car_number,
                car_brand: schedule.car_brand,
                sender: schedule.sender
            });

            container.innerHTML = `${detailsHtml}${formHtml}`;

            if (typeof pickupMapInstance !== 'undefined') {
                pickupMapInstance = null;
            }
            if (typeof pickupPlacemark !== 'undefined') {
                pickupPlacemark = null;
            }
            window.__pickupMapInited = false;

            if (typeof initializeForm === 'function') {
                initializeForm();
            }
        } catch (error) {
            console.error('Ошибка отрисовки формы приёмки:', error);
            container.innerHTML = `${detailsHtml}<div class="acceptance-error">Не удалось отобразить форму приёмки.</div>`;
        }
    }

    function populateFilterOptions() {
        const marketplaceSelect = document.getElementById('acceptanceMarketplaceFilter');
        if (marketplaceSelect) {
            const current = marketplaceSelect.value;
            const marketplaces = Array.from(new Set(state.schedules.map((s) => s.marketplace).filter(Boolean))).sort(localeSort);
            marketplaceSelect.innerHTML = '<option value="">Все маркетплейсы</option>' + marketplaces
                .map((marketplace) => `<option value="${escapeAttr(marketplace)}">${escapeHtml(marketplace)}</option>`)
                .join('');
            if (current && marketplaces.includes(current)) {
                marketplaceSelect.value = current;
            }
        }

        const statusSelect = document.getElementById('acceptanceStatusFilter');
        if (statusSelect) {
            const currentStatus = statusSelect.value;
            const statuses = Array.from(new Set(state.schedules.map((s) => s.status).filter(Boolean))).sort(localeSort);
            statusSelect.innerHTML = '<option value="">Все статусы</option>' + statuses
                .map((status) => `<option value="${escapeAttr(status)}">${escapeHtml(status)}</option>`)
                .join('');
            if (currentStatus && statuses.includes(currentStatus)) {
                statusSelect.value = currentStatus;
            }
        }
    }

    function createDetailsCard(schedule) {
        const acceptDate = formatDate(schedule.accept_date);
        const acceptTime = schedule.accept_time ? escapeHtml(schedule.accept_time) : '—';
        const deliveryDate = formatDate(schedule.delivery_date);
        const deadline = formatDateTime(schedule.acceptance_end || schedule.accept_deadline);
        const driver = escapeHtml(schedule.driver_name || '—');
        const driverPhone = escapeHtml(schedule.driver_phone || '—');
        const car = escapeHtml([schedule.car_brand, schedule.car_number].filter(Boolean).join(' ') || '—');
        const marketplace = escapeHtml(schedule.marketplace || '—');
        const timeslot = escapeHtml(schedule.timeslot || '—');
        const status = escapeHtml(schedule.status || '—');

        return `
            <div class="acceptance-details-card">
                <div class="acceptance-details-item">
                    <span class="acceptance-details-label">Маршрут</span>
                    <span class="acceptance-details-value">${escapeHtml(schedule.city || '—')} → ${escapeHtml(schedule.warehouses || '—')}</span>
                </div>
                <div class="acceptance-details-item">
                    <span class="acceptance-details-label">Приёмка</span>
                    <span class="acceptance-details-value">${escapeHtml(acceptDate)}${acceptTime !== '—' ? ' • ' + acceptTime : ''}</span>
                </div>
                <div class="acceptance-details-item">
                    <span class="acceptance-details-label">Сдача</span>
                    <span class="acceptance-details-value">${escapeHtml(deliveryDate)}</span>
                </div>
                <div class="acceptance-details-item">
                    <span class="acceptance-details-label">Дедлайн</span>
                    <span class="acceptance-details-value">${deadline !== '—' ? escapeHtml(deadline) : '—'}</span>
                </div>
                <div class="acceptance-details-item">
                    <span class="acceptance-details-label">Маркетплейс</span>
                    <span class="acceptance-details-value">${marketplace}</span>
                </div>
                <div class="acceptance-details-item">
                    <span class="acceptance-details-label">Таймслот</span>
                    <span class="acceptance-details-value">${timeslot}</span>
                </div>
                <div class="acceptance-details-item">
                    <span class="acceptance-details-label">Статус</span>
                    <span class="acceptance-details-value">${status}</span>
                </div>
                <div class="acceptance-details-item">
                    <span class="acceptance-details-label">Водитель</span>
                    <span class="acceptance-details-value">${driver}</span>
                </div>
                <div class="acceptance-details-item">
                    <span class="acceptance-details-label">Телефон водителя</span>
                    <span class="acceptance-details-value">${driverPhone}</span>
                </div>
                <div class="acceptance-details-item">
                    <span class="acceptance-details-label">Автомобиль</span>
                    <span class="acceptance-details-value">${car}</span>
                </div>
            </div>
        `;
    }

    function buildSearchString(schedule) {
        return [
            schedule.city,
            schedule.warehouses,
            schedule.marketplace,
            schedule.status,
            schedule.driver_name,
            schedule.driver_phone,
            schedule.car_brand,
            schedule.car_number,
            schedule.timeslot,
            schedule.accept_date,
            schedule.delivery_date
        ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase();
    }

    function compareSchedules(a, b) {
        const dateA = a.accept_date || '9999-12-31';
        const dateB = b.accept_date || '9999-12-31';
        if (dateA !== dateB) {
            return dateA.localeCompare(dateB);
        }
        const timeA = (a.accept_time || '').toString();
        const timeB = (b.accept_time || '').toString();
        return timeA.localeCompare(timeB);
    }

    function formatDate(value) {
        if (!value) return '—';
        if (value.includes('.')) return value;
        const [year, month, day] = value.split('-');
        if (!year || !month || !day) return value;
        return `${day.padStart(2, '0')}.${month.padStart(2, '0')}.${year}`;
    }

    function formatDateTime(value) {
        if (!value) return '—';
        const normalized = value.replace('T', ' ');
        const [datePart, timePart] = normalized.split(' ');
        const formattedDate = formatDate(datePart);
        if (!timePart) return formattedDate;
        const time = timePart.slice(0, 5);
        return time ? `${formattedDate} ${time}` : formattedDate;
    }

    function getStatusClass(status) {
        if (!status) return '';
        const normalized = status.toString().toLowerCase();
        if (normalized.includes('ожид') || normalized.includes('ожидание')) return 'waiting';
        if (normalized.includes('приём') || normalized.includes('прием') || normalized.includes('accept')) return 'active';
        if (normalized.includes('готов')) return 'ready';
        if (normalized.includes('заверш') || normalized.includes('done')) return 'done';
        return '';
    }

    function localeSort(a, b) {
        return a.localeCompare(b, 'ru', { sensitivity: 'base' });
    }

    function escapeHtml(value) {
        if (value === null || value === undefined) return '';
        return String(value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function escapeAttr(value) {
        return escapeHtml(value);
    }

    window.loadForm = loadForm;
})();
