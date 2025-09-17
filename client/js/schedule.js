import { fetchMarketplaces } from './filterOptions.js';

// Управление расписанием отправлений
class ScheduleManager {
    constructor() {
        this.schedules = [];
        this.filteredSchedules = [];
        this.currentTab = 'upcoming';
        this.currentMonth = new Date();
        this.filters = {
            marketplace: '',
            city: '',
            warehouse: ''
        };
        this.marketplaceGridElement = null;
        this.warehouseGridElement = null;
        this.marketplaceBannerElement = null;
        this.warehouseBannerElement = null;
        this.marketplaceOptions = [];
        this.warehouseOptions = [];
        this.highlightTimers = {};
        this.filtersIncomplete = true;

        this.init();
    }

    init() {
        this.setupTabs();
        this.setupFilters();
        this.setupCalendar();
        this.loadSchedules();
    }

    setupTabs() {
        const tabBtns = document.querySelectorAll('#scheduleSection .tab-btn');
        tabBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const tab = btn.dataset.tab;
                this.switchTab(tab);
                
                tabBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            });
        });
    }

    switchTab(tab) {
        const tabs = document.querySelectorAll('#scheduleSection .tab-content');
        tabs.forEach(tabContent => tabContent.classList.remove('active'));
        
        const targetTab = document.getElementById(`${tab}Tab`);
        if (targetTab) {
            targetTab.classList.add('active');
            this.currentTab = tab;
            
            if (tab === 'calendar') {
                this.renderCalendar();
            } else {
                this.renderScheduleGrid();
            }
        }
    }

    setupFilters() {
        this.marketplaceGridElement = document.getElementById('marketplaceGrid');
        this.warehouseGridElement = document.getElementById('warehouseGrid');
        this.marketplaceBannerElement = document.getElementById('marketplaceBanner');
        this.warehouseBannerElement = document.getElementById('warehouseBanner');

        if (!this.marketplaceGridElement || !this.warehouseGridElement) {
            return;
        }

        this.filters.city = '';

        this.marketplaceGridElement.dataset.state = 'loading';
        this.marketplaceGridElement.innerHTML = `
            <div class="selection-skeleton">
                <div class="selection-skeleton__pulse"></div>
                <div class="selection-skeleton__pulse"></div>
                <div class="selection-skeleton__pulse"></div>
            </div>
        `;

        this.renderWarehouseCards([]);
        this.refreshStepStates();

        const baseUrl = '../filter_options.php';

        const initializeFilters = async () => {
            try {
                const marketplaces = await fetchMarketplaces({ baseUrl });
                this.renderMarketplaceCards(marketplaces);
            } catch (error) {
                console.error('Ошибка инициализации фильтров расписания:', error);
                this.renderMarketplaceCards([]);
            }
        };

        initializeFilters();

        this.bindFilterStepActions();
    }

    normalizeOptions(options = []) {
        const normalized = [];
        const seen = new Set();

        options.forEach(option => {
            if (option === null || option === undefined) {
                return;
            }

            let value = '';
            let label = '';
            let description = '';
            let meta = null;

            if (typeof option === 'string') {
                value = option.trim();
                label = option.trim();
            } else if (typeof option === 'object') {
                const rawValue = option.value ?? option.code ?? option.slug ?? option.id ?? option.name ?? option.title;
                const rawLabel = option.label ?? option.name ?? option.title ?? rawValue;
                const rawDescription = option.description ?? option.subtitle ?? option.hint ?? '';
                const rawMeta = option.meta ?? option.count ?? option.total ?? null;

                if (rawValue !== null && rawValue !== undefined) {
                    value = typeof rawValue === 'string' ? rawValue.trim() : `${rawValue}`.trim();
                }

                if (rawLabel !== null && rawLabel !== undefined) {
                    label = typeof rawLabel === 'string' ? rawLabel.trim() : `${rawLabel}`.trim();
                }

                if (rawDescription !== null && rawDescription !== undefined) {
                    description = typeof rawDescription === 'string'
                        ? rawDescription.trim()
                        : `${rawDescription}`.trim();
                }

                if (rawMeta !== null && rawMeta !== undefined && `${rawMeta}`.trim() !== '') {
                    const numericMeta = Number(rawMeta);
                    meta = Number.isFinite(numericMeta) ? numericMeta : rawMeta;
                }
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
            normalized.push({
                value,
                label,
                description,
                meta,
                raw: option
            });
        });

        return normalized;
    }

    renderMarketplaceCards(options = null) {
        if (!this.marketplaceGridElement) {
            return;
        }

        if (options !== null) {
            this.marketplaceOptions = this.normalizeOptions(options);
        }

        if (!Array.isArray(this.marketplaceOptions) || this.marketplaceOptions.length === 0) {
            this.marketplaceGridElement.dataset.state = 'empty';
            this.marketplaceGridElement.innerHTML = `
                <div class="selection-empty">
                    <i class="fas fa-store-slash"></i>
                    <p>Маркетплейсы недоступны</p>
                    <span>Попробуйте обновить страницу или обратитесь в поддержку.</span>
                </div>
            `;
            this.refreshStepStates();
            return;
        }

        this.marketplaceGridElement.dataset.state = 'ready';
        this.marketplaceGridElement.innerHTML = this.marketplaceOptions
            .map(option => this.buildSelectionCard(option, 'marketplace'))
            .join('');

        this.bindSelectionCards(this.marketplaceGridElement, 'marketplace');
        this.refreshStepStates();
    }

    renderWarehouseCards(options = null) {
        if (!this.warehouseGridElement) {
            return;
        }

        if (options !== null) {
            this.warehouseOptions = Array.isArray(options) ? options : [];
        }

        const marketplaceSelected = Boolean(this.filters.marketplace);

        if (!marketplaceSelected) {
            this.warehouseGridElement.dataset.state = 'locked';
            this.warehouseGridElement.innerHTML = `
                <div class="selection-empty">
                    <i class="fas fa-hand-pointer"></i>
                    <p>Выберите маркетплейс</p>
                    <span>Сначала завершите шаг 1, чтобы увидеть доступные склады.</span>
                </div>
            `;
            this.refreshStepStates();
            return;
        }

        if (!Array.isArray(this.warehouseOptions) || this.warehouseOptions.length === 0) {
            this.warehouseGridElement.dataset.state = 'empty';
            this.warehouseGridElement.innerHTML = `
                <div class="selection-empty">
                    <i class="fas fa-warehouse"></i>
                    <p>Нет складов</p>
                    <span>Для выбранного маркетплейса пока нет активных расписаний.</span>
                </div>
            `;
            this.refreshStepStates();
            return;
        }

        this.warehouseGridElement.dataset.state = 'ready';
        this.warehouseGridElement.innerHTML = this.warehouseOptions
            .map(option => this.buildSelectionCard(option, 'warehouse'))
            .join('');

        this.bindSelectionCards(this.warehouseGridElement, 'warehouse');
        this.refreshStepStates();
    }

    buildSelectionCard(option, type) {
        if (!option || !option.value) {
            return '';
        }

        const isMarketplace = type === 'marketplace';
        const isSelected = isMarketplace
            ? this.filters.marketplace === option.value
            : this.filters.warehouse === option.value;
        const isDisabled = !isMarketplace && !this.filters.marketplace;

        const { meta, description } = isMarketplace
            ? this.getMarketplaceMeta(option)
            : this.getWarehouseMeta(option);

        const classes = ['selection-card', `selection-card--${type}`];
        if (isSelected) {
            classes.push('selection-card--selected');
        }
        if (isDisabled) {
            classes.push('selection-card--disabled');
        }

        const disabledAttr = isDisabled ? ' disabled' : '';
        const metaHtml = meta ? `<span class="selection-card__meta">${meta}</span>` : '';
        const descriptionHtml = description ? `<span class="selection-card__description">${description}</span>` : '';

        return `
            <button type="button" class="${classes.join(' ')}" data-value="${option.value}" data-type="${type}"${disabledAttr}>
                <span class="selection-card__abbr" aria-hidden="true">${this.getOptionAbbreviation(option.label)}</span>
                <span class="selection-card__title">${option.label}</span>
                ${metaHtml}
                ${descriptionHtml}
                <span class="selection-card__check" aria-hidden="true">
                    <i class="fas fa-check"></i>
                </span>
            </button>
        `;
    }

    bindSelectionCards(container, type) {
        if (!container) {
            return;
        }

        container.querySelectorAll('.selection-card').forEach(card => {
            if (card.dataset.bound === 'true' || card.disabled) {
                return;
            }

            card.addEventListener('click', () => {
                const value = card.dataset.value;
                if (!value) {
                    return;
                }

                if (type === 'marketplace') {
                    this.handleMarketplaceSelection(value);
                } else if (type === 'warehouse') {
                    this.handleWarehouseSelection(value);
                }
            });

            card.dataset.bound = 'true';
        });
    }

    handleMarketplaceSelection(value) {
        if (!value) {
            return;
        }

        this.filters.marketplace = value;
        this.filters.warehouse = '';
        this.renderMarketplaceCards();
        this.updateWarehouseOptions();

        this.applyFilters();
        this.refreshStepStates();
        this.focusFilter('warehouseGrid');
    }

    handleWarehouseSelection(value) {
        if (!value) {
            return;
        }

        this.filters.warehouse = value;
        this.renderWarehouseCards();
        this.applyFilters();
        this.refreshStepStates();
        this.focusFilter('scheduleGrid');
    }

    refreshStepStates() {
        const marketplaceSelected = Boolean(this.filters.marketplace);
        const warehouseSelected = Boolean(this.filters.warehouse);

        if (this.marketplaceBannerElement) {
            if (!this.marketplaceOptions.length) {
                this.setBannerState(this.marketplaceBannerElement, 'locked', {
                    title: 'Маркетплейсы недоступны',
                    description: 'Попробуйте обновить страницу или обратитесь в поддержку.',
                    status: 'Недоступно'
                });
            } else if (marketplaceSelected) {
                const marketplace = this.marketplaceOptions.find(option => option.value === this.filters.marketplace);
                const label = marketplace ? marketplace.label : this.filters.marketplace;
                this.setBannerState(this.marketplaceBannerElement, 'complete', {
                    title: 'Маркетплейс выбран',
                    description: `Вы выбрали: ${label}`,
                    status: 'Шаг 1 готов'
                });
            } else {
                this.setBannerState(this.marketplaceBannerElement, 'active', {
                    title: 'Выберите маркетплейс',
                    description: 'Мы покажем подходящие склады и расписание после выбора площадки.',
                    status: 'Шаг 1 из 2'
                });
            }
        }

        if (this.warehouseBannerElement) {
            if (!marketplaceSelected) {
                this.setBannerState(this.warehouseBannerElement, 'locked', {
                    title: 'Сначала выберите маркетплейс',
                    description: 'После выбора площадки мы покажем доступные склады и расписание приёмок.',
                    status: 'Шаг 2 из 2'
                });
            } else if (!this.warehouseOptions.length) {
                this.setBannerState(this.warehouseBannerElement, 'empty', {
                    title: 'Склады недоступны',
                    description: 'Для выбранного маркетплейса пока нет активных расписаний.',
                    status: 'Нет данных'
                });
            } else if (warehouseSelected) {
                const warehouse = this.warehouseOptions.find(option => option.value === this.filters.warehouse);
                const label = warehouse ? warehouse.label : this.filters.warehouse;
                this.setBannerState(this.warehouseBannerElement, 'complete', {
                    title: 'Склад выбран',
                    description: `Вы выбрали: ${label}`,
                    status: 'Готово'
                });
            } else {
                const warehousesCount = this.warehouseOptions.length;
                const countLabel = `${warehousesCount} ${this.formatPlural(warehousesCount, ['склад', 'склада', 'складов'])}`;
                this.setBannerState(this.warehouseBannerElement, 'active', {
                    title: 'Выберите склад',
                    description: `Для выбранного маркетплейса доступно ${countLabel}.`,
                    status: 'Шаг 2 из 2'
                });
            }
        }

        if (this.marketplaceGridElement) {
            if (!this.marketplaceOptions.length) {
                this.marketplaceGridElement.dataset.state = 'empty';
            } else if (this.marketplaceGridElement.dataset.state === 'loading') {
                this.marketplaceGridElement.dataset.state = 'ready';
            }
        }

        if (this.warehouseGridElement) {
            let state = 'locked';
            if (!marketplaceSelected) {
                state = 'locked';
            } else if (!this.warehouseOptions.length) {
                state = 'empty';
            } else {
                state = 'ready';
            }
            this.warehouseGridElement.dataset.state = state;
        }
    }

    setBannerState(element, state, { title, description, status } = {}) {
        if (!element) {
            return;
        }

        element.dataset.state = state;

        const titleElement = element.querySelector('[data-banner-title]');
        if (titleElement && typeof title === 'string') {
            titleElement.textContent = title;
        }

        const descriptionElement = element.querySelector('[data-banner-description]');
        if (descriptionElement && typeof description === 'string') {
            descriptionElement.textContent = description;
        }

        const statusElement = element.querySelector('[data-banner-status]');
        if (statusElement && typeof status === 'string') {
            statusElement.textContent = status;
        }
    }

    getOptionAbbreviation(label) {
        if (!label) {
            return '—';
        }

        const normalized = `${label}`.trim();
        if (!normalized) {
            return '—';
        }

        const words = normalized.split(/\s+/).filter(Boolean);
        const toFirstLetter = (word) => {
            if (!word) {
                return '';
            }
            const letters = Array.from(word);
            return letters.length ? letters[0] : '';
        };

        let abbreviation = '';

        if (words.length === 1) {
            abbreviation = Array.from(words[0]).slice(0, 2).join('');
        } else {
            abbreviation = `${toFirstLetter(words[0])}${toFirstLetter(words[1])}`;
        }

        return abbreviation.toUpperCase() || normalized.slice(0, 2).toUpperCase();
    }

    formatPlural(count, forms) {
        const n = Math.abs(Number(count)) % 100;
        const n1 = n % 10;

        if (n > 10 && n < 20) {
            return forms[2];
        }
        if (n1 > 1 && n1 < 5) {
            return forms[1];
        }
        if (n1 === 1) {
            return forms[0];
        }
        return forms[2];
    }

    getMarketplaceMeta(option) {
        const relatedWarehouses = this.collectWarehouses(option.value);
        const warehousesCount = relatedWarehouses.length;
        const schedulesCount = relatedWarehouses.reduce((acc, item) => acc + (item.count ?? 0), 0);

        const metaParts = [];
        if (warehousesCount > 0) {
            metaParts.push(`${warehousesCount} ${this.formatPlural(warehousesCount, ['склад', 'склада', 'складов'])}`);
        }
        if (schedulesCount > 0) {
            metaParts.push(`${schedulesCount} ${this.formatPlural(schedulesCount, ['рейс', 'рейса', 'рейсов'])}`);
        }

        const meta = metaParts.join(' • ');
        const description = option.description || 'Нажмите, чтобы перейти к выбору склада.';

        return { meta, description };
    }

    getWarehouseMeta(option) {
        const cities = Array.isArray(option?.cities) ? option.cities.filter(city => city && city.trim()) : [];
        let meta = '';

        if (cities.length === 1) {
            meta = `Город: ${cities[0]}`;
        } else if (cities.length > 1) {
            const visibleCities = cities.slice(0, 2).join(', ');
            const remaining = cities.length - 2;
            meta = `Города: ${visibleCities}${remaining > 0 ? ` и ещё ${remaining}` : ''}`;
        }

        const count = option.count ?? 0;
        const description = count
            ? `${count} ${this.formatPlural(count, ['рейс', 'рейса', 'рейсов'])} в расписании`
            : 'Кликните, чтобы увидеть ближайшие даты.';

        return { meta, description };
    }

    updateWarehouseOptions() {
        if (!this.warehouseGridElement) {
            return;
        }

        if (!this.filters.marketplace) {
            this.warehouseOptions = [];
            this.filters.warehouse = '';
            this.renderWarehouseCards([]);
            this.refreshStepStates();
            return;
        }

        const warehouses = this.collectWarehouses(this.filters.marketplace);
        this.warehouseOptions = warehouses;

        const hasSelectedWarehouse = warehouses.some(option => option.value === this.filters.warehouse);
        if (!hasSelectedWarehouse) {
            this.filters.warehouse = '';
        }

        this.renderWarehouseCards();
        this.refreshStepStates();
    }

    collectWarehouses(marketplace) {
        if (!marketplace) {
            return [];
        }

        if (!Array.isArray(this.schedules) || this.schedules.length === 0) {
            return [];
        }

        const warehouseMap = new Map();

        this.schedules.forEach(schedule => {
            if (schedule.marketplace !== marketplace) {
                return;
            }

            const rawWarehouse = schedule.warehouse ?? schedule.warehouses;
            const warehouseList = Array.isArray(rawWarehouse) ? rawWarehouse : [rawWarehouse];
            const city = typeof schedule.city === 'string' ? schedule.city.trim() : '';

            warehouseList.forEach(item => {
                if (item === null || item === undefined) {
                    return;
                }

                const trimmed = typeof item === 'string' ? item.trim() : `${item}`.trim();
                if (!trimmed) {
                    return;
                }

                if (!warehouseMap.has(trimmed)) {
                    warehouseMap.set(trimmed, {
                        value: trimmed,
                        label: trimmed,
                        count: 0,
                        cities: new Set()
                    });
                }

                const entry = warehouseMap.get(trimmed);
                entry.count += 1;
                if (city) {
                    entry.cities.add(city);
                }
            });
        });

        const collated = Array.from(warehouseMap.values()).map(entry => ({
            value: entry.value,
            label: entry.label,
            count: entry.count,
            cities: Array.from(entry.cities)
        }));

        return collated.sort((a, b) => {
            try {
                return a.label.localeCompare(b.label, 'ru', { sensitivity: 'base' });
            } catch (error) {
                return a.label.localeCompare(b.label);
            }
        });
    }

    setupCalendar() {
        const prevBtn = document.getElementById('prevMonth');
        const nextBtn = document.getElementById('nextMonth');

        if (prevBtn) {
            prevBtn.addEventListener('click', () => {
                this.currentMonth.setMonth(this.currentMonth.getMonth() - 1);
                this.renderCalendar();
            });
        }

        if (nextBtn) {
            nextBtn.addEventListener('click', () => {
                this.currentMonth.setMonth(this.currentMonth.getMonth() + 1);
                this.renderCalendar();
            });
        }
    }

    async loadSchedules() {
        try {
            const response = await fetch('../fetch_schedule.php', {
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error('Network response was not ok');
            }

            const data = await response.json();
            this.schedules = data.map(({
                accept_date,
                delivery_date,
                city,
                warehouses,
                status,
                ...rest
            }) => ({
                ...rest,
                acceptDate: accept_date,
                deliveryDate: delivery_date,
                city,
                warehouse: warehouses,
                status
            }));

            this.updateWarehouseOptions();
            this.renderMarketplaceCards();
            this.applyFilters();
            this.refreshStepStates();
        } catch (error) {
            console.error('Ошибка загрузки расписания:', error);
            window.app.showError('Не удалось загрузить расписание');
        }
    }

    applyFilters() {
        const requireFilters = !this.filters.marketplace || !this.filters.warehouse;

        if (requireFilters) {
            this.filteredSchedules = [];
            this.filtersIncomplete = true;
        } else {
            this.filteredSchedules = this.schedules.filter(schedule => {
                const matchMarketplace = schedule.marketplace === this.filters.marketplace;
                const scheduleWarehouse = schedule.warehouse;
                const matchWarehouse = Array.isArray(scheduleWarehouse)
                    ? scheduleWarehouse.includes(this.filters.warehouse)
                    : scheduleWarehouse === this.filters.warehouse;

                return matchMarketplace && matchWarehouse;
            });
            this.filtersIncomplete = false;
        }

        if (this.currentTab === 'upcoming') {
            this.renderScheduleGrid();
        } else {
            this.renderCalendar();
        }
    }

    renderScheduleGrid() {
        const grid = document.getElementById('scheduleGrid');
        if (!grid) return;

        if (this.filtersIncomplete) {
            grid.innerHTML = this.getMissingFiltersTemplate();
            this.bindFilterStepActions(grid);
            return;
        }

        if (this.filteredSchedules.length === 0) {
            grid.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-calendar-times"></i>
                    <h3>Нет доступных отправлений</h3>
                    <p>По выбранным фильтрам отправления не найдены</p>
                </div>
            `;
            return;
        }

        grid.innerHTML = this.filteredSchedules.map(schedule => `
            <div class="schedule-card" data-id="${schedule.id}">
                <div class="schedule-header">
                    <div class="schedule-route">${schedule.city} → ${schedule.warehouse}</div>
                    <div class="schedule-marketplace marketplace-${schedule.marketplace.toLowerCase()}">
                        ${schedule.marketplace}
                    </div>
                </div>
                
                <div class="schedule-dates">
                    <div class="date-item">
                        <span class="date-label">Приёмка:</span>
                        <span class="date-value">${window.utils.formatDate(schedule.acceptDate)}</span>
                    </div>
                    <div class="date-item">
                        <span class="date-label">Сдача:</span>
                        <span class="date-value">${window.utils.formatDate(schedule.deliveryDate)}</span>
                    </div>
                    <div class="date-item">
                        <span class="date-label">Водитель:</span>
                        <span class="date-value">${schedule.driverName}</span>
                    </div>
                </div>

                <div class="schedule-status status-${schedule.status.toLowerCase().replace(/\s+/g, '-')}">
                    <i class="fas fa-circle"></i>
                    ${schedule.status}
                </div>

                <div class="schedule-action">
                    <button class="create-order-small" onclick="window.ScheduleManager.createOrderForSchedule(${schedule.id})">
                        <i class="fas fa-plus"></i>
                        Создать заявку
                    </button>
                </div>
            </div>
        `).join('');

        // Добавляем обработчики кликов
        grid.querySelectorAll('.schedule-card').forEach(card => {
            card.addEventListener('click', (e) => {
                if (!e.target.closest('.create-order-small')) {
                    const scheduleId = parseInt(card.dataset.id);
                    this.showScheduleDetails(scheduleId);
                }
            });
        });
    }

    getMissingFiltersTemplate() {
        return `
            <div class="empty-state empty-state-filters">
                <i class="fas fa-filter"></i>
                <h3>Выберите маркетплейс и склад</h3>
                <p>Чтобы увидеть расписание отправлений, сначала выберите карточку маркетплейса, затем склад.</p>
                <div class="empty-state-actions">
                    <button type="button" class="filter-step-action" data-target="marketplaceGrid">
                        Перейти к шагу «Маркетплейс»
                    </button>
                    <button type="button" class="filter-step-action" data-target="warehouseGrid">
                        Перейти к шагу «Склад»
                    </button>
                </div>
            </div>
        `;
    }

    focusFilter(targetId) {
        const targetElement = document.getElementById(targetId);
        if (!targetElement) {
            return;
        }

        if (typeof targetElement.scrollIntoView === 'function') {
            targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }

        const parentStep = targetElement.closest('.filter-step');
        const elementsToHighlight = [targetElement];

        if (parentStep) {
            elementsToHighlight.push(parentStep);
        }

        elementsToHighlight.forEach((element, index) => {
            if (!element) {
                return;
            }

            element.classList.add('schedule-filter--highlight');
            const key = `${targetId}-${index}`;
            clearTimeout(this.highlightTimers[key]);
            this.highlightTimers[key] = setTimeout(() => {
                element.classList.remove('schedule-filter--highlight');
            }, 1800);
        });

        const focusable = targetElement.querySelector('button:not([disabled])');
        if (focusable && typeof focusable.focus === 'function') {
            try {
                focusable.focus({ preventScroll: true });
            } catch (error) {
                focusable.focus();
            }
        }
    }

    bindFilterStepActions(context = document) {
        const buttons = context.querySelectorAll('.filter-step-action');
        buttons.forEach(button => {
            if (button.dataset.bound === 'true') {
                return;
            }

            const targetId = button.dataset.target;
            if (!targetId) {
                return;
            }

            button.addEventListener('click', (event) => {
                event.preventDefault();
                this.focusFilter(targetId);
            });

            button.dataset.bound = 'true';
        });
    }

    renderCalendar() {
        const monthNames = [
            'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
            'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
        ];

        const currentMonthElement = document.getElementById('currentMonth');
        if (currentMonthElement) {
            currentMonthElement.textContent = 
                `${monthNames[this.currentMonth.getMonth()]} ${this.currentMonth.getFullYear()}`;
        }

        const calendarGrid = document.getElementById('calendarGrid');
        if (!calendarGrid) return;

        if (this.filtersIncomplete) {
            calendarGrid.innerHTML = this.getMissingFiltersTemplate();
            this.bindFilterStepActions(calendarGrid);
            return;
        }

        // Очищаем календарь
        calendarGrid.innerHTML = '';

        // Заголовки дней недели
        const dayHeaders = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
        dayHeaders.forEach(day => {
            const headerCell = document.createElement('div');
            headerCell.className = 'calendar-header-cell';
            headerCell.textContent = day;
            calendarGrid.appendChild(headerCell);
        });

        // Получаем первый и последний день месяца
        const firstDay = new Date(this.currentMonth.getFullYear(), this.currentMonth.getMonth(), 1);
        const lastDay = new Date(this.currentMonth.getFullYear(), this.currentMonth.getMonth() + 1, 0);
        
        // Получаем день недели первого дня (0 = воскресенье, преобразуем в 1-7)
        let startDayOfWeek = firstDay.getDay();
        if (startDayOfWeek === 0) startDayOfWeek = 7;

        // Добавляем пустые ячейки в начале
        for (let i = 1; i < startDayOfWeek; i++) {
            const emptyCell = document.createElement('div');
            emptyCell.className = 'calendar-cell other-month';
            calendarGrid.appendChild(emptyCell);
        }

        // Добавляем дни месяца
        for (let day = 1; day <= lastDay.getDate(); day++) {
            const cell = document.createElement('div');
            const cellDate = new Date(this.currentMonth.getFullYear(), this.currentMonth.getMonth(), day);
            const dateStr = cellDate.toISOString().split('T')[0];
            
            cell.className = 'calendar-cell';
            if (this.isToday(cellDate)) {
                cell.classList.add('today');
            }

            cell.innerHTML = `<div class="cell-date">${day}</div>`;

            // Добавляем события на эту дату
            const daySchedules = this.filteredSchedules.filter(s => 
                s.acceptDate === dateStr || s.deliveryDate === dateStr
            );

            if (daySchedules.length > 0) {
                const eventsContainer = document.createElement('div');
                eventsContainer.className = 'calendar-events';
                
                daySchedules.slice(0, 3).forEach(schedule => {
                    const event = document.createElement('div');
                    event.className = 'calendar-event';
                    event.textContent = `${schedule.city} → ${schedule.warehouse}`;
                    eventsContainer.appendChild(event);
                });

                if (daySchedules.length > 3) {
                    const moreEvent = document.createElement('div');
                    moreEvent.className = 'calendar-event';
                    moreEvent.textContent = `+${daySchedules.length - 3} ещё`;
                    eventsContainer.appendChild(moreEvent);
                }

                cell.appendChild(eventsContainer);
            }

            cell.addEventListener('click', () => {
                this.showDaySchedules(dateStr, daySchedules);
            });

            calendarGrid.appendChild(cell);
        }
    }

    isToday(date) {
        const today = new Date();
        return date.getDate() === today.getDate() &&
               date.getMonth() === today.getMonth() &&
               date.getFullYear() === today.getFullYear();
    }

    showDaySchedules(date, schedules) {
        if (schedules.length === 0) return;

        const modal = document.getElementById('scheduleDetailsModal');
        const content = document.getElementById('scheduleDetailsContent');
        
        if (!content) return;

        content.innerHTML = `
            <h4>Отправления на ${window.utils.formatDate(date)}</h4>
            <div class="day-schedules">
                ${schedules.map(schedule => `
                    <div class="day-schedule-item" data-id="${schedule.id}">
                        <div class="schedule-item-header">
                            <span class="route">${schedule.city} → ${schedule.warehouse}</span>
                            <span class="marketplace marketplace-${schedule.marketplace.toLowerCase()}">
                                ${schedule.marketplace}
                            </span>
                        </div>
                        <div class="schedule-item-info">
                            <div class="info-row">
                                <span>Водитель:</span>
                                <span>${schedule.driverName}</span>
                            </div>
                            <div class="info-row">
                                <span>Автомобиль:</span>
                                <span>${schedule.carBrand} ${schedule.carNumber}</span>
                            </div>
                            <div class="info-row">
                                <span>Заявок:</span>
                                <span>${schedule.ordersCount}</span>
                            </div>
                        </div>
                        <button class="create-order-small" onclick="window.ScheduleManager.createOrderForSchedule(${schedule.id})">
                            Создать заявку
                        </button>
                    </div>
                `).join('')}
            </div>
        `;

        // Добавляем стили для day-schedules
        if (!document.getElementById('daySchedulesStyles')) {
            const styles = document.createElement('style');
            styles.id = 'daySchedulesStyles';
            styles.textContent = `
                .day-schedules {
                    display: flex;
                    flex-direction: column;
                    gap: 16px;
                    margin-top: 16px;
                }
                .day-schedule-item {
                    border: 1px solid var(--border);
                    border-radius: var(--radius);
                    padding: 16px;
                    background: var(--bg-secondary);
                }
                .schedule-item-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 12px;
                }
                .schedule-item-header .route {
                    font-weight: 600;
                    color: var(--text-primary);
                }
                .schedule-item-info {
                    display: flex;
                    flex-direction: column;
                    gap: 6px;
                    margin-bottom: 12px;
                }
                .info-row {
                    display: flex;
                    justify-content: space-between;
                    font-size: 0.9rem;
                }
                .info-row span:first-child {
                    color: var(--text-secondary);
                }
                .info-row span:last-child {
                    font-weight: 500;
                }
            `;
            document.head.appendChild(styles);
        }

        window.app.openModal(modal);
    }

    showScheduleDetails(scheduleId) {
        const schedule = this.schedules.find(s => s.id === scheduleId);
        if (!schedule) return;

        const modal = document.getElementById('scheduleDetailsModal');
        const content = document.getElementById('scheduleDetailsContent');
        
        if (!content) return;

        content.innerHTML = `
            <div class="schedule-details">
                <div class="details-section">
                    <h4>Маршрут</h4>
                    <div class="details-grid">
                        <div class="detail-item">
                            <span class="detail-label">Откуда:</span>
                            <span class="detail-value">${schedule.city}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Куда:</span>
                            <span class="detail-value">${schedule.warehouse}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Маркетплейс:</span>
                            <span class="detail-value">${schedule.marketplace}</span>
                        </div>
                    </div>
                </div>

                <div class="details-section">
                    <h4>Даты</h4>
                    <div class="details-grid">
                        <div class="detail-item">
                            <span class="detail-label">Приёмка:</span>
                            <span class="detail-value">${window.utils.formatDate(schedule.acceptDate)}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Сдача:</span>
                            <span class="detail-value">${window.utils.formatDate(schedule.deliveryDate)}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Статус:</span>
                            <span class="detail-value status-${schedule.status.toLowerCase().replace(/\s+/g, '-')}">${schedule.status}</span>
                        </div>
                    </div>
                </div>

                <div class="details-section">
                    <h4>Транспорт</h4>
                    <div class="details-grid">
                        <div class="detail-item">
                            <span class="detail-label">Водитель:</span>
                            <span class="detail-value">${schedule.driverName}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Телефон:</span>
                            <span class="detail-value">${schedule.driverPhone}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Автомобиль:</span>
                            <span class="detail-value">${schedule.carBrand} ${schedule.carNumber}</span>
                        </div>
                    </div>
                </div>

                <div class="modal-actions">
                    <button class="action-btn action-btn-primary" onclick="window.ScheduleManager.createOrderForSchedule(${schedule.id})">
                        <i class="fas fa-plus"></i>
                        Создать заявку
                    </button>
                </div>
            </div>
        `;

        // Добавляем стили
        if (!document.getElementById('scheduleDetailsStyles')) {
            const styles = document.createElement('style');
            styles.id = 'scheduleDetailsStyles';
            styles.textContent = `
                .schedule-details {
                    display: flex;
                    flex-direction: column;
                    gap: 20px;
                }
                .details-section h4 {
                    font-size: 1.1rem;
                    font-weight: 600;
                    color: var(--text-primary);
                    margin-bottom: 12px;
                    padding-bottom: 8px;
                    border-bottom: 1px solid var(--border-light);
                }
                .details-grid {
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                }
                .detail-item {
                    display: flex;
                    justify-content: space-between;
                    padding: 8px 0;
                }
                .detail-label {
                    color: var(--text-secondary);
                    font-size: 0.9rem;
                }
                .detail-value {
                    font-weight: 500;
                    color: var(--text-primary);
                }
                .modal-actions {
                    display: flex;
                    justify-content: center;
                    margin-top: 20px;
                }
            `;
            document.head.appendChild(styles);
        }

        window.app.openModal(modal);
    }

    createOrderForSchedule(scheduleId) {
        const schedule = this.schedules.find(s => s.id === scheduleId);
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
}

// Инициализация после загрузки DOM
document.addEventListener('DOMContentLoaded', () => {
    window.ScheduleManager = new ScheduleManager();
});