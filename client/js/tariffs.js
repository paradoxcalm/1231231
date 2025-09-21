// Управление тарифами
class TariffsManager {
    constructor() {
        this.ALL_MARKETPLACE = 'all';
        this.UNASSIGNED_MARKETPLACE = '__unassigned';

        this.tariffs = {};
        this.marketplaceTariffs = {};
        this.marketplaceOptions = [];
        this.currentMarketplace = this.ALL_MARKETPLACE;
        this.currentCity = '';
        this.hasLoaded = false;
        this.isLoading = false;

        this.elements = {
            cityTabs: document.getElementById('cityTabs'),
            tableContainer: document.getElementById('tariffsTable'),
            marketplaceSelect: document.getElementById('tariffsMarketplaceFilter')
        };

        this.init();
    }

    init() {
        this.setupEventListeners();
        this.loadTariffs();
    }

    setupEventListeners() {
        const { marketplaceSelect } = this.elements;
        if (marketplaceSelect) {
            marketplaceSelect.addEventListener('change', (event) => {
                this.handleMarketplaceChange(event.target.value);
            });
        }
    }

    async loadTariffs(optionsOrCity, warehouse) {
        if (typeof optionsOrCity === 'string' && typeof warehouse === 'string') {
            return this.fetchSingleTariff(optionsOrCity, warehouse);
        }

        if (this.isLoading) {
            return;
        }

        const isOptionsObject = typeof optionsOrCity === 'object' && optionsOrCity !== null;
        const forceReload = optionsOrCity === true || (isOptionsObject && optionsOrCity.force === true);

        if (this.hasLoaded && !forceReload) {
            this.renderTariffs();
            return;
        }

        this.isLoading = true;

        const previousMarketplace = this.currentMarketplace;
        const previousCity = this.currentCity;

        if (!this.hasLoaded) {
            this.showLoadingState();
        }

        try {
            const response = await fetch('../tariffs/fetch_tariffs.php');
            const result = await response.json();

            if (!result.success) {
                throw new Error(result.message || 'Сервер вернул ошибку');
            }

            this.processTariffsData(result.data || {});

            const hasMarketplace = this.marketplaceOptions.some(option => option.value === previousMarketplace);
            this.currentMarketplace = hasMarketplace ? previousMarketplace : this.ALL_MARKETPLACE;

            const filteredTariffs = this.getTariffsByMarketplace(this.currentMarketplace);
            this.currentCity = previousCity && filteredTariffs[previousCity] ? previousCity : '';

            this.renderTariffs();
            this.hasLoaded = true;
        } catch (error) {
            console.error('Ошибка загрузки тарифов:', error);
            if (!this.hasLoaded) {
                this.showErrorState(error?.message);
            }
            if (window.app?.showError) {
                window.app.showError('Не удалось загрузить тарифы');
            }
        } finally {
            this.isLoading = false;
        }
    }

    async fetchSingleTariff(city, warehouse) {
        const url = `../get_tariff.php?city=${encodeURIComponent(city)}&warehouse=${encodeURIComponent(warehouse)}`;

        try {
            const response = await fetch(url);
            const result = await response.json();

            if (!result.success) {
                throw new Error(result.message || 'Тариф не найден');
            }

            const tariff = {
                box: this.toNumber(result.base_price),
                pallet: this.toNumber(result.pallet_price),
                boxCoef: this.toNumber(result.box_coef),
                perLiter: this.toNumber(result.per_liter)
            };

            const existing = this.tariffs[city]?.[warehouse];
            if (existing) {
                existing.box = tariff.box;
                existing.pallet = tariff.pallet;
            }

            return tariff;
        } catch (error) {
            console.error('Ошибка получения тарифа:', error);
            throw error;
        }
    }

