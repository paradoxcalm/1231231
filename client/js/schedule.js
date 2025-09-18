import { fetchMarketplaces, fetchWarehouses } from './filterOptions.js';

// Управление расписанием отправлений в одноэкранном формате фильтрации
class ScheduleManager {
    constructor() {
        this.schedules = [];
        this.filteredSchedules = [];
        this.filters = {
            marketplace: '',
            warehouse: ''
        };
        this.marketplaceOptions = [];
        this.warehouseOptions = [];
        this.isLoadingMarketplaces = false;
        this.isLoadingWarehouses = false;
        this.isLoadingSchedules = false;
        this.schedulesCache = new Map();
        this.warehouseStats = {
            isLoading: false,
            error: '',
            data: null
        };
        this.warehouseStatsCache = new Map();
        this.currentWarehouseStatsKey = '';
        this.activeWarehouseStatsController = null;
        this.elements = {
            marketplaceSelect: document.getElementById('marketplaceFilter'),
            warehouseSelect: document.getElementById('warehouseFilter'),
            resetButton: document.getElementById('resetScheduleFilters'),
            subtitle: document.getElementById('scheduleSubtitle'),
            warehouseStats: document.getElementById('warehouseStats')
        };
        this.stepElements = {
            marketplaceStep: document.querySelector('[data-step="marketplace"]'),
            warehouseStep: document.querySelector('[data-step="warehouse"]'),
            marketplaceSummary: document.getElementById('marketplaceSummary'),
            warehouseSummary: document.getElementById('warehouseSummary'),
            marketplaceConfirmBtn: document.getElementById('confirmMarketplace'),
            warehouseConfirmBtn: document.getElementById('confirmWarehouse'),
            backToMarketplaceBtn: document.getElementById('backToMarketplaceBtn'),
            changeMarketplaceBtn: document.getElementById('changeMarketplaceBtn'),
            changeWarehouseBtn: document.getElementById('changeWarehouseBtn')
        };
        this.pendingSelections = {
            marketplace: '',
            warehouse: ''
        };
        this.currentStep = 'marketplace';

        this.init();
    }

    init() {
        this.setupEventListeners();
        this.applyStepState('marketplace', { active: true, complete: false });
        this.applyStepState('warehouse', { active: false, complete: false });
        this.updateMarketplaceConfirmState();
        this.updateWarehouseConfirmState();
        this.renderScheduleGrid();
        this.renderWarehouseStats();
        this.renderWarehouses();
        this.loadMarketplaces();
    }

    setupEventListeners() {
        const { marketplaceSelect, warehouseSelect, resetButton } = this.elements;

        if (marketplaceSelect) {
            marketplaceSelect.addEventListener('click', (event) => {
                if (marketplaceSelect.classList.contains('is-disabled')) {
                    return;
                }

                const card = event.target.closest('.marketplace-card');
                if (!card || card.disabled) {
                    return;
                }

                const { value } = card.dataset;
                if (typeof value === 'undefined') {
                    return;
                }

                const isSameSelection = card.classList.contains('is-active') && this.pendingSelections.marketplace === value;
                this.handleMarketplaceChange(isSameSelection ? '' : value);
            });
        }

        if (warehouseSelect) {
            warehouseSelect.addEventListener('change', (event) => {
                this.handleWarehouseChange(event.target.value);
            });
        }

        if (resetButton) {
            resetButton.addEventListener('click', () => {
                this.resetFilters();
            });
        }

        const {
            marketplaceConfirmBtn,
            warehouseConfirmBtn,
            backToMarketplaceBtn,
            changeMarketplaceBtn,
            changeWarehouseBtn
        } = this.stepElements;

        if (marketplaceConfirmBtn) {
            marketplaceConfirmBtn.addEventListener('click', () => {
                this.confirmMarketplaceSelection();
            });
        }

        if (warehouseConfirmBtn) {
            warehouseConfirmBtn.addEventListener('click', () => {
                this.confirmWarehouseSelection();
            });
        }

        if (backToMarketplaceBtn) {
            backToMarketplaceBtn.addEventListener('click', () => {
                this.openMarketplaceStep();
            });
        }

        if (changeMarketplaceBtn) {
            changeMarketplaceBtn.addEventListener('click', () => {
                this.openMarketplaceStep();
            });
        }

        if (changeWarehouseBtn) {
            changeWarehouseBtn.addEventListener('click', () => {
                this.openWarehouseStep();
            });
        }
    }

    applyStepState(stepName, { active = false, complete = false } = {}) {
        const stepKey = `${stepName}Step`;
        const step = this.stepElements[stepKey];
        if (!step) {
            return;
        }

        step.classList.toggle('is-active', active);
        step.classList.toggle('is-complete', complete);
    }

