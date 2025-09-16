/**
 * Рассчитывает стоимость заявки на основе данных расписания и тарифов.
 * @param {Object} schedule - объект расписания с городом, складом и маркетплейсом
 * @returns {Promise<number>} рассчитанная стоимость
 */
async function calculateCost(schedule) {
    if (!schedule || !schedule.city) return 0;
    const warehouseName = schedule.warehouses || schedule.warehouse;
    if (!warehouseName) return 0;

    try {
        const resp = await fetch(
            `/get_tariff.php?city=${encodeURIComponent(schedule.city)}&warehouse=${encodeURIComponent(warehouseName)}`
        );
        if (!resp.ok) {
            console.error('get_tariff.php вернул статус', resp.status);
            return 0;
        }
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
        console.error('Ошибка расчёта стоимости:', err?.message || err);
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

const LEGACY_TEMPLATE_PATHS = [
    '/client/templates/customOrderModal.html',
    'client/templates/customOrderModal.html',
    'templates/customOrderModal.html'
];

let legacyFormScriptPromise = null;
let yandexMapsPromise = null;

function ensureLegacyFormScript() {
    if (typeof window.initializeForm === 'function') {
        return Promise.resolve();
    }
    if (legacyFormScriptPromise) {
        return legacyFormScriptPromise;
    }
    const scriptUrl = resolveTemplateUrl('/form.js');
    legacyFormScriptPromise = new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = scriptUrl;
        script.async = true;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error(`Не удалось загрузить скрипт формы (${scriptUrl})`));
        document.head.appendChild(script);
    });
    return legacyFormScriptPromise;
}

function ensureYandexMaps() {
    if (typeof window.ymaps !== 'undefined') {
        return Promise.resolve();
    }
    if (yandexMapsPromise) {
        return yandexMapsPromise;
    }
    yandexMapsPromise = new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://api-maps.yandex.ru/2.1/?lang=ru_RU';
        script.async = true;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('Не удалось загрузить Яндекс.Карты'));
        document.head.appendChild(script);
    });
    return yandexMapsPromise;
}

function ensureRequestModalContainer() {
    let modal = document.getElementById('requestModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'requestModal';
        modal.className = 'modal';
        const content = document.createElement('div');
        content.className = 'modal-content';
        content.id = 'requestModalContent';
        modal.appendChild(content);
        document.body.appendChild(modal);
    } else if (!modal.querySelector('#requestModalContent')) {
        const content = document.createElement('div');
        content.className = 'modal-content';
        content.id = 'requestModalContent';
        modal.appendChild(content);
    }
    return modal;
}

function setupGlobalLoadOrdersFallback() {
    if (typeof window.loadOrders === 'function') return;
    const manager = window.OrdersManager;
    if (manager && typeof manager.loadOrders === 'function') {
        window.loadOrders = manager.loadOrders.bind(manager);
    }
}

function normalizeSchedule(scheduleOrId, fallbackCity = '', fallbackWarehouse = '', fallbackMarketplace = '') {
    const schedule = typeof scheduleOrId === 'object' && scheduleOrId !== null
        ? scheduleOrId
        : { id: scheduleOrId, city: fallbackCity, warehouses: fallbackWarehouse, marketplace: fallbackMarketplace };

    const city = schedule.city || schedule.city_name || schedule.route_city || fallbackCity || '';
    const warehouse = schedule.warehouses || schedule.warehouse || schedule.route_warehouse || fallbackWarehouse || '';
    const acceptDate = schedule.accept_date || schedule.acceptDate || schedule.departure_date || schedule.departureDate || '';
    const deliveryDate = schedule.delivery_date || schedule.deliveryDate || '';
    const acceptTime = schedule.accept_time || schedule.acceptTime || '';
    const driverName = schedule.driver_name || schedule.driverName || '';
    const driverPhone = schedule.driver_phone || schedule.driverPhone || '';
    const carNumber = schedule.car_number || schedule.carNumber || '';
    const carBrand = schedule.car_brand || schedule.carBrand || '';
    const sender = schedule.sender || schedule.company_name || '';
    const marketplace = schedule.marketplace || fallbackMarketplace || '';

    return {
        id: schedule.id ?? schedule.schedule_id ?? '',
        city,
        warehouse,
        acceptDate,
        deliveryDate,
        acceptTime,
        driverName,
        driverPhone,
        carNumber,
        carBrand,
        sender,
        marketplace
    };
}