    processTariffsData(rawData) {
        const normalizedTariffs = {};
        const groupedByMarketplace = {};
        const marketplaceOrder = [];
        const seenMarketplaces = new Set();
        let hasUnassigned = false;

        for (const [cityName, warehouses] of Object.entries(rawData)) {
            if (!normalizedTariffs[cityName]) {
                normalizedTariffs[cityName] = {};
            }

            for (const [warehouseName, values] of Object.entries(warehouses || {})) {
                const marketplaceName = this.normalizeMarketplace(values.marketplace);
                const entry = {
                    box: this.toNumber(values.box_price),
                    pallet: this.toNumber(values.pallet_price),
                    marketplace: marketplaceName,
                    marketplaceId: values.marketplace_id ?? null
                };

                normalizedTariffs[cityName][warehouseName] = entry;

                const marketplaceKey = marketplaceName || this.UNASSIGNED_MARKETPLACE;

                if (!groupedByMarketplace[marketplaceKey]) {
                    groupedByMarketplace[marketplaceKey] = {};
                }

                if (!groupedByMarketplace[marketplaceKey][cityName]) {
                    groupedByMarketplace[marketplaceKey][cityName] = {};
                }

                groupedByMarketplace[marketplaceKey][cityName][warehouseName] = entry;

                if (marketplaceName) {
                    if (!seenMarketplaces.has(marketplaceName)) {
                        seenMarketplaces.add(marketplaceName);
                        marketplaceOrder.push(marketplaceName);
                    }
                } else {
                    hasUnassigned = true;
                }
            }
        }

        const options = [{ value: this.ALL_MARKETPLACE, label: 'Все маркетплейсы' }];

        marketplaceOrder.forEach(name => {
            options.push({ value: name, label: name });
        });

        if (hasUnassigned) {
            options.push({ value: this.UNASSIGNED_MARKETPLACE, label: 'Без маркетплейса' });
        }

        this.tariffs = normalizedTariffs;
        this.marketplaceTariffs = groupedByMarketplace;
        this.marketplaceOptions = options;
    }

    getTariffsByMarketplace(marketplaceKey) {
        if (marketplaceKey === this.ALL_MARKETPLACE) {
            return this.tariffs;
        }

        return this.marketplaceTariffs[marketplaceKey] || {};
    }

    renderTariffs() {
        const hasTariffs = Object.keys(this.tariffs).length > 0;
        this.renderMarketplaceFilter(hasTariffs);

        const filteredTariffs = this.getTariffsByMarketplace(this.currentMarketplace);
        const cities = Object.keys(filteredTariffs);

        if (!cities.length) {
            this.currentCity = '';
            this.renderCityTabs(filteredTariffs, cities);
            this.renderTariffsTable(filteredTariffs, '');
            return;
        }

        if (!this.currentCity || !filteredTariffs[this.currentCity]) {
            this.currentCity = cities[0];
        }

        this.renderCityTabs(filteredTariffs, cities);
        this.renderTariffsTable(filteredTariffs, this.currentCity);
    }

    renderMarketplaceFilter(hasTariffs) {
        const { marketplaceSelect } = this.elements;
        if (!marketplaceSelect) {
            return;
        }

        if (!hasTariffs) {
            marketplaceSelect.innerHTML = '<option value="">Нет тарифов</option>';
            marketplaceSelect.value = '';
            marketplaceSelect.disabled = true;
            return;
        }

        marketplaceSelect.disabled = false;
        marketplaceSelect.innerHTML = this.marketplaceOptions
            .map(option => `<option value="${option.value}">${option.label}</option>`)
            .join('');

        const selectedOption = this.marketplaceOptions.find(option => option.value === this.currentMarketplace);
        const selectedValue = selectedOption ? selectedOption.value : this.ALL_MARKETPLACE;

        this.currentMarketplace = selectedValue;
        marketplaceSelect.value = selectedValue;
    }

    handleMarketplaceChange(value) {
        const newValue = value || this.ALL_MARKETPLACE;
        if (newValue === this.currentMarketplace) {
            return;
        }

        this.currentMarketplace = newValue;
        this.renderTariffs();
    }

    renderCityTabs(filteredTariffs, cities) {
        const { cityTabs } = this.elements;
        if (!cityTabs) {
            return;
        }

        cityTabs.innerHTML = '';
        cityTabs.classList.toggle('is-hidden', cities.length === 0);

        if (!cities.length) {
            return;
        }

        const fragment = document.createDocumentFragment();

        cities.forEach(city => {
            const tab = document.createElement('button');
            tab.type = 'button';
            tab.className = `city-tab${city === this.currentCity ? ' active' : ''}`;
            tab.dataset.city = city;
            tab.textContent = city;

            tab.addEventListener('click', () => {
                if (this.currentCity === city) {
                    return;
                }
                this.currentCity = city;
                this.renderTariffs();
            });

            fragment.appendChild(tab);
        });

        cityTabs.appendChild(fragment);
    }