    handleMarketplaceChange(value) {
        this.pendingSelections.marketplace = value;
        this.updateMarketplaceConfirmState();
        this.setActiveMarketplaceCard(value);

        this.pendingSelections.warehouse = '';
        this.updateWarehouseConfirmState();
        this.applyStepState('warehouse', { active: false, complete: false });
        this.clearWarehouseSummary();
        this.clearWarehouseStats();

        if (!value) {
            this.clearMarketplaceSummary();
        }
        this.renderWarehouseStats();
    }

    setActiveMarketplaceCard(value) {
        const container = this.elements.marketplaceSelect;
        if (!container) {
            return;
        }

        const cards = container.querySelectorAll('.marketplace-card');
        cards.forEach((card) => {
            const isActive = Boolean(value) && card.dataset.value === value;
            card.classList.toggle('is-active', isActive);
            card.setAttribute('aria-pressed', isActive ? 'true' : 'false');
        });
    }

    updateMarketplaceConfirmState() {
        const button = this.stepElements.marketplaceConfirmBtn;
        if (button) {
            button.disabled = !this.pendingSelections.marketplace;
        }
    }

    confirmMarketplaceSelection() {
        if (!this.pendingSelections.marketplace) {
            return;
        }

        this.selectMarketplace(this.pendingSelections.marketplace);
        this.pendingSelections.marketplace = this.filters.marketplace;
        this.showMarketplaceSummary();
        this.applyStepState('marketplace', { active: false, complete: true });
        this.applyStepState('warehouse', { active: true, complete: false });
        this.currentStep = 'warehouse';
        this.pendingSelections.warehouse = '';
        this.updateWarehouseConfirmState();
        this.clearWarehouseSummary();
    }

    openMarketplaceStep() {
        this.currentStep = 'marketplace';
        this.applyStepState('marketplace', { active: true, complete: false });
        const hasWarehouse = Boolean(this.filters.warehouse);
        this.applyStepState('warehouse', { active: false, complete: hasWarehouse });
        this.pendingSelections.marketplace = this.filters.marketplace || '';
        this.updateMarketplaceConfirmState();
        this.pendingSelections.warehouse = this.filters.warehouse || '';
        this.updateWarehouseConfirmState();
        this.setActiveMarketplaceCard(this.pendingSelections.marketplace);
    }

    openWarehouseStep() {
        if (!this.filters.marketplace) {
            this.openMarketplaceStep();
            return;
        }

        this.currentStep = 'warehouse';
        this.applyStepState('marketplace', { active: false, complete: true });
        this.applyStepState('warehouse', { active: true, complete: false });
        this.pendingSelections.warehouse = this.filters.warehouse || '';
        this.updateWarehouseConfirmState();

        if (this.elements.warehouseSelect) {
            this.elements.warehouseSelect.value = this.filters.warehouse || '';
        }

        const marketplace = this.getMarketplaceForWarehouseStep();
        const warehouse = this.pendingSelections.warehouse;
        if (marketplace && warehouse) {
            this.fetchWarehouseOrdersStats(marketplace, warehouse);
        }
        this.renderWarehouseStats();
    }

    handleWarehouseChange(value) {
        this.pendingSelections.warehouse = value;
        this.updateWarehouseConfirmState();
        this.applyStepState('warehouse', { active: true, complete: false });

        if (!value) {
            this.clearWarehouseSummary();
            this.clearWarehouseStats();
            this.renderWarehouseStats();
            return;
        }

        const marketplace = this.getMarketplaceForWarehouseStep();
        if (!marketplace) {
            this.clearWarehouseStats();
            this.renderWarehouseStats();
            return;
        }

        this.fetchWarehouseOrdersStats(marketplace, value);
    }

    updateWarehouseConfirmState() {
        const button = this.stepElements.warehouseConfirmBtn;
        if (button) {
            const hasMarketplace = Boolean(this.filters.marketplace || this.pendingSelections.marketplace);
            button.disabled = !hasMarketplace || !this.pendingSelections.warehouse;
        }
    }

    confirmWarehouseSelection() {
        if (!this.pendingSelections.warehouse) {
            return;
        }

        this.selectWarehouse(this.pendingSelections.warehouse);
        this.pendingSelections.warehouse = this.filters.warehouse;
        this.showWarehouseSummary();
        this.applyStepState('warehouse', { active: false, complete: true });
        this.currentStep = 'results';
        this.renderWarehouseStats();
    }

    showMarketplaceSummary() {
        const summary = this.stepElements.marketplaceSummary;
        if (!summary) {
            return;
        }

        if (!this.filters.marketplace) {
            summary.textContent = '';
            return;
        }

        const label = this.getMarketplaceLabel(this.filters.marketplace);
        summary.textContent = label ? `Маркетплейс: ${label}` : '';
    }

