import { fetchMarketplaces, fetchWarehouses } from './filterOptions.js';

// Управление расписанием отправлений с пошаговым выбором
class ScheduleManager {
    constructor() {
        this.schedules = [];
        this.filteredSchedules = [];
        this.currentStep = 1; // 1 = маркетплейс, 2 = склад, 3 = расписание
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

        this.init();
    }

    init() {
        this.setupStepNavigation();
        this.updateMarketplaceBanner();
        this.updateWarehouseBanner();
        this.updateSelectionSummary();
        this.loadMarketplaces();
        this.showStep(1);
        this.renderScheduleGrid();
    }

    setupStepNavigation() {
        // Кнопки навигации между шагами
        const backBtn = document.getElementById('stepBackBtn');
        const nextBtn = document.getElementById('stepNextBtn');

        if (backBtn) {
            backBtn.addEventListener('click', () => {
                if (this.currentStep > 1) {
                    this.showStep(this.currentStep - 1);
                }
            });
        }

        if (nextBtn) {
            nextBtn.addEventListener('click', () => {
                if (this.currentStep < 3) {
                    this.showStep(this.currentStep + 1);
                }
            });
        }
    }

    setBannerState(bannerId, { state = 'active', title = '', description = '', status = '' } = {}) {
        const banner = document.getElementById(bannerId);
        if (!banner) return;

        banner.dataset.state = state;

        const titleEl = banner.querySelector('[data-banner-title]');
        if (titleEl) {
            titleEl.textContent = title;
        }

        const descriptionEl = banner.querySelector('[data-banner-description]');
        if (descriptionEl) {
            descriptionEl.textContent = description;
        }

        const statusEl = banner.querySelector('[data-banner-status]');
        if (statusEl) {
            statusEl.textContent = status;
        }
    }

    updateMarketplaceBanner() {
        if (this.filters.marketplace) {
            this.setBannerState('marketplaceBanner', {
                state: 'completed',
                title: `Выбран маркетплейс «${this.filters.marketplace}»`,
                description: 'Можно перейти к следующему шагу и выбрать склад.',
                status: 'Готово ✓'
            });
        } else {
            this.setBannerState('marketplaceBanner', {
                state: 'active',
                title: 'Выберите маркетплейс',
                description: 'После выбора площадки мы покажем подходящие склады и даты отправлений.',
                status: 'Шаг 1 из 3'
            });
        }
    }

    updateWarehouseBanner() {
        if (!this.filters.marketplace) {
            this.setBannerState('warehouseBanner', {
                state: 'locked',
                title: 'Сначала выберите маркетплейс',
                description: 'Как только выберете площадку, мы подгрузим доступные склады.',
                status: 'Шаг 2 из 3'
            });
            return;
        }

        if (this.filters.warehouse) {
            this.setBannerState('warehouseBanner', {
                state: 'completed',
                title: `Выбран склад «${this.filters.warehouse}»`,
                description: 'Осталось выбрать дату отправления на следующем шаге.',
                status: 'Готово ✓'
            });
        } else {
            this.setBannerState('warehouseBanner', {
                state: 'active',
                title: `Выберите склад для «${this.filters.marketplace}»`,
                description: 'Выберите точку приёма, которая вам подходит.',
                status: 'Шаг 2 из 3'
            });
        }
    }

    updateSelectionSummary() {
        const marketplaceLabel = document.getElementById('selectedMarketplace');
        if (marketplaceLabel) {
            marketplaceLabel.textContent = this.filters.marketplace || '—';
        }

        const marketplaceSummary = document.getElementById('summaryMarketplace');
        if (marketplaceSummary) {
            const hasMarketplace = Boolean(this.filters.marketplace);
            marketplaceSummary.textContent = `Маркетплейс: ${this.filters.marketplace || '—'}`;
            marketplaceSummary.dataset.filled = hasMarketplace ? 'true' : 'false';
        }

        const warehouseSummary = document.getElementById('summaryWarehouse');
        if (warehouseSummary) {
            const hasWarehouse = Boolean(this.filters.warehouse);
            warehouseSummary.textContent = `Склад: ${this.filters.warehouse || '—'}`;
            warehouseSummary.dataset.filled = hasWarehouse ? 'true' : 'false';
        }
    }

