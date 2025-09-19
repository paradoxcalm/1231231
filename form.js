// ===== form.js =====

function resolveFormPath(relativePath) {
    if (typeof relativePath !== 'string' || !relativePath) {
        return relativePath;
    }

    // Не преобразуем уже абсолютные адреса и схемы data:
    if (/^(?:[a-z][a-z0-9+.-]*:)?\/\//i.test(relativePath) || relativePath.startsWith('data:')) {
        return relativePath;
    }

    // Если путь начинается с "/" — этого достаточно для fetch, возвращаем как есть.
    if (relativePath.startsWith('/')) {
        return relativePath;
    }

    const pickFormScriptSrc = () => {
        try {
            const current = document?.currentScript;
            if (current?.src && current.src.includes('form.js')) {
                return current.src;
            }
            const scripts = document?.querySelectorAll?.('script[src]');
            if (scripts) {
                for (const script of scripts) {
                    if (script.src?.includes('form.js')) {
                        return script.src;
                    }
                }
            }
        } catch (err) {
            console.warn('resolveFormPath: не удалось найти form.js в DOM', err);
        }
        return null;
    };

    const scriptSrc = pickFormScriptSrc();
    if (scriptSrc) {
        try {
            const scriptUrl = new URL(scriptSrc, window.location.href);
            return new URL(relativePath, scriptUrl).toString();
        } catch (err) {
            console.warn('resolveFormPath: ошибка при расчёте относительно form.js', err);
        }
    }

    try {
        return new URL(relativePath, window.location.href).toString();
    } catch (err) {
        console.warn('resolveFormPath: не удалось вычислить путь относительно страницы', err);
    }

    return relativePath;
}