    showWarehouseSummary() {
        const summary = this.stepElements.warehouseSummary;
        if (!summary) {
            return;
        }

        if (!this.filters.warehouse) {
            summary.textContent = '';
            return;
        }

        summary.textContent = `Склад: ${this.filters.warehouse}`;
    }

    clearMarketplaceSummary() {
        const summary = this.stepElements.marketplaceSummary;
        if (summary) {
            summary.textContent = '';
        }
    }

    clearWarehouseSummary() {
        const summary = this.stepElements.warehouseSummary;
        if (summary) {
            summary.textContent = '';
        }
    }

    clearWarehouseStats() {
        this.abortWarehouseStatsRequest();
        this.warehouseStats = {
            isLoading: false,
            error: '',
            data: null
        };
        this.currentWarehouseStatsKey = '';

        const container = this.elements.warehouseStats;
        if (container) {
            container.classList.remove('is-visible');
            container.innerHTML = '';
            container.setAttribute('aria-hidden', 'true');
        }
    }

    abortWarehouseStatsRequest() {
        if (this.activeWarehouseStatsController) {
            this.activeWarehouseStatsController.abort();
            this.activeWarehouseStatsController = null;
        }
    }

    updateScheduleSubtitle(message) {
        const subtitle = this.elements.subtitle || document.getElementById('scheduleSubtitle');
        if (subtitle) {
            subtitle.textContent = message;
        }
    }

    async loadMarketplaces() {
        this.isLoadingMarketplaces = true;
        this.renderMarketplaces();

        try {
            const marketplaces = await fetchMarketplaces({ baseUrl: '../filter_options.php' });
            this.marketplaceOptions = marketplaces.map(mp => ({
                value: mp,
                label: mp,
                description: this.getMarketplaceDescription(mp)
            }));
        } catch (error) {
            console.error('Ошибка загрузки маркетплейсов:', error);
            this.showError('Не удалось загрузить список маркетплейсов');
            this.marketplaceOptions = [];
        } finally {
            this.isLoadingMarketplaces = false;
            this.renderMarketplaces();
        }
    }

    renderMarketplaces() {
        const container = this.elements.marketplaceSelect;
        if (!container) return;

        container.innerHTML = '';
        container.classList.remove('is-loading', 'is-disabled');
        container.removeAttribute('aria-busy');
        container.removeAttribute('aria-disabled');

        if (this.isLoadingMarketplaces) {
            container.classList.add('is-loading');
            container.setAttribute('aria-busy', 'true');
            container.appendChild(this.createMarketplaceMessage('Загрузка маркетплейсов...', { isLoading: true }));
            return;
        }

        if (this.marketplaceOptions.length === 0) {
            container.classList.add('is-disabled');
            container.setAttribute('aria-disabled', 'true');
            container.appendChild(this.createMarketplaceMessage('Маркетплейсы недоступны'));
            return;
        }

        const activeValue = this.pendingSelections.marketplace || this.filters.marketplace || '';

        this.marketplaceOptions.forEach(optionData => {
            const card = document.createElement('button');
            card.type = 'button';
            card.className = 'marketplace-card';
            card.dataset.value = optionData.value;
            card.dataset.label = optionData.label;
            card.title = optionData.description || optionData.label;

            const title = document.createElement('span');
            title.className = 'marketplace-card__title';
            title.textContent = optionData.label;
            card.appendChild(title);

            if (optionData.description) {
                const description = document.createElement('span');
                description.className = 'marketplace-card__description';
                description.textContent = optionData.description;
                card.appendChild(description);
            }

            const isActive = Boolean(activeValue) && optionData.value === activeValue;
            card.classList.toggle('is-active', isActive);
            card.setAttribute('aria-pressed', isActive ? 'true' : 'false');

            container.appendChild(card);
        });
    }

    createMarketplaceMessage(text, { isLoading = false } = {}) {
        const message = document.createElement('div');
        message.className = 'marketplace-placeholder';
        if (isLoading) {
            message.classList.add('marketplace-placeholder--loading');
        }

        message.setAttribute('role', isLoading ? 'status' : 'note');
        message.setAttribute('aria-live', 'polite');

        const span = document.createElement('span');
        span.textContent = text;
        message.appendChild(span);
        return message;
    }

    getMarketplaceDescription(marketplace) {
        const descriptions = {
            'Wildberries': 'Крупнейший российский маркетплейс',
            'Ozon': 'Универсальная торговая площадка',
            'YandexMarket': 'Маркетплейс от Яндекса'
        };
        return descriptions[marketplace] || 'Торговая площадка';
    }

