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

function findElementInsideById(container, elementId) {
    if (!container || typeof elementId !== 'string' || !elementId) return null;

    let element = null;
    if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
        try {
            element = container.querySelector(`#${CSS.escape(elementId)}`);
        } catch (err) {
            element = null;
        }
    }

    if (!element) {
        const escapedId = elementId.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
        element = container.querySelector(`[id="${escapedId}"]`);
    }

    if (!element) {
        const globalElement = document.getElementById(elementId);
        if (globalElement && typeof container.contains === 'function' && container.contains(globalElement)) {
            element = globalElement;
        }
    }

    return element;
}

function ensureRequestModalContainer(modalId = 'requestModal', contentId = 'requestModalContent') {
    const doc = document;
    let modal = doc.getElementById(modalId);
    if (!modal) {
        modal = doc.createElement('div');
        modal.id = modalId;
        modal.className = 'modal';
        const parent = doc.body || doc.documentElement;
        if (parent) {
            parent.appendChild(modal);
        }
    } else if (!modal.classList.contains('modal')) {
        modal.classList.add('modal');
    }

    let content = findElementInsideById(modal, contentId);
    if (!content) {
        content = doc.createElement('div');
        content.className = 'modal-content';
        content.id = contentId;
        modal.appendChild(content);
    } else {
        if (!content.id) {
            content.id = contentId;
        }
        if (!content.classList.contains('modal-content')) {
            content.classList.add('modal-content');
        }
    }

    if (modal && modal.dataset) {
        modal.dataset.requestFormContentId = contentId;
    }

    window.__lastRequestFormModalId = modalId;
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
        sender,
        marketplace
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

    const marketplaceDisplay = container.querySelector('#legacyMarketplace');
    if (marketplaceDisplay) {
        const marketplaceText = marketplace || '—';
        marketplaceDisplay.textContent = marketplaceText;
        if (marketplace && typeof marketplaceDisplay.setAttribute === 'function') {
            marketplaceDisplay.setAttribute('title', marketplace);
        } else if (typeof marketplaceDisplay.removeAttribute === 'function') {
            marketplaceDisplay.removeAttribute('title');
        }
    }

    const warehouseDisplay = container.querySelector('#legacyWarehouse');
    if (warehouseDisplay) {
        const warehouseText = warehouse || '—';
        warehouseDisplay.textContent = warehouseText;
        if (warehouse && typeof warehouseDisplay.setAttribute === 'function') {
            warehouseDisplay.setAttribute('title', warehouse);
        } else if (typeof warehouseDisplay.removeAttribute === 'function') {
            warehouseDisplay.removeAttribute('title');
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

    const formElement = container.querySelector('#dataForm');
    if (formElement) {
        formElement.dataset.marketplace = marketplace || '';
        formElement.dataset.initialCity = city || '';
        formElement.dataset.initialWarehouse = warehouse || '';
    }

    const status = container.querySelector('#status');
    if (status) {
        status.textContent = '';
        status.removeAttribute('style');
    }
}

async function openRequestFormModal(
    scheduleOrId,
    city = "",
    warehouse = "",
    marketplace = "",
    options = {}
) {
    const scheduleData = normalizeSchedule(scheduleOrId, city, warehouse, marketplace);

    const {
        modalId = 'requestModal',
        contentId = 'requestModalContent',
        onBeforeOpen,
        onAfterOpen,
        onBeforeClose,
        onAfterClose,
        onError
    } = options || {};

    const safeCall = (callback, ...args) => {
        if (typeof callback !== 'function') return;
        try {
            return callback(...args);
        } catch (err) {
            console.error('Ошибка выполнения callback формы заявки:', err);
        }
    };

    const safeCallAsync = async (callback, ...args) => {
        if (typeof callback !== 'function') return;
        try {
            return await callback(...args);
        } catch (err) {
            console.error('Ошибка выполнения callback формы заявки:', err);
        }
    };

    const notifyError = (error) => {
        if (!error) return;
        safeCall(onError, error, { modalId, contentId, schedule: scheduleData });
    };

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
        const error = lastError || new Error('Шаблон формы заявки не был загружен');
        console.error('Шаблон формы заявки не был загружен', error);
        notifyError(error);
        alert('Не удалось загрузить форму заявки. Попробуйте обновить страницу.');
        return;
    }

    let modal;
    try {
        modal = ensureRequestModalContainer(modalId, contentId);
    } catch (error) {
        console.error('Не удалось подготовить контейнер модального окна.', error);
        notifyError(error);
        alert('Не удалось открыть форму заявки. Попробуйте обновить страницу.');
        return;
    }

    let contentHost = findElementInsideById(modal, contentId);
    if (!contentHost) {
        const error = new Error(`Контейнер модального окна "${contentId}" не найден внутри "${modalId}"`);
        console.error('Контейнер модального окна не найден.', error);
        notifyError(error);
        alert('Не удалось открыть форму заявки.');
        return;
    }

    await safeCallAsync(onBeforeOpen, modal, scheduleData);

    const yandexMapsReadyPromise = ensureYandexMaps()
        .then(() => true)
        .catch((err) => {
            console.warn('Не удалось загрузить Яндекс.Карты:', err);
            return false;
        });

    const wrapper = document.createElement('div');
    wrapper.innerHTML = templateHtml.trim();
    const contentRoot = wrapper.firstElementChild;
    if (!contentRoot) {
        const error = new Error('Загруженный шаблон пуст');
        console.error('Загруженный шаблон пуст', templateUrlUsed);
        notifyError(error);
        alert('Шаблон формы заявки повреждён.');
        return;
    }

    contentHost.innerHTML = '';
    contentHost.appendChild(contentRoot);

    fillLegacyFormFields(contentHost, scheduleData);
    setupGlobalLoadOrdersFallback();

    const changeContextButton = contentHost.querySelector('[data-action="change-marketplace"]');

    let closed = false;
    const escHandler = (event) => {
        if (event.key === 'Escape') {
            event.preventDefault();
            closeModal('escape');
        }
    };

    const closeModal = (reason = 'manual') => {
        if (closed) return;
        closed = true;

        safeCall(onBeforeClose, modal, reason, scheduleData);

        modal.classList.remove('active', 'show');
        modal.style.display = 'none';
        if (contentHost) {
            contentHost.innerHTML = '';
        }
        if (typeof pickupMapInstance !== 'undefined' && pickupMapInstance) {
            try {
                if (typeof pickupMapInstance.destroy === 'function') {
                    pickupMapInstance.destroy();
                }
            } catch (err) {
                console.warn('Не удалось корректно уничтожить карту забора груза:', err);
            }
        }
        if (typeof pickupMapInstance !== 'undefined') {
            pickupMapInstance = null;
        }
        if (typeof pickupPlacemark !== 'undefined') {
            pickupPlacemark = null;
        }
        if (typeof pickupMapInitPromise !== 'undefined') {
            pickupMapInitPromise = null;
        }
        if (typeof window !== 'undefined') {
            window.__pickupMapInited = false;
        }
        document.body.classList.remove('modal-open');
        document.removeEventListener('keydown', escHandler);
        modal.removeEventListener('click', backdropHandler);
        if (modal._legacyCleanup === closeModal) {
            modal._legacyCleanup = null;
        }

        safeCall(onAfterClose, modal, reason, scheduleData);
    };

    const focusScheduleFilters = () => {
        const filterIds = ['marketplaceFilter', 'warehouseFilter'];
        const candidates = filterIds
            .map((id) => {
                const el = typeof document !== 'undefined' ? document.getElementById(id) : null;
                return el instanceof HTMLElement ? el : null;
            })
            .filter(Boolean);

        if (!candidates.length) {
            return false;
        }

        const firstVisible = candidates.find((element) => element.offsetParent !== null);
        const focusTarget = firstVisible || candidates[0];
        if (!focusTarget) {
            return false;
        }

        const scrollAnchor = focusTarget.closest('.filter-step')
            || focusTarget.closest('.filter-group')
            || focusTarget;

        if (scrollAnchor && typeof scrollAnchor.scrollIntoView === 'function') {
            try {
                scrollAnchor.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
            } catch (err) {
                scrollAnchor.scrollIntoView();
            }
        }

        const highlightClass = 'schedule-filter--highlight';
        const highlightTargets = new Set();
        highlightTargets.add(focusTarget);
        const group = focusTarget.closest('.filter-group');
        if (group) {
            highlightTargets.add(group);
        }
        const step = focusTarget.closest('.filter-step');
        if (step) {
            highlightTargets.add(step);
        }

        const applyFocusAndHighlight = () => {
            if (typeof focusTarget.focus === 'function') {
                try {
                    focusTarget.focus({ preventScroll: true });
                } catch (err) {
                    focusTarget.focus();
                }
            }

            highlightTargets.forEach((element) => {
                try {
                    element.classList.add(highlightClass);
                } catch (err) {
                    // ignore styling errors
                }
            });

            setTimeout(() => {
                highlightTargets.forEach((element) => {
                    try {
                        element.classList.remove(highlightClass);
                    } catch (err) {
                        // ignore styling errors
                    }
                });
            }, 1600);
        };

        setTimeout(applyFocusAndHighlight, 250);
        return true;
    };

    const backdropHandler = (event) => {
        if (event.target === modal) {
            closeModal('backdrop');
        }
    };

    const closeBtn = modal.querySelector('[data-close-modal]');
    if (closeBtn) {
        closeBtn.addEventListener('click', () => closeModal('close-button'), { once: true });
    }

    modal.addEventListener('click', backdropHandler);
    document.addEventListener('keydown', escHandler);
    modal._legacyCleanup = closeModal;

    modal.classList.add('active', 'show');
    modal.style.display = 'flex';
    document.body.classList.add('modal-open');

    if (changeContextButton) {
        changeContextButton.addEventListener('click', (event) => {
            event.preventDefault();

            const focusAfterClose = () => {
                if (typeof window === 'undefined') {
                    return;
                }
                window.requestAnimationFrame(() => {
                    window.requestAnimationFrame(() => {
                        if (!focusScheduleFilters()) {
                            console.warn('Не удалось найти фильтры расписания для изменения маркетплейса/склада.');
                        }
                    });
                });
            };

            closeModal('change-marketplace');
            focusAfterClose();
        });
    }

    try {
        await ensureLegacyFormScript();
        const ymapsLoaded = await yandexMapsReadyPromise;
        if (!ymapsLoaded && typeof window.ymaps === 'undefined') {
            console.warn('Глобальный объект ymaps так и не появился после загрузки скрипта.');
        }
        if (typeof window.initializeForm === 'function') {
            window.initializeForm();
            safeCall(onAfterOpen, modal, contentHost, scheduleData);
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
        notifyError(error);
    }
}

function openClientRequestFormModal(
    scheduleOrId,
    city = "",
    warehouse = "",
    marketplace = "",
    options = {}
) {
    const mergedOptions = {
        modalId: 'clientRequestModal',
        contentId: 'clientRequestModalContent',
        ...(options || {})
    };

    return openRequestFormModal(scheduleOrId, city, warehouse, marketplace, mergedOptions);
}

window.openRequestFormModal = openRequestFormModal;
window.openClientRequestFormModal = openClientRequestFormModal;