    updateScheduleSubtitle(message) {
        const subtitle = document.getElementById('scheduleStepSubtitle');
        if (subtitle) {
            subtitle.textContent = message;
        }
    }

    showStep(stepNumber) {
        this.currentStep = stepNumber;

        this.updateStepWizardProgress();
        // Обновляем индикаторы шагов
        this.updateStepIndicators();
        
        // Показываем соответствующий контент
        const steps = document.querySelectorAll('.step-content');
        steps.forEach(step => step.classList.remove('active'));
        
        const currentStepElement = document.getElementById(`step${stepNumber}`);
        if (currentStepElement) {
            currentStepElement.classList.add('active');
        }

        // Обновляем кнопки навигации
        this.updateNavigationButtons();

        // Загружаем данные для текущего шага
        switch (stepNumber) {
            case 1:
                this.renderMarketplaces();
                break;
            case 2:
                this.loadWarehouses();
                break;
            case 3:
                this.loadSchedules();
                break;
        }
    }

    updateStepIndicators() {
        for (let i = 1; i <= 3; i++) {
            const indicator = document.querySelector(`.step-indicator[data-step="${i}"]`);
            if (indicator) {
                indicator.classList.remove('active', 'completed');

                if (i < this.currentStep) {
                    indicator.classList.add('completed');
                } else if (i === this.currentStep) {
                    indicator.classList.add('active');
                }
            }
        }
    }

    updateStepWizardProgress() {
        const wizard = document.querySelector('.step-wizard');
        if (wizard) {
            wizard.dataset.progress = String(this.currentStep);
        }
    }

    updateNavigationButtons() {
        const backBtn = document.getElementById('stepBackBtn');
        const nextBtn = document.getElementById('stepNextBtn');

        if (backBtn) {
            backBtn.style.display = this.currentStep > 1 ? 'flex' : 'none';
        }

        if (nextBtn) {
            const canProceed = this.canProceedToNextStep();
            nextBtn.style.display = this.currentStep < 3 && canProceed ? 'flex' : 'none';
        }
    }