    getMarketplaceForWarehouseStep() {
        return this.filters.marketplace || this.pendingSelections.marketplace || '';
    }

    getMarketplaceLabel(value) {
        if (!value) {
            return '';
        }

        const option = this.marketplaceOptions.find(item => item.value === value);
        return option ? option.label : value;
    }

    selectMarketplace(marketplace) {
        this.filters.marketplace = marketplace;
        this.filters.warehouse = '';

        this.pendingSelections.marketplace = marketplace;
        this.pendingSelections.warehouse = '';
        this.updateMarketplaceConfirmState();
        this.updateWarehouseConfirmState();
        this.clearWarehouseSummary();
        this.clearWarehouseStats();

        if (this.elements.warehouseSelect) {
            this.elements.warehouseSelect.value = '';
        }

        this.warehouseOptions = [];
        this.schedules = [];
        this.filteredSchedules = [];
        this.isLoadingSchedules = false;

        this.renderMarketplaces();
        this.renderWarehouses();
        this.renderScheduleGrid();

        if (marketplace) {
            this.loadWarehouses();
        }
    }

    async loadWarehouses() {
        if (!this.filters.marketplace) {
            this.warehouseOptions = [];
            this.renderWarehouses();
            return;
        }

        this.isLoadingWarehouses = true;
        this.renderWarehouses();

        try {
            const warehouses = await fetchWarehouses({
                marketplace: this.filters.marketplace,
                baseUrl: '../filter_options.php'
            });

            this.warehouseOptions = warehouses.map(wh => ({
                value: wh,
                label: wh
            }));
        } catch (error) {
            console.error('Ошибка загрузки складов:', error);
            this.showError('Не удалось загрузить список складов');
            this.warehouseOptions = [];
        } finally {
            this.isLoadingWarehouses = false;
            this.renderWarehouses();
        }
    }

    renderWarehouses() {
        const select = this.elements.warehouseSelect;
        if (!select) return;

        select.innerHTML = '';

        if (!this.filters.marketplace) {
            const option = document.createElement('option');
            option.value = '';
            option.textContent = 'Сначала выберите маркетплейс';
            select.appendChild(option);
            select.disabled = true;
            return;
        }

        if (this.isLoadingWarehouses) {
            const option = document.createElement('option');
            option.value = '';
            option.textContent = 'Загрузка складов...';
            option.disabled = true;
            select.appendChild(option);
            select.disabled = true;
            return;
        }

        if (this.warehouseOptions.length === 0) {
            const option = document.createElement('option');
            option.value = '';
            option.textContent = 'Нет доступных складов';
            option.disabled = true;
            select.appendChild(option);
            select.disabled = true;
            return;
        }

        const placeholderOption = document.createElement('option');
        placeholderOption.value = '';
        placeholderOption.textContent = 'Выберите склад';
        select.appendChild(placeholderOption);

        this.warehouseOptions.forEach(optionData => {
            const option = document.createElement('option');
            option.value = optionData.value;
            option.textContent = optionData.label;
            select.appendChild(option);
        });

        select.disabled = false;
        const selected = this.filters.warehouse || '';
        select.value = selected;
        if (select.value !== selected) {
            select.value = '';
        }
    }

    selectWarehouse(warehouse) {
        this.filters.warehouse = warehouse;
        this.pendingSelections.warehouse = warehouse;
        this.updateWarehouseConfirmState();

        if (!warehouse) {
            this.filteredSchedules = [];
            this.renderScheduleGrid();
            this.clearWarehouseSummary();
            this.clearWarehouseStats();
            return;
        }

        this.loadSchedules();
        this.fetchWarehouseOrdersStats(this.filters.marketplace, warehouse);
        this.renderWarehouseStats();
    }

    createWarehouseStatsKey(marketplace, warehouse) {
        if (!marketplace || !warehouse) {
            return '';
        }

        const normalize = (value) => String(value).trim().toLowerCase();
        return `${normalize(marketplace)}__${normalize(warehouse)}`;
    }

