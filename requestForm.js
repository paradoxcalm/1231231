async function openRequestFormModal(scheduleId, city = "", warehouse = "") {
    try {
        const tmplResp = await fetch('client/templates/orderModal.html');
        const tmplHtml = await tmplResp.text();
        const wrap = document.createElement('div');
        wrap.innerHTML = tmplHtml.trim();
        const modal = wrap.firstElementChild;
        document.body.appendChild(modal);

        const closeBtn = modal.querySelector('#closeOrderModal');
        closeBtn.addEventListener('click', () => modal.remove());
        modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });

        modal.querySelector('#orderScheduleId').value = scheduleId || '';
        const cityInput = modal.querySelector('#orderCity');
        const whInput = modal.querySelector('#orderWarehouse');
        if (cityInput) cityInput.value = city;
        if (whInput) whInput.value = warehouse;

        const costInput = modal.querySelector('#orderCost');
        if (city && warehouse && costInput) {
            fetch(`get_tariff.php?city=${encodeURIComponent(city)}&warehouse=${encodeURIComponent(warehouse)}`)
                .then(r => r.json())
                .then(data => { if (data.success) costInput.value = data.base_price; });
        }

        const form = modal.querySelector('#createOrderForm');
        form.addEventListener('submit', submitOrderForm);
    } catch (err) {
        console.error('Ошибка открытия формы заявки:', err);
        alert('Не удалось открыть форму заявки');
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
