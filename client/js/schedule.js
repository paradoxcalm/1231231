import { fetchMarketplaces, fetchWarehouses } from './filterOptions.js';

// Управление расписанием отправлений в одноэкранном формате фильтрации
class ScheduleManager {
    constructor() {
        this.schedules = [];
        this.filteredSchedules = [];
        this.groupedSchedules = [];
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
        this.scheduleGroupsByKey = new Map();
        this.boundHandleScheduleGridClick = this.handleScheduleGridClick.bind(this);
        this.scheduleGridElement = null;
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

        if (!value) {
            this.clearMarketplaceSummary();
        }
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
    }

    handleWarehouseChange(value) {
        this.pendingSelections.warehouse = value;
        this.updateWarehouseConfirmState();
        this.applyStepState('warehouse', { active: true, complete: false });

        if (!value) {
            this.clearWarehouseSummary();
        }
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
        this.groupedSchedules = [];
        this.isLoadingSchedules = false;
        this.scheduleGroupsByKey.clear();

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
            this.groupedSchedules = [];
            this.scheduleGroupsByKey.clear();
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

        const hasSelection = Boolean(this.filters.marketplace && this.filters.warehouse);
        container.classList.toggle('is-visible', hasSelection);

        if (!hasSelection) {
            container.innerHTML = '';
            container.setAttribute('aria-hidden', 'true');
            return;
        }

        container.removeAttribute('aria-hidden');

        const fragment = document.createDocumentFragment();
        const header = document.createElement('div');
        header.className = 'warehouse-stats__header';

        const title = document.createElement('span');
        title.className = 'warehouse-stats__title';
        title.textContent = 'Статистика склада';
        header.appendChild(title);

        const meta = document.createElement('span');
        meta.className = 'warehouse-stats__subtitle';
        const marketplaceLabel = this.getMarketplaceLabel(this.filters.marketplace) || this.filters.marketplace;
        const metaParts = [];
        if (this.filters.warehouse) {
            metaParts.push(`Склад «${this.filters.warehouse}»`);
        }
        if (marketplaceLabel) {
            metaParts.push(`Маркетплейс «${marketplaceLabel}»`);
        }
        if (metaParts.length > 0) {
            meta.textContent = metaParts.join(' · ');
            header.appendChild(meta);
        }
        fragment.appendChild(header);

        const grid = document.createElement('div');
        grid.className = 'warehouse-stats__grid';

        if (this.isLoadingSchedules) {
            grid.appendChild(this.createWarehouseStatsLoadingItem('Отправления', 'Загружаем расписание...'));
        } else {
            const stats = this.getWarehouseDepartureStats();
            const description = stats.uniqueDepartureDates === 0
                ? 'Нет активных отправлений'
                : `По уникальным датам выезда (${this.formatNumber(stats.totalSchedules)} расписаний)`;

            grid.appendChild(this.createWarehouseStatsItem({
                label: 'Отправления',
                value: this.formatNumber(stats.uniqueDepartureDates),
                description
            }));
        }

        if (this.warehouseStats.isLoading) {
            grid.appendChild(this.createWarehouseStatsLoadingItem('Заказы', 'Обновляем статистику заказов...'));
        } else if (this.warehouseStats.error) {
            grid.appendChild(this.createWarehouseStatsErrorItem('Заказы', this.warehouseStats.error));
        } else {
            const stats = this.warehouseStats.data || {
                ordersTotal: 0,
                ordersForWarehouse: 0,
                ordersPercentage: 0
            };

            const hasOrders = stats.ordersTotal > 0;
            const ordersValue = this.formatNumber(stats.ordersForWarehouse);
            const description = hasOrders
                ? `${this.formatPercentage(stats.ordersPercentage)}% от ${this.formatNumber(stats.ordersTotal)} заказов`
                : 'Для этого маркетплейса ещё нет заказов';

            grid.appendChild(this.createWarehouseStatsItem({
                label: 'Заказы',
                value: ordersValue,
                description
            }));
        }

        fragment.appendChild(grid);

        const note = document.createElement('p');
        note.className = 'warehouse-stats__note';
        note.textContent = 'Статистика заказов учитывает только выбранный маркетплейс.';
        fragment.appendChild(note);

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

    getWarehouseDepartureStats() {
        if (!Array.isArray(this.filteredSchedules) || this.filteredSchedules.length === 0) {
            return {
                totalSchedules: 0,
                uniqueDepartureDates: 0
            };
        }

        const uniqueDates = new Set();
        let total = 0;

        this.filteredSchedules.forEach((schedule) => {
            if (!schedule) {
                return;
            }

            total += 1;
            const departureKey = this.getScheduleDepartureKey(schedule);
            if (departureKey) {
                uniqueDates.add(departureKey);
            }
        });

        return {
            totalSchedules: total,
            uniqueDepartureDates: uniqueDates.size
        };
    }

    getScheduleDepartureKey(schedule) {
        const value = schedule?.departure_date
            || schedule?.departureDate
            || schedule?.accept_date
            || schedule?.acceptDate
            || '';

        if (!value) {
            return '';
        }

        const raw = String(value).trim();
        if (!raw) {
            return '';
        }

        if (raw.includes('T')) {
            return raw.split('T')[0];
        }

        if (raw.includes(' ')) {
            return raw.split(' ')[0];
        }

        return raw;
    }

    getScheduleDeliveryKey(schedule) {
        const value = schedule?.delivery_date
            || schedule?.deliveryDate
            || '';

        if (!value) {
            return '';
        }

        const raw = String(value).trim();
        if (!raw) {
            return '';
        }

        if (raw.includes('T')) {
            return raw.split('T')[0];
        }

        if (raw.includes(' ')) {
            return raw.split(' ')[0];
        }

        return raw;
    }

    parseLocalDate(value) {
        if (!value) {
            return null;
        }

        const raw = String(value).trim();
        if (!raw) {
            return null;
        }

        const [sanitized] = raw.split(/[T ]/);

        const isoMatch = sanitized.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (isoMatch) {
            const year = Number(isoMatch[1]);
            const month = Number(isoMatch[2]);
            const day = Number(isoMatch[3]);

            if (!Number.isNaN(year) && !Number.isNaN(month) && !Number.isNaN(day)) {
                const date = new Date(year, month - 1, day);
                if (!Number.isNaN(date.getTime())) {
                    return date;
                }
            }
        }

        const dottedMatch = sanitized.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
        if (dottedMatch) {
            const day = Number(dottedMatch[1]);
            const month = Number(dottedMatch[2]);
            const year = Number(dottedMatch[3]);

            if (!Number.isNaN(year) && !Number.isNaN(month) && !Number.isNaN(day)) {
                const date = new Date(year, month - 1, day);
                if (!Number.isNaN(date.getTime())) {
                    return date;
                }
            }
        }

        const fallback = Date.parse(raw);
        if (!Number.isNaN(fallback)) {
            const parsed = new Date(fallback);
            const date = new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
            if (!Number.isNaN(date.getTime())) {
                return date;
            }
        }

        return null;
    }

    isScheduleInFuture(schedule) {
        const departureKey = this.getScheduleDepartureKey(schedule);
        if (!departureKey) {
            return true;
        }

        const departureDate = this.parseLocalDate(departureKey);
        if (!departureDate) {
            return true;
        }

        const today = new Date();
        const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
        const departureStart = new Date(
            departureDate.getFullYear(),
            departureDate.getMonth(),
            departureDate.getDate()
        ).getTime();

        if (Number.isNaN(departureStart)) {
            return true;
        }

        return departureStart >= todayStart;
    }


    normalizeScheduleForModal(schedule) {
        if (!schedule || typeof schedule !== 'object') {
            return {
                id: '',
                city: '',
                warehouse: '',
                warehouses: '',
                accept_date: '',
                acceptDate: '',
                delivery_date: '',
                deliveryDate: '',
                accept_time: '',
                acceptTime: '',
                driver_name: '',
                driverName: '',
                driver_phone: '',
                driverPhone: '',
                car_number: '',
                carNumber: '',
                car_brand: '',
                carBrand: '',
                sender: '',
                marketplace: ''
            };
        }

        const city = schedule.city
            || schedule.city_name
            || schedule.route_city
            || '';
        const warehouse = schedule.warehouses
            || schedule.warehouse
            || schedule.route_warehouse
            || '';
        const acceptDate = schedule.accept_date
            || schedule.acceptDate
            || schedule.departure_date
            || schedule.departureDate
            || '';
        const deliveryDate = schedule.delivery_date
            || schedule.deliveryDate
            || '';
        const acceptTime = schedule.accept_time
            || schedule.acceptTime
            || '';
        const driverName = schedule.driver_name
            || schedule.driverName
            || '';
        const driverPhone = schedule.driver_phone
            || schedule.driverPhone
            || '';
        const carNumber = schedule.car_number
            || schedule.carNumber
            || '';
        const carBrand = schedule.car_brand
            || schedule.carBrand
            || '';
        const sender = schedule.sender
            || schedule.company_name
            || '';
        const marketplace = schedule.marketplace
            || '';

        return {
            id: schedule.id ?? schedule.schedule_id ?? '',
            city,
            warehouse,
            warehouses: warehouse,
            accept_date: acceptDate,
            acceptDate,
            delivery_date: deliveryDate,
            deliveryDate,
            accept_time: acceptTime,
            acceptTime,
            driver_name: driverName,
            driverName,
            driver_phone: driverPhone,
            driverPhone,
            car_number: carNumber,
            carNumber,
            car_brand: carBrand,
            carBrand,
            sender,
            marketplace
        };
    }

    groupSchedulesByDate(schedules) {
        const groups = new Map();

        (Array.isArray(schedules) ? schedules : []).forEach((schedule) => {
            if (!schedule || !this.isScheduleInFuture(schedule)) {
                return;
            }

            const details = this.normalizeScheduleForModal(schedule);
            const departureKey = this.getScheduleDepartureKey(schedule)
                || details.accept_date
                || details.acceptDate
                || '';

            const key = departureKey || `schedule_${details.id || Math.random().toString(36).slice(2)}`;
            if (!groups.has(key)) {
                groups.set(key, {
                    key,
                    departureDate: departureKey,
                    schedules: [],
                    scheduleDetails: [],
                    cities: new Set(),
                    deliveryDates: new Set(),
                    acceptTimes: new Set(),
                    statuses: new Set(),
                    marketplace: details.marketplace || '',
                    warehouse: details.warehouse || details.warehouses || '',
                    primaryScheduleId: details.id || ''
                });
            }

            const group = groups.get(key);
            group.schedules.push(schedule);
            group.scheduleDetails.push(details);

            if (details.city) {
                group.cities.add(details.city);
            }

            const deliveryKey = this.getScheduleDeliveryKey(schedule)
                || details.delivery_date
                || details.deliveryDate;
            if (deliveryKey) {
                group.deliveryDates.add(deliveryKey);
            }

            const acceptTime = details.accept_time || details.acceptTime;
            if (acceptTime) {
                group.acceptTimes.add(acceptTime);
            }

            if (schedule && schedule.status) {
                group.statuses.add(schedule.status);
            }

            if (!group.marketplace && details.marketplace) {
                group.marketplace = details.marketplace;
            }

            if (!group.warehouse && (details.warehouse || details.warehouses)) {
                group.warehouse = details.warehouse || details.warehouses;
            }

            if (!group.primaryScheduleId && details.id) {
                group.primaryScheduleId = details.id;
            }
        });

        const toTimestamp = (value) => {
            const date = this.parseLocalDate(value);
            if (!date) {
                return Number.MAX_SAFE_INTEGER;
            }

            const normalized = new Date(date.getFullYear(), date.getMonth(), date.getDate());
            return normalized.getTime();


            if (!value) {
                return Number.MAX_SAFE_INTEGER;
            }
            const timestamp = Date.parse(value);
            return Number.isNaN(timestamp) ? Number.MAX_SAFE_INTEGER : timestamp;

        };

        const result = Array.from(groups.values()).map((group) => ({
            ...group,
            cities: Array.from(group.cities),
            deliveryDates: Array.from(group.deliveryDates),
            acceptTimes: Array.from(group.acceptTimes),
            statuses: Array.from(group.statuses)
        }));

        result.sort((a, b) => {
            const timeA = toTimestamp(a.departureDate || '');
            const timeB = toTimestamp(b.departureDate || '');
            if (timeA !== timeB) {
                return timeA - timeB;
            }

            return String(a.key).localeCompare(String(b.key), 'ru');
        });

        return result;
    }

    getGroupStatusInfo(group) {
        const statuses = Array.isArray(group?.statuses) ? group.statuses.filter(Boolean) : [];
        if (statuses.length === 0) {
            return {
                text: '—',
                className: this.getStatusClass('')
            };
        }

        const priority = ['Приём заявок', 'Ожидает отправки', 'В пути', 'Завершено'];
        const sorted = statuses.slice().sort((a, b) => {
            const indexA = priority.indexOf(a);
            const indexB = priority.indexOf(b);
            const safeA = indexA === -1 ? priority.length : indexA;
            const safeB = indexB === -1 ? priority.length : indexB;
            if (safeA !== safeB) {
                return safeA - safeB;
            }
            return a.localeCompare(b, 'ru');
        });

        const text = sorted[0];
        return {
            text,
            className: this.getStatusClass(text)
        };
    }

    formatCityCount(count) {
        const safeCount = Number.isFinite(Number(count)) ? Number(count) : 0;
        if (safeCount <= 0) {
            return 'Город будет выбран при оформлении';
        }

        if (safeCount === 1) {
            return 'Доступен 1 город';
        }

        if (safeCount >= 5) {
            return `Доступно ${safeCount} городов`;
        }

        return `Доступно ${safeCount} города`;
    }

    formatDeliverySummary(group) {
        const dates = Array.isArray(group?.deliveryDates) ? group.deliveryDates : [];
        if (dates.length === 0) {
            return '—';
        }

        const formatted = dates
            .map(date => this.formatDate(date))
            .filter(Boolean);

        if (formatted.length === 0) {
            return '—';
        }

        if (formatted.length === 1) {
            return formatted[0];
        }

        return `${formatted[0]} и ещё ${formatted.length - 1}`;
    }

    formatAcceptTimeInfo(group) {
        const times = Array.isArray(group?.acceptTimes) ? group.acceptTimes.filter(Boolean) : [];
        if (times.length === 0) {
            return '—';
        }

        if (times.length === 1) {
            return times[0];
        }

        return `${times.length} вариантов`;
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

        return {
            marketplace: data?.marketplace || this.filters.marketplace || '',
            warehouse: data?.warehouse || this.filters.warehouse || '',
            ordersTotal,
            ordersForWarehouse,
            ordersPercentage
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
            this.groupedSchedules = [];
            this.scheduleGroupsByKey.clear();
            this.renderScheduleGrid();
            this.renderWarehouseStats();
            return;
        }

        this.filteredSchedules = this.schedules.filter((schedule) => {
            if (!schedule) {
                return false;
            }

            const matchMarketplace = schedule.marketplace === this.filters.marketplace;
            const matchWarehouse = schedule.warehouses === this.filters.warehouse;

            if (!matchMarketplace || !matchWarehouse) {
                return false;
            }

            return this.isScheduleInFuture(schedule);
        });

        this.groupedSchedules = this.groupSchedulesByDate(this.filteredSchedules);
        this.scheduleGroupsByKey = new Map(
            this.groupedSchedules.map(group => [group.key, group])
        );

        this.renderScheduleGrid();
        this.renderWarehouseStats();
    }

    renderScheduleGrid() {
        const container = document.getElementById('scheduleGrid');
        if (!container) return;

        if (this.scheduleGridElement !== container) {
            if (this.scheduleGridElement) {
                this.scheduleGridElement.removeEventListener('click', this.boundHandleScheduleGridClick);
            }
            container.addEventListener('click', this.boundHandleScheduleGridClick);
            this.scheduleGridElement = container;
        }

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

        if (!Array.isArray(this.groupedSchedules) || this.groupedSchedules.length === 0) {
            this.updateScheduleSubtitle('На выбранный склад пока нет активных отправлений');
            container.classList.add('is-empty');
            container.innerHTML = this.renderEmptyState(
                'fa-calendar-times',
                'Нет доступных отправлений',
                'Попробуйте выбрать другой склад или загляните позже.'
            );
            return;
        }

        this.updateScheduleSubtitle(`Доступные даты отправления: ${this.groupedSchedules.length}`);
        container.innerHTML = this.groupedSchedules
            .map(group => this.renderScheduleCard(group))
            .join('');
    }

    renderScheduleCard(group) {
        const baseDetails = Array.isArray(group?.scheduleDetails) && group.scheduleDetails.length > 0
            ? group.scheduleDetails[0]
            : this.normalizeScheduleForModal(null);

        const marketplaceLabel = baseDetails.marketplace || this.filters.marketplace || '';
        const marketplace = this.escapeHtml(marketplaceLabel || '—');
        const marketplaceClass = this.getMarketplaceBadgeClass(marketplaceLabel);
        const warehouseName = baseDetails.warehouse || baseDetails.warehouses || this.filters.warehouse || '';
        const warehouse = this.escapeHtml(warehouseName || '—');
        const departureDate = this.escapeHtml(this.formatDate(group?.departureDate || baseDetails.accept_date || baseDetails.acceptDate));
        const deliveryDate = this.escapeHtml(this.formatDeliverySummary(group));
        const acceptTime = this.escapeHtml(this.formatAcceptTimeInfo(group));
        const driver = this.escapeHtml(baseDetails.driver_name || baseDetails.driverName || '—');
        const carInfo = this.escapeHtml([
            baseDetails.car_brand || baseDetails.carBrand,
            baseDetails.car_number || baseDetails.carNumber
        ].filter(Boolean).join(' ') || '—');
        const statusInfo = this.getGroupStatusInfo(group);
        const statusText = this.escapeHtml(statusInfo.text || '—');
        const statusClass = statusInfo.className;
        const citiesCount = Array.isArray(group?.cities) ? group.cities.length : 0;
        const citiesSummary = this.escapeHtml(this.formatCityCount(citiesCount));
        const groupIdentifier = group?.key ?? '';
        const primaryScheduleId = group?.primaryScheduleId ?? baseDetails.id ?? '';
        const safeGroupIdentifier = this.escapeHtml(String(groupIdentifier || ''));
        const safeScheduleId = this.escapeHtml(String(primaryScheduleId || ''));

        return `
            <article class="schedule-card" data-group="${safeGroupIdentifier}">


        const groupKey = JSON.stringify(group?.key ?? '') || 'null';
        const groupIdentifier = group?.key ?? '';

        return `
            <article class="schedule-card" data-group="${this.escapeHtml(String(groupIdentifier))}">

                <div class="schedule-status-indicator status-${statusClass}"></div>
                <div class="schedule-card-content">
                    <header class="schedule-card-header">
                        <div class="schedule-card-title">
                            <span class="schedule-card-warehouse">${warehouse}</span>
                            <span class="schedule-card-city">${citiesSummary}</span>
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
                            <span class="date-value">${departureDate || '—'}</span>
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
                        <button
                            type="button"
                            class="create-order-btn"
                            data-group-key="${safeGroupIdentifier}"
                            data-schedule-id="${safeScheduleId}"
                        >


                        <button class="create-order-btn" onclick="window.ScheduleManager.handleCreateOrderClick(event, ${groupKey})">

                            <i class="fas fa-plus"></i>
                            Создать заявку
                        </button>
                    </div>
                </div>
            </article>
        `;
    }

    handleScheduleGridClick(event) {
        if (!event || !(event.target instanceof HTMLElement)) {
            return;
        }

        const button = event.target.closest('.create-order-btn');
        if (!button || button.disabled) {
            return;
        }

        const currentTarget = event.currentTarget;
        if (currentTarget instanceof HTMLElement && !currentTarget.contains(button)) {
            return;
        }

        event.preventDefault();
        const { groupKey = '', scheduleId = '' } = button.dataset || {};
        const identifier = groupKey || scheduleId;

        this.handleCreateOrderClick(event, identifier, button);
    }

    handleCreateOrderClick(event, scheduleId, explicitButton) {
        const button = explicitButton instanceof HTMLElement
            ? explicitButton
            : event?.target instanceof HTMLElement
                ? event.target.closest('.create-order-btn')
                : event?.currentTarget instanceof HTMLElement && event.currentTarget.classList.contains('create-order-btn')
                    ? event.currentTarget
                    : null;

        this.animateActionButton(button);

        let potentialGroupKey = '';
        if (typeof scheduleId === 'string' || typeof scheduleId === 'number') {
            potentialGroupKey = String(scheduleId);
        }

        if (!potentialGroupKey && button?.dataset?.groupKey) {
            potentialGroupKey = button.dataset.groupKey;
        }

        if (potentialGroupKey && this.scheduleGroupsByKey.has(potentialGroupKey)) {
            this.createOrderForScheduleGroup(potentialGroupKey);
            return;

        }

        let fallbackScheduleId = '';
        if (button?.dataset?.scheduleId) {
            fallbackScheduleId = button.dataset.scheduleId;
        }

        if (!fallbackScheduleId && (typeof scheduleId === 'string' || typeof scheduleId === 'number')) {
            fallbackScheduleId = String(scheduleId);
        } else if (!fallbackScheduleId && scheduleId && typeof scheduleId === 'object' && 'id' in scheduleId) {
            fallbackScheduleId = String(scheduleId.id);
        }

        if (fallbackScheduleId) {
            this.createOrderForSchedule(fallbackScheduleId);
        }
    }

    animateActionButton(button) {
        if (!(button instanceof HTMLElement)) {
            return;
        }

        button.classList.remove('is-pressed');
        // Перезапускаем анимацию, если пользователь кликает повторно до её окончания
        void button.offsetWidth;
        button.classList.add('is-pressed');
        button.addEventListener('animationend', () => {
            button.classList.remove('is-pressed');
        }, { once: true });

        const potentialGroupKey = typeof scheduleId === 'string'
            ? scheduleId
            : '';

        if (potentialGroupKey && this.scheduleGroupsByKey.has(potentialGroupKey)) {
            this.createOrderForScheduleGroup(potentialGroupKey);
            return;
        }

        let fallbackScheduleId = '';
        if (button?.dataset?.scheduleId) {
            fallbackScheduleId = button.dataset.scheduleId;
        }

        if (!fallbackScheduleId && (typeof scheduleId === 'string' || typeof scheduleId === 'number')) {
            fallbackScheduleId = String(scheduleId);
        } else if (!fallbackScheduleId && scheduleId && typeof scheduleId === 'object' && 'id' in scheduleId) {
            fallbackScheduleId = String(scheduleId.id);
        }

        if (fallbackScheduleId) {
            this.createOrderForSchedule(fallbackScheduleId);
        }
    }

    animateActionButton(button) {
        if (!(button instanceof HTMLElement)) {
            return;
        }

        button.classList.remove('is-pressed');
        // Перезапускаем анимацию, если пользователь кликает повторно до её окончания
        void button.offsetWidth;
        button.classList.add('is-pressed');
        button.addEventListener('animationend', () => {
            button.classList.remove('is-pressed');
        }, { once: true });
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
        const date = this.parseLocalDate(dateStr);
        if (!date) {
            return '—';
        }

        return date.toLocaleDateString('ru-RU', {
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

    createOrderForScheduleGroup(groupKey) {
        const group = this.scheduleGroupsByKey.get(groupKey);
        if (!group || !Array.isArray(group.scheduleDetails) || group.scheduleDetails.length === 0) {
            console.warn('Не удалось найти отправления для выбранной даты', groupKey);
            return;
        }

        const clonedDetails = group.scheduleDetails.map((details) => ({ ...details }));
        const primaryDetails = { ...clonedDetails[0] };

        primaryDetails.available_schedules = clonedDetails;
        primaryDetails.availableSchedules = clonedDetails;

        if (!primaryDetails.id && group.primaryScheduleId) {
            primaryDetails.id = group.primaryScheduleId;
        }

        if (!primaryDetails.accept_date && group.departureDate) {
            primaryDetails.accept_date = group.departureDate;
            primaryDetails.acceptDate = group.departureDate;
        }

        if (!primaryDetails.delivery_date && Array.isArray(group.deliveryDates) && group.deliveryDates.length > 0) {
            const delivery = group.deliveryDates[0];
            primaryDetails.delivery_date = delivery;
            primaryDetails.deliveryDate = delivery;
        }

        if (clonedDetails.length > 1) {
            primaryDetails.city = '';
        }

        if (!primaryDetails.marketplace) {
            primaryDetails.marketplace = this.filters.marketplace || '';
        }
        if (!primaryDetails.warehouse && !primaryDetails.warehouses) {
            const warehouse = this.filters.warehouse || '';
            primaryDetails.warehouse = warehouse;
            primaryDetails.warehouses = warehouse;
        }

        const detailsModal = document.getElementById('scheduleDetailsModal');
        if (detailsModal) {
            window.app.closeModal(detailsModal);
        }

        if (typeof window.openClientRequestFormModal === 'function') {
            window.openClientRequestFormModal(primaryDetails);
        } else if (typeof window.openRequestFormModal === 'function') {
            window.openRequestFormModal(primaryDetails, '', '', '', {
                modalId: 'clientRequestModal',
                contentId: 'clientRequestModalContent'
            });
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
        this.groupedSchedules = [];
        this.warehouseOptions = [];
        this.isLoadingSchedules = false;
        this.pendingSelections.marketplace = '';
        this.pendingSelections.warehouse = '';
        this.currentStep = 'marketplace';
        this.clearWarehouseStats();
        this.scheduleGroupsByKey.clear();

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
