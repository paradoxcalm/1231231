import { state, setCurrentModal, syncWindowFilters } from './state.js';
import { formatDeliveryDate } from './utils.js';

function canCreateOrderForSchedule(schedule) {
    if (!schedule) return false;
    if (schedule.status === 'Завершено' || schedule.status === 'Товар отправлен') return false;

    const deadline = schedule.accept_deadline;
    if (!deadline) return true;

    const now = new Date();
    const deadlineDate = new Date(deadline);
    return now <= deadlineDate;
}

export function openSingleShipmentModal(sh) {
    const modalContainer = document.getElementById('modalContainer');
    if (!modalContainer) return;

    modalContainer.innerHTML = '';
    modalContainer.style.display = 'block';

    const modalContent = document.createElement('div');
    modalContent.className = 'modal-content';

    const role = window.userRole || 'client';

    modalContent.innerHTML = `
        <span class="modal-close" onclick="closeScheduleModal()"><i class="fas fa-times"></i></span>
        <div class="modal-header">
            <h2>Отправление №${sh.id || '—'}</h2>
        </div>

        <div class="modal-section">
            <div class="modal-section-title">Информация об отправлении</div>
            <div class="modal-row"><div class="modal-label">Город отправления:</div><div class="modal-value">${sh.city || '—'}</div></div>
            <div class="modal-row"><div class="modal-label">Склад назначения:</div><div class="modal-value">${sh.warehouses || '—'}</div></div>
            <div class="modal-row"><div class="modal-label">Отправление:</div><div class="modal-value">${sh.accept_date || '—'}</div></div>
            <div class="modal-row"><div class="modal-label">Время приёмки:</div><div class="modal-value">${sh.accept_time || '—'}</div></div>
            <div class="modal-row"><div class="modal-label">Сдача (дата):</div><div class="modal-value">${sh.delivery_date || '—'}</div></div>
            <div class="modal-row"><div class="modal-label">Приёмка до:</div><div class="modal-value">${sh.accept_deadline || '—'}</div></div>
            <div class="modal-row"><div class="modal-label">Маркетплейс:</div><div class="modal-value">${sh.marketplace || '—'}</div></div>
        </div>

        <div class="modal-section">
            <div class="modal-section-title">Авто и водитель</div>
            <div class="modal-row"><div class="modal-label">Авто:</div><div class="modal-value">${sh.car_number || '—'} (${sh.car_brand || '—'})</div></div>
            <div class="modal-row"><div class="modal-label">Водитель:</div><div class="modal-value">${sh.driver_name || '—'}</div></div>
            <div class="modal-row"><div class="modal-label">Телефон:</div><div class="modal-value">${sh.driver_phone || '—'}</div></div>
        </div>

        <div class="modal-actions">
            ${canCreateOrderForSchedule(sh) ? `
                <button class="create-order-btn big-action" onclick="createOrder(${sh.id}, '${sh.city}', '${sh.warehouses}', '${sh.marketplace}')">
                    <i class="fas fa-plus-circle"></i> Создать заявку
                </button>
            ` : `<span class="closed-message">Приём заявок закрыт</span>`}

            ${role === 'admin' || role === 'manager' ? `
                <div class="status-control" style="margin-top:10px;margin-bottom:10px;">
                    <label for="statusSelect_${sh.id}">Изменить статус:</label>
                    <select id="statusSelect_${sh.id}" onchange="updateStatus(${sh.id}, this.value)">
                        <option value="Ожидает отправки" ${sh.status === 'Ожидает отправки' ? 'selected' : ''}>Ожидает отправки</option>
                        <option value="Готов к отправке" ${sh.status === 'Готов к отправке' ? 'selected' : ''}>Готов к отправке</option>
                        <option value="В пути" ${sh.status === 'В пути' ? 'selected' : ''}>В пути</option>
                        <option value="Завершено" ${sh.status === 'Завершено' ? 'selected' : ''}>Завершено</option>
                    </select>
                </div>

                <button class="action-button" onclick="editSchedule(${sh.id})">
                    <i class="fas fa-edit"></i> Редактировать
                </button>
                <button class="action-button" onclick="deleteSchedule(${sh.id})">
                    <i class="fas fa-trash"></i> Удалить
                </button>
            ` : ''}
        </div>
    `;

    modalContainer.appendChild(modalContent);
    setCurrentModal(modalContainer);
}

