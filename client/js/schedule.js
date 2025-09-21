import { fetchMarketplaces, fetchCities } from './filterOptions.js';

const DEFAULT_CITY = 'Махачкала';

class ScheduleController {
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
            marketplace: 'Wildberries',
            city: DEFAULT_CITY,
            weekStart: this.getMonday(new Date())
        };

        this.marketplaces = [];
        this.cities = [];
        this.scheduleItems = [];
        this.schedulesByDate = new Map();
        this.abortController = null;
        this.isLoading = false;
        this.errorMessage = '';

        this.handleOriginTabClick = this.handleOriginTabClick.bind(this);

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
        const { marketplace, originTabs, prev, next } = this.elements;

        if (marketplace) {
            marketplace.addEventListener('change', (event) => {
                this.state.marketplace = (event.target.value || '').trim();
                this.state.city = DEFAULT_CITY;
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
            this.marketplaces = Array.isArray(marketplaces)
                ? marketplaces
                    .map((value) => (typeof value === 'string' ? value.trim() : ''))
                    .filter((value) => value.length > 0)
                : [];
        } catch (error) {
            console.error('Ошибка загрузки маркетплейсов:', error);
            this.marketplaces = [];
        } finally {
            this.renderMarketplaceOptions();
            select.disabled = false;
        }
    }

    getSortedMarketplaces() {
        return this.marketplaces
            .slice()
            .sort((first, second) => first.localeCompare(second, 'ru', { sensitivity: 'base' }));
    }

    resolveMarketplaceSelection({ currentValue = '', preferWildberries = false, marketplaces = [] } = {}) {
        if (!Array.isArray(marketplaces) || marketplaces.length === 0) {
            return '';
        }

        const normalizedCurrent = (currentValue || '').toLowerCase();
        if (normalizedCurrent) {
            const currentMatch = marketplaces.find(
                (marketplace) => marketplace.toLowerCase() === normalizedCurrent
            );
            if (currentMatch) {
                return currentMatch;
            }
        }

        if (preferWildberries) {
            const wildberriesMatch = marketplaces.find(
                (marketplace) => marketplace.toLowerCase() === 'wildberries'
            );
            if (wildberriesMatch) {
                return wildberriesMatch;
            }
        }

        return marketplaces[0];
    }

    renderMarketplaceOptions() {
        const select = this.elements.marketplace;
        if (!select) {
            return;
        }

        const previousValue = this.state.marketplace || '';
        const marketplaces = this.getSortedMarketplaces();

        select.innerHTML = '';

        marketplaces.forEach((marketplace) => {
            const option = document.createElement('option');
            option.value = marketplace;
            option.textContent = marketplace;
            select.appendChild(option);
        });

        const preferWildberries =
            !previousValue || previousValue.toLowerCase() === 'wildberries';
        const nextValue = this.resolveMarketplaceSelection({
            currentValue: previousValue,
            preferWildberries,
            marketplaces
        });

        if (nextValue) {
            select.value = nextValue;
        } else {
            select.value = '';
        }

        const normalizedPrevious = previousValue ? previousValue.toLowerCase() : '';
        const normalizedNext = nextValue ? nextValue.toLowerCase() : '';

        this.state.marketplace = nextValue || '';

        if (normalizedNext !== normalizedPrevious) {
            this.state.city = DEFAULT_CITY;
            this.renderWeekRange();
            this.loadCities();
            this.loadSchedules();
        }
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
            const cities = await fetchCities({
                marketplace: this.state.marketplace,
                baseUrl: '../filter_options.php'
            });

            this.cities = Array.isArray(cities)
                ? cities
                    .map((city) => (typeof city === 'string' ? city.trim() : ''))
                    .filter((city) => city.length > 0)
                : [];
        } catch (error) {
            console.error('Ошибка загрузки городов:', error);
            this.cities = [];
        }

        const previousCity = this.state.city;
        const defaultCityIndex = this.cities.findIndex(
            (city) => city.toLowerCase() === DEFAULT_CITY.toLowerCase()
        );

        if (defaultCityIndex >= 0) {
            this.state.city = this.cities[defaultCityIndex];
        } else if (this.cities.length > 0) {
            this.state.city = this.cities[0];
        } else {
            this.state.city = '';
        }

        this.renderOriginTabs();

        if (previousCity !== this.state.city) {
            this.loadSchedules();
        }
    }

    renderOriginTabs() {
        const container = this.elements.originTabs;
        if (!container) {
            return;
        }

        container.innerHTML = '';

        if (!this.cities.length) {
            container.classList.add('is-hidden');
            container.setAttribute('aria-hidden', 'true');
            return;
        }

        container.classList.remove('is-hidden');
        container.removeAttribute('aria-hidden');

        const fragment = document.createDocumentFragment();

        this.cities
            .slice()
            .sort((first, second) => first.localeCompare(second, 'ru', { sensitivity: 'base' }))
            .forEach((city) => {
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

    async loadSchedules() {
        if (!this.elements.grid) {
            return;
        }

        if (this.abortController) {
            this.abortController.abort();
        }

        const controller = new AbortController();
        this.abortController = controller;
        this.errorMessage = '';
        this.isLoading = true;
        this.renderWeek();

        try {
            const payload = await this.fetchSchedules(controller.signal);
            this.processSchedules(Array.isArray(payload) ? payload : []);
        } catch (error) {
            if (error.name === 'AbortError') {
                return;
            }

            console.error('Ошибка загрузки расписания:', error);
            this.processSchedules([]);
            this.errorMessage = 'Не удалось загрузить расписание. Попробуйте позже.';

            if (window.app && typeof window.app.showError === 'function') {
                window.app.showError('Не удалось загрузить расписание');
            }
        } finally {
            if (this.abortController === controller) {
                this.abortController = null;
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
            return response.json();
        }

        const textPayload = await response.text();
        try {
            return JSON.parse(textPayload);
        } catch (parseError) {
            throw new Error('Некорректный формат ответа сервера');
        }
    }

    processSchedules(schedules) {
        this.scheduleItems = [];
        this.schedulesByDate = new Map();

        schedules.forEach((schedule, index) => {
            const entry = this.normalizeSchedule(schedule, index);
            if (!entry) {
                return;
            }

            this.scheduleItems.push(entry);
            if (!this.schedulesByDate.has(entry.dateKey)) {
                this.schedulesByDate.set(entry.dateKey, []);
            }
            this.schedulesByDate.get(entry.dateKey).push(entry);
        });

        this.schedulesByDate.forEach((entries) => {
            entries.sort((a, b) => {
                if (a.timeValue !== b.timeValue) {
                    return a.timeValue - b.timeValue;
                }

                return (a.warehouse || '').localeCompare(b.warehouse || '', 'ru', { sensitivity: 'base' });
            });
        });
    }

    normalizeSchedule(schedule, index) {
        if (!schedule || typeof schedule !== 'object') {
            return null;
        }

        const getValue = (keys) => {
            for (const key of keys) {
                if (!key || !(key in schedule)) {
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

        const id = getValue(['id', 'schedule_id', 'scheduleId'])
            || `schedule_${Date.now()}_${index}_${Math.random().toString(36).slice(2, 7)}`;
        const marketplace = getValue(['marketplace']);
        const city = getValue(['city', 'city_name', 'route_city']);
        const warehouse = getValue(['warehouses', 'warehouse', 'route_warehouse', 'warehouse_name']);
        const acceptDateRaw = getValue(['accept_date', 'acceptDate', 'departure_date', 'departureDate']);
        const acceptTimeRaw = getValue(['accept_time', 'acceptTime', 'accept_time_from']);
        const deliveryDateRaw = getValue(['delivery_date', 'deliveryDate']);
        const status = getValue(['status']);
        const driverName = getValue(['driver_name', 'driverName']);
        const driverPhone = getValue(['driver_phone', 'driverPhone', 'driver_contact']);
        const carBrand = getValue(['car_brand', 'carBrand']);
        const carNumber = getValue(['car_number', 'carNumber']);
        const sender = getValue(['sender', 'sender_name']);
        const comment = getValue(['comment', 'comments', 'note']);

        const acceptDate = this.parseDate(acceptDateRaw);
        if (!acceptDate) {
            return null;
        }

        const { display: acceptTimeLabel, value: timeValue } = this.parseTime(acceptTimeRaw);

        const entry = {
            id,
            raw: { ...schedule },
            marketplace,
            city,
            warehouse,
            warehouses: warehouse,
            acceptDate,
            acceptDateRaw,
            acceptTimeRaw,
            acceptTimeLabel,
            timeValue,
            deliveryDateRaw,
            status,
            driverName,
            driverPhone,
            carBrand,
            carNumber,
            sender,
            comment
        };

        entry.dateKey = this.formatDateKey(acceptDate);
        entry.requestPayload = this.buildRequestPayload(entry);
        return entry;
    }

    buildRequestPayload(entry) {
        const payload = { ...entry.raw };
        payload.id = entry.id;
        payload.marketplace = entry.marketplace;
        payload.city = entry.city;
        payload.route_city = entry.city;
        payload.warehouse = entry.warehouse;
        payload.warehouses = entry.warehouse;
        payload.route_warehouse = entry.warehouse;
        payload.accept_date = entry.acceptDateRaw;
        payload.acceptDate = entry.acceptDateRaw;
        payload.accept_time = entry.acceptTimeRaw;
        payload.acceptTime = entry.acceptTimeRaw;
        payload.delivery_date = entry.deliveryDateRaw;
        payload.deliveryDate = entry.deliveryDateRaw;
        payload.status = entry.status;
        payload.driver_name = entry.driverName;
        payload.driverName = entry.driverName;
        payload.driver_phone = entry.driverPhone;
        payload.driverPhone = entry.driverPhone;
        payload.car_brand = entry.carBrand;
        payload.carBrand = entry.carBrand;
        payload.car_number = entry.carNumber;
        payload.carNumber = entry.carNumber;
        payload.sender = entry.sender;
        payload.comment = entry.comment;
        return payload;
    }

    parseDate(value) {
        if (!value) {
            return null;
        }

        if (value instanceof Date && !Number.isNaN(value.getTime())) {
            const clone = new Date(value);
            clone.setHours(0, 0, 0, 0);
            return clone;
        }

        if (typeof value === 'number' && Number.isFinite(value)) {
            const date = new Date(value);
            if (!Number.isNaN(date.getTime())) {
                date.setHours(0, 0, 0, 0);
                return date;
            }
        }

        const stringValue = String(value).trim();
        if (!stringValue) {
            return null;
        }

        const isoMatch = stringValue.match(/^(\d{4})[-/](\d{2})[-/](\d{2})$/);
        if (isoMatch) {
            const year = Number(isoMatch[1]);
            const month = Number(isoMatch[2]) - 1;
            const day = Number(isoMatch[3]);
            const date = new Date(year, month, day);
            if (!Number.isNaN(date.getTime())) {
                date.setHours(0, 0, 0, 0);
                return date;
            }
        }

        const ruMatch = stringValue.match(/^(\d{1,2})[.](\d{1,2})[.](\d{2,4})$/);
        if (ruMatch) {
            const day = Number(ruMatch[1]);
            const month = Number(ruMatch[2]) - 1;
            let year = Number(ruMatch[3]);
            if (year < 100) {
                year += 2000;
            }
            const date = new Date(year, month, day);
            if (!Number.isNaN(date.getTime())) {
                date.setHours(0, 0, 0, 0);
                return date;
            }
        }

        const parsed = new Date(stringValue);
        if (!Number.isNaN(parsed.getTime())) {
            parsed.setHours(0, 0, 0, 0);
            return parsed;
        }

        return null;
    }

    parseTime(value) {
        if (!value) {
            return { display: '', value: Number.MAX_SAFE_INTEGER };
        }

        const stringValue = String(value).trim();
        if (!stringValue) {
            return { display: '', value: Number.MAX_SAFE_INTEGER };
        }

        const match = stringValue.match(/(\d{1,2}):(\d{2})/);
        if (match) {
            const hours = Number(match[1]);
            const minutes = Number(match[2]);
            const normalized = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
            return { display: normalized, value: hours * 60 + minutes };
        }

        return { display: stringValue, value: Number.MAX_SAFE_INTEGER };
    }

    formatDateKey(date) {
        const year = date.getFullYear();
        const month = `${date.getMonth() + 1}`.padStart(2, '0');
        const day = `${date.getDate()}`.padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    formatDate(date) {
        if (!date) {
            return '';
        }

        if (typeof date === 'string') {
            const parsed = this.parseDate(date);
            if (parsed) {
                return this.formatDate(parsed);
            }
            return date;
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
        return this.schedulesByDate.get(dateKey) || [];
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

        const grid = this.elements.grid;
        if (!grid) {
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

        if (!schedules.length) {
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

        const header = document.createElement('div');
        header.className = 'schedule-shipment__header';

        const destination = document.createElement('span');
        destination.className = 'schedule-shipment__destination';

        const warehouseName =
            typeof entry.warehouse === 'string' && entry.warehouse.trim().length > 0
                ? entry.warehouse.trim()
                : 'Склад не указан';

        const shouldShorten = warehouseName.length > 25 || warehouseName.includes(' - ');

        if (shouldShorten) {
            const parts = warehouseName.split(' - ');

            if (parts.length > 1) {
                const [firstPart, secondPart = '', ...restParts] = parts;
                const words = secondPart.trim().split(/\s+/).filter(Boolean);

                if (words.length > 0) {
                    const [firstWord, ...otherWords] = words;
                    const abbreviatedSecondPart = [
                        `${firstWord.charAt(0)}.`,
                        ...otherWords
                    ]
                        .join(' ')
                        .trim();

                    const restTail = restParts.length ? ` - ${restParts.join(' - ')}` : '';
                    destination.textContent = `${firstPart} - ${abbreviatedSecondPart}${restTail}`.trim();
                } else {
                    destination.textContent = warehouseName;
                }
            } else {
                destination.textContent = warehouseName;
            }

            destination.classList.add('schedule-shipment__destination--long');
        } else {
            destination.textContent = warehouseName;
        }
        header.appendChild(destination);

        const badgeText = this.getMarketplaceBadge(entry.marketplace);
        if (badgeText) {
            const badge = document.createElement('span');
            const badgeClass = this.getMarketplaceBadgeClass(entry.marketplace);
            badge.className = `schedule-shipment__badge${badgeClass ? ` ${badgeClass}` : ''}`;
            badge.textContent = badgeText;
            header.appendChild(badge);
        }

        button.appendChild(header);

        const meta = document.createElement('div');
        meta.className = 'schedule-shipment__meta';

        if (entry.status) {
            const status = document.createElement('span');
            const statusClass = this.getStatusClass(entry.status);
            status.className = `schedule-shipment__status${statusClass ? ` ${statusClass}` : ''}`;
            status.textContent = entry.status;
            meta.appendChild(status);
        }

        if (entry.acceptTimeLabel) {
            const accept = document.createElement('span');
            accept.className = 'schedule-shipment__chip';
            accept.textContent = `Приём: ${entry.acceptTimeLabel}`;
            meta.appendChild(accept);
        }

        if (entry.deliveryDateRaw) {
            const delivery = document.createElement('span');
            delivery.className = 'schedule-shipment__chip';
            delivery.textContent = `Сдача: ${this.formatDate(entry.deliveryDateRaw)}`;
            meta.appendChild(delivery);
        }

        if (meta.childNodes.length > 0) {
            button.appendChild(meta);
        }

        button.addEventListener('click', () => {
            this.openRequestForm(entry);
        });

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

    openRequestForm(entry) {
        const payload = entry && entry.requestPayload;
        if (!payload) {
            return;
        }

        if (typeof window.openRequestFormModal === 'function') {
            window.openRequestFormModal(payload, '', '', '', {
                modalId: 'clientRequestModal',
                contentId: 'clientRequestModalContent'
            });
            return;
        }

        if (typeof window.openClientRequestFormModal === 'function') {
            window.openClientRequestFormModal(payload);
            return;
        }

        console.error('Форма заявки недоступна');
        if (window.app && typeof window.app.showError === 'function') {
            window.app.showError('Не удалось открыть форму заявки');
        }
    }

    resetFilters() {
        this.state.marketplace = 'Wildberries';
        this.state.city = '';
        this.state.weekStart = this.getMonday(new Date());

        const marketplaces = this.getSortedMarketplaces();
        const resolvedMarketplace = this.resolveMarketplaceSelection({
            currentValue: this.state.marketplace,
            preferWildberries: true,
            marketplaces
        });
        const nextMarketplace = resolvedMarketplace || this.state.marketplace;

        this.state.marketplace = nextMarketplace;

        if (this.elements.marketplace) {
            if (nextMarketplace && marketplaces.includes(nextMarketplace)) {
                this.elements.marketplace.value = nextMarketplace;
            } else {
                this.elements.marketplace.value = '';
            }
        }

        this.renderWeekRange();
        this.loadCities();
        this.loadSchedules();
    }
}

window.ScheduleController = ScheduleController;

document.addEventListener('DOMContentLoaded', () => {
    window.scheduleController = new ScheduleController();
});
