import { fetchSchedules } from './scheduleApi.js';
import { openSingleShipmentModal } from './scheduleDetails.js';

export let activeCityFilter = '';
export let activeWarehouseFilter = '';
export let activeMarketplaceFilter = '';
export let archiveView = false;

export function fetchAndDisplayUpcoming(showArchived = false) {
    const container = document.getElementById('upcomingList');
    if (!container) return;
    container.innerHTML = 'Загрузка…';

    let params = { archived: showArchived ? 1 : 0 };
    if (activeMarketplaceFilter) params.marketplace = activeMarketplaceFilter;
    if (activeCityFilter) params.city = activeCityFilter;
    if (activeWarehouseFilter) params.warehouse = activeWarehouseFilter;

    fetchSchedules(params)
        .then(list => {
            const schedules = list.schedules || list;
            if (!Array.isArray(schedules)) {
                container.innerHTML = '<p>Нет расписаний.</p>';
                return;
            }
            const grouped = {};
            schedules.forEach(item => {
                const d = item.accept_date;
                if (!grouped[d]) grouped[d] = [];
                grouped[d].push(item);
            });
            const sortedDates = Object.keys(grouped).sort((a,b)=>new Date(a)-new Date(b));
            container.innerHTML = '';
            let count = 0;
            for (let d of sortedDates) {
                if (count >= 5) break;
                grouped[d].forEach(sh => {
                    const w = sh.warehouses || '—';
                    const formattedDelivery = formatDeliveryDate(sh.delivery_date);
                    const div = document.createElement('div');
                    div.className = 'upcoming-item styled-upcoming-item';
                    div.innerHTML = `
                        <div class="shipment-info">
                            <div class="shipment-header">
                                <span class="shipment-warehouse">${w}</span>
                            </div>
                            <div class="shipment-sub"><strong>${formattedDelivery}</strong></div>
                        </div>`;
                    div.addEventListener('click', () => openSingleShipmentModal(sh));
                    container.appendChild(div);
                });
                count++;
            }
            if (container.innerHTML.trim() === '') {
                container.innerHTML = '<p>Нет отправлений по выбранным условиям.</p>';
            }
        })
        .catch(err => {
            console.error('Ошибка fetchAndDisplayUpcoming:', err);
            container.innerHTML = '<p>Ошибка загрузки.</p>';
        });
}

export function formatDeliveryDate(dateStr) {
    if (!dateStr) return '';
    const days = ['Вс','Пн','Вт','Ср','Чт','Пт','Сб'];
    const d = new Date(dateStr);
    const dayName = days[d.getDay()];
    const dd = String(d.getDate()).padStart(2,'0');
    const mm = String(d.getMonth()+1).padStart(2,'0');
    const yyyy = d.getFullYear();
    return `${dd}.${mm}.${yyyy} ${dayName}`;
}
