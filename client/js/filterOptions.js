const EMPTY_OPTION_LABEL = 'Все';

function buildUrl(baseUrl, action, params = {}) {
    const url = new URL(baseUrl, window.location.href);
    url.searchParams.set('action', action);

    Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && `${value}`.trim() !== '') {
            url.searchParams.set(key, value);
        }
    });

    return url;
}

export async function fetchFilterOptions(action, { baseUrl = 'filter_options.php', params = {} } = {}) {
    const url = buildUrl(baseUrl, action, params);
    const response = await fetch(url.toString(), { credentials: 'include' });

    if (!response.ok) {
        throw new Error(`Не удалось получить данные фильтра: ${response.status} ${response.statusText}`);
    }

    return response.json();
}

export async function fetchMarketplaces({ baseUrl = 'filter_options.php' } = {}) {
    try {
        const data = await fetchFilterOptions('marketplaces', { baseUrl });
        if (Array.isArray(data?.marketplaces)) {
            return data.marketplaces;
        }
        if (Array.isArray(data)) {
            return data;
        }
        if (data?.success === false && data?.message) {
            console.error(`Ошибка ответа сервера (marketplaces): ${data.message}`);
        }
    } catch (error) {
        console.error('Ошибка загрузки списка маркетплейсов:', error);
    }

    return [];
}

export async function fetchCities({ marketplace = '', baseUrl = 'filter_options.php' } = {}) {
    const action = marketplace ? 'cities' : 'all_cities';
    const params = marketplace ? { marketplace } : {};

    try {
        const data = await fetchFilterOptions(action, { baseUrl, params });
        if (Array.isArray(data?.cities)) {
            return data.cities;
        }
        if (Array.isArray(data)) {
            return data;
        }
        if (data?.success === false && data?.message) {
            console.error(`Ошибка ответа сервера (${action}): ${data.message}`);
        }
    } catch (error) {
        console.error('Ошибка загрузки списка городов:', error);
    }

    return [];
}

export async function fetchWarehouses({ marketplace = '', city = '', baseUrl = 'filter_options.php' } = {}) {
    let action = 'all_warehouses';
    const params = {};

    if (marketplace && city) {
        action = 'warehouses';
        params.marketplace = marketplace;
        params.city = city;
    } else if (city) {
        params.city = city;
    }

    try {
        const data = await fetchFilterOptions(action, { baseUrl, params });
        if (Array.isArray(data?.warehouses)) {
            return data.warehouses;
        }
        if (Array.isArray(data)) {
            return data;
        }
        if (data?.success === false && data?.message) {
            console.error(`Ошибка ответа сервера (${action}): ${data.message}`);
        }
    } catch (error) {
        console.error('Ошибка загрузки списка складов:', error);
    }

    return [];
}

function normalizeOptions(options) {
    const normalized = [];
    const seen = new Set();

    options.forEach(option => {
        if (option === null || option === undefined) {
            return;
        }

        let value;
        let label;

        if (typeof option === 'string') {
            value = option.trim();
            label = option.trim();
        } else if (typeof option === 'object') {
            const rawValue = option.value ?? option.label ?? '';
            const rawLabel = option.label ?? option.value ?? '';
            value = typeof rawValue === 'string' ? rawValue.trim() : `${rawValue}`.trim();
            label = typeof rawLabel === 'string' ? rawLabel.trim() : `${rawLabel}`.trim();
        }

        if (!value) {
            return;
        }

        if (!label) {
            label = value;
        }

        if (seen.has(value)) {
            return;
        }

        seen.add(value);
        normalized.push({ value, label });
    });

    return normalized;
}

export function populateSelect(selectElement, options, { placeholder = EMPTY_OPTION_LABEL, selectedValue = '' } = {}) {
    if (!selectElement) {
        return '';
    }

    const normalized = normalizeOptions(Array.isArray(options) ? options : []);
    const fragment = document.createDocumentFragment();

    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.textContent = placeholder;
    fragment.appendChild(defaultOption);

    normalized.forEach(({ value, label }) => {
        const optionElement = document.createElement('option');
        optionElement.value = value;
        optionElement.textContent = label;
        fragment.appendChild(optionElement);
    });

    selectElement.innerHTML = '';
    selectElement.appendChild(fragment);

    const values = new Set(normalized.map(option => option.value));
    const finalValue = selectedValue && values.has(selectedValue) ? selectedValue : '';
    selectElement.value = finalValue;

    return finalValue;
}
