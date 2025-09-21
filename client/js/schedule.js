import { fetchMarketplaces, fetchCities } from './filterOptions.js';

class ScheduleTimeline {
    constructor() {
        this.elements = {
            panel: document.getElementById('schedulePanel'),
            marketplace: document.getElementById('marketplace'),
            originTabs: document.getElementById('originTabs'),
            grid: document.getElementById('grid'),
            prev: document.getElementById('prev'),
            next: document.getElementById('next'),
            range: document.getElementById('range')
        };

        this.state = {
            marketplace: '',
            city: '',
            weekStart: this.getMonday(new Date())
        };

        this.marketplaceOptions = [];
        this.cityOptions = [];
        this.scheduleCache = new Map();
        this.originalSchedules = [];
        this.enrichedSchedules = [];
        this.scheduleLookup = new Map();
        this.activeRequestController = null;
        this.isLoading = false;
        this.errorMessage = '';

        this.handleOriginTabClick = this.handleOriginTabClick.bind(this);
        this.handleTimelineClick = this.handleTimelineClick.bind(this);

        this.init();
    }

    init() {
        if (!this.elements.panel || !this.elements.grid) {
            return;
        }

        this.bindEvents();
        this.renderWeekRange();
        this.loadMarketplaces();
        this.loadCities();
        this.loadSchedules();
    }

    bindEvents() {
        const { marketplace, originTabs, prev, next, grid } = this.elements;

        if (marketplace) {
            marketplace.addEventListener('change', (event) => {
                this.state.marketplace = (event.target.value || '').trim();
                this.state.city = '';
                this.scheduleCache.clear();
                this.renderWeekRange();
                this.loadCities();
                this.loadSchedules();
            });
        }

        if (originTabs) {
            originTabs.addEventListener('click', this.handleOriginTabClick);
        }

        if (prev) {
            prev.addEventListener('click', () => {
                this.changeWeek(-1);
            });
        }

        if (next) {
            next.addEventListener('click', () => {
                this.changeWeek(1);
            });
        }

        if (grid) {
            grid.addEventListener('click', this.handleTimelineClick);
        }
    }

    getMonday(date) {
        const workingDate = new Date(date);
        const day = workingDate.getDay();
        const diff = workingDate.getDate() - (day === 0 ? 6 : day - 1);
        workingDate.setDate(diff);
        workingDate.setHours(0, 0, 0, 0);
        return workingDate;
    }

    changeWeek(offset) {
        const nextWeek = new Date(this.state.weekStart);
        nextWeek.setDate(nextWeek.getDate() + offset * 7);
        this.state.weekStart = this.getMonday(nextWeek);
        this.renderWeek();
    }

    async loadMarketplaces() {
        const select = this.elements.marketplace;
        if (!select) {
            return;
        }

        select.disabled = true;

        try {
            const marketplaces = await fetchMarketplaces({ baseUrl: '../filter_options.php' });
            this.marketplaceOptions = Array.isArray(marketplaces) ? marketplaces : [];
        } catch (error) {
            console.error('Ошибка загрузки маркетплейсов:', error);
            this.marketplaceOptions = [];
        } finally {
            this.renderMarketplaceOptions();
            select.disabled = false;
        }
    }

    renderMarketplaceOptions() {
        const select = this.elements.marketplace;
        if (!select) {
            return;
        }

        const currentValue = this.state.marketplace || '';
        select.innerHTML = '';

        const defaultOption = document.createElement('option');
        defaultOption.value = '';
        defaultOption.textContent = 'Все маркетплейсы';
        select.appendChild(defaultOption);

        this.marketplaceOptions.forEach((marketplace) => {
            if (!marketplace) {
                return;
            }

            const option = document.createElement('option');
            option.value = marketplace;
            option.textContent = marketplace;
            select.appendChild(option);
        });

        select.value = currentValue;
    }