    async fetchWarehouseOrdersStats(marketplace, warehouse) {
        if (!marketplace || !warehouse) {
            this.warehouseStats = {
                isLoading: false,
                error: '',
                data: null
            };
            this.currentWarehouseStatsKey = '';
            this.renderWarehouseStats();
            return;
        }

        const cacheKey = this.createWarehouseStatsKey(marketplace, warehouse);
        this.currentWarehouseStatsKey = cacheKey;

        const cached = this.warehouseStatsCache.get(cacheKey);
        if (cached) {
            this.warehouseStats = {
                isLoading: false,
                error: '',
                data: cached
            };
            this.renderWarehouseStats();
            return;
        }

        this.abortWarehouseStatsRequest();

        const controller = new AbortController();
        this.activeWarehouseStatsController = controller;

        this.warehouseStats = {
            isLoading: true,
            error: '',
            data: null
        };
        this.renderWarehouseStats();

        try {
            const params = new URLSearchParams({ marketplace, warehouse });
            const response = await fetch(`../get_warehouse_stats.php?${params.toString()}`, {
                credentials: 'include',
                signal: controller.signal
            });

            if (!response.ok) {
                throw new Error(`Ошибка загрузки статистики: ${response.status}`);
            }

            const payload = await response.json();

            if (!payload || payload.success === false) {
                const message = payload && typeof payload.message === 'string'
                    ? payload.message
                    : 'Не удалось получить статистику заказов';
                throw new Error(message);
            }

            const normalized = this.normalizeWarehouseStatsResponse(payload);
            this.warehouseStatsCache.set(cacheKey, normalized);

            if (this.currentWarehouseStatsKey !== cacheKey) {
                return;
            }

            this.warehouseStats = {
                isLoading: false,
                error: '',
                data: normalized
            };
        } catch (error) {
            if (error.name === 'AbortError') {
                return;
            }

            console.error('Ошибка загрузки статистики склада:', error);

            if (this.currentWarehouseStatsKey !== cacheKey) {
                return;
            }

            this.warehouseStats = {
                isLoading: false,
                error: 'Не удалось загрузить статистику заказов',
                data: null
            };
        } finally {
            if (this.activeWarehouseStatsController === controller) {
                this.activeWarehouseStatsController = null;
            }

            if (this.currentWarehouseStatsKey === cacheKey) {
                this.renderWarehouseStats();
            }
        }
    }

    renderWarehouseStats() {
        const container = this.elements.warehouseStats;
        if (!container) {
            return;
        }

        const warehouseStep = this.stepElements.warehouseStep;
        const isStepActive = Boolean(warehouseStep && warehouseStep.classList.contains('is-active'));
        const marketplace = this.getMarketplaceForWarehouseStep();
        const warehouse = isStepActive ? (this.pendingSelections.warehouse || '') : '';
        const shouldShow = Boolean(isStepActive && marketplace && warehouse);

        container.classList.toggle('is-visible', shouldShow);

        if (!shouldShow) {
            container.innerHTML = '';
            container.setAttribute('aria-hidden', 'true');
            return;
        }

        container.removeAttribute('aria-hidden');

        const statsKey = this.createWarehouseStatsKey(marketplace, warehouse);
        let statsState = this.warehouseStats;

        if (!statsKey) {
            statsState = { isLoading: false, error: '', data: null };
        } else if (this.currentWarehouseStatsKey !== statsKey) {
            const cached = this.warehouseStatsCache.get(statsKey);
            statsState = cached
                ? { isLoading: false, error: '', data: cached }
                : { isLoading: true, error: '', data: null };
        }

        const fragment = document.createDocumentFragment();
        const header = document.createElement('div');
        header.className = 'warehouse-stats__header';

        const title = document.createElement('span');
        title.className = 'warehouse-stats__title';
        title.textContent = 'Статистика по складу';
        header.appendChild(title);
        fragment.appendChild(header);

        const grid = document.createElement('div');
        grid.className = 'warehouse-stats__grid';

        if (statsState.isLoading) {
            grid.appendChild(this.createWarehouseStatsLoadingItem('Всего отправлений', 'Загружаем данные...'));
            grid.appendChild(this.createWarehouseStatsLoadingItem('Доля заявок', 'Загружаем данные...'));
        } else if (statsState.error) {
            grid.appendChild(this.createWarehouseStatsErrorItem('Всего отправлений', statsState.error));
            grid.appendChild(this.createWarehouseStatsErrorItem('Доля заявок', statsState.error));
        } else {
            const stats = statsState.data || {
                departuresUnique: 0,
                departuresTotal: 0,
                ordersTotal: 0,
                ordersForWarehouse: 0,
                ordersPercentage: 0
            };

            const departuresDescription = stats.departuresUnique === 0
                ? 'Нет ближайших отправлений'
                : 'по датам выезда';

            grid.appendChild(this.createWarehouseStatsItem({
                label: 'Всего отправлений',
                value: this.formatNumber(stats.departuresUnique),
                description: departuresDescription
            }));

            const ordersDescription = `${this.formatNumber(stats.ordersForWarehouse)} из ${this.formatNumber(stats.ordersTotal)} заявок`;
            const percentageValue = this.formatPercentage(stats.ordersPercentage);

            grid.appendChild(this.createWarehouseStatsItem({
                label: 'Доля заявок',
                value: `${percentageValue}%`,
                description: ordersDescription
            }));
        }

        fragment.appendChild(grid);

        container.innerHTML = '';
        container.appendChild(fragment);
    }