    renderTariffsTable(filteredTariffs, city) {
        const { tableContainer } = this.elements;
        if (!tableContainer) {
            return;
        }

        tableContainer.classList.remove('is-empty');
        tableContainer.innerHTML = '';

        if (!Object.keys(this.tariffs).length) {
            tableContainer.classList.add('is-empty');
            tableContainer.innerHTML = this.createEmptyState({
                icon: 'truck-ramp-box',
                title: 'Нет доступных тарифов',
                description: 'Сейчас в системе нет тарифов. Попробуйте обновить страницу позже.'
            });
            return;
        }

        if (!city) {
            tableContainer.classList.add('is-empty');
            tableContainer.innerHTML = this.createEmptyState({
                icon: 'circle-info',
                title: 'Нет данных',
                description: 'Для выбранного маркетплейса нет городов с тарифами.'
            });
            return;
        }

        const cityTariffs = filteredTariffs[city] || {};
        const warehouses = Object.keys(cityTariffs);

        if (!warehouses.length) {
            tableContainer.classList.add('is-empty');
            tableContainer.innerHTML = this.createEmptyState({
                icon: 'city',
                title: 'Нет тарифов по выбранному городу',
                description: 'Выберите другой город или маркетплейс, чтобы увидеть доступные склады.'
            });
            return;
        }

        const rows = warehouses.map(warehouse => {
            const tariff = cityTariffs[warehouse];
            const boxPrice = this.formatPrice(tariff.box);
            const palletPrice = this.formatPrice(tariff.pallet);
            const cubicVolume = (60 * 40 * 40) / 1_000_000;
            const cubicPrice = typeof tariff.box === 'number' && tariff.box > 0
                ? `≈${this.formatPrice(Math.round(tariff.box / cubicVolume))}`
                : '—';
            const cubicNote = typeof tariff.box === 'number' && tariff.box > 0
                ? '<div class="price-note text-muted">за м³</div>'
                : '<div class="price-note text-muted">нет данных</div>';

            return `
                <tr>
                    <td>
                        <div class="warehouse-name">${warehouse}</div>
                        <div class="warehouse-location text-muted"></div>
                    </td>
                    <td>
                        <span class="price-value">${boxPrice}</span>
                        <div class="price-note text-muted">за стандартную коробку</div>
                    </td>
                    <td>
                        <span class="price-value">${palletPrice}</span>
                        <div class="price-note text-muted">за паллету</div>
                    </td>
                    <td>
                        <span class="price-value">${cubicPrice}</span>
                        ${cubicNote}
                    </td>
                </tr>
            `;
        }).join('');

        tableContainer.innerHTML = `
            <table class="tariffs-table tariffs-table--compact">
                <thead>
                    <tr>
                        <th>Склад назначения</th>
                        <th>Стоимость за коробку</th>
                        <th>Стоимость за паллету</th>
                        <th>Объём (примерный)</th>
                    </tr>
                </thead>
                <tbody>
                    ${rows}
                </tbody>
            </table>
            ${this.buildTariffsNote()}
        `;

        this.ensureTableStyles();
    }

    buildTariffsNote() {
        return `
            <div class="tariffs-note">
                <h4>Дополнительная информация</h4>
                <ul>
                    <li>Стандартная коробка: 60×40×40 см</li>
                    <li>Максимальный вес коробки: 15 кг</li>
                    <li>Паллета: до 220 см высота, до 600 кг</li>
                    <li>Цены указаны без учета дополнительных услуг</li>
                    <li>Нестандартные размеры рассчитываются индивидуально</li>
                </ul>
            </div>
        `;
    }