    async loadCities() {
        const container = this.elements.originTabs;
        if (!container) {
            return;
        }

        container.classList.remove('is-hidden');
        container.innerHTML = '';

        const placeholder = document.createElement('span');
        placeholder.className = 'schedule-origin-placeholder';
        placeholder.textContent = 'Загрузка городов...';
        container.appendChild(placeholder);

        try {
            const cities = await fetchCities({ marketplace: this.state.marketplace, baseUrl: '../filter_options.php' });
            this.cityOptions = Array.isArray(cities)
                ? cities.filter((city) => typeof city === 'string' && city.trim().length > 0)
                : [];
        } catch (error) {
            console.error('Ошибка загрузки городов:', error);
            this.cityOptions = [];
        }

        if (this.state.city && !this.cityOptions.includes(this.state.city)) {
            this.state.city = '';
        }

        this.renderOriginTabs();
    }

    renderOriginTabs() {
        const container = this.elements.originTabs;
        if (!container) {
            return;
        }

        container.innerHTML = '';

        if (!this.cityOptions || this.cityOptions.length === 0) {
            container.classList.add('is-hidden');
            container.setAttribute('aria-hidden', 'true');
            return;
        }

        container.classList.remove('is-hidden');
        container.removeAttribute('aria-hidden');

        const fragment = document.createDocumentFragment();
        fragment.appendChild(this.createOriginTab('', 'Все города отправления'));

        this.cityOptions.forEach((city) => {
            fragment.appendChild(this.createOriginTab(city, city));
        });

        container.appendChild(fragment);
        this.updateActiveOriginTab();
    }