export function fetchAndDisplayUpcoming(showArchived = false, statusCategory = 'active') {
    const container = document.getElementById('upcomingList');
    if (!container) return;
    container.innerHTML = 'Загрузка…';

    let url = `schedule.php?archived=${showArchived ? 1 : 0}`;
    if (state.activeMarketplaceFilter) {
        url += `&marketplace=${encodeURIComponent(state.activeMarketplaceFilter)}`;
    }
    if (state.activeCityFilter) {
        url += `&city=${encodeURIComponent(state.activeCityFilter)}`;
    }
    if (state.activeDestinationWarehouseFilter) {
        url += `&warehouse=${encodeURIComponent(state.activeDestinationWarehouseFilter)}`;
    }

    fetch(url)
        .then(async r => {
            if (!r.ok) throw new Error('Ошибка загрузки: ' + r.status);
            const ct = r.headers.get('Content-Type') || '';
            if (!ct.includes('application/json')) {
                const txt = await r.text();
                throw new Error('Сервер вернул не JSON: ' + txt.slice(0, 200));
            }
            try {
                return await r.json();
            } catch (e) {
                throw new Error('Ошибка парсинга JSON: ' + e.message);
            }
        })
        .then(data => {
            const list = Array.isArray(data?.schedules) ? data.schedules : data;
            if (!Array.isArray(list) || list.length === 0) {
                container.innerHTML = 'Нет расписаний.';
                return;
            }

            const now = new Date();
            now.setHours(0, 0, 0, 0);

            const activeList = [];
            const transitList = [];
            const completedList = [];

            list.forEach(item => {
                if (!item?.accept_date || !item?.delivery_date) return;
                const accept = new Date(item.accept_date);
                const deliver = new Date(item.delivery_date);
                if (Number.isNaN(accept) || Number.isNaN(deliver)) return;

                accept.setHours(0, 0, 0, 0);
                deliver.setHours(0, 0, 0, 0);

                if (accept >= now) {
                    activeList.push(item);
                } else if (deliver >= now) {
                    transitList.push(item);
                } else {
                    completedList.push(item);
                }
            });

            let listToDisplay;
            if (statusCategory === 'active') listToDisplay = activeList;
            else if (statusCategory === 'transit') listToDisplay = transitList;
            else listToDisplay = completedList;

            if (window.userRole === 'client') {
                listToDisplay = listToDisplay.filter(canCreateOrderForSchedule);
            }

            if (!listToDisplay.length) {
                container.innerHTML = 'Нет расписаний для выбранной категории.';
                return;
            }

            const grouped = {};
            listToDisplay.forEach(sh => {
                const d = sh.accept_date;
                if (!grouped[d]) grouped[d] = [];
                grouped[d].push(sh);
            });

            container.innerHTML = '';
            Object.keys(grouped)
                .sort((a, b) => new Date(a) - new Date(b))
                .forEach(d => {
                    grouped[d].forEach(sh => {
                        const formattedAccept = formatDeliveryDate(sh.accept_date);
                        const formattedDelivery = formatDeliveryDate(sh.delivery_date);

                        let mpClass = '';
                        if (sh.marketplace === 'Ozon') mpClass = 'mp-ozon';
                        else if (sh.marketplace === 'Wildberries') mpClass = 'mp-wb';
                        else if (sh.marketplace === 'YandexMarket') mpClass = 'mp-yandex';

                        const canOrder = canCreateOrderForSchedule(sh);

                        const div = document.createElement('div');
                        div.className = 'upcoming-item styled-upcoming-item';
                        if (canOrder && typeof window.openRequestFormModal === 'function') {
                            div.classList.add('card-clickable');
                            div.addEventListener('click', () => window.openRequestFormModal(sh));
                        }

                        div.innerHTML = `
                            <div class="shipment-info">
                                <div class="shipment-header" style="display:flex; justify-content:space-between; align-items:center;">
                                    <span class="shipment-warehouse">${sh.city || '—'} → ${sh.warehouses || '—'}</span>
                                    <span class="shipment-marketplace ${mpClass}">${sh.marketplace || ''}</span>
                                </div>
                                <div class="shipment-date-row" style="display:flex; justify-content:space-between; align-items:center; margin-top:8px;">
                                    <div class="shipment-sub"><strong>${formattedAccept} → ${formattedDelivery}</strong></div>
                                    ${canOrder ? `<span class="cta-label">Создать заявку</span>` : ''}
                                </div>
                            </div>
                        `;
                        container.appendChild(div);
                    });
                });
        })
        .catch(err => {
            container.innerHTML = 'Не удалось загрузить расписание. Обратитесь в поддержку.';
            console.error('Ошибка fetchAndDisplayUpcoming:', err);
        });
}

export function setArchiveView(value) {
    state.archiveView = value;
    syncWindowFilters();
}