    ensureTableStyles() {
        if (document.getElementById('tariffsTableStyles')) {
            return;
        }

        const styles = document.createElement('style');
        styles.id = 'tariffsTableStyles';
        styles.textContent = `
            .warehouse-name {
                font-weight: 600;
                color: var(--text-primary);
            }
            .warehouse-location {
                font-size: 0.8rem;
                margin-top: 2px;
            }
            .price-note {
                font-size: 0.8rem;
                margin-top: 2px;
            }
            .tariffs-note {
                margin-top: 24px;
                padding: 20px;
                background: var(--bg-secondary);
                border-radius: var(--radius);
            }
            .tariffs-note h4 {
                font-size: 1rem;
                font-weight: 600;
                margin-bottom: 12px;
                color: var(--text-primary);
            }
            .tariffs-note ul {
                list-style: none;
                padding: 0;
                margin: 0;
            }
            .tariffs-note li {
                padding: 6px 0;
                color: var(--text-secondary);
                font-size: 0.9rem;
                position: relative;
                padding-left: 20px;
            }
            .tariffs-note li::before {
                content: "•";
                color: var(--primary);
                position: absolute;
                left: 0;
                font-weight: bold;
            }
        `;
        document.head.appendChild(styles);
    }

    createEmptyState({ icon = 'circle-info', iconClass = '', title = '', description = '' } = {}) {
        const iconHtml = icon
            ? `<div class="tariffs-empty-icon"><i class="fas fa-${icon} ${iconClass}"></i></div>`
            : '';
        const titleHtml = title ? `<div class="tariffs-empty-title">${title}</div>` : '';
        const descriptionHtml = description
            ? `<p class="tariffs-empty-description">${description}</p>`
            : '';

        return `
            <div class="tariffs-empty">
                ${iconHtml}
                ${titleHtml}
                ${descriptionHtml}
            </div>
        `;
    }

    showLoadingState() {
        const { tableContainer, cityTabs, marketplaceSelect } = this.elements;
        if (tableContainer) {
            tableContainer.classList.add('is-empty');
            tableContainer.innerHTML = this.createEmptyState({
                icon: 'spinner',
                iconClass: 'fa-spin',
                title: 'Загрузка тарифов',
                description: 'Пожалуйста, подождите — мы подготавливаем данные.'
            });
        }

        if (marketplaceSelect) {
            marketplaceSelect.disabled = true;
            marketplaceSelect.innerHTML = '<option value="all">Загрузка...</option>';
        }

        if (cityTabs) {
            cityTabs.classList.add('is-hidden');
            cityTabs.innerHTML = '';
        }
    }

    showErrorState(message) {
        const { tableContainer, cityTabs, marketplaceSelect } = this.elements;
        if (tableContainer) {
            tableContainer.classList.add('is-empty');
            tableContainer.innerHTML = this.createEmptyState({
                icon: 'triangle-exclamation',
                title: 'Не удалось загрузить тарифы',
                description: message || 'Попробуйте повторить попытку немного позже.'
            });
        }

        if (marketplaceSelect) {
            marketplaceSelect.innerHTML = '<option value="">Недоступно</option>';
            marketplaceSelect.value = '';
            marketplaceSelect.disabled = true;
        }

        if (cityTabs) {
            cityTabs.classList.add('is-hidden');
            cityTabs.innerHTML = '';
        }
    }

    formatPrice(value) {
        if (typeof value !== 'number' || Number.isNaN(value)) {
            return '—';
        }

        if (window.utils?.formatCurrency) {
            return window.utils.formatCurrency(value);
        }

        return `${value.toLocaleString('ru-RU')} ₽`;
    }

    toNumber(value) {
        if (value === null || value === undefined || value === '') {
            return null;
        }

        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : null;
    }

    normalizeMarketplace(value) {
        if (typeof value !== 'string') {
            return null;
        }

        const trimmed = value.trim();
        return trimmed.length > 0 ? trimmed : null;
    }

    getTariff(city, warehouse, type = 'box') {
        const cityTariffs = this.tariffs[city];
        if (!cityTariffs) {
            return null;
        }

        const warehouseTariff = cityTariffs[warehouse];
        if (!warehouseTariff) {
            return null;
        }

        return warehouseTariff[type] ?? null;
    }

    calculateShippingCost(city, warehouse, quantity, type = 'box') {
        const unitPrice = this.getTariff(city, warehouse, type);
        if (unitPrice === null || unitPrice === undefined) {
            return null;
        }

        const normalizedQuantity = Number(quantity);
        if (!Number.isFinite(normalizedQuantity)) {
            return null;
        }

        return unitPrice * normalizedQuantity;
    }
}

// Инициализация после загрузки DOM
document.addEventListener('DOMContentLoaded', () => {
    window.TariffsManager = new TariffsManager();
});