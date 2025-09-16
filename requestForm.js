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

function resolveTemplateUrl(relativePath) {
    if (typeof relativePath !== 'string') return relativePath;

    // Сначала пытаемся вычислить путь относительно текущей страницы
    try {
        return new URL(relativePath, window.location.href).toString();
    } catch (err) {
        console.warn('Не удалось вычислить путь относительно текущей страницы:', err);
    }

    // Если не удалось, пробуем относительно самого скрипта requestForm.js


    try {
        const currentScript = document?.currentScript;
        if (currentScript?.src) {
            return new URL(relativePath, currentScript.src).toString();
        }

        const scripts = document?.querySelectorAll?.('script[src]');
        if (scripts) {
            for (const script of scripts) {
                if (script.src?.includes('requestForm.js')) {
                    return new URL(relativePath, script.src).toString();
                }
            }
        }
    } catch (err) {
        console.warn('Не удалось вычислить путь относительно скрипта requestForm.js:', err);
    }

    try {
        return new URL(relativePath, window.location.href).toString();
    } catch (err) {
        console.warn('Не удалось вычислить путь относительно текущей страницы:', err);
    }

    return relativePath;
}

async function openRequestFormModal(scheduleOrId, city = "", warehouse = "", marketplace = "") {
    const schedule =
        typeof scheduleOrId === 'object'
            ? scheduleOrId
            : { id: scheduleOrId, city, warehouses: warehouse, marketplace };
    const relativeTemplatePath = window.location.pathname.includes('/client/')
        ? '/client/templates/orderModal.html'
        : 'templates/orderModal.html';
    const templateUrl = resolveTemplateUrl(relativeTemplatePath);
    try {
        const tmplResp = await fetch(templateUrl);
        if (!tmplResp.ok) {
            console.error(`Не удалось загрузить шаблон формы заявки (${templateUrl}): ${tmplResp.status} ${tmplResp.statusText}`);
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

        const itemsContainer = modal.querySelector('#itemsContainer');
        const addItemBtn = modal.querySelector('#addItemBtn');
        if (itemsContainer && addItemBtn) {
            addItemBtn.addEventListener('click', () => {
                const row = document.createElement('div');
                row.className = 'item-row';
                row.innerHTML = `
              <input type="text" class="item-barcode" placeholder="Штрихкод" required>
              <input type="number" class="item-qty" min="1" value="1" required>
              <button type="button" class="remove-item">&times;</button>`;
                itemsContainer.appendChild(row);
            });
            itemsContainer.addEventListener('click', (ev) => {
                if (ev.target.classList.contains('remove-item')) {
                    const row = ev.target.closest('.item-row');
                    if (row) row.remove();
                }
            });
        }

        const form = modal.querySelector('#createOrderForm');
        if (form) {
            form.addEventListener('submit', submitOrderForm);
        } else {
            console.error('Форма создания заказа не найдена в шаблоне');
        }
    } catch (err) {
        console.error('Ошибка открытия формы заявки:', err);
        if (templateUrl) {
            console.error('Форма заявки не была открыта. Попытка загрузить шаблон по адресу:', templateUrl);
        }
        alert(err.message || 'Не удалось открыть форму заявки');
    }
}

function submitOrderForm(e) {
    e.preventDefault();
    const form = e.target;

    const packagingMap = { box: 'Box', pallet: 'Pallet' };
    const packagingValue = form.elements.packaging_type?.value || 'box';
    const packaging_type = packagingMap[packagingValue] || packagingValue;

    const marketplace_wildberries = form.elements.marketplace_wildberries?.checked ? 1 : 0;
    const marketplace_ozon = form.elements.marketplace_ozon?.checked ? 1 : 0;

    const items = [];
    form.querySelectorAll('#itemsContainer .item-row').forEach(row => {
        const barcode = row.querySelector('.item-barcode')?.value.trim();
        const qty = parseInt(row.querySelector('.item-qty')?.value, 10) || 0;
        if (barcode && qty > 0) {
            items.push({ barcode, total_qty: qty });
        }
    });

    const payload = {
        schedule_id: form.elements.schedule_id?.value || '',
        company_name: form.elements.company_name?.value.trim() || '',
        store_name: form.elements.store_name?.value.trim() || '',
        comment: form.elements.comment?.value.trim() || '',
        packaging_type,
        marketplace_wildberries,
        marketplace_ozon,
        items
    };

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