    createWarehouseStatsItem({ label, value = '', description = '', modifier = '' }) {
        const item = document.createElement('div');
        item.className = 'warehouse-stats__item';
        if (modifier) {
            item.classList.add(`warehouse-stats__item--${modifier}`);
        }

        const labelEl = document.createElement('span');
        labelEl.className = 'warehouse-stats__label';
        labelEl.textContent = label;
        item.appendChild(labelEl);

        const valueEl = document.createElement('span');
        valueEl.className = 'warehouse-stats__value';

        if (modifier === 'loading') {
            const spinner = document.createElement('span');
            spinner.className = 'warehouse-stats__spinner';
            spinner.setAttribute('aria-hidden', 'true');
            valueEl.appendChild(spinner);
        } else if (value !== null && value !== undefined && value !== '') {
            valueEl.textContent = value;
        } else {
            valueEl.textContent = '—';
        }

        item.appendChild(valueEl);

        if (description) {
            const descriptionEl = document.createElement('span');
            descriptionEl.className = 'warehouse-stats__description';
            descriptionEl.textContent = description;
            item.appendChild(descriptionEl);
        }

        return item;
    }

    createWarehouseStatsLoadingItem(label, message) {
        return this.createWarehouseStatsItem({
            label,
            description: message,
            modifier: 'loading'
        });
    }

    createWarehouseStatsErrorItem(label, message) {
        return this.createWarehouseStatsItem({
            label,
            description: message,
            modifier: 'error'
        });
    }

    normalizeWarehouseStatsResponse(data) {
        const ordersTotal = this.toNumber(data?.orders_total);
        const ordersForWarehouse = this.toNumber(data?.orders_for_warehouse);
        let ordersPercentage = Number(data?.orders_percentage);
        if (!Number.isFinite(ordersPercentage)) {
            ordersPercentage = ordersTotal > 0
                ? (ordersForWarehouse / ordersTotal) * 100
                : 0;
        }

        ordersPercentage = Math.min(Math.max(ordersPercentage, 0), 100);
        const departuresUnique = this.toNumber(data?.departures_unique ?? data?.departure_dates);
        const departuresTotal = this.toNumber(data?.departures_total ?? data?.schedules_total);

        return {
            marketplace: data?.marketplace || this.filters.marketplace || '',
            warehouse: data?.warehouse || this.filters.warehouse || '',
            ordersTotal,
            ordersForWarehouse,
            ordersPercentage,
            departuresUnique,
            departuresTotal
        };
    }

    toNumber(value) {
        const numeric = Number(value);
        return Number.isFinite(numeric) ? numeric : 0;
    }

    formatNumber(value, options = {}) {
        const numeric = Number(value);
        const safeValue = Number.isFinite(numeric) ? numeric : 0;
        const { maximumFractionDigits = 0 } = options;
        return new Intl.NumberFormat('ru-RU', {
            minimumFractionDigits: 0,
            maximumFractionDigits
        }).format(safeValue);
    }

    formatPercentage(value) {
        const numeric = Number(value);
        const safeValue = Number.isFinite(numeric) ? numeric : 0;
        return new Intl.NumberFormat('ru-RU', {
            minimumFractionDigits: safeValue > 0 && safeValue < 1 ? 1 : 0,
            maximumFractionDigits: safeValue > 0 ? 1 : 0
        }).format(safeValue);
    }

