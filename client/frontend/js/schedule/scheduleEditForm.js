import { getSchedule, editSchedule as apiEdit } from './scheduleApi.js';

export async function editSchedule(id) {
    const data = await getSchedule(id);
    if (!data.success) return;
    const sh = data.schedule;
    const modalContainer = document.getElementById('modalContainer');
    if (!modalContainer) return;
    modalContainer.innerHTML = `<div class="modal-content">
        <i class="fas fa-times modal-close" onclick="closeScheduleModal()"></i>
        <div class="modal-header"><h2>Редактировать отправление</h2></div>
        <div class="modal-body">
            <form id="editScheduleForm">
                <input type="hidden" name="id" value="${sh.id}" />
                <input type="text" name="city" value="${sh.city}" required />
                <button type="submit">Сохранить</button>
            </form>
            <div id="editError" class="error-message" style="display:none;color:red;"></div>
        </div>
    </div>`;
    modalContainer.style.display = 'block';
    const form = document.getElementById('editScheduleForm');
    form.addEventListener('submit', async e => {
        e.preventDefault();
        const formData = new FormData(form);
        const resp = await apiEdit(id, formData);
        if (resp.status === 'success') {
            closeScheduleModal();
        } else {
            const err = document.getElementById('editError');
            err.textContent = resp.message || 'Ошибка';
            err.style.display = 'block';
        }
    });
    window.currentModal = modalContainer;
}
