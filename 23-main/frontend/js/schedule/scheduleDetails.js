import { updateScheduleStatus, deleteSchedule } from './scheduleApi.js';
import { editSchedule } from './scheduleEditForm.js';
import { createOrder } from '/client/requestForm.js';

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
        <div class="modal-header"><h2>Отправление №${sh.id || '—'}</h2></div>
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
            ${canCreateOrderForSchedule(sh) ? `<button class="create-order-btn big-action" onclick="createOrder(${sh.id}, '${sh.city}', '${sh.warehouses}')"><i class="fas fa-plus-circle"></i> Создать заявку</button>` : '<span class="closed-message">Приём заявок закрыт</span>'}
            ${role === 'admin' || role === 'manager' ? `
                <div class="status-control" style="margin-top:10px;margin-bottom:10px;">
                    <label for="statusSelect_${sh.id}">Изменить статус:</label>
                    <select id="statusSelect_${sh.id}">
                        <option value="Ожидает отправки" ${sh.status === 'Ожидает отправки' ? 'selected' : ''}>Ожидает отправки</option>
                        <option value="Готов к отправке" ${sh.status === 'Готов к отправке' ? 'selected' : ''}>Готов к отправке</option>
                        <option value="В пути" ${sh.status === 'В пути' ? 'selected' : ''}>В пути</option>
                        <option value="Завершено" ${sh.status === 'Завершено' ? 'selected' : ''}>Завершено</option>
                    </select>
                </div>
                <button class="action-button" id="editBtn"><i class="fas fa-edit"></i> Редактировать</button>
                <button class="action-button" id="delBtn"><i class="fas fa-trash"></i> Удалить</button>
            ` : ''}
        </div>`;
    modalContainer.appendChild(modalContent);
    document.getElementById(`statusSelect_${sh.id}`)?.addEventListener('change', e => {
        updateScheduleStatus(sh.id, e.target.value);
    });
    document.getElementById('editBtn')?.addEventListener('click', () => editSchedule(sh.id));
    document.getElementById('delBtn')?.addEventListener('click', () => deleteSchedule(sh.id));
    window.currentModal = modalContainer;
}

export function canCreateOrderForSchedule(schedule) {
    if (!schedule) return false;
    if (schedule.status === 'Завершено' || schedule.status === 'Товар отправлен') return false;
    const deadline = schedule.accept_deadline;
    if (!deadline) return true;
    const now = new Date();
    const deadlineDate = new Date(deadline);
    return now <= deadlineDate;
}
export function openShipmentsForDate(date) {
    fetch(`/backend/schedule/listSchedules.php?date=${encodeURIComponent(date)}`)
        .then(r => r.json())
        .then(data => {
            const modalContainer = document.getElementById('modalContainer');
            if (!modalContainer) return;
            if (!Array.isArray(data) || data.length === 0) {
                modalContainer.innerHTML = '<div class="modal-content"><span class="modal-close" onclick="closeScheduleModal()"><i class="fas fa-times"></i></span><p style="padding:20px;">На эту дату нет отправлений.</p></div>';
                modalContainer.style.display = 'block';
                return;
            }
            if (data.length === 1) {
                openSingleShipmentModal(data[0]);
                return;
            }
            let tabsHtml = '<div class="tab-header">';
            let contentHtml = '';
            data.forEach((sh,i)=>{
                const tabId = `shTab${i}`;
                tabsHtml += `<button class="tab-button ${i===0?'active':''}" onclick="switchShipmentSubTab(${i},${data.length})" id="tabBtn${i}">${sh.warehouses||'Отпр.'+(i+1)}</button>`;
                contentHtml += `<div class="shipment-subtab" id="${tabId}" style="display:${i===0?'block':'none'};">${renderShipmentDetailsHTML(sh)}</div>`;
            });
            modalContainer.innerHTML = `<div class="modal-content"><span class="modal-close" onclick="closeScheduleModal()"><i class="fas fa-times"></i></span><h2>Отправления на ${date}</h2>${tabsHtml}<div id="shipmentSubtabs">${contentHtml}</div></div>`;
            modalContainer.style.display = 'block';
            window.currentModal = modalContainer;
        });
}

function renderShipmentDetailsHTML(sh) {
    return `<div>Склад: ${sh.warehouses || ''}<br/>Статус: ${sh.status}</div>`;
}

export function switchShipmentSubTab(index, total) {
    for (let i=0;i<total;i++) {
        const btn = document.getElementById(`tabBtn${i}`);
        const tab = document.getElementById(`shTab${i}`);
        if(!btn||!tab) continue;
        if(i===index){btn.classList.add('active');tab.style.display='block';}else{btn.classList.remove('active');tab.style.display='none';}
    }
}