function fillLegacyFormFields(container, scheduleData) {
    if (!container || !scheduleData) return;

    const {
        id,
        city,
        warehouse,
        acceptDate,
        deliveryDate,
        acceptTime,
        driverName,
        driverPhone,
        carNumber,
        carBrand,
        sender
    } = scheduleData;

    const directionDisplay = container.querySelector('#legacyDirection');
    if (directionDisplay) {
        if (city || warehouse) {
            const left = city || '—';
            const right = warehouse || '—';
            directionDisplay.textContent = `${left} → ${right}`;
        } else {
            directionDisplay.textContent = '—';
        }
    }

    const datesDisplay = container.querySelector('#legacyDates');
    if (datesDisplay) {
        if (acceptDate && deliveryDate) {
            datesDisplay.textContent = `${acceptDate} → ${deliveryDate}`;
        } else if (acceptDate || deliveryDate) {
            datesDisplay.textContent = acceptDate || deliveryDate;
        } else {
            datesDisplay.textContent = '—';
        }
    }

    const setValue = (selector, value = '') => {
        const el = container.querySelector(selector);
        if (el) el.value = value;
    };

    setValue('#formScheduleId', id || '');
    setValue('#acceptDateField', acceptDate || '');
    setValue('#deliveryDateField', deliveryDate || '');
    setValue('#deliveryDateAlias', deliveryDate || '');
    setValue('#acceptTimeField', acceptTime || '');
    setValue('#directionField', warehouse || '');
    setValue('#city', city || '');
    setValue('#warehouses', warehouse || '');
    setValue('#driver_name', driverName || '');
    setValue('#driver_phone', driverPhone || '');
    setValue('#car_number', carNumber || '');
    setValue('#car_brand', carBrand || '');
    setValue('#sender', sender || '');

    const status = container.querySelector('#status');
    if (status) {
        status.textContent = '';
        status.removeAttribute('style');
    }
}

async function openRequestFormModal(scheduleOrId, city = "", warehouse = "", marketplace = "") {
    const scheduleData = normalizeSchedule(scheduleOrId, city, warehouse, marketplace);

    let templateHtml = '';
    let lastError = null;
    let templateUrlUsed = '';

    for (const path of LEGACY_TEMPLATE_PATHS) {
        const url = resolveTemplateUrl(path);
        try {
            const response = await fetch(url, { credentials: 'include' });
            if (!response.ok) {
                lastError = new Error(`Не удалось загрузить шаблон (${url}): ${response.status}`);
                continue;
            }
            templateHtml = await response.text();
            templateUrlUsed = url;
            break;
        } catch (err) {
            lastError = err;
        }
    }

    if (!templateHtml) {
        console.error('Шаблон формы заявки не был загружен', lastError);
        alert('Не удалось загрузить форму заявки. Попробуйте обновить страницу.');
        return;
    }

    const modal = ensureRequestModalContainer();
    const contentHost = modal.querySelector('#requestModalContent');
    if (!contentHost) {
        console.error('Контейнер модального окна не найден.');
        alert('Не удалось открыть форму заявки.');
        return;
    }

    const wrapper = document.createElement('div');
    wrapper.innerHTML = templateHtml.trim();
    const contentRoot = wrapper.firstElementChild;
    if (!contentRoot) {
        console.error('Загруженный шаблон пуст', templateUrlUsed);
        alert('Шаблон формы заявки повреждён.');
        return;
    }

    contentHost.innerHTML = '';
    contentHost.appendChild(contentRoot);

    fillLegacyFormFields(contentHost, scheduleData);
    setupGlobalLoadOrdersFallback();

    let closed = false;
    const escHandler = (event) => {
        if (event.key === 'Escape') {
            event.preventDefault();
            closeModal();
        }
    };

    const closeModal = () => {
        if (closed) return;
        closed = true;
        modal.classList.remove('active');
        modal.style.display = 'none';
        if (contentHost) {
            contentHost.innerHTML = '';
        }
        document.body.classList.remove('modal-open');
        document.removeEventListener('keydown', escHandler);
        modal.removeEventListener('click', backdropHandler);
        if (modal._legacyCleanup === closeModal) {
            modal._legacyCleanup = null;
        }
    };

    const backdropHandler = (event) => {
        if (event.target === modal) {
            closeModal();
        }
    };

    const closeBtn = modal.querySelector('[data-close-modal]');
    if (closeBtn) {
        closeBtn.addEventListener('click', closeModal, { once: true });
    }

    modal.addEventListener('click', backdropHandler);
    document.addEventListener('keydown', escHandler);
    modal._legacyCleanup = closeModal;

    modal.classList.add('active');
    modal.style.display = 'flex';
    document.body.classList.add('modal-open');

    ensureYandexMaps().catch((err) => {
        console.warn('Не удалось загрузить Яндекс.Карты:', err);
    });

    try {
        await ensureLegacyFormScript();
        if (typeof window.initializeForm === 'function') {
            window.initializeForm();
        } else {
            throw new Error('Функция инициализации формы недоступна');
        }
    } catch (error) {
        console.error('Ошибка инициализации формы заявки:', error);
        const status = contentHost.querySelector('#status');
        if (status) {
            status.textContent = error.message || 'Не удалось инициализировать форму заявки';
            status.style.color = 'red';
        } else {
            alert(error.message || 'Не удалось инициализировать форму заявки');
        }
    }
}

window.openRequestFormModal = openRequestFormModal;