function escapeAttributeValue(value) {
    return `${value ?? ''}`
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

function escapeHtmlContent(value) {
    return `${value ?? ''}`
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

// 1️⃣ Автозаполнение данных пользователя
function preloadUserDataIntoForm() {
    fetch(resolveFormPath('fetch_user_data.php'))
        .then(r => r.json())
        .then(data => {
            if (!data.success) return;
            const u = data.data;
            const senderInput = document.getElementById('sender');
            if (senderInput && u.company_name) {
                senderInput.value = u.company_name;
            }
        })
        .catch(err => console.error("Ошибка автозаполнения профиля:", err));
}

const CITY_PLACEHOLDER_LABEL = 'Выберите город';
const CITY_STORAGE_PREFIX = 'requestForm:lastCity';
const CITY_OPTIONS_CACHE = new Map();

let cityStorageInstance = null;
let cityStorageChecked = false;
let lastTariffRequestToken = 0;

function focusCitySelectionElement(element) {
    if (!element || typeof element !== 'object') {
        return;
    }

    const performFocus = () => {
        try {
            if (typeof element.focus === 'function') {
                element.focus({ preventScroll: true });
            }
        } catch (err) {
            try {
                element.focus();
            } catch (innerErr) {
                console.warn('Не удалось сфокусировать селектор города:', innerErr);
            }
        }
    };

    if (typeof element.scrollIntoView === 'function') {
        try {
            element.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
            setTimeout(performFocus, 250);
            return;
        } catch (err) {
            // продолжаем выполнение и пробуем сфокусировать элемент напрямую
        }
    }

    performFocus();
}

function openCityConfirmationModal({ cityName = '', cityElement = null } = {}) {
    if (typeof document === 'undefined') {
        return Promise.resolve(true);
    }

    const normalizedCity = `${cityName ?? ''}`.trim();
    if (!normalizedCity) {
        return Promise.resolve(true);
    }

    const bodyElement = document.body;
    if (!bodyElement) {
        return Promise.resolve(true);
    }

    return new Promise((resolve) => {
        const overlay = document.createElement('div');
        overlay.className = 'city-confirm-overlay';
        overlay.setAttribute('role', 'presentation');

        const uniqueSuffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
        const titleId = `cityConfirmTitle-${uniqueSuffix}`;

        overlay.innerHTML = `
            <div class="city-confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="${titleId}">
                <button type="button" class="city-confirm-close" data-role="close" aria-label="Закрыть предупреждение"></button>
                <div class="city-confirm-icon" aria-hidden="true">❗</div>
                <h2 class="city-confirm-title" id="${titleId}">Проверьте выбранный город</h2>
                <p class="city-confirm-message">
                    Мы собираемся отправить заявку для города <span class="city-confirm-city" data-role="city-name"></span>.
                    Всё верно?
                </p>
                <div class="city-confirm-actions">
                    <button type="button" class="city-confirm-button city-confirm-edit" data-role="edit">Изменить</button>
                    <button type="button" class="city-confirm-button city-confirm-continue" data-role="confirm">Да, продолжить</button>
                </div>
            </div>
        `;

        const dialog = overlay.querySelector('.city-confirm-dialog');
        const cityNameTarget = overlay.querySelector('[data-role="city-name"]');
        if (cityNameTarget) {
            cityNameTarget.textContent = normalizedCity;
        }

        const focusableSelectors = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
        const getFocusable = () => Array.from(dialog?.querySelectorAll(focusableSelectors) || [])
            .filter((node) => node instanceof HTMLElement && !node.hasAttribute('disabled'));

        let isResolved = false;

        const finish = (result, afterClose) => {
            if (isResolved) {
                return;
            }
            isResolved = true;

            let finalizeCalled = false;
            const finalize = () => {
                if (finalizeCalled) {
                    return;
                }
                finalizeCalled = true;

                overlay.removeEventListener('keydown', keyHandler);
                overlay.remove();
                bodyElement.classList.remove('city-confirm-open');
                if (typeof afterClose === 'function') {
                    try {
                        afterClose();
                    } catch (callbackErr) {
                        console.warn('Ошибка выполнения обработчика после закрытия окна подтверждения города:', callbackErr);
                    }
                }
                resolve(result);
            };

            overlay.classList.remove('city-confirm-overlay--visible');
            dialog?.classList.remove('city-confirm-dialog--visible');
            overlay.classList.add('city-confirm-overlay--closing');
            dialog?.classList.add('city-confirm-dialog--closing');

            const onTransitionEnd = () => {
                overlay.removeEventListener('transitionend', onTransitionEnd);
                finalize();
            };

            overlay.addEventListener('transitionend', onTransitionEnd);
            setTimeout(finalize, 220);
        };

        const closeAndFocusCity = () => {
            finish(false, () => {
                if (cityElement) {
                    focusCitySelectionElement(cityElement);
                }
            });
        };

        const keyHandler = (event) => {
            if (event.key === 'Escape') {
                event.preventDefault();
                closeAndFocusCity();
                return;
            }

            if (event.key === 'Tab') {
                const focusable = getFocusable();
                if (!focusable.length) {
                    return;
                }

                const first = focusable[0];
                const last = focusable[focusable.length - 1];

                if (event.shiftKey && document.activeElement === first) {
                    event.preventDefault();
                    last.focus();
                } else if (!event.shiftKey && document.activeElement === last) {
                    event.preventDefault();
                    first.focus();
                }
            }
        };

        overlay.addEventListener('keydown', keyHandler);

        const confirmBtn = overlay.querySelector('[data-role="confirm"]');
        const editBtn = overlay.querySelector('[data-role="edit"]');
        const closeBtn = overlay.querySelector('[data-role="close"]');

        confirmBtn?.addEventListener('click', () => finish(true));
        editBtn?.addEventListener('click', closeAndFocusCity);
        closeBtn?.addEventListener('click', closeAndFocusCity);

        overlay.addEventListener('click', (event) => {
            if (event.target === overlay) {
                closeAndFocusCity();
            }
        });

        bodyElement.appendChild(overlay);

        requestAnimationFrame(() => {
            bodyElement.classList.add('city-confirm-open');
            overlay.classList.add('city-confirm-overlay--visible');
            dialog?.classList.add('city-confirm-dialog--visible');
            const focusable = getFocusable();
            const focusTarget = confirmBtn || focusable[0];
            if (focusTarget) {
                try {
                    focusTarget.focus({ preventScroll: true });
                } catch (err) {
                    focusTarget.focus();
                }
            }
        });
    });
}

function getCityStorage() {
    if (cityStorageChecked) {
        return cityStorageInstance;
    }

    cityStorageChecked = true;

    if (typeof window === 'undefined') {
        return null;
    }

    const storageCandidates = ['localStorage', 'sessionStorage'];
    for (const storageName of storageCandidates) {
        try {
            const storage = window[storageName];
            if (!storage) {
                continue;
            }

            const testKey = `${CITY_STORAGE_PREFIX}__test__`;
            storage.setItem(testKey, '1');
            storage.removeItem(testKey);

            cityStorageInstance = storage;
            break;
        } catch (err) {
            cityStorageInstance = null;
        }
    }

    return cityStorageInstance;
}

function buildCityStorageKey(marketplace = '', warehouse = '') {
    const marketplaceKey = (marketplace || 'all').trim().toLowerCase();
    const warehouseKey = (warehouse || 'all').trim().toLowerCase();
    return `${CITY_STORAGE_PREFIX}:${encodeURIComponent(marketplaceKey)}:${encodeURIComponent(warehouseKey)}`;
}

function getStoredCitySelection(marketplace = '', warehouse = '') {
    try {
        const storage = getCityStorage();
        if (!storage) {
            return '';
        }
        return storage.getItem(buildCityStorageKey(marketplace, warehouse)) || '';
    } catch (err) {
        console.warn('Не удалось прочитать сохранённый город формы заявки:', err);
        return '';
    }
}

function saveCitySelection(marketplace = '', warehouse = '', city = '') {
    try {
        const storage = getCityStorage();
        if (!storage) {
            return;
        }
        const key = buildCityStorageKey(marketplace, warehouse);
        const trimmedCity = `${city ?? ''}`.trim();
        if (trimmedCity) {
            storage.setItem(key, trimmedCity);
        } else {
            storage.removeItem(key);
        }
    } catch (err) {
        console.warn('Не удалось сохранить выбранный город формы заявки:', err);
    }
}

function clearStoredCitySelection(marketplace = '', warehouse = '') {
    saveCitySelection(marketplace, warehouse, '');
}

function normalizeWarehouseValue(raw = '') {
    const trimmed = `${raw ?? ''}`.trim();
    if (!trimmed) {
        return '';
    }
    const [first] = trimmed.split(',');
    return (first || '').trim();
}

async function fetchCitiesForMarketplace(marketplace = '') {
    const key = (marketplace || '').trim().toLowerCase() || '__all__';
    if (CITY_OPTIONS_CACHE.has(key)) {
        return CITY_OPTIONS_CACHE.get(key);
    }

    const params = new URLSearchParams();
    if (marketplace) {
        params.set('action', 'cities');
        params.set('marketplace', marketplace);
    } else {
        params.set('action', 'all_cities');
    }

    const url = resolveFormPath(`filter_options.php?${params.toString()}`);

    try {
        const response = await fetch(url, { credentials: 'include' });
        if (!response.ok) {
            throw new Error(`Ошибка загрузки городов: ${response.status}`);
        }

        const payload = await response.json();
        let list = [];
        if (Array.isArray(payload?.cities)) {
            list = payload.cities;
        } else if (Array.isArray(payload)) {
            list = payload;
        }

        const normalized = [];
        const seen = new Set();
        list.forEach((item) => {
            if (item === null || item === undefined) {
                return;
            }
            const text = `${item}`.trim();
            if (!text) {
                return;
            }
            const normalizedText = text.toLowerCase();
            if (seen.has(normalizedText)) {
                return;
            }
            seen.add(normalizedText);
            normalized.push(text);
        });

        normalized.sort((a, b) => a.localeCompare(b, 'ru', { sensitivity: 'base' }));
        CITY_OPTIONS_CACHE.set(key, normalized);
        return normalized;
    } catch (err) {
        console.warn('Не удалось загрузить список городов для формы заявки:', err);
        return [];
    }
}

function populateCitySelectOptions(selectElement, cities, {
    placeholderLabel = CITY_PLACEHOLDER_LABEL,
    preferredCity = '',
    fallbackCity = ''
} = {}) {
    if (!selectElement) {
        return '';
    }

    const doc = selectElement.ownerDocument || document;
    const placeholderOption = doc.createElement('option');
    placeholderOption.value = '';
    placeholderOption.textContent = placeholderLabel;
    placeholderOption.disabled = true;

    const fragment = doc.createDocumentFragment();
    fragment.appendChild(placeholderOption);

    const uniqueCities = [];
    const seen = new Set();
    const addCity = (value) => {
        if (value === null || value === undefined) {
            return;
        }
        const text = `${value}`.trim();
        if (!text) {
            return;
        }
        const normalizedText = text.toLowerCase();
        if (seen.has(normalizedText)) {
            return;
        }
        seen.add(normalizedText);
        uniqueCities.push(text);
    };

    (Array.isArray(cities) ? cities : []).forEach(addCity);
    addCity(preferredCity);
    addCity(fallbackCity);

    uniqueCities.forEach((cityName) => {
        const option = doc.createElement('option');
        option.value = cityName;
        option.textContent = cityName;
        fragment.appendChild(option);
    });

    selectElement.innerHTML = '';
    selectElement.appendChild(fragment);

    const preferredNormalized = `${preferredCity ?? ''}`.trim().toLowerCase();
    const fallbackNormalized = `${fallbackCity ?? ''}`.trim().toLowerCase();

    const pickValue = (target) => {
        if (!target) return '';
        const normalizedTarget = target.trim().toLowerCase();
        return uniqueCities.find((cityName) => cityName.toLowerCase() === normalizedTarget) || '';
    };

    let selectedValue = pickValue(preferredNormalized ? preferredCity : '');
    if (!selectedValue) {
        selectedValue = pickValue(fallbackNormalized ? fallbackCity : '');
    }

    if (selectedValue) {
        selectElement.value = selectedValue;
    } else {
        placeholderOption.selected = true;
    }

    return selectElement.value || '';
}

function updateDirectionSummary(city, warehouse) {
    const directionDisplay = document.getElementById('legacyDirection');
    if (!directionDisplay) {
        return;
    }
    const left = city && city.trim() ? city.trim() : '—';
    const right = warehouse && warehouse.trim() ? warehouse.trim() : '—';
    directionDisplay.textContent = `${left} → ${right}`;
}

async function setupCitySelector({
    form,
    selectElement,
    marketplace = '',
    initialCity = '',
    getWarehouseValue = () => '',
    overrideCities = null,
    onCityChange
} = {}) {
    if (!selectElement) {
        return (initialCity || '').trim();
    }

    const marketplaceValue = `${marketplace ?? ''}`.trim();
    const warehouseValue = normalizeWarehouseValue(typeof getWarehouseValue === 'function' ? getWarehouseValue() : '');
    const storedCity = getStoredCitySelection(marketplaceValue, warehouseValue);
    const placeholderLabel = selectElement.dataset?.placeholderLabel || CITY_PLACEHOLDER_LABEL;

    selectElement.disabled = true;
    selectElement.dataset.loading = 'true';

    const overrideListRaw = Array.isArray(overrideCities) ? overrideCities : [];
    const overrideList = [];
    const seenOverride = new Set();
    overrideListRaw.forEach((item) => {
        if (item === null || item === undefined) {
            return;
        }
        let rawValue = '';
        if (typeof item === 'string') {
            rawValue = item;
        } else if (typeof item === 'object') {
            if (typeof item.city === 'string') {
                rawValue = item.city;
            } else if (typeof item.name === 'string') {
                rawValue = item.name;
            } else if (typeof item.label === 'string') {
                rawValue = item.label;
            }
        }
        const text = `${rawValue ?? ''}`.trim();
        if (!text) {
            return;
        }
        const key = text.toLowerCase();
        if (seenOverride.has(key)) {
            return;
        }
        seenOverride.add(key);
        overrideList.push(text);
    });

    const cities = overrideList.length > 0
        ? overrideList
        : await fetchCitiesForMarketplace(marketplaceValue).catch(() => []);
    const selectedCity = populateCitySelectOptions(selectElement, cities, {
        placeholderLabel,
        preferredCity: storedCity,
        fallbackCity: initialCity
    });

    delete selectElement.dataset.loading;
    selectElement.disabled = false;

    const finalCity = (selectedCity || '').trim();
    const currentWarehouse = normalizeWarehouseValue(typeof getWarehouseValue === 'function' ? getWarehouseValue() : '');

    if (finalCity) {
        saveCitySelection(marketplaceValue, currentWarehouse, finalCity);
    } else {
        clearStoredCitySelection(marketplaceValue, currentWarehouse);
    }

    if (form) {
        form.dataset.selectedCity = finalCity;
    }

    updateDirectionSummary(finalCity, currentWarehouse);

    const handler = () => {
        const nextWarehouse = normalizeWarehouseValue(typeof getWarehouseValue === 'function' ? getWarehouseValue() : '');
        const value = (selectElement.value || '').trim();
        if (value) {
            saveCitySelection(marketplaceValue, nextWarehouse, value);
        } else {
            clearStoredCitySelection(marketplaceValue, nextWarehouse);
        }
        updateDirectionSummary(value, nextWarehouse);
        if (typeof onCityChange === 'function') {
            try {
                const maybePromise = onCityChange(value, nextWarehouse, marketplaceValue);
                if (maybePromise && typeof maybePromise.then === 'function') {
                    maybePromise.catch((asyncErr) => {
                        console.warn('Ошибка асинхронного обработчика изменения города формы заявки:', asyncErr);
                    });
                }
            } catch (err) {
                console.warn('Ошибка обработчика изменения города формы заявки:', err);
            }
        }
    };

    if (selectElement._requestFormCityChange) {
        selectElement.removeEventListener('change', selectElement._requestFormCityChange);
    }
    selectElement.addEventListener('change', handler);
    selectElement._requestFormCityChange = handler;

    selectElement.dataset.loadedMarketplace = marketplaceValue;
    selectElement.dataset.loadedWarehouse = currentWarehouse;

    return finalCity;
}

async function updateTariffFor(city, warehouse) {
    const normalizedCity = `${city ?? ''}`.trim();
    const normalizedWarehouse = normalizeWarehouseValue(warehouse);
    const requestToken = ++lastTariffRequestToken;

    const applyDefaults = () => {
        setupVolumeCalculator(650, 1, 7000, 1);
        const tariffRate = document.getElementById('tariff_rate');
        if (tariffRate) {
            tariffRate.textContent = '650 ₽ (по умолчанию)';
        }
        const packaging = document.querySelector('input[name="packaging_type"]:checked');
        if (packaging && packaging.value === 'Pallet') {
            calculatePalletCost();
        }
    };

    if (!normalizedCity || !normalizedWarehouse) {
        console.warn('Нет города или склада — тариф не загружается');
        applyDefaults();
        return;
    }

    try {
        const tariffUrl = resolveFormPath(
            `get_tariff.php?city=${encodeURIComponent(normalizedCity)}&warehouse=${encodeURIComponent(normalizedWarehouse)}`
        );
        const response = await fetch(tariffUrl);
        if (!response.ok) {
            throw new Error(`get_tariff.php вернул статус ${response.status}`);
        }
        const data = await response.json();
        if (requestToken !== lastTariffRequestToken) {
            return;
        }
        if (data && data.success) {
            setupVolumeCalculator(
                Number(data.base_price),
                Number(data.box_coef),
                Number(data.pallet_price),
                Number(data.box_coef)
            );
            const tariffRate = document.getElementById('tariff_rate');
            if (tariffRate) {
                tariffRate.textContent = `${data.base_price} ₽`;
            }
            const packaging = document.querySelector('input[name="packaging_type"]:checked');
            if (packaging && packaging.value === 'Pallet') {
                calculatePalletCost();
            }
        } else {
            console.warn('Тариф не найден:', data && data.message);
            applyDefaults();
        }
    } catch (err) {
        if (requestToken === lastTariffRequestToken) {
            console.error('Ошибка загрузки тарифа:', err);
            applyDefaults();
        }
    }
}

// 2️⃣ Отрисовка формы (HTML) с блоком customBoxWarning
// form.js (загружается до requestForm.js)

// Объявляем функцию как раньше
function renderFormHTML(scheduleData = {}) {
    const {
        id = '',
        city = '',
        warehouses = '',
        accept_date = '',
        delivery_date = '',
        accept_time = '',
        driver_name = '',
        driver_phone = '',
        car_number = '',
        car_brand = '',
        sender = '',
        marketplace = ''
    } = scheduleData;

    const attrMarketplace = escapeAttributeValue(marketplace);
    const attrCity = escapeAttributeValue(city);
    const attrWarehouses = escapeAttributeValue(warehouses);
    const cityOptionText = escapeHtmlContent(city);
    const marketplaceDisplay = marketplace ? escapeHtmlContent(marketplace) : '—';
    const warehouseDisplay = warehouses ? escapeHtmlContent(warehouses) : '—';
    const marketplaceTitle = marketplace ? escapeAttributeValue(marketplace) : '';
    const warehouseTitle = warehouses ? escapeAttributeValue(warehouses) : '';

    // Склеиваем две даты в одну строку «выезд → сдача»
    const combinedDates = accept_date && delivery_date
        ? `${accept_date} → ${delivery_date}`
        : accept_date || delivery_date;
    const combinedDatesDisplay = combinedDates ? escapeHtmlContent(combinedDates) : '—';
    const directionLeft = city ? escapeHtmlContent(city) : '—';
    const directionRight = warehouses ? escapeHtmlContent(warehouses) : '—';

    // назначаем tabindex и фокус для удобного перехода по форме
    setTimeout(() => {
        const fields = document.querySelectorAll('.form-group input, .form-group select, .form-group textarea');
        fields.forEach((f, i) => f.setAttribute('tabindex', i + 1));
        if (fields.length) fields[0].focus();
    }, 100);

    return `
<div class="request-modal request-modal--inline">
  <header class="modal-header-with-close">
    <h2 class="request-modal__title">Оформление заявки</h2>
  </header>
  <section class="modal-body request-modal__body">
    <div class="section-container modal-section request-modal__content">
      <form id="dataForm" enctype="multipart/form-data" data-marketplace="${attrMarketplace}" data-initial-city="${attrCity}" data-initial-warehouse="${attrWarehouses}">
        <h3 class="section-subtitle">ПРИЁМКА</h3>

        <input type="hidden" name="schedule_id" id="formScheduleId" value="${id}">
        <input type="hidden" name="accept_date" id="acceptDateField" value="${accept_date}">
        <input type="hidden" name="delivery_date" id="deliveryDateField" value="${delivery_date}">
        <input type="hidden" name="date_of_delivery" id="deliveryDateAlias" value="${delivery_date}">
        <input type="hidden" name="accept_time" id="acceptTimeField" value="${accept_time}">
        <input type="hidden" name="direction" id="directionField" value="${warehouses}">

        <div class="request-modal__summary">
          <div class="modal-row request-modal__summary-row">
            <span class="modal-row-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8">
                <path d="M4 12h11"></path>
                <path d="M13 8l5 4-5 4"></path>
                <path d="M4 5h5"></path>
                <path d="M4 19h5"></path>
              </svg>
            </span>
            <span class="modal-label">Направление:</span>
            <span class="modal-value">${directionLeft} → ${directionRight}</span>
          </div>

          <div class="modal-row request-modal__summary-row">
            <span class="modal-row-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8">
                <rect x="3" y="4" width="18" height="17" rx="2"></rect>
                <path d="M16 2v4"></path>
                <path d="M8 2v4"></path>
                <path d="M3 10h18"></path>
                <rect x="8" y="14" width="4" height="4" fill="currentColor" stroke="none"></rect>
              </svg>
            </span>
            <span class="modal-label">Выезд → Сдача:</span>
            <span class="modal-value">${combinedDatesDisplay}</span>
          </div>
        </div>

        <div class="request-modal__selection" aria-live="polite">
          <div class="request-modal__selection-info">
            <div class="request-modal__selection-item">
              <span class="request-modal__selection-label">Маркетплейс</span>
              <span class="request-modal__selection-value" id="legacyMarketplace" title="${marketplaceTitle}">${marketplaceDisplay}</span>
            </div>
            <div class="request-modal__selection-item">
              <span class="request-modal__selection-label">Склад</span>
              <span class="request-modal__selection-value" id="legacyWarehouse" title="${warehouseTitle}">${warehouseDisplay}</span>
            </div>
          </div>
          <button type="button" class="request-modal__selection-change" data-action="change-marketplace" aria-label="Изменить маркетплейс и склад">
            Изменить
          </button>
        </div>

        <div class="form-group request-form__group request-form__city-group">
          <label for="city">Город:</label>
          <div class="request-form__city-control">
            <select id="city" name="city" class="request-form__city-select" autocomplete="off" required>
              <option value="" disabled ${city ? '' : 'selected'}>Выберите город</option>
              ${city ? `<option value="${attrCity}" selected>${cityOptionText}</option>` : ''}
            </select>
          </div>
        </div>
        <input type="hidden" id="warehouses" name="warehouses" value="${warehouses}">
        <input type="hidden" id="driver_name" name="driver_name" value="${driver_name}">
        <input type="hidden" id="driver_phone" name="driver_phone" value="${driver_phone}">
        <input type="hidden" id="car_number" name="car_number" value="${car_number}">
        <input type="hidden" id="car_brand" name="car_brand" value="${car_brand}">
        <input type="hidden" id="sender" name="sender" value="${sender}">

        <p id="citySelectionNotice" class="request-form__city-notice" role="status" aria-live="polite">
          Пожалуйста, выберите город отправления…
        </p>

        <div id="cityDependentFields" class="request-form__city-dependent">
          <div class="form-group request-form__group">
            <label class="section-label">Тип упаковки:</label>
            <div class="request-modal__option-group request-form__radio-row">
              <label class="request-modal__option request-form__option"><input type="radio" name="packaging_type" value="Box" checked> Коробка</label>
              <label class="request-modal__option request-form__option"><input type="radio" name="packaging_type" value="Pallet"> Паллета</label>
            </div>
          </div>

          <div class="form-group request-form__group">
            <label for="boxes">Количество:</label>
            <input type="number" id="boxes" name="boxes" min="1" required>
          </div>

          <div id="palletInputBlock" class="form-group request-form__group request-modal__custom-box request-form__pallet-group request-form__hidden">
            <label>Параметры палет:</label>
            <div id="palletFields" class="request-modal__pallet-fields request-form__pallet-grid"></div>
            <p id="palletWarning" class="request-modal__warning request-form__warning form-error text-danger request-form__hidden">Максимум 20 палет</p>
          </div>

          <div class="form-group request-form__group" id="boxTypeBlock">
            <label class="section-label">Тип коробки:</label>
            <div class="request-modal__option-group request-form__radio-row">
              <label class="request-modal__option request-form__option"><input type="radio" name="box_type" value="standard" checked> Стандарт (60×40×40)</label>
              <label class="request-modal__option request-form__option"><input type="radio" name="box_type" value="custom"> Свои размеры</label>
            </div>
          </div>

          <div class="form-group request-form__group request-form__box-dimensions" id="boxSizeBlock">
            <label>Габариты одной коробки (см):</label>
            <div class="request-modal__dimensions request-form__dimensions">
              <input type="number" id="box_length" name="box_length" placeholder="Длина" class="request-modal__dimension-input request-form__dimension-input">
              <input type="number" id="box_width" name="box_width" placeholder="Ширина" class="request-modal__dimension-input request-form__dimension-input">
              <input type="number" id="box_height" name="box_height" placeholder="Высота" class="request-modal__dimension-input request-form__dimension-input">
            </div>
          </div>

          <div class="form-group request-form__group request-modal__custom-box request-form__custom-box request-form__hidden" id="customBoxFieldsBlock">
            <label>Свои группы коробов:</label>
            <input type="number" id="customBoxGroupCount" min="1" max="10" placeholder="Кол-во групп" class="request-modal__group-count request-form__group-count">
            <div id="customBoxFields" class="request-modal__custom-fields request-form__custom-fields"></div>
            <p id="customBoxWarning" class="request-modal__warning request-form__warning form-error text-danger request-form__hidden">Сумма количеств в группах не должна превышать общее количество коробов</p>
          </div>

          <div class="form-group request-form__group request-form__summary"><label>Общий объём:</label><span id="box_volume" class="request-form__summary-value">—</span></div>
          <div class="form-group request-form__group request-form__summary"><label>Тариф:</label><span id="tariff_rate" class="request-form__summary-value">—</span></div>
          <div class="form-group request-form__group"><label for="payment">Сумма оплаты:</label>
            <input type="number" id="payment" name="payment" readonly>
          </div>

          <div class="form-group request-form__group request-form__checkbox">
            <label>
              <input type="checkbox" id="pickupCheckbox" name="pickup_checkbox">
              Забрать груз с адреса отправителя
            </label>
          </div>

          <div id="pickupAddressFields" class="request-modal__pickup request-form__pickup request-form__hidden">
            <div class="request-card">
              <div class="request-card__body">
                <div id="pickupMap" class="request-card__map request-modal__map request-form__map"></div>

                <input type="hidden" id="pickupLat" name="pickup_lat">
                <input type="hidden" id="pickupLng" name="pickup_lng">

                <div class="request-card__field">
                  <label for="clientPhone" class="request-card__label request-modal__pickup-label request-form__pickup-label">Номер для связи:</label>
                  <input type="tel" id="clientPhone" name="client_phone" placeholder="+7 (999) 123-45-67" class="request-card__input request-modal__pickup-phone request-form__pickup-input">
                </div>

                <div id="routeBlock" class="request-card__route request-modal__route request-form__route request-form__hidden">
                  <span class="request-card__route-label request-modal__route-label request-form__route-label">Ссылка для навигатора:</span>
                  <div class="request-card__routes request-modal__route-links request-form__route-links">
                    <div class="request-card__route-group">
                      <a id="routeLinkYandex" href="#" target="_blank" class="link-button request-card__link request-modal__route-link request-form__route-link"></a>
                      <button type="button" id="routeCopyBtn" class="ghost-button request-card__copy request-modal__route-copy request-form__route-copy">Копировать</button>
                    </div>
                    <a id="routeLinkGoogle" href="#" target="_blank" class="link-button request-card__link request-modal__route-link request-form__route-link"></a>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="form-group request-form__group">
            <label for="comment">Комментарий:</label>
            <textarea id="comment" name="comment" rows="3" placeholder="Введите комментарий"></textarea>
          </div>
          <div class="modal-actions request-form__actions">
            <button type="submit" class="primary-button request-form__submit">
              <span class="button__label">Отправить</span>
            </button>
          </div>
        </div>
      </form>
      <p id="status" class="request-form__status"></p>
    </div>
  </section>
</div>`;
}

// При необходимости, чтобы функция была доступна глобально:
window.renderFormHTML = renderFormHTML;


const REQUEST_FORM_HIDDEN_CLASS = 'request-form__hidden';

function hideRequestFormElement(element) {
    if (!element) return;
    element.classList.add(REQUEST_FORM_HIDDEN_CLASS);
}

function showRequestFormElement(element) {
    if (!element) return;
    element.classList.remove(REQUEST_FORM_HIDDEN_CLASS);
}






// 3️⃣ Показ/скрытие блоков по типу упаковки
function updatePackaging() {
    const selected = document.querySelector('input[name="packaging_type"]:checked');
    const pack = selected ? selected.value : 'Box';
    const boxTypeBlock = document.getElementById('boxTypeBlock');
    const boxSizeBlock = document.getElementById('boxSizeBlock');
    const customBlock = document.getElementById('customBoxFieldsBlock');
    const palletBlock = document.getElementById('palletInputBlock');

    if (pack === 'Box') {
        showRequestFormElement(boxTypeBlock);
        showRequestFormElement(boxSizeBlock);
        hideRequestFormElement(customBlock);
        hideRequestFormElement(palletBlock);
        updateBoxType();
    } else {
        hideRequestFormElement(boxTypeBlock);
        hideRequestFormElement(boxSizeBlock);
        hideRequestFormElement(customBlock);
        showRequestFormElement(palletBlock);
    }
}

// 4️⃣ Тип коробки: стандарт или свои
function updateBoxType() {
    const type = document.querySelector('input[name="box_type"]:checked').value;
    const sizeBlock = document.getElementById('boxSizeBlock');
    const customBlock = document.getElementById('customBoxFieldsBlock');
    if (type === 'standard') {
        hideRequestFormElement(sizeBlock);
        hideRequestFormElement(customBlock);
        ['box_length','box_width','box_height','customBoxGroupCount'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = '';
        });
        document.getElementById('customBoxFields').innerHTML = '';
    } else {
        hideRequestFormElement(sizeBlock);
        showRequestFormElement(customBlock);
    }
}

// 5️⃣ Обработчики переключения
function setupPackagingToggle() {
    document.getElementsByName('packaging_type')
        .forEach(r => r.addEventListener('change', updatePackaging));
    document.getElementsByName('box_type')
        .forEach(r => r.addEventListener('change', updateBoxType));
    updatePackaging();
}

// 6️⃣ Генерация полей для своих коробов + привязка recalcBox
function generateBoxFields(count) {
    const block = document.getElementById("customBoxFields");
    const fieldConfigs = [
        {
            key: 'length',
            name: 'box_length[]',
            label: 'Длина, см',
            placeholder: 'Длина, см',
            min: '1',
            step: '0.1',
        },
        {
            key: 'width',
            name: 'box_width[]',
            label: 'Ширина, см',
            placeholder: 'Ширина, см',
            min: '1',
            step: '0.1',
        },
        {
            key: 'height',
            name: 'box_height[]',
            label: 'Высота, см',
            placeholder: 'Высота, см',
            min: '1',
            step: '0.1',
        },
        {
            key: 'count',
            name: 'box_count[]',
            label: 'Кол-во',
            placeholder: 'Кол-во',
            min: '1',
            step: '1',
        },
    ];

    const existingValues = fieldConfigs.reduce((acc, field) => {
        acc[field.key] = Array.from(block.querySelectorAll(`input[name="${field.name}"]`)).map(input => input.value);
        return acc;
    }, {});

    if (count < 1 || count > 10) {
        block.innerHTML = '<p class="request-modal__warning request-form__warning form-error text-danger">Укажите от 1 до 10 групп</p>';
        return;
    }

    const html = Array.from({ length: count }, (_, groupIndex) => {
        const fieldsHtml = fieldConfigs.map((field) => [
            '          <label class="request-modal__box-field request-form__box-field">',
            `            <span class="request-form__box-field-title">${escapeHtmlContent(field.label)}</span>`,
            `            <input type="number" name="${escapeAttributeValue(field.name)}" placeholder="${escapeAttributeValue(field.placeholder)}" min="${escapeAttributeValue(field.min)}" step="${escapeAttributeValue(field.step)}" required class="request-modal__dimension-input request-form__dimension-input">`,
            '          </label>',
        ].join('\n')).join('\n');

        return `
      <div class="request-modal__box-group request-form__box-group box-group-item">
        <strong class="request-modal__box-group-title request-form__box-group-title">Группа ${groupIndex + 1}:</strong>
        <div class="request-modal__box-group-inputs request-form__box-group-inputs">
${fieldsHtml}
        </div>
      </div>
    `;
    }).join('');

    block.innerHTML = html;

    const inputs = fieldConfigs.reduce((acc, field) => {
        acc[field.key] = block.querySelectorAll(`input[name="${field.name}"]`);
        return acc;
    }, {});

    fieldConfigs.forEach(({ key }) => {
        inputs[key].forEach((input, index) => {
            if (existingValues[key] && existingValues[key][index] !== undefined) {
                input.value = existingValues[key][index];
            }
            if (typeof window.recalcBox === 'function') {
                input.addEventListener('input', window.recalcBox);
            }
        });
    });
}

// 7️⃣ Триггер генерации своих коробов
function setupBoxFieldsTrigger() {
    const qtyInput = document.getElementById("customBoxGroupCount");
    qtyInput?.addEventListener("change", () => {
        const cnt = parseInt(qtyInput.value) || 0;
        generateBoxFields(cnt);
        if (typeof window.recalcBox === 'function') window.recalcBox();
    });
}

// 8️⃣ Расчёт объёма и оплаты для коробок + валидация по сумме
// 8️⃣ Расчёт объёма и оплаты для коробок + установка цены паллет
function setupVolumeCalculator(basePrice = 500, coef = 1, palletPrice = 1000, boxCoef = 1.15) {
    // 👇 Теперь записываем корректную глобальную переменную для калькулятора паллет
    window._pricePerPallet = palletPrice;

    const L = document.getElementById('box_length'),
          W = document.getElementById('box_width'),
          H = document.getElementById('box_height'),
          Cnt = document.getElementById('boxes'),
          Vol = document.getElementById('box_volume'),
          Pay = document.getElementById('payment'),
          warning = document.getElementById('customBoxWarning'),
          getPack = () => document.querySelector('input[name="packaging_type"]:checked').value,
          getBoxType = () => document.querySelector('input[name="box_type"]:checked').value;

    const MIN_ERROR_CLASS = 'request-form__input-error';

    function validateMinValue(input) {
        if (!input) return false;

        const minAttr = input.getAttribute('min');
        if (!minAttr) {
            input.classList.remove(MIN_ERROR_CLASS);
            input.removeAttribute('aria-invalid');
            if (typeof input.setCustomValidity === 'function') {
                input.setCustomValidity('');
            }
            return false;
        }

        const minValue = parseFloat(minAttr);
        const valueStr = input.value;
        const hasValue = valueStr !== '';
        const numericValue = parseFloat(valueStr);
        const isNumber = Number.isFinite(numericValue);
        const isInvalid = hasValue && isNumber && numericValue < minValue;

        if (isInvalid) {
            input.classList.add(MIN_ERROR_CLASS);
            input.setAttribute('aria-invalid', 'true');
            if (typeof input.setCustomValidity === 'function') {
                input.setCustomValidity(`Минимальное значение ${minAttr}`);
            }
        } else {
            input.classList.remove(MIN_ERROR_CLASS);
            input.removeAttribute('aria-invalid');
            if (typeof input.setCustomValidity === 'function') {
                input.setCustomValidity('');
            }
        }

        return isInvalid;
    }

    window.recalcBox = function() {
        if (getBoxType() === 'custom') {
            const totalBoxes = parseInt(Cnt.value) || 0;
            const sumGroups = Array.from(document.getElementsByName('box_count[]'))
                .reduce((sum, el) => sum + (parseInt(el.value)||0), 0);
            if (sumGroups > totalBoxes) {
                showRequestFormElement(warning);
                Vol.textContent = '—';
                Pay.value = '';
                return;
            } else {
                hideRequestFormElement(warning);
            }
        }

        const fieldsToValidate = [
            L,
            W,
            H,
            Cnt,
            ...document.querySelectorAll('#customBoxFields input[type="number"]')
        ];

        let hasMinError = false;
        fieldsToValidate.forEach((input) => {
            if (validateMinValue(input)) {
                hasMinError = true;
            }
        });

        if (hasMinError) {
            if (Vol) {
                Vol.textContent = '—';
            }
            if (Pay) {
                Pay.value = '';
            }
            return;
        }

        let totalVol = 0;
        let totalCost = 0;
        const count = parseInt(Cnt.value) || 0;

        if (getPack() !== 'Box') return;

        if (getBoxType() === 'standard') {
            // ✅ Просто умножаем на цену за коробку
            totalCost = basePrice * count;
            totalVol = (60 * 40 * 40 / 1000) * count; // объём стандартных коробок
        } else {
            // 🧮 Нестандарт: считаем объём в литрах и применяем коэффициент
            document.querySelectorAll('#customBoxFields .box-group-item').forEach(g => {
                const l = parseFloat(g.querySelector('[name="box_length[]"]').value) || 0;
                const w = parseFloat(g.querySelector('[name="box_width[]"]').value)  || 0;
                const h = parseFloat(g.querySelector('[name="box_height[]"]').value) || 0;
                const c = parseInt(g.querySelector('[name="box_count[]"]').value)     || 0;
                if (l && w && h && c) {
                    const volumeLiters = (l * w * h) / 1000;
                    totalVol += volumeLiters * c;
                    const pricePerLiter = basePrice / (60 * 40 * 40 / 1000); // пересчёт в литры от стандартной
                    totalCost += volumeLiters * pricePerLiter * boxCoef * c;
                }
            });
        }

        Vol.textContent = totalVol ? `${totalVol.toFixed(2)} м³` : '—';
        Pay.value = Math.ceil(totalCost);
    };

    [L, W, H, Cnt,
     ...document.getElementsByName('packaging_type'),
     ...document.getElementsByName('box_type')]
    .forEach(el => {
        if (!el) return;
        const ev = el.type === 'radio' ? 'change' : 'input';
        el.addEventListener(ev, window.recalcBox);
    });
    window.recalcBox();
}















// 9️⃣ Плавная наценка для палет
function getHeightMarkup(h) {
    if (h >= 160 && h <= 200) {
        return 1;
    }
    if (h < 160 && h >= 50) {
        // при 50 см: pct = 0.30; при 160 см: pct = 0
        const pct = ((160 - h) / 110) * 0.30;
        return 1 + pct;
    }
    if (h < 50) {
        return 1 + 0.30;
    }
    // h > 200
    if (h <= 220) {
        // при 200 см: pct = 0; при 220 см: pct = 0.30
        const pct = ((h - 200) / 20) * 0.30;
        return 1 + pct;
    }
    return 1 + 0.30;
}

function getWeightMarkup(w) {
    if (w <= 400) {
        return 1;
    }
    if (w <= 600) {
        // при 400 кг: pct = 0; при 600 кг: pct = 0.30
        const pct = ((w - 400) / 200) * 0.30;
        return 1 + pct;
    }
    return 1 + 0.30;
}
function calculatePalletCost() {
    let total = 0;
    const basePrice = window._pricePerPallet || 7000;
    document.querySelectorAll("#palletFields .pallet-item").forEach(row => {
        let h = parseFloat(row.querySelector(".pallet-height").value) || 0;
        let w = parseFloat(row.querySelector(".pallet-weight").value) || 0;
        // Ограничения
        if (h > 220) h = 220;
        if (w > 600) w = 600;
        if (h > 0 && w > 0) {
            total += basePrice * getHeightMarkup(h) * getWeightMarkup(w);
        }
    });
    document.getElementById("payment").value = Math.ceil(total);
}




// 10️⃣ Генерация полей для палет — обновлённая версия с автокоррекцией значений
function generatePalletFields(count) {
    const block = document.getElementById("palletFields");
    block.innerHTML = Array.from({ length: count }, (_, i) => `
      <div class="pallet-item">
        <strong>Палета ${i+1}</strong>
        <input
          type="number"
          class="pallet-height"
          name="pallet_height[]"
          min="1"
          max="220"
          placeholder="Высота, см"
          oninput="if (this.value > 220) this.value = 220; if (this.value < 1) this.value = 1;"
          onchange="calculatePalletCost()"
        >
        <input
          type="number"
          class="pallet-weight"
          name="pallet_weight[]"
          min="1"
          max="600"
          placeholder="Вес, кг"
          oninput="if (this.value > 600) this.value = 600; if (this.value < 1) this.value = 1;"
          onchange="calculatePalletCost()"
        >
      </div>
    `).join('');
}


// 11️⃣ Триггер палет
function setupPalletFieldsTrigger() {
    const packInputs   = document.getElementsByName("packaging_type");
    const qtyInput     = document.getElementById("boxes");
    const palletBlock  = document.getElementById("palletInputBlock");
    const warn         = document.getElementById("palletWarning");

    function update() {
        // Правильно получаем выбранный тип упаковки
        const selected = Array.from(packInputs).find(i => i.checked)?.value;
        const qty      = parseInt(qtyInput.value, 10) || 0;

        if (selected === "Pallet" && qty > 0 && qty <= 20) {
            showRequestFormElement(palletBlock);
            hideRequestFormElement(warn);
            generatePalletFields(qty);
            calculatePalletCost();
        } else {
            hideRequestFormElement(palletBlock);
            if (selected === "Pallet" && qty > 20) {
                showRequestFormElement(warn);
            } else {
                hideRequestFormElement(warn);
            }
        }
    }

    qtyInput?.addEventListener("input", update);
    Array.from(packInputs).forEach(i => i.addEventListener("change", update));

    // Обрабатываем начальное состояние сразу
    update();
}
// 12️⃣ Модальное окно успешной заявки
function showSuccessModal(qrText, paymentAmount, modalIdOverride) {
    const lastModalId = typeof modalIdOverride === 'string' && modalIdOverride
        ? modalIdOverride
        : (typeof window !== 'undefined' && window.__lastRequestFormModalId) || 'requestModal';
    const modal = lastModalId ? document.getElementById(lastModalId) : null;

    if (modal) {
        if (typeof modal._legacyCleanup === 'function') {
            try {
                modal._legacyCleanup();
            } catch (cleanupError) {
                console.warn('showSuccessModal: ошибка при выполнении _legacyCleanup', cleanupError);
            }
        }

        modal.classList.remove('active', 'show', 'open', 'modal-open');
        modal.style.display = 'none';

        const { requestFormContentId } = modal.dataset || {};
        let content = null;
        if (requestFormContentId) {
            const datasetContent = document.getElementById(requestFormContentId);
            if (datasetContent && modal.contains(datasetContent)) {
                content = datasetContent;
            }
        }
        if (!content) {
            content = modal.querySelector('#requestModalContent');
        }
        if (content) {
            content.innerHTML = '';
        }
    }

    document.body.classList.remove('modal-open');

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.insertAdjacentHTML('beforeend', `
<style>
.modal-overlay {
  position: fixed; top: 0; left: 0; width: 100%; height: 100%;
  background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center;
  z-index: 9999;
}
.modal-content {
    max-width: 500px; width: 95%; padding: 24px;
    box-sizing: border-box; background: #fff; border-radius: 8px; position: relative;
}
.modal-header.success-header h2 { margin: 0; }
.modal-body {
    display: flex !important; flex-direction: column !important; gap: 24px;
    align-items: center; overflow-x: hidden !important; overflow-y: visible;
    width: 100%; box-sizing: border-box;
}
.close-button {
    background: none; border: none; cursor: pointer;
}
@media (max-width: 480px) {
    .modal-content { width: 94% !important; padding: 20px 16px !important; }
    .modal-body { gap: 16px; padding: 0; }
    .modal-body img { width: 180px !important; height: auto !important; }
    .modal-body p, .modal-body div { font-size: 14px !important; text-align: center; }
    .modal-body button { font-size: 14px !important; width: 100%; }
}
</style>`);

    const qrImageUrl = resolveFormPath('QR/1IP.jpg');
    overlay.insertAdjacentHTML('beforeend', `
<div class="modal-content" onclick="event.stopPropagation()">
  <div class="modal-header success-header" style="margin-bottom:20px;">
    <h2 style="font-size:20px; color:#2e7d32;">✅ Заявка успешно создана!</h2>
    <button type="button" class="close-button legacy-success-close" style="position:absolute;top:16px;right:16px;font-size:22px;">×</button>
  </div>
  <div class="modal-body">
    <div><p style="font-weight:500;">📱 Покажите этот QR менеджеру:</p><div id="qrCodeSuccess" class="qr-success-box" style="margin:auto;"></div></div>
    <hr style="width:100%;border-top:1px solid #ccc;">
    <div>
      <p style="font-weight:500;">💳 Отсканируйте QR для оплаты:</p>
      <img src="${qrImageUrl}" alt="QR для оплаты" style="width:200px;border:1px solid #ccc;border-radius:8px;">
      <p style="margin-top:10px;font-size:16px;"><strong>Сумма к оплате:</strong> <span id="modalPaymentSum">${paymentAmount}</span> ₽</p>
    </div>
    <p style="color:#444;font-size:14px;">⚠️ Покажите чек оплаты менеджеру приёмки для подтверждения</p>
  </div>
</div>`);

    document.body.appendChild(overlay);

    const cleanup = () => {
        overlay.remove();
        if (typeof window.loadOrders === 'function') {
            try {
                window.loadOrders();
            } catch (err) {
                console.warn('loadOrders() завершился с ошибкой:', err);
            }
        }
    };

    const closeBtn = overlay.querySelector('.legacy-success-close');
    if (closeBtn) {
        closeBtn.addEventListener('click', cleanup, { once: true });
    }

    overlay.addEventListener('click', (ev) => {
        if (!ev.target.closest('.modal-content')) {
            cleanup();
        }
    });

    const qrContainer = overlay.querySelector('#qrCodeSuccess');
    if (qrContainer) {
        new QRCode(qrContainer, { text: qrText, width: 200, height: 200 });
    }
}

let pickupMapInstance;
let pickupPlacemark;
let pickupMapInitPromise = null;

const YMAPS_READY_TIMEOUT = 10000;
const YMAPS_READY_CHECK_INTERVAL = 150;

function waitForYmapsGlobal(timeoutMs = YMAPS_READY_TIMEOUT, intervalMs = YMAPS_READY_CHECK_INTERVAL) {
  return new Promise((resolve, reject) => {
    const hasYmaps = () => typeof window !== 'undefined'
      && typeof window.ymaps !== 'undefined'
      && typeof window.ymaps.ready === 'function';

    if (hasYmaps()) {
      resolve(window.ymaps);
      return;
    }

    const deadline = Date.now() + Math.max(timeoutMs, 0);

    (function check() {
      if (hasYmaps()) {
        resolve(window.ymaps);
        return;
      }
      if (Date.now() > deadline) {
        reject(new Error('Глобальный объект ymaps ещё не готов'));
        return;
      }
      setTimeout(check, Math.max(intervalMs, 50));
    })();
  });
}

async function initPickupMap() {
  const mapElement = document.getElementById('pickupMap');
  if (!mapElement) {
    throw new Error('Контейнер карты забора не найден в DOM');
  }

  const currentContainer = pickupMapInstance
    && pickupMapInstance.container
    && typeof pickupMapInstance.container.getElement === 'function'
    ? pickupMapInstance.container.getElement()
    : null;

  if (pickupMapInstance && currentContainer !== mapElement) {
    try {
      if (typeof pickupMapInstance.destroy === 'function') {
        pickupMapInstance.destroy();
      }
    } catch (err) {
      console.warn('Ошибка при уничтожении предыдущего экземпляра карты забора:', err);
    }
    pickupMapInstance = null;
    pickupPlacemark = null;
    pickupMapInitPromise = null;
    if (typeof window !== 'undefined') {
      window.__pickupMapInited = false;
    }
  }

  if (pickupMapInstance) {
    if (typeof window !== 'undefined') {
      window.__pickupMapInited = true;
    }
    return pickupMapInstance;
  }

  if (pickupMapInitPromise) {
    return pickupMapInitPromise;
  }

  const createMap = () => new Promise((resolve, reject) => {
    try {
      ymaps.ready(() => {
        try {
          if (pickupMapInstance) {
            if (typeof window !== 'undefined') {
              window.__pickupMapInited = true;
            }
            resolve(pickupMapInstance);
            return;
          }

          const targetElement = document.getElementById('pickupMap');
          if (!targetElement) {
            throw new Error('Контейнер карты забора не найден в DOM');
          }

          const latEl      = document.getElementById('pickupLat');
          const lngEl      = document.getElementById('pickupLng');
          const routeBlock = document.getElementById('routeBlock');
          const yLink      = document.getElementById('routeLinkYandex');
          const gLink      = document.getElementById('routeLinkGoogle');
          const copyBtn    = document.getElementById('routeCopyBtn');

          pickupMapInstance = new ymaps.Map(targetElement, {
            center: [43.251900, 46.603400], // центр по умолчанию
            zoom: 12,
            controls: ['zoomControl']
          });
          setTimeout(() => pickupMapInstance.container.fitToViewport(), 0);

          function setPlacemark(coords) {
            if (pickupPlacemark) {
              pickupPlacemark.geometry.setCoordinates(coords);
            } else {
              pickupPlacemark = new ymaps.Placemark(coords, {}, { preset: 'islands#redIcon' });
              pickupMapInstance.geoObjects.add(pickupPlacemark);
            }
          }

          function updateLinks(coords) {
            const lat = Number(coords[0]).toFixed(6);
            const lon = Number(coords[1]).toFixed(6);

            if (latEl) latEl.value = lat;
            if (lngEl) lngEl.value = lon;

            const yUrl = `https://yandex.ru/maps/?from=api-maps`
              + `&ll=${encodeURIComponent(lon)},${encodeURIComponent(lat)}`
              + `&mode=routes&rtext=~${encodeURIComponent(lat)},${encodeURIComponent(lon)}`
              + `&rtt=auto&z=14`;

            const gUrl = `https://www.google.com/maps/dir/?api=1`
              + `&destination=${encodeURIComponent(lat)},${encodeURIComponent(lon)}`
              + `&travelmode=driving`;

            if (yLink) {
              yLink.href = yUrl;
              yLink.textContent = 'Открыть в Яндекс.Картах';
            }
            if (gLink) {
              gLink.href = gUrl;
              gLink.textContent = 'Открыть в Google Maps';
            }
            if (routeBlock) {
              showRequestFormElement(routeBlock);
            }

            if (copyBtn) {
              copyBtn.onclick = () => {
                navigator.clipboard.writeText(yUrl).then(() => {
                  copyBtn.textContent = 'Скопировано!';
                  setTimeout(() => copyBtn.textContent = 'Копировать', 1200);
                });
              };
            }
          }

          pickupMapInstance.events.add('click', (e) => {
            const coords = e.get('coords');
            setPlacemark(coords);
            updateLinks(coords);
          });

          if (typeof window !== 'undefined') {
            window.__pickupMapInited = true;
          }
          resolve(pickupMapInstance);
        } catch (innerErr) {
          reject(innerErr);
        }
      });
    } catch (err) {
      reject(err);
    }
  });

  pickupMapInitPromise = (async () => {
    await waitForYmapsGlobal();
    return createMap();
  })();

  try {
    return await pickupMapInitPromise;
  } catch (err) {
    pickupMapInitPromise = null;
    if (typeof window !== 'undefined') {
      window.__pickupMapInited = false;
    }
    throw err;
  }
}






async function initializeForm() {
    const form = document.getElementById('dataForm');
    if (!form) {
        // Если форма ещё не загружена — повторим после DOMContentLoaded
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', initializeForm);
        }
        return;
    }

    if (form.dataset?.initialized === 'true') {
        return;
    }

    // 1) Предзаполнение и настройка переключателей
    preloadUserDataIntoForm();
    setupPackagingToggle();
    setupPalletFieldsTrigger();
    setupBoxFieldsTrigger();

    const cityEl = document.getElementById('city');
    const whEl   = document.getElementById('warehouses');
    const cityDependentContainer = document.getElementById('cityDependentFields');
    const cityNoticeElement = document.getElementById('citySelectionNotice');

    const marketplace = (form.dataset?.marketplace || '').trim();
    const initialCity = (form.dataset?.initialCity || (cityEl ? cityEl.value : '') || '').trim();
    const warehouseFallback = () => {
        const raw = whEl && typeof whEl.value === 'string' ? whEl.value : form.dataset?.initialWarehouse || '';
        return normalizeWarehouseValue(raw);
    };

    const toTrimmedString = (value) => {
        if (value === null || value === undefined) {
            return '';
        }
        return `${value}`.trim();
    };

    const scheduleFieldElements = {
        scheduleId: document.getElementById('formScheduleId'),
        acceptDate: document.getElementById('acceptDateField'),
        deliveryDate: document.getElementById('deliveryDateField'),
        deliveryAlias: document.getElementById('deliveryDateAlias'),
        acceptTime: document.getElementById('acceptTimeField'),
        direction: document.getElementById('directionField'),
        warehouse: whEl,
        driverName: document.getElementById('driver_name'),
        driverPhone: document.getElementById('driver_phone'),
        carNumber: document.getElementById('car_number'),
        carBrand: document.getElementById('car_brand'),
        sender: document.getElementById('sender')
    };

    const defaultScheduleState = {};
    Object.entries(scheduleFieldElements).forEach(([key, element]) => {
        if (element && Object.prototype.hasOwnProperty.call(element, 'value')) {
            defaultScheduleState[key] = toTrimmedString(element.value);
        } else {
            defaultScheduleState[key] = '';
        }
    });

    const scheduleByCityKey = new Map();
    const overrideCityList = [];
    const seenOverrideCities = new Set();

    if (form.dataset?.availableSchedules) {
        try {
            const parsed = JSON.parse(form.dataset.availableSchedules);
            if (Array.isArray(parsed)) {
                parsed.forEach((item) => {
                    if (!item || typeof item !== 'object') {
                        return;
                    }

                    const normalizedEntry = {
                        id: toTrimmedString(item.id ?? item.schedule_id ?? ''),
                        city: toTrimmedString(item.city ?? ''),
                        warehouse: toTrimmedString(item.warehouse ?? item.warehouses ?? defaultScheduleState.warehouse),
                        acceptDate: toTrimmedString(item.acceptDate ?? item.accept_date ?? ''),
                        deliveryDate: toTrimmedString(item.deliveryDate ?? item.delivery_date ?? ''),
                        acceptTime: toTrimmedString(item.acceptTime ?? item.accept_time ?? ''),
                        driverName: toTrimmedString(item.driverName ?? item.driver_name ?? ''),
                        driverPhone: toTrimmedString(item.driverPhone ?? item.driver_phone ?? ''),
                        carNumber: toTrimmedString(item.carNumber ?? item.car_number ?? ''),
                        carBrand: toTrimmedString(item.carBrand ?? item.car_brand ?? ''),
                        sender: toTrimmedString(item.sender ?? ''),
                        marketplace: toTrimmedString(item.marketplace ?? '')
                    };

                    if (normalizedEntry.city) {
                        const cityKey = normalizedEntry.city.toLowerCase();
                        if (!scheduleByCityKey.has(cityKey)) {
                            scheduleByCityKey.set(cityKey, normalizedEntry);
                        }
                        if (!seenOverrideCities.has(cityKey)) {
                            seenOverrideCities.add(cityKey);
                            overrideCityList.push(normalizedEntry.city);
                        }
                    }
                });
            }
        } catch (err) {
            console.warn('Не удалось разобрать список доступных отправлений формы заявки:', err);
        }
    }

    const overrideCityOptions = overrideCityList.length > 0 ? overrideCityList : null;

    const applyScheduleSelection = (cityValue) => {
        const cityText = toTrimmedString(cityValue);
        const schedule = cityText ? (scheduleByCityKey.get(cityText.toLowerCase()) || null) : null;
        const usingOverrideList = Array.isArray(overrideCityOptions) && overrideCityOptions.length > 0;

        const values = { ...defaultScheduleState };

        if (schedule) {
            const scheduleId = toTrimmedString(schedule.id);
            if (scheduleId) {
                values.scheduleId = scheduleId;
            }

            const acceptDate = toTrimmedString(schedule.acceptDate);
            if (acceptDate) {
                values.acceptDate = acceptDate;
            }

            const deliveryDate = toTrimmedString(schedule.deliveryDate);
            if (deliveryDate) {
                values.deliveryDate = deliveryDate;
                values.deliveryAlias = deliveryDate;
            }

            const acceptTime = toTrimmedString(schedule.acceptTime);
            if (acceptTime) {
                values.acceptTime = acceptTime;
            }

            const warehouseName = toTrimmedString(schedule.warehouse);
            if (warehouseName) {
                values.direction = warehouseName;
                values.warehouse = warehouseName;
            }

            const driverName = toTrimmedString(schedule.driverName);
            if (driverName) {
                values.driverName = driverName;
            }

            const driverPhone = toTrimmedString(schedule.driverPhone);
            if (driverPhone) {
                values.driverPhone = driverPhone;
            }

            const carNumber = toTrimmedString(schedule.carNumber);
            if (carNumber) {
                values.carNumber = carNumber;
            }

            const carBrand = toTrimmedString(schedule.carBrand);
            if (carBrand) {
                values.carBrand = carBrand;
            }

            const senderName = toTrimmedString(schedule.sender);
            if (senderName) {
                values.sender = senderName;
            }
        } else if (usingOverrideList) {
            values.scheduleId = '';
            values.acceptTime = '';
            values.driverName = '';
            values.driverPhone = '';
            values.carNumber = '';
            values.carBrand = '';
        }

        Object.entries(scheduleFieldElements).forEach(([key, element]) => {
            if (!element || !Object.prototype.hasOwnProperty.call(element, 'value')) {
                return;
            }
            const nextValue = values[key] !== undefined ? values[key] : '';
            element.value = toTrimmedString(nextValue);
        });

        const selectedScheduleId = toTrimmedString(values.scheduleId);
        if (selectedScheduleId) {
            form.dataset.selectedScheduleId = selectedScheduleId;
        } else {
            delete form.dataset.selectedScheduleId;
        }

        const resolvedWarehouse = toTrimmedString(values.warehouse) || warehouseFallback();
        updateDirectionSummary(cityText, resolvedWarehouse);

        return schedule;
    };

    const applyCityInteractivity = (cityValue) => {
        const normalizedCity = `${cityValue ?? ''}`.trim();
        const hasCity = normalizedCity.length > 0;

        if (form) {
            form.dataset.selectedCity = normalizedCity;
            form.dataset.cityReady = hasCity ? 'true' : 'false';
        }

        if (cityNoticeElement) {
            if (hasCity) {
                cityNoticeElement.classList.add(REQUEST_FORM_HIDDEN_CLASS);
            } else {
                cityNoticeElement.classList.remove(REQUEST_FORM_HIDDEN_CLASS);
            }
        }

        if (!cityDependentContainer) {
            return;
        }

        cityDependentContainer.classList.toggle(REQUEST_FORM_HIDDEN_CLASS, !hasCity);
        if (!hasCity) {
            cityDependentContainer.setAttribute('aria-hidden', 'true');
        } else {
            cityDependentContainer.removeAttribute('aria-hidden');
        }

        const interactiveElements = cityDependentContainer.querySelectorAll('input, select, textarea, button');
        interactiveElements.forEach((element) => {
            if (!element) {
                return;
            }
            if (element.type === 'hidden' || element.dataset?.cityLockIgnore === 'true') {
                return;
            }
            if (!hasCity) {
                if (!element.dataset.cityLockWasDisabled) {
                    element.dataset.cityLockWasDisabled = element.disabled ? 'true' : 'false';
                }
                element.disabled = true;
            } else {
                if (element.dataset.cityLockWasDisabled !== 'true') {
                    element.disabled = false;
                }
                delete element.dataset.cityLockWasDisabled;
            }
        });
    };

    const resetCityDependentOutputs = () => {
        const tariffRate = document.getElementById('tariff_rate');
        if (tariffRate) {
            tariffRate.textContent = '—';
        }
        const paymentInput = document.getElementById('payment');
        if (paymentInput) {
            paymentInput.value = '';
        }
        const volumeDisplay = document.getElementById('box_volume');
        if (volumeDisplay) {
            volumeDisplay.textContent = '—';
        }
    };

    const handleCitySelectionChange = async (cityValue) => {
        const normalizedCity = `${cityValue ?? ''}`.trim();
        applyCityInteractivity(normalizedCity);

        if (!normalizedCity) {
            resetCityDependentOutputs();
            return;
        }

        await updateTariffFor(normalizedCity, warehouseFallback());
    };

    const triggerCitySelectionChange = (value) => {
        try {
            const maybePromise = handleCitySelectionChange(value);
            if (maybePromise && typeof maybePromise.then === 'function') {
                maybePromise.catch((err) => {
                    console.warn('Ошибка обновления состояния формы при выборе города:', err);
                });
            }
        } catch (err) {
            console.warn('Ошибка обновления состояния формы при выборе города:', err);
        }
    };

    let resolvedCity = (cityEl ? cityEl.value : '').trim() || initialCity;

    applyScheduleSelection(resolvedCity);
    applyCityInteractivity(resolvedCity);

    try {
        const selectedCity = await setupCitySelector({
            form,
            selectElement: cityEl,
            marketplace,
            initialCity,
            getWarehouseValue: warehouseFallback,
            overrideCities: overrideCityOptions,
            onCityChange: (value) => {
                applyScheduleSelection(value);
                triggerCitySelectionChange(value);
            }
        });
        if (typeof selectedCity === 'string') {
            resolvedCity = selectedCity;
        }
    } catch (err) {
        console.warn('Не удалось инициализировать список городов формы заявки:', err);
        resolvedCity = (cityEl ? cityEl.value : '').trim() || initialCity;
    }

    applyScheduleSelection(resolvedCity);

    try {
        await handleCitySelectionChange(resolvedCity);
    } catch (err) {
        console.warn('Не удалось применить состояние формы после инициализации города:', err);
    }

    // 4) Обработка отправки формы
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const status = document.getElementById('status');

        // Проверка координат, если выбран забор груза
        const pickCb   = document.getElementById('pickupCheckbox');
        const latInput = document.getElementById('pickupLat');
        const lngInput = document.getElementById('pickupLng');

        if (pickCb && pickCb.checked) {
            if (!window.__pickupMapInited) {
                try {
                    await initPickupMap();
                } catch (err) {
                    console.warn('Не удалось инициализировать карту перед проверкой координат:', err);
                }
            }
            const lat = latInput ? latInput.value.trim() : '';
            const lng = lngInput ? lngInput.value.trim() : '';
            if (!lat || !lng) {
                if (status) {
                    status.textContent = 'Пожалуйста, выберите точку на карте';
                    status.style.color = 'red';
                }
                return;
            }
        }

        const cityValue = (cityEl && typeof cityEl.value === 'string') ? cityEl.value.trim() : '';
        if (cityValue) {
            let confirmed = true;
            try {
                confirmed = await openCityConfirmationModal({ cityName: cityValue, cityElement: cityEl });
            } catch (err) {
                console.warn('Не удалось показать подтверждение города перед отправкой формы:', err);
                confirmed = true;
            }

            if (!confirmed) {
                return;
            }
        }

        const btn = form.querySelector('button[type="submit"]');
        if (btn) { btn.disabled = true; btn.textContent = 'Отправка...'; }
        try {
            const submitUrl = resolveFormPath('log_data.php');
            const res    = await fetch(submitUrl, { method: 'POST', body: new FormData(form) });
            const result = await res.json();
            if (result && result.status === 'success') {
                const pay = document.getElementById('payment');
                showSuccessModal(result.qr_code, pay ? pay.value : '');
            } else {
                if (status) {
                    status.textContent = `⚠️ Ошибка: ${result && result.message ? result.message : 'Неизвестная ошибка'}`;
                    status.style.color = 'red';
                }
            }
        } catch (err) {
            if (status) {
                status.textContent = 'Ошибка подключения: ' + err.message;
                status.style.color = 'red';
            }
        } finally {
            if (btn) { btn.disabled = false; btn.textContent = 'Отправить'; }
        }
    });

    // 5) Логика «Забрать груз» (карта + номер телефона)
    const pickupCheckbox = document.getElementById('pickupCheckbox');
    const addressFields  = document.getElementById('pickupAddressFields');
    const phoneInput     = document.getElementById('clientPhone');
    const latInput       = document.getElementById('pickupLat');
    const lngInput       = document.getElementById('pickupLng');
    if (phoneInput) phoneInput.required = pickupCheckbox && pickupCheckbox.checked;

    // безопасный сброс полей карты
    const resetMapFields = () => {
        if (latInput) latInput.value = '';
        if (lngInput) lngInput.value = '';
        // routeBlock просто скрываем — ссылки пересчитаются при следующем клике по карте
        const rb = document.getElementById('routeBlock');
        if (rb) hideRequestFormElement(rb);
    };

    if (pickupCheckbox) {
        const ensurePickupMapReady = () => {
            return initPickupMap()
                .then(() => {
                    setTimeout(() => {
                        if (pickupMapInstance && pickupMapInstance.container) {
                            pickupMapInstance.container.fitToViewport();
                        }
                    }, 0);
                })
                .catch((err) => {
                    console.warn('Не удалось инициализировать карту забора:', err);
                });
        };

        pickupCheckbox.addEventListener('change', () => {
            if (pickupCheckbox.checked) {
                if (addressFields) showRequestFormElement(addressFields);
                if (phoneInput) phoneInput.required = true;
                ensurePickupMapReady();
            } else {
                if (addressFields) hideRequestFormElement(addressFields);
                if (phoneInput) phoneInput.required = false;
                resetMapFields();
            }
        });

        // если галочка уже была выставлена при рендере — сразу покажем блок и инициализируем карту
        if (pickupCheckbox.checked) {
            if (addressFields) showRequestFormElement(addressFields);
            if (phoneInput) phoneInput.required = true;
            ensurePickupMapReady();
        }
    }

    form.dataset.initialized = 'true';
}






window.initializeForm = initializeForm;

initializeForm();
