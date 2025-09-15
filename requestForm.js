const appBaseUrl = new URL('..', window.location.href);
const resolveAppUrl = (relativePath) => new URL(relativePath, appBaseUrl).toString();
const formatCurrency = (amount) => {
    if (window.utils && typeof window.utils.formatCurrency === 'function') {
        return window.utils.formatCurrency(amount);
    }

    return new Intl.NumberFormat('ru-RU', {
        style: 'currency',
        currency: 'RUB',
        minimumFractionDigits: 0
    }).format(amount);
};

/**
 * Рассчитывает стоимость заявки на основе данных расписания и тарифов.
 * @param {Object} schedule - объект расписания с городом, складом и маркетплейсом
 * @returns {Promise<number>} рассчитанная стоимость
 */
async function calculateCost(schedule) {
    if (!schedule || !schedule.city || !schedule.warehouses) return 0;

    try {
        const tariffUrl = resolveAppUrl(
            `get_tariff.php?city=${encodeURIComponent(schedule.city)}&warehouse=${encodeURIComponent(schedule.warehouses)}`
        );
        const resp = await fetch(tariffUrl);
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
        const templateUrl = resolveAppUrl('client/templates/orderModal.html');
        const tmplResp = await fetch(templateUrl);
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

        const existingModal = document.getElementById('orderModal');
        if (existingModal && existingModal !== modal) {
            if (typeof existingModal.closeModal === 'function') {
                existingModal.closeModal();
                existingModal.remove();
            } else {
                existingModal.remove();
            }
        }

        document.body.appendChild(modal);

        let isClosed = false;
        const unlockBodyScroll = () => {
            if (!document.querySelector('.modal.active')) {
                document.body.style.overflow = '';
            }
        };

        const closeModal = () => {
            if (isClosed) {
                return;
            }
            isClosed = true;
            modal.classList.remove('active');
            document.removeEventListener('keydown', handleKeydown);
            setTimeout(() => {
                modal.remove();
                unlockBodyScroll();
            }, 150);
        };

        const handleKeydown = (event) => {
            if (event.key === 'Escape') {
                event.preventDefault();
                closeModal();
            }
        };

        modal.closeModal = closeModal;
        document.addEventListener('keydown', handleKeydown);

        document.body.style.overflow = 'hidden';
        requestAnimationFrame(() => modal.classList.add('active'));

        const closeBtn = modal.querySelector('#closeOrderModal');
        if (closeBtn) {
            closeBtn.addEventListener('click', closeModal);
        }

        modal.addEventListener('click', (event) => {
            if (event.target === modal) {
                closeModal();
            }
        });

        const scheduleIdInput = modal.querySelector('#orderScheduleId');
        if (scheduleIdInput) scheduleIdInput.value = schedule.id || '';
        const cityInput = modal.querySelector('#orderCity');
        const whInput = modal.querySelector('#orderWarehouse');
        if (cityInput) cityInput.value = schedule.city || '';
        if (whInput) whInput.value = schedule.warehouses || schedule.warehouse || '';

        const costInput = modal.querySelector('#orderCost');
        if (costInput) {
            if (schedule.city && schedule.warehouses) {
                const cost = await calculateCost(schedule);
                if (!isClosed) {
                    costInput.value = cost ? formatCurrency(cost) : '';
                }
            } else {
                costInput.value = '';
            }
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
                    <button type="button" class="remove-item" aria-label="Удалить товар">&times;</button>`;
                itemsContainer.appendChild(row);
            });

            itemsContainer.addEventListener('click', (event) => {
                if (event.target.classList.contains('remove-item')) {
                    const row = event.target.closest('.item-row');
                    if (row) {
                        row.remove();
                    }
                }
            });
        }

        const form = modal.querySelector('#createOrderForm');
        if (form) {
            const user = window.app && window.app.currentUser ? window.app.currentUser : null;
            if (user) {
                if (form.elements.company_name && !form.elements.company_name.value) {
                    form.elements.company_name.value = user.companyName || '';
                }
                if (form.elements.store_name && !form.elements.store_name.value) {
                    form.elements.store_name.value = user.storeName || '';
                }
            }

            const firstField = form.querySelector('input:not([type="hidden"])');
            if (firstField) {
                firstField.focus();
            }

            form.addEventListener('submit', submitOrderForm);
        } else {
            console.error('Форма создания заказа не найдена в шаблоне');
        }
    } catch (err) {
        console.error('Ошибка открытия формы заявки:', err);
        const message = err.message || 'Не удалось открыть форму заявки';
        if (window.app && typeof window.app.showError === 'function') {
            window.app.showError(message);
        } else {
            alert(message);
        }
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

    const submitBtn = form.querySelector('.submit-btn');
    const originalSubmitText = submitBtn ? submitBtn.innerHTML : '';
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Отправка...';
    }

    if (items.length === 0) {
        const message = 'Добавьте хотя бы один товар';
        if (window.app && typeof window.app.showError === 'function') {
            window.app.showError(message);
        } else {
            alert(message);
        }
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalSubmitText;
        }
        return;
    }

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

    const requestUrl = resolveAppUrl('create_order.php');

    fetch(requestUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        credentials: 'include'
    })
        .then(async (response) => {
            let data;
            try {
                data = await response.json();
            } catch (parseError) {
                console.error('Некорректный ответ сервера при создании заказа', parseError);
                throw new Error('Не удалось обработать ответ сервера');
            }

            if (!response.ok || !data.success) {
                const message = data?.message || 'Ошибка создания заказа';
                throw new Error(message);
            }

            return data;
        })
        .then(() => {
            if (window.app && typeof window.app.showSuccess === 'function') {
                window.app.showSuccess('Заказ успешно создан!');
            } else {
                alert('Заказ успешно создан!');
            }

            const modal = form.closest('.modal');
            if (modal) {
                if (typeof modal.closeModal === 'function') {
                    modal.closeModal();
                } else {
                    modal.remove();
                    if (!document.querySelector('.modal.active')) {
                        document.body.style.overflow = '';
                    }
                }
            }

            form.reset();

            if (window.OrdersManager && typeof window.OrdersManager.loadOrders === 'function') {
                window.OrdersManager.loadOrders();
            }
        })
        .catch((error) => {
            console.error('Ошибка создания заказа:', error);
            const message = error.message || 'Ошибка создания заказа';
            if (window.app && typeof window.app.showError === 'function') {
                window.app.showError(message);
            } else {
                alert(message);
            }
        })
        .finally(() => {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalSubmitText;
            }
        });
}

window.openRequestFormModal = openRequestFormModal;
