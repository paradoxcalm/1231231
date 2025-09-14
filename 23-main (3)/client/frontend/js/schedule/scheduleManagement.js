import { fetchSchedules, bulkUpdate, deleteSchedule } from './scheduleApi.js';

export function openScheduleManagementModal() {
    const modal = document.getElementById('modalContainer');
    if (!modal) return;
    modal.innerHTML = `<div class="modal-content"><i class="fas fa-times modal-close" onclick="closeScheduleModal()"></i><div class="modal-header"><h2>Управление расписанием</h2></div><div class="modal-body"><table id="manageTable"></table><button id="delSelected">Удалить выбранные</button></div></div>`;
    modal.style.display = 'block';
    loadManagementSchedules();
    document.getElementById('delSelected').addEventListener('click', async ()=>{
        const ids = Array.from(document.querySelectorAll('.manage-check:checked')).map(cb=>cb.value);
        await bulkUpdate(ids,'delete');
        loadManagementSchedules();
    });
    window.currentModal = modal;
}

async function loadManagementSchedules() {
    const table = document.getElementById('manageTable');
    const data = await fetchSchedules({archived:0});
    table.innerHTML = data.map(sh=>`<tr><td><input type="checkbox" class="manage-check" value="${sh.id}"></td><td>${sh.city}</td><td><button class="del" data-id="${sh.id}">Удалить</button></td></tr>`).join('');
    table.querySelectorAll('.del').forEach(btn=>btn.addEventListener('click',async()=>{await deleteSchedule(btn.dataset.id);loadManagementSchedules();}));
}
