/**
 * Рассчитывает стоимость заявки на основе данных расписания и тарифов.
 * @param {Object} schedule - объект расписания с городом, складом и маркетплейсом
 * @returns {Promise<number>} рассчитанная стоимость
 */
async function calculateCost(schedule) {
    if (!schedule || !schedule.city || !schedule.warehouses) return 0;

    try {
        const resp = await fetch(
            `get_tariff.php?city=${encodeURIComponent(schedule.city)}&warehouse=${encodeURIComponent(schedule.warehouses)}`
        );
        const data = await resp.json();
        if (!data.success) return 0;

        const basePrice = parseFloat(data.base_price) || 0;
        const multipliers = {
            'Wildberries': 1.0,
            'Ozon': 1.1,
            'YandexMarket': 1.05
        };

        return basePrice * (multipliers[schedule.marketplace] || 1.0);
    } catch (err) {
        console.error('Ошибка расчёта стоимости:', err);
        return 0;
    }
}

async function openRequestFormModal(scheduleOrId, city = "", warehouse = "", marketplace = "") {
    const schedule =
        typeof scheduleOrId === 'object'
            ? scheduleOrId
            : { id: scheduleOrId, city, warehouses: warehouse, marketplace };

    try {
        const tmplResp = await fetch('/client/templates/orderModal.html');
        if (!tmplResp.ok) {
            if (tmplResp.status === 404) {
                throw new Error('Шаблон формы заявки не найден');
            }
            throw new Error('Ошибка загрузки шаблона формы заявки');
        }
        const tmplHtml = await tmplResp.text();
        const wrap = document.createElement('div');
        wrap.innerHTML = tmplHtml.trim();
        const modal = wrap.firstElementChild;
        if (!modal) {
            throw new Error('Шаблон формы заявки не содержит модальное окно');
        }
        document.body.appendChild(modal);

        const closeBtn = modal.querySelector('#closeOrderModal');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => modal.remove());
        }
        modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });

        const scheduleIdInput = modal.querySelector('#orderScheduleId');
        if (scheduleIdInput) scheduleIdInput.value = schedule.id || '';
        const cityInput = modal.querySelector('#orderCity');
        const whInput = modal.querySelector('#orderWarehouse');
        if (cityInput) cityInput.value = schedule.city || '';
        if (whInput) whInput.value = schedule.warehouses || schedule.warehouse || '';

        const costInput = modal.querySelector('#orderCost');
        if (costInput && schedule.city && schedule.warehouses) {
            const cost = await calculateCost(schedule);
            costInput.value = cost ? window.utils.formatCurrency(cost) : '';
        }

        const form = modal.querySelector('#createOrderForm');
        if (form) {
            form.addEventListener('submit', submitOrderForm);
        } else {
            console.error('Форма создания заказа не найдена в шаблоне');
        }
    } catch (err) {
        console.error('Ошибка открытия формы заявки:', err);
        alert(err.message || 'Не удалось открыть форму заявки');
    }
}

function submitOrderForm(e) {
    e.preventDefault();
    const form = e.target;
    const formData = new FormData(form);
    const payload = {};
    for (let [key, value] of formData.entries()) {
        if (payload[key]) {
            if (Array.isArray(payload[key])) payload[key].push(value);
            else payload[key] = [payload[key], value];
        } else {
            payload[key] = value;
        }
    }
    fetch('create_order.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        credentials: 'include'
    })
        .then(r => r.json())
        .then(data => {
            if (data.success) {
                alert('Заказ успешно создан!');
                const modal = form.closest('.modal');
                if (modal) modal.remove();
            } else {
                alert(data.message || 'Ошибка создания заказа');
            }
        })
        .catch(err => {
            alert('Ошибка сети: ' + err.message);
        });
}

window.openRequestFormModal = openRequestFormModal;
