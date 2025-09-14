import { createSchedule } from './scheduleApi.js';

export function showCreateForm() {
    const modalContainer = document.getElementById('modalContainer');
    if (!modalContainer) return;
    modalContainer.innerHTML = `
        <div class="modal-content">
            <i class="fas fa-times modal-close" onclick="closeScheduleModal()"></i>
            <div class="modal-header"><h2>Создать отправление</h2></div>
            <div class="modal-body">
                <form id="createScheduleForm">
                    <input type="text" name="city" placeholder="Город" required />
                    <input type="date" name="accept_date" required />
                    <input type="date" name="delivery_date" required />
                    <button type="submit">Сохранить</button>
                </form>
                <div id="createError" class="error-message" style="display:none;color:red;"></div>
            </div>
        </div>`;
    modalContainer.style.display = 'block';
    const form = document.getElementById('createScheduleForm');
    form.addEventListener('submit', async e => {
        e.preventDefault();
        const formData = new FormData(form);
        const resp = await createSchedule(formData);
        if (resp.status === 'success') {
            closeScheduleModal();
        } else {
            const err = document.getElementById('createError');
            err.textContent = resp.message || 'Ошибка';
            err.style.display = 'block';
        }
    });
    window.currentModal = modalContainer;
}
