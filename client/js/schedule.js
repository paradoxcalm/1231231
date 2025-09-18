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
        this.elements = {
            marketplaceSelect: document.getElementById('marketplaceFilter'),
            warehouseSelect: document.getElementById('warehouseFilter'),
            resetButton: document.getElementById('resetScheduleFilters'),
            subtitle: document.getElementById('scheduleSubtitle')
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
        this.renderWarehouses();
        this.loadMarketplaces();
    }

    setupEventListeners() {
        const { marketplaceSelect, warehouseSelect, resetButton } = this.elements;

        if (marketplaceSelect) {
            marketplaceSelect.addEventListener('change', (event) => {
                this.handleMarketplaceChange(event.target.value);
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
        this.pendingSelections.warehouse = '';
        this.updateWarehouseConfirmState();
        this.applyStepState('warehouse', { active: false, complete: false });
        this.clearWarehouseSummary();

        if (!value) {
            this.clearMarketplaceSummary();
        }
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

        if (this.elements.marketplaceSelect) {
            this.elements.marketplaceSelect.value = this.filters.marketplace || '';
        }
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

        summary.textContent = `Маркетплейс: ${this.filters.marketplace}`;
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
        const select = this.elements.marketplaceSelect;
        if (!select) return;

        select.innerHTML = '';

        if (this.isLoadingMarketplaces) {
            const option = document.createElement('option');
            option.value = '';
            option.textContent = 'Загрузка маркетплейсов...';
            option.disabled = true;
            select.appendChild(option);
            select.disabled = true;
            return;
        }

        if (this.marketplaceOptions.length === 0) {
            const option = document.createElement('option');
            option.value = '';
            option.textContent = 'Маркетплейсы недоступны';
            option.disabled = true;
            select.appendChild(option);
            select.disabled = true;
            return;
        }

        const placeholderOption = document.createElement('option');
        placeholderOption.value = '';
        placeholderOption.textContent = 'Выберите маркетплейс';
        select.appendChild(placeholderOption);

        this.marketplaceOptions.forEach(optionData => {
            const option = document.createElement('option');
            option.value = optionData.value;
            option.textContent = optionData.label;
            if (optionData.description) {
                option.title = optionData.description;
            }
            select.appendChild(option);
        });

        select.disabled = false;
        const selected = this.filters.marketplace || '';
        select.value = selected;
        if (select.value !== selected) {
            select.value = '';
        }
    }

    getMarketplaceDescription(marketplace) {
        const descriptions = {
            'Wildberries': 'Крупнейший российский маркетплейс',
            'Ozon': 'Универсальная торговая площадка',
            'YandexMarket': 'Маркетплейс от Яндекса'
        };
        return descriptions[marketplace] || 'Торговая площадка';
    }

    selectMarketplace(marketplace) {
        this.filters.marketplace = marketplace;
        this.filters.warehouse = '';

        this.pendingSelections.marketplace = marketplace;
        this.pendingSelections.warehouse = '';
        this.updateMarketplaceConfirmState();
        this.updateWarehouseConfirmState();
        this.clearWarehouseSummary();

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
            return;
        }

        this.loadSchedules();
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
            return;
        }

        this.filteredSchedules = this.schedules.filter(schedule => {
            const matchMarketplace = schedule.marketplace === this.filters.marketplace;
            const matchWarehouse = schedule.warehouses === this.filters.warehouse;
            return matchMarketplace && matchWarehouse;
        });

        this.renderScheduleGrid();
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

        this.applyStepState('marketplace', { active: true, complete: false });
        this.applyStepState('warehouse', { active: false, complete: false });
        this.clearMarketplaceSummary();
        this.clearWarehouseSummary();
        this.updateMarketplaceConfirmState();
        this.updateWarehouseConfirmState();

        if (this.elements.marketplaceSelect) {
            this.elements.marketplaceSelect.value = '';
        }

        if (this.elements.warehouseSelect) {
            this.elements.warehouseSelect.value = '';
        }

        this.renderMarketplaces();
        this.renderWarehouses();
        this.renderScheduleGrid();
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