    async loadSchedules() {
        if (!this.filters.marketplace || !this.filters.warehouse) {
            this.applyFilters();
            return;
        }

        const cacheKey = `${this.filters.marketplace}__${this.filters.warehouse}`;
        if (this.schedulesCache.has(cacheKey)) {
            this.schedules = this.schedulesCache.get(cacheKey);
            this.applyFilters();
            return;
        }

        this.isLoadingSchedules = true;
        this.renderScheduleGrid();
        this.renderWarehouseStats();

        try {
            const params = new URLSearchParams({
                marketplace: this.filters.marketplace,
                warehouse: this.filters.warehouse
            });

            const response = await fetch(`../fetch_schedule.php?${params.toString()}`, {
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error('Network response was not ok');
            }

            const data = await response.json();
            this.schedules = Array.isArray(data) ? data : [];
            this.schedulesCache.set(cacheKey, this.schedules);
        } catch (error) {
            console.error('Ошибка загрузки расписания:', error);
            this.showError('Не удалось загрузить расписание');
            this.schedules = [];
        } finally {
            this.isLoadingSchedules = false;
            this.applyFilters();
        }
    }

    applyFilters() {
        if (!this.filters.marketplace || !this.filters.warehouse) {
            this.filteredSchedules = [];
            this.renderScheduleGrid();
            this.renderWarehouseStats();
            return;
        }

        this.filteredSchedules = this.schedules.filter(schedule => {
            const matchMarketplace = schedule.marketplace === this.filters.marketplace;
            const matchWarehouse = schedule.warehouses === this.filters.warehouse;
            return matchMarketplace && matchWarehouse;
        });

        this.renderScheduleGrid();
        this.renderWarehouseStats();
    }

    renderScheduleGrid() {
        const container = document.getElementById('scheduleGrid');
        if (!container) return;

        container.classList.remove('is-empty');

        if (!this.filters.marketplace) {
            this.updateScheduleSubtitle('Чтобы увидеть расписание, выберите маркетплейс и склад');
            container.classList.add('is-empty');
            container.innerHTML = this.renderEmptyState(
                'fa-layer-group',
                'Расписание недоступно',
                'Укажите маркетплейс и склад, чтобы мы показали подходящие отправления.'
            );
            return;
        }

        if (!this.filters.warehouse) {
            this.updateScheduleSubtitle('Сначала выберите склад, чтобы увидеть доступные отправления');
            container.classList.add('is-empty');
            container.innerHTML = this.renderEmptyState(
                'fa-warehouse',
                'Не выбран склад',
                'Выберите склад, чтобы показать подходящее расписание.'
            );
            return;
        }

        if (this.isLoadingSchedules) {
            this.updateScheduleSubtitle(`Загружаем расписание для склада «${this.filters.warehouse}»...`);
            container.classList.add('is-empty');
            container.innerHTML = `
                <div class="loading">
                    <div class="spinner"></div>
                    Подгружаем отправления...
                </div>
            `;
            return;
        }

        if (this.filteredSchedules.length === 0) {
            this.updateScheduleSubtitle('На выбранный склад пока нет активных отправлений');
            container.classList.add('is-empty');
            container.innerHTML = this.renderEmptyState(
                'fa-calendar-times',
                'Нет доступных отправлений',
                'Попробуйте выбрать другой склад или загляните позже.'
            );
            return;
        }

        this.updateScheduleSubtitle(`Доступно отправлений: ${this.filteredSchedules.length}`);
        container.innerHTML = this.filteredSchedules
            .map(schedule => this.renderScheduleCard(schedule))
            .join('');
    }

    renderScheduleCard(schedule) {
        const marketplace = this.escapeHtml(schedule.marketplace || '—');
        const marketplaceClass = this.getMarketplaceBadgeClass(schedule.marketplace);
        const city = this.escapeHtml(schedule.city || '—');
        const warehouse = this.escapeHtml(schedule.warehouses || '—');
        const departureDate = this.escapeHtml(this.formatDate(schedule.accept_date));
        const acceptTime = this.escapeHtml(schedule.accept_time || '—');
        const deliveryDate = this.escapeHtml(this.formatDate(schedule.delivery_date));
        const driver = this.escapeHtml(schedule.driver_name || '—');
        const carInfo = this.escapeHtml([schedule.car_brand, schedule.car_number].filter(Boolean).join(' ') || '—');
        const statusText = this.escapeHtml(schedule.status || '—');
        const statusClass = this.getStatusClass(schedule.status);
        const hasId = schedule && Object.prototype.hasOwnProperty.call(schedule, 'id');
        const scheduleIdValue = hasId ? schedule.id : '';
        const scheduleId = hasId ? JSON.stringify(schedule.id) : 'null';

        return `
            <article class="schedule-card" data-id="${this.escapeHtml(String(scheduleIdValue))}">
                <div class="schedule-status-indicator status-${statusClass}"></div>
                <div class="schedule-card-content">
                    <header class="schedule-card-header">
                        <div class="schedule-card-title">
                            <span class="schedule-card-warehouse">${warehouse}</span>
                            <span class="schedule-card-city">${city}</span>
                        </div>
                        <span class="schedule-marketplace ${marketplaceClass}">${marketplace}</span>
                    </header>
                    <div class="schedule-status status-${statusClass}">
                        <span class="status-dot"></span>
                        ${statusText}
                    </div>
                    <div class="schedule-dates">
                        <div class="date-item">
                            <span class="date-label">Дата выезда</span>
                            <span class="date-value">${departureDate}</span>
                        </div>
                        <div class="date-item">
                            <span class="date-label">Дата сдачи</span>
                            <span class="date-value">${deliveryDate}</span>
                        </div>
                    </div>
                    <div class="schedule-meta">
                        <div class="meta-item">
                            <span class="meta-label">Время приёмки</span>
                            <span class="meta-value">${acceptTime}</span>
                        </div>
                        <div class="meta-item">
                            <span class="meta-label">Водитель</span>
                            <span class="meta-value">${driver}</span>
                        </div>
                        <div class="meta-item">
                            <span class="meta-label">Автомобиль</span>
                            <span class="meta-value">${carInfo}</span>
                        </div>
                    </div>
                    <div class="schedule-action">
                        <button class="create-order-btn" onclick="window.ScheduleManager.handleCreateOrderClick(event, ${scheduleId})">
                            <i class="fas fa-plus"></i>
                            Создать заявку
                        </button>
                    </div>
                </div>
            </article>
        `;
    }

    handleCreateOrderClick(event, scheduleId) {
        if (event && event.currentTarget instanceof HTMLElement) {
            const button = event.currentTarget;
            button.classList.remove('is-pressed');
            // Перезапускаем анимацию, если пользователь кликает повторно до её окончания
            void button.offsetWidth;
            button.classList.add('is-pressed');
            button.addEventListener('animationend', () => {
                button.classList.remove('is-pressed');
            }, { once: true });
        }

        this.createOrderForSchedule(scheduleId);
    }

    getMarketplaceBadgeClass(marketplace) {
        if (!marketplace) {
            return '';
        }

        const normalized = marketplace.toLowerCase();
        if (normalized.includes('wildberries')) {
            return 'marketplace-wb';
        }
        if (normalized.includes('ozon')) {
            return 'marketplace-ozon';
        }
        if (normalized.includes('yandex')) {
            return 'marketplace-yandex';
        }
        return '';
    }

    renderEmptyState(icon, title, description) {
        const safeIcon = this.escapeHtml(icon);
        const safeTitle = this.escapeHtml(title);
        const safeDescription = this.escapeHtml(description);
        return `
            <div class="empty-state">
                <i class="fas ${safeIcon}"></i>
                <h3>${safeTitle}</h3>
                <p>${safeDescription}</p>
            </div>
        `;
    }

    escapeHtml(value) {
        if (value === null || value === undefined) {
            return '';
        }

        return String(value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    getStatusClass(status) {
        const statusMap = {
            'Приём заявок': 'open',
            'Ожидает отправки': 'waiting',
            'В пути': 'transit',
            'Завершено': 'completed'
        };
        return statusMap[status] || 'unknown';
    }

    formatDate(dateStr) {
        if (!dateStr) return '—';
        return new Date(dateStr).toLocaleDateString('ru-RU', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    }

    createOrderForSchedule(scheduleId) {
        const schedule = this.schedules.find(s => String(s.id) === String(scheduleId));
        if (!schedule) return;

        const detailsModal = document.getElementById('scheduleDetailsModal');
        if (detailsModal) {
            window.app.closeModal(detailsModal);
        }

        if (typeof window.openClientRequestFormModal === 'function') {
            window.openClientRequestFormModal(schedule);
        } else if (typeof window.openRequestFormModal === 'function') {
            window.openRequestFormModal(schedule, '', '', '', {
                modalId: 'clientRequestModal',
                contentId: 'clientRequestModalContent'
            });
        } else {
            console.error('openRequestFormModal is not loaded');
            if (window.app && typeof window.app.showError === 'function') {
                window.app.showError('Не удалось загрузить форму заявки');
            }
        }
    }

    showError(message) {
        if (window.app && typeof window.app.showError === 'function') {
            window.app.showError(message);
        } else {
            alert(message);
        }
    }

    resetFilters() {
        this.filters = {
            marketplace: '',
            warehouse: ''
        };
        this.schedules = [];
        this.filteredSchedules = [];
        this.warehouseOptions = [];
        this.isLoadingSchedules = false;
        this.pendingSelections.marketplace = '';
        this.pendingSelections.warehouse = '';
        this.currentStep = 'marketplace';
        this.clearWarehouseStats();

        this.applyStepState('marketplace', { active: true, complete: false });
        this.applyStepState('warehouse', { active: false, complete: false });
        this.clearMarketplaceSummary();
        this.clearWarehouseSummary();
        this.updateMarketplaceConfirmState();
        this.updateWarehouseConfirmState();

        this.setActiveMarketplaceCard('');

        if (this.elements.warehouseSelect) {
            this.elements.warehouseSelect.value = '';
        }

        this.renderMarketplaces();
        this.renderWarehouses();
        this.renderScheduleGrid();
        this.renderWarehouseStats();
    }

    getCurrentSelection() {
        return {
            marketplace: this.filters.marketplace,
            warehouse: this.filters.warehouse
        };
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.ScheduleManager = new ScheduleManager();
});