    createOriginTab(value, label) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'schedule-origin-tab';
        button.dataset.origin = value || '';
        button.textContent = label;
        button.setAttribute('role', 'tab');
        button.setAttribute('aria-selected', 'false');
        return button;
    }

    updateActiveOriginTab() {
        const container = this.elements.originTabs;
        if (!container) {
            return;
        }

        const activeValue = this.state.city || '';
        const tabs = container.querySelectorAll('.schedule-origin-tab');

        tabs.forEach((tab) => {
            const tabValue = tab.dataset.origin || '';
            const isActive = tabValue === activeValue;
            tab.classList.toggle('is-active', isActive);
            tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
        });
    }

    handleOriginTabClick(event) {
        const target = event.target;
        if (!(target instanceof HTMLElement)) {
            return;
        }

        const button = target.closest('.schedule-origin-tab');
        if (!button) {
            return;
        }

        const value = button.dataset.origin || '';
        if (value === (this.state.city || '')) {
            return;
        }

        this.state.city = value;
        this.updateActiveOriginTab();
        this.loadSchedules();
    }

    handleTimelineClick(event) {
        const target = event.target;
        if (!(target instanceof HTMLElement)) {
            return;
        }

        const button = target.closest('.schedule-shipment');
        if (!button) {
            return;
        }

        const scheduleId = button.dataset.scheduleId || '';
        const entry = this.scheduleLookup.get(scheduleId);
        if (!entry) {
            return;
        }

        event.preventDefault();
        this.openScheduleDetails(entry);
    }

    async loadSchedules() {
        if (!this.elements.grid) {
            return;
        }

        const cacheKey = JSON.stringify({
            marketplace: this.state.marketplace || '',
            city: this.state.city || ''
        });

        const cached = this.scheduleCache.get(cacheKey);
        if (cached) {
            this.updateSchedules(cached);
            this.errorMessage = '';
            this.isLoading = false;
            this.renderWeek();
            return;
        }

        if (this.activeRequestController) {
            this.activeRequestController.abort();
        }

        const controller = new AbortController();
        this.activeRequestController = controller;
        this.errorMessage = '';
        this.isLoading = true;
        this.renderWeek();

        try {
            const data = await this.fetchSchedules(controller.signal);
            this.scheduleCache.set(cacheKey, data);
            this.updateSchedules(data);
        } catch (error) {
            if (error.name === 'AbortError') {
                return;
            }

            console.error('Ошибка загрузки расписания:', error);
            this.errorMessage = 'Не удалось загрузить расписание. Попробуйте позже.';
            this.originalSchedules = [];
            this.enrichedSchedules = [];
            this.scheduleLookup.clear();

            if (window.app && typeof window.app.showError === 'function') {
                window.app.showError('Не удалось загрузить расписание');
            }
        } finally {
            if (this.activeRequestController === controller) {
                this.activeRequestController = null;
            }

            this.isLoading = false;
            this.renderWeek();
        }
    }

    async fetchSchedules(signal) {
        const params = new URLSearchParams();
        if (this.state.marketplace) {
            params.set('marketplace', this.state.marketplace);
        }
        if (this.state.city) {
            params.set('city', this.state.city);
        }

        const query = params.toString();
        const response = await fetch(`../fetch_schedule.php${query ? `?${query}` : ''}`, {
            credentials: 'include',
            signal
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const contentType = (response.headers.get('content-type') || '').toLowerCase();
        if (contentType.includes('application/json')) {
            const payload = await response.json();
            return Array.isArray(payload) ? payload : [];
        }

        const textPayload = await response.text();
        try {
            const parsed = JSON.parse(textPayload);
            return Array.isArray(parsed) ? parsed : [];
        } catch (parseError) {
            throw new Error('Некорректный формат ответа сервера');
        }
    }

    updateSchedules(schedules) {
        this.originalSchedules = Array.isArray(schedules) ? schedules : [];
        this.enrichedSchedules = this.prepareSchedules(this.originalSchedules);
        this.scheduleLookup = new Map(
            this.enrichedSchedules.map((entry) => [entry.id, entry])
        );
    }

    prepareSchedules(schedules) {
        if (!Array.isArray(schedules)) {
            return [];
        }

        return schedules
            .map((schedule, index) => {
                const details = this.normalizeSchedule(schedule);
                const acceptDate = this.parseDate(details.acceptDate);
                const id = this.computeScheduleId(schedule, index);
                const dateKey = acceptDate ? this.formatDateKey(acceptDate) : '';
                return {
                    id,
                    raw: schedule,
                    details,
                    acceptDate,
                    dateKey,
                    timeValue: this.parseTime(details.acceptTime)
                };
            })
            .filter((entry) => Boolean(entry.dateKey));
    }

    computeScheduleId(schedule, index) {
        const candidates = ['id', 'schedule_id', 'scheduleId'];
        for (const key of candidates) {
            const value = schedule && schedule[key];
            if (value === undefined || value === null) {
                continue;
            }
            const str = String(value).trim();
            if (str) {
                return str;
            }
        }

        return `schedule_${Date.now()}_${index}_${Math.random().toString(36).slice(2, 7)}`;
    }

    normalizeSchedule(schedule) {
        const getValue = (keys) => {
            for (const key of keys) {
                if (!key || !schedule || !(key in schedule)) {
                    continue;
                }
                const raw = schedule[key];
                if (raw === undefined || raw === null) {
                    continue;
                }
                if (typeof raw === 'string') {
                    const trimmed = raw.trim();
                    if (trimmed) {
                        return trimmed;
                    }
                } else if (typeof raw === 'number') {
                    return String(raw);
                }
            }
            return '';
        };

        return {
            id: getValue(['id', 'schedule_id', 'scheduleId']),
            marketplace: getValue(['marketplace']),
            city: getValue(['city', 'city_name', 'route_city']),
            warehouse: getValue(['warehouses', 'warehouse', 'route_warehouse']),
            acceptDate: getValue(['accept_date', 'acceptDate', 'departure_date', 'departureDate']),
            deliveryDate: getValue(['delivery_date', 'deliveryDate']),
            acceptTime: getValue(['accept_time', 'acceptTime']),
            status: getValue(['status']),
            driverName: getValue(['driver_name', 'driverName']),
            driverPhone: getValue(['driver_phone', 'driverPhone']),
            carNumber: getValue(['car_number', 'carNumber']),
            carBrand: getValue(['car_brand', 'carBrand']),
            sender: getValue(['sender', 'company_name'])
        };
    }

    parseDate(value) {
        if (!value) {
            return null;
        }

        if (value instanceof Date) {
            return new Date(value.getTime());
        }

        if (typeof value === 'number') {
            const dateFromNumber = new Date(value);
            return Number.isNaN(dateFromNumber.getTime()) ? null : dateFromNumber;
        }

        const stringValue = String(value).trim();
        if (!stringValue) {
            return null;
        }

        const dotMatch = stringValue.match(/^(\d{2})\.(\d{2})\.(\d{4})/);
        if (dotMatch) {
            const [, day, month, year] = dotMatch;
            const parsed = new Date(Number(year), Number(month) - 1, Number(day));
            return Number.isNaN(parsed.getTime()) ? null : parsed;
        }

        const normalized = stringValue.includes('T') ? stringValue : stringValue.replace(' ', 'T');
        const isoCandidate = normalized.length <= 10 ? `${normalized}T00:00:00` : normalized;
        const date = new Date(isoCandidate);
        return Number.isNaN(date.getTime()) ? null : date;
    }

    parseTime(value) {
        if (!value) {
            return Number.POSITIVE_INFINITY;
        }

        const match = String(value).match(/(\d{1,2}):(\d{2})/);
        if (!match) {
            return Number.POSITIVE_INFINITY;
        }

        const hours = Number(match[1]);
        const minutes = Number(match[2]);
        if (Number.isNaN(hours) || Number.isNaN(minutes)) {
            return Number.POSITIVE_INFINITY;
        }

        return hours * 60 + minutes;
    }

    formatDateKey(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    formatDate(value) {
        const date = this.parseDate(value);
        if (!date) {
            return '—';
        }

        return date.toLocaleDateString('ru-RU', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    }

    formatShortDate(date) {
        return date.toLocaleDateString('ru-RU', {
            day: '2-digit',
            month: '2-digit'
        });
    }

    formatWeekday(date) {
        const raw = date.toLocaleDateString('ru-RU', { weekday: 'long' });
        return raw.charAt(0).toUpperCase() + raw.slice(1);
    }

    getWeekDays() {
        const days = [];
        for (let index = 0; index < 6; index += 1) {
            const day = new Date(this.state.weekStart);
            day.setDate(day.getDate() + index);
            days.push(day);
        }
        return days;
    }

    getSchedulesForDay(dateKey) {
        return this.enrichedSchedules
            .filter((entry) => entry.dateKey === dateKey)
            .sort((a, b) => {
                if (a.timeValue !== b.timeValue) {
                    return a.timeValue - b.timeValue;
                }

                const first = a.details.warehouse || '';
                const second = b.details.warehouse || '';
                return first.localeCompare(second, 'ru', { sensitivity: 'base' });
            });
    }

    renderWeekRange() {
        const range = this.elements.range;
        if (!range) {
            return;
        }

        const start = this.state.weekStart;
        const end = new Date(this.state.weekStart);
        end.setDate(end.getDate() + 5);
        range.textContent = `${this.formatShortDate(start)} – ${this.formatShortDate(end)}`;
    }

    renderWeek() {
        this.renderWeekRange();

        if (!this.elements.grid) {
            return;
        }

        if (this.isLoading) {
            this.renderLoadingState();
            return;
        }

        if (this.errorMessage) {
            this.renderErrorState(this.errorMessage);
            return;
        }

        this.renderTimeline();
    }

    renderLoadingState() {
        const grid = this.elements.grid;
        if (!grid) {
            return;
        }

        const container = document.createElement('div');
        container.className = 'schedule-loading';

        const spinner = document.createElement('div');
        spinner.className = 'schedule-spinner';
        container.appendChild(spinner);

        const text = document.createElement('span');
        text.textContent = 'Загружаем расписание...';
        container.appendChild(text);

        grid.innerHTML = '';
        grid.appendChild(container);
    }

    renderErrorState(message) {
        const grid = this.elements.grid;
        if (!grid) {
            return;
        }

        const container = document.createElement('div');
        container.className = 'schedule-empty';

        const icon = document.createElement('i');
        icon.className = 'fas fa-exclamation-circle';
        container.appendChild(icon);

        const title = document.createElement('h3');
        title.textContent = 'Ошибка загрузки';
        container.appendChild(title);

        const description = document.createElement('p');
        description.textContent = message;
        container.appendChild(description);

        grid.innerHTML = '';
        grid.appendChild(container);
    }

    renderTimeline() {
        const grid = this.elements.grid;
        if (!grid) {
            return;
        }

        const days = this.getWeekDays();
        const fragment = document.createDocumentFragment();

        days.forEach((day) => {
            fragment.appendChild(this.createDayColumn(day));
        });

        grid.innerHTML = '';
        grid.appendChild(fragment);
    }

    createDayColumn(date) {
        const wrapper = document.createElement('article');
        wrapper.className = 'schedule-day';

        const header = document.createElement('header');
        header.className = 'schedule-day__header';

        const weekday = document.createElement('span');
        weekday.className = 'schedule-day__weekday';
        weekday.textContent = this.formatWeekday(date);
        header.appendChild(weekday);

        const dateLabel = document.createElement('span');
        dateLabel.className = 'schedule-day__date';
        dateLabel.textContent = date.toLocaleDateString('ru-RU', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
        header.appendChild(dateLabel);

        wrapper.appendChild(header);

        const list = document.createElement('div');
        list.className = 'schedule-day__list';

        const dateKey = this.formatDateKey(date);
        const schedules = this.getSchedulesForDay(dateKey);

        if (schedules.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'schedule-day__empty';
            empty.textContent = 'Нет отправлений';
            list.appendChild(empty);
        } else {
            schedules.forEach((entry) => {
                list.appendChild(this.createShipmentElement(entry));
            });
        }

        wrapper.appendChild(list);
        return wrapper;
    }

    createShipmentElement(entry) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'schedule-shipment';
        button.dataset.scheduleId = entry.id;

        const { details } = entry;

        const header = document.createElement('div');
        header.className = 'schedule-shipment__header';

        const destination = document.createElement('span');
        destination.className = 'schedule-shipment__destination';
        destination.textContent = details.warehouse || 'Склад не указан';
        header.appendChild(destination);

        const badgeText = this.getMarketplaceBadge(details.marketplace);
        if (badgeText) {
            const badge = document.createElement('span');
            const badgeClass = this.getMarketplaceBadgeClass(details.marketplace);
            badge.className = `schedule-shipment__badge${badgeClass ? ` ${badgeClass}` : ''}`;
            badge.textContent = badgeText;
            header.appendChild(badge);
        }

        button.appendChild(header);

        if (details.city) {
            const route = document.createElement('div');
            route.className = 'schedule-shipment__route';
            route.textContent = `${details.city} → ${details.warehouse || '—'}`;
            button.appendChild(route);
        }

        const meta = document.createElement('div');
        meta.className = 'schedule-shipment__meta';

        if (details.status) {
            const status = document.createElement('span');
            const statusClass = this.getStatusClass(details.status);
            status.className = `schedule-shipment__status${statusClass ? ` ${statusClass}` : ''}`;
            status.textContent = details.status;
            meta.appendChild(status);
        }

        if (details.acceptTime) {
            const accept = document.createElement('span');
            accept.className = 'schedule-shipment__chip';
            accept.textContent = `Приём: ${details.acceptTime}`;
            meta.appendChild(accept);
        }

        if (details.deliveryDate) {
            const delivery = document.createElement('span');
            delivery.className = 'schedule-shipment__chip';
            delivery.textContent = `Сдача: ${this.formatDate(details.deliveryDate)}`;
            meta.appendChild(delivery);
        }

        if (meta.childNodes.length > 0) {
            button.appendChild(meta);
        }

        const footer = document.createElement('div');
        footer.className = 'schedule-shipment__footer';

        const action = document.createElement('span');
        action.className = 'schedule-shipment__action';
        action.textContent = 'Оформить заявку';
        footer.appendChild(action);

        button.appendChild(footer);
        return button;
    }

    getMarketplaceBadge(marketplace) {
        if (!marketplace) {
            return '';
        }

        const normalized = marketplace.toLowerCase();
        if (normalized.includes('wildberries')) {
            return 'WB';
        }
        if (normalized.includes('ozon')) {
            return 'OZ';
        }
        if (normalized.includes('yandex') || normalized.includes('market')) {
            return 'YM';
        }
        return marketplace.length > 3 ? marketplace.slice(0, 3).toUpperCase() : marketplace;
    }

    getMarketplaceBadgeClass(marketplace) {
        if (!marketplace) {
            return '';
        }

        const normalized = marketplace.toLowerCase();
        if (normalized.includes('wildberries')) {
            return 'badge-wb';
        }
        if (normalized.includes('ozon')) {
            return 'badge-ozon';
        }
        if (normalized.includes('yandex') || normalized.includes('market')) {
            return 'badge-ym';
        }
        return '';
    }

    getStatusClass(status) {
        if (!status) {
            return 'status-unknown';
        }

        const map = new Map([
            ['приём заявок', 'status-open'],
            ['ожидает отправки', 'status-waiting'],
            ['в пути', 'status-transit'],
            ['завершено', 'status-completed']
        ]);

        const normalized = status.toLowerCase();
        return map.get(normalized) || 'status-unknown';
    }

    openScheduleDetails(entry) {
        const modal = document.getElementById('scheduleDetailsModal');
        const content = document.getElementById('scheduleDetailsContent');

        if (!modal || !content) {
            this.createOrder(entry.raw);
            return;
        }

        content.innerHTML = '';

        const container = document.createElement('div');
        container.className = 'schedule-modal';

        const grid = document.createElement('div');
        grid.className = 'schedule-modal__grid';

        const pushItem = (label, value) => {
            if (!value || String(value).trim().length === 0) {
                return;
            }
            const item = document.createElement('div');
            item.className = 'schedule-modal__item';

            const title = document.createElement('span');
            title.className = 'schedule-modal__label';
            title.textContent = label;
            item.appendChild(title);

            const val = document.createElement('span');
            val.className = 'schedule-modal__value';
            val.textContent = value;
            item.appendChild(val);

            grid.appendChild(item);
        };

        const { details } = entry;

        pushItem('Маркетплейс', details.marketplace);
        pushItem('Город отправления', details.city);
        pushItem('Склад/направление', details.warehouse);
        pushItem('Дата отправления', this.formatDate(details.acceptDate));
        pushItem('Время приёма', details.acceptTime);
        pushItem('Сдача на склад', this.formatDate(details.deliveryDate));
        pushItem('Статус', details.status);
        pushItem('Водитель', details.driverName);
        pushItem('Телефон водителя', details.driverPhone);
        pushItem('Транспорт', [details.carBrand, details.carNumber].filter(Boolean).join(' ').trim());
        pushItem('Отправитель', details.sender);

        container.appendChild(grid);

        const actions = document.createElement('div');
        actions.className = 'schedule-modal__actions';

        const createOrderBtn = document.createElement('button');
        createOrderBtn.type = 'button';
        createOrderBtn.className = 'create-order-btn';
        createOrderBtn.textContent = 'Создать заявку';
        createOrderBtn.addEventListener('click', () => {
            this.createOrder(entry.raw);
        });

        actions.appendChild(createOrderBtn);
        container.appendChild(actions);

        content.appendChild(container);

        if (window.app && typeof window.app.openModal === 'function') {
            window.app.openModal(modal);
        } else {
            modal.classList.add('active');
        }
    }

    createOrder(schedule) {
        const detailsModal = document.getElementById('scheduleDetailsModal');
        if (detailsModal && window.app && typeof window.app.closeModal === 'function') {
            window.app.closeModal(detailsModal);
        }

        if (typeof window.openClientRequestFormModal === 'function') {
            window.openClientRequestFormModal(schedule);
            return;
        }

        if (typeof window.openRequestFormModal === 'function') {
            window.openRequestFormModal(schedule, '', '', '', {
                modalId: 'clientRequestModal',
                contentId: 'clientRequestModalContent'
            });
            return;
        }

        console.error('Форма заявки недоступна');
        if (window.app && typeof window.app.showError === 'function') {
            window.app.showError('Не удалось открыть форму заявки');
        }
    }

    resetFilters() {
        this.state.marketplace = '';
        this.state.city = '';
        this.state.weekStart = this.getMonday(new Date());

        if (this.elements.marketplace) {
            this.elements.marketplace.value = '';
        }

        this.scheduleCache.clear();
        this.renderWeekRange();
        this.loadCities();
        this.loadSchedules();
    }
}

window.ScheduleTimeline = ScheduleTimeline;

document.addEventListener('DOMContentLoaded', () => {
    window.ScheduleManager = new ScheduleTimeline();
});