    canProceedToNextStep() {
        switch (this.currentStep) {
            case 1:
                return Boolean(this.filters.marketplace);
            case 2:
                return Boolean(this.filters.warehouse);
            default:
                return false;
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
        } finally {
            this.isLoadingMarketplaces = false;
            this.renderMarketplaces();
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

    renderMarketplaces() {
        const container = document.getElementById('marketplaceGrid');
        if (!container) return;

        container.classList.remove('is-empty');

        if (this.isLoadingMarketplaces) {
            container.classList.add('is-empty');
            container.innerHTML = `
                <div class="loading">
                    <div class="spinner"></div>
                    Загружаем список маркетплейсов...
                </div>
            `;
            return;
        }

        if (this.marketplaceOptions.length === 0) {
            container.classList.add('is-empty');
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-store-slash"></i>
                    <h3>Маркетплейсы недоступны</h3>
                    <p>Попробуйте обновить страницу</p>
                </div>
            `;
            return;
        }

        container.innerHTML = this.marketplaceOptions.map(option => {
            const value = this.escapeHtml(option.value);
            const label = this.escapeHtml(option.label);
            const description = this.escapeHtml(option.description);
            return `
                <div class="marketplace-card ${this.filters.marketplace === option.value ? 'selected' : ''}"
                     data-value="${value}">
                    <div class="marketplace-icon">
                        <i class="fas ${this.getMarketplaceIcon(option.value)}"></i>
                    </div>
                    <div class="marketplace-info">
                        <h3>${label}</h3>
                        <p>${description}</p>
                    </div>
                    <div class="marketplace-check">
                        <i class="fas fa-check"></i>
                    </div>
                </div>
            `;
        }).join('');

        // Добавляем обработчики кликов
        container.querySelectorAll('.marketplace-card').forEach(card => {
            card.addEventListener('click', () => {
                const value = card.dataset.value;
                this.selectMarketplace(value);
            });
        });
    }

    getMarketplaceIcon(marketplace) {
        const icons = {
            'Wildberries': 'fa-shopping-bag',
            'Ozon': 'fa-box',
            'YandexMarket': 'fa-store'
        };
        return icons[marketplace] || 'fa-store';
    }

    selectMarketplace(marketplace) {
        this.filters.marketplace = marketplace;
        this.filters.warehouse = ''; // Сбрасываем выбор склада
        this.schedules = [];
        this.filteredSchedules = [];
        this.isLoadingSchedules = false;

        this.updateMarketplaceBanner();
        this.updateWarehouseBanner();
        this.updateSelectionSummary();
        this.renderScheduleGrid();

        // Обновляем визуальное состояние
        document.querySelectorAll('.marketplace-card').forEach(card => {
            card.classList.toggle('selected', card.dataset.value === marketplace);
        });

        this.warehouseOptions = [];
        this.renderWarehouses();

        // Автоматически переходим к следующему шагу
        setTimeout(() => {
            this.showStep(2);
        }, 300);
    }

    async loadWarehouses() {
        if (!this.filters.marketplace) {
            this.showStep(1);
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
                label: wh,
                count: this.getWarehouseScheduleCount(wh)
            }));
        } catch (error) {
            console.error('Ошибка загрузки складов:', error);
            this.showError('Не удалось загрузить список складов');
        } finally {
            this.isLoadingWarehouses = false;
            this.renderWarehouses();
        }
    }

    getWarehouseScheduleCount(warehouse) {
        return this.schedules.filter(s => 
            s.marketplace === this.filters.marketplace && 
            s.warehouses === warehouse
        ).length;
    }

    renderWarehouses() {
        const container = document.getElementById('warehouseGrid');
        if (!container) return;

        container.classList.remove('is-empty');

        if (!this.filters.marketplace) {
            container.classList.add('is-empty');
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-store"></i>
                    <h3>Сначала выберите маркетплейс</h3>
                    <p>Мы покажем доступные склады после выбора площадки.</p>
                </div>
            `;
            return;
        }

        if (this.isLoadingWarehouses) {
            container.classList.add('is-empty');
            container.innerHTML = `
                <div class="loading">
                    <div class="spinner"></div>
                    Загружаем склады...
                </div>
            `;
            return;
        }

        if (this.warehouseOptions.length === 0) {
            container.classList.add('is-empty');
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-warehouse"></i>
                    <h3>Нет доступных складов</h3>
                    <p>Для выбранного маркетплейса пока нет активных расписаний</p>
                </div>
            `;
            return;
        }

        // Создаем сетку складов
        container.innerHTML = this.warehouseOptions.map(option => {
            const value = this.escapeHtml(option.value);
            const label = this.escapeHtml(option.label);
            const count = Number(option.count) || 0;
            return `
                <div class="warehouse-card ${this.filters.warehouse === option.value ? 'selected' : ''}"
                     data-value="${value}">
                    <div class="warehouse-icon">
                        <i class="fas fa-warehouse"></i>
                    </div>
                    <div class="warehouse-info">
                        <h4>${label}</h4>
                        <span class="warehouse-count">${count} отправлений</span>
                    </div>
                    <div class="warehouse-check">
                        <i class="fas fa-check"></i>
                    </div>
                </div>
            `;
        }).join('');

        // Добавляем обработчики кликов
        container.querySelectorAll('.warehouse-card').forEach(card => {
            card.addEventListener('click', () => {
                const value = card.dataset.value;
                this.selectWarehouse(value);
            });
        });
    }

    selectWarehouse(warehouse) {
        this.filters.warehouse = warehouse;

        this.updateWarehouseBanner();
        this.updateSelectionSummary();

        // Обновляем визуальное состояние
        document.querySelectorAll('.warehouse-card').forEach(card => {
            card.classList.toggle('selected', card.dataset.value === warehouse);
        });

        this.isLoadingSchedules = true;
        this.renderScheduleGrid();

        // Автоматически переходим к расписанию
        setTimeout(() => {
            this.showStep(3);
        }, 300);
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
            this.updateSelectionSummary();
            this.updateMarketplaceBanner();
            this.updateWarehouseBanner();
            this.renderScheduleGrid();
            return;
        }

        this.filteredSchedules = this.schedules.filter(schedule => {
            const matchMarketplace = schedule.marketplace === this.filters.marketplace;
            const matchWarehouse = schedule.warehouses === this.filters.warehouse;
            return matchMarketplace && matchWarehouse;
        });

        this.updateSelectionSummary();
        this.renderScheduleGrid();
    }

    renderScheduleGrid() {
        const container = document.getElementById('scheduleGrid');
        if (!container) return;

        container.classList.remove('is-empty');

        if (!this.filters.marketplace || !this.filters.warehouse) {
            this.updateScheduleSubtitle('Чтобы увидеть расписание, выберите маркетплейс и склад');
            container.classList.add('is-empty');
            container.innerHTML = this.renderEmptyState(
                'fa-layer-group',
                'Расписание недоступно',
                'Выберите маркетплейс и склад, чтобы мы показали подходящие отправления.'
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
                'Попробуйте выбрать другую дату или склад, либо загляните позже.'
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
        const acceptDate = this.formatDate(schedule.accept_date);
        const acceptTime = this.escapeHtml(schedule.accept_time || '—');
        const deliveryDate = this.formatDate(schedule.delivery_date);
        const driver = this.escapeHtml(schedule.driver_name || '—');
        const carInfo = this.escapeHtml([schedule.car_brand, schedule.car_number].filter(Boolean).join(' ') || '—');
        const statusText = this.escapeHtml(schedule.status || '—');
        const statusClass = this.getStatusClass(schedule.status);
        const hasId = schedule && Object.prototype.hasOwnProperty.call(schedule, 'id');
        const scheduleIdValue = hasId ? schedule.id : '';
        const scheduleId = hasId ? JSON.stringify(schedule.id) : 'null';

        return `
            <article class="schedule-card" data-id="${this.escapeHtml(String(scheduleIdValue))}">
                <div class="schedule-header">
                    <div class="schedule-route">
                        <i class="fas fa-route"></i>
                        ${city} → ${warehouse}
                    </div>
                    <span class="schedule-marketplace ${marketplaceClass}">${marketplace}</span>
                </div>
                <div class="schedule-dates">
                    <div class="date-item">
                        <span class="date-label">Дата приёмки</span>
                        <span class="date-value">${acceptDate}</span>
                    </div>
                    <div class="date-item">
                        <span class="date-label">Время приёмки</span>
                        <span class="date-value">${acceptTime}</span>
                    </div>
                    <div class="date-item">
                        <span class="date-label">Дата отправки</span>
                        <span class="date-value">${deliveryDate}</span>
                    </div>
                </div>
                <div class="schedule-meta">
                    <div class="meta-item">
                        <span class="meta-label">Водитель</span>
                        <span class="meta-value">${driver}</span>
                    </div>
                    <div class="meta-item">
                        <span class="meta-label">Автомобиль</span>
                        <span class="meta-value">${carInfo}</span>
                    </div>
                </div>
                <div class="schedule-status status-${statusClass}">
                    <span class="status-dot"></span>
                    ${statusText}
                </div>
                <div class="schedule-action">
                    <button class="create-order-btn" onclick="window.ScheduleManager.createOrderForSchedule(${scheduleId})">
                        <i class="fas fa-plus"></i>
                        Создать заявку
                    </button>
                </div>
            </article>
        `;
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

        // Закрываем модальное окно деталей
        const detailsModal = document.getElementById('scheduleDetailsModal');
        if (detailsModal) {
            window.app.closeModal(detailsModal);
        }

        // Открываем форму создания заявки
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

    // Методы для внешнего вызова
    resetFilters() {
        this.filters = {
            marketplace: '',
            warehouse: ''
        };
        this.schedules = [];
        this.filteredSchedules = [];
        this.isLoadingSchedules = false;

        this.updateMarketplaceBanner();
        this.updateWarehouseBanner();
        this.updateSelectionSummary();

        this.renderMarketplaces();
        this.warehouseOptions = [];
        this.renderWarehouses();
        this.renderScheduleGrid();

        this.showStep(1);
    }

    getCurrentSelection() {
        return {
            marketplace: this.filters.marketplace,
            warehouse: this.filters.warehouse,
            step: this.currentStep
        };
    }
}

// Инициализация после загрузки DOM
document.addEventListener('DOMContentLoaded', () => {
    window.ScheduleManager = new ScheduleManager();
});