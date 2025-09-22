import { fetchMarketplaces, fetchCities } from './filterOptions.js';

const DEFAULT_CITY = 'Махачкала';
const MOBILE_BREAKPOINT = 900;
const MOBILE_MEDIA_QUERY = `(max-width: ${MOBILE_BREAKPOINT}px)`;
const WEEKDAY_SHORT_LABELS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];

class ScheduleController {
    constructor() {
        this.elements = {
            panel: document.getElementById('schedulePanel'),
            marketplace: document.getElementById('marketplace'),
            originTabs: document.getElementById('originTabs'),
            grid: document.getElementById('grid'),
            prev: document.getElementById('prev'),
            next: document.getElementById('next'),
            range: document.getElementById('range'),
            daySwitcher: null
        };

        this.state = {
            marketplace: 'Wildberries',
            city: DEFAULT_CITY,
            weekStart: this.getMonday(new Date()),
            selectedDayKey: '',
            isMobile: false
        };

        this.mediaQuery = null;

        this.marketplaces = [];
        this.cities = [];
        this.scheduleItems = [];
        this.schedulesByDate = new Map();
        this.abortController = null;
        this.isLoading = false;
        this.errorMessage = '';

        this.handleOriginTabClick = this.handleOriginTabClick.bind(this);
        this.handleDaySwitcherClick = this.handleDaySwitcherClick.bind(this);
        this.handleMediaQueryChange = this.handleMediaQueryChange.bind(this);
        this.handleResize = this.handleResize.bind(this);

        this.state.selectedDayKey = this.resolveSelectedDayKey();

        this.init();
    }

    init() {
        if (!this.elements.panel || !this.elements.grid) {
            return;
        }

        this.setupDaySwitcher();
        this.setupResponsiveBehavior();

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

    setupDaySwitcher() {
        const panel = this.elements.panel;
        if (!panel) {
            return;
        }

        const wrap = panel.querySelector('.schedule-wrap');
        if (!wrap) {
            return;
        }

        let container = wrap.querySelector('.schedule-day-switcher');
        if (!container) {
            container = document.createElement('div');
            container.className = 'schedule-day-switcher';
            container.setAttribute('role', 'tablist');
            container.setAttribute('aria-label', 'Выбор дня недели');

            const weekNav = wrap.querySelector('.schedule-week-nav');
            if (weekNav && weekNav.parentNode) {
                weekNav.insertAdjacentElement('afterend', container);
            } else {
                wrap.insertBefore(container, wrap.firstChild || null);
            }
        }

        container.addEventListener('click', this.handleDaySwitcherClick);
        this.elements.daySwitcher = container;
        this.updateDaySwitcherVisibility();
    }

    setupResponsiveBehavior() {
        if (typeof window === 'undefined') {
            return;
        }

        if (typeof window.matchMedia === 'function') {
            this.mediaQuery = window.matchMedia(MOBILE_MEDIA_QUERY);
            this.state.isMobile = this.mediaQuery.matches;

            if (typeof this.mediaQuery.addEventListener === 'function') {
                this.mediaQuery.addEventListener('change', this.handleMediaQueryChange);
            } else if (typeof this.mediaQuery.addListener === 'function') {
                this.mediaQuery.addListener(this.handleMediaQueryChange);
            }
        } else {
            this.state.isMobile = window.innerWidth <= MOBILE_BREAKPOINT;
            window.addEventListener('resize', this.handleResize);
        }

        this.updateDaySwitcherVisibility();
    }

    handleMediaQueryChange(event) {
        this.state.isMobile = Boolean(event && event.matches);
        this.updateDaySwitcherVisibility();
        this.renderWeek();
    }

    handleResize() {
        if (typeof window === 'undefined') {
            return;
        }

        const nextIsMobile = window.innerWidth <= MOBILE_BREAKPOINT;
        if (nextIsMobile === this.state.isMobile) {
            return;
        }

        this.state.isMobile = nextIsMobile;
        this.updateDaySwitcherVisibility();
        this.renderWeek();
    }

    updateDaySwitcherVisibility() {
        const container = this.elements.daySwitcher;
        if (!container) {
            return;
        }

        const shouldShow = Boolean(this.state.isMobile);
        container.classList.toggle('is-visible', shouldShow);
        container.setAttribute('aria-hidden', shouldShow ? 'false' : 'true');
    }

    renderDaySwitcher(days) {
        const container = this.elements.daySwitcher;
        if (!container) {
            return;
        }

        container.innerHTML = '';

        const weekDays = Array.isArray(days) ? days : [];
        if (!weekDays.length) {
            container.setAttribute('aria-hidden', 'true');
            return;
        }

        const fragment = document.createDocumentFragment();
        let activeButton = null;

        weekDays.forEach((day, index) => {
            const dayKey = this.formatDateKey(day);
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'schedule-day-switcher__button';
            button.dataset.dayKey = dayKey;
            button.textContent = WEEKDAY_SHORT_LABELS[index] || this.formatWeekday(day).slice(0, 2);
            button.title = this.formatWeekday(day);

            const isActive = dayKey === this.state.selectedDayKey;
            button.classList.toggle('is-active', isActive);
            button.setAttribute('aria-selected', isActive ? 'true' : 'false');
            button.setAttribute('role', 'tab');
            button.tabIndex = isActive ? 0 : -1;

            if (isActive) {
                activeButton = button;
            }

            fragment.appendChild(button);
        });

        container.appendChild(fragment);
        this.updateDaySwitcherVisibility();

        if (
            this.state.isMobile &&
            activeButton &&
            typeof activeButton.scrollIntoView === 'function'
        ) {
            const scrollToActive = () => {
                try {
                    activeButton.scrollIntoView({ block: 'nearest', inline: 'center' });
                } catch (error) {
                    activeButton.scrollIntoView();
                }
            };

            if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
                window.requestAnimationFrame(scrollToActive);
            } else {
                scrollToActive();
            }
        }
    }

    handleDaySwitcherClick(event) {
        const target = event.target;
        if (!(target instanceof HTMLElement)) {
            return;
        }

        const button = target.closest('.schedule-day-switcher__button');
        if (!button) {
            return;
        }

        const dayKey = button.dataset.dayKey || '';
        if (!dayKey || dayKey === this.state.selectedDayKey) {
            return;
        }

        this.state.selectedDayKey = dayKey;
        this.renderWeek();
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
        this.state.selectedDayKey = this.resolveSelectedDayKey(this.state.selectedDayKey);
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

        const getRawValue = (keys) => {
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
                } else {
                    return raw;
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
        const acceptTimeString = typeof acceptTimeRaw === 'string' ? acceptTimeRaw.trim() : '';
        const acceptDeadlineRaw = getRawValue(['accept_deadline', 'acceptance_end']);

        let acceptTimeMatches = [];
        if (acceptTimeString) {
            if (typeof acceptTimeString.matchAll === 'function') {
                acceptTimeMatches = Array.from(acceptTimeString.matchAll(/(\d{1,2}):(\d{2})/g));
            } else {
                const fallbackMatches = acceptTimeString.match(/(\d{1,2}):(\d{2})/g);
                if (Array.isArray(fallbackMatches)) {
                    acceptTimeMatches = fallbackMatches
                        .map((timeString) => /(\d{1,2}):(\d{2})/.exec(timeString))
                        .filter(Boolean);
                }
            }
        }

        const parseTimeMatch = (match) => {
            if (!match || match.length < 3) {
                return null;
            }

            const hours = Number(match[1]);
            const minutes = Number(match[2]);

            if (
                !Number.isFinite(hours)
                || !Number.isFinite(minutes)
                || hours < 0
                || hours > 23
                || minutes < 0
                || minutes > 59
            ) {
                return null;
            }

            return {
                hours,
                minutes,
                label: `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`
            };
        };

        const acceptTimeStartMatch =
            acceptTimeMatches.length > 0 ? parseTimeMatch(acceptTimeMatches[0]) : null;
        const acceptTimeEndMatch =
            acceptTimeMatches.length > 0
                ? parseTimeMatch(acceptTimeMatches[acceptTimeMatches.length - 1])
                : null;

        const acceptTimeStart = acceptTimeStartMatch ? acceptTimeStartMatch.label : '';
        const acceptTimeEnd = acceptTimeEndMatch ? acceptTimeEndMatch.label : '';
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
        const {
            date: acceptDeadlineFromRaw,
            label: acceptDeadlineLabelFromRaw,
            source: acceptDeadlineSource,
            hasTime: hasAcceptDeadlineTime
        } = this.parseAcceptDeadline(acceptDeadlineRaw, acceptDate);

        const closingTimeMatch = acceptTimeEndMatch || acceptTimeStartMatch;

        let acceptTimeRangeLabel = '';
        if (acceptTimeStart && acceptTimeEnd) {
            if (acceptTimeStart !== acceptTimeEnd) {
                acceptTimeRangeLabel = `${acceptTimeStart} – ${acceptTimeEnd}`;
            } else {
                acceptTimeRangeLabel = acceptTimeStart;
            }
        } else if (acceptTimeString) {
            acceptTimeRangeLabel = acceptTimeString;
        } else {
            acceptTimeRangeLabel = acceptTimeLabel;
        }

        const hasParsedAcceptDeadline =
            hasAcceptDeadlineTime
            && acceptDeadlineFromRaw instanceof Date
            && !Number.isNaN(acceptDeadlineFromRaw.getTime());

        let acceptDeadlineLabel = '';
        if (acceptDeadlineLabelFromRaw) {
            acceptDeadlineLabel = acceptDeadlineLabelFromRaw;
        } else if (acceptTimeEnd) {
            acceptDeadlineLabel = acceptTimeEnd;
        } else if (closingTimeMatch && closingTimeMatch.label) {
            acceptDeadlineLabel = closingTimeMatch.label;
        } else if (acceptTimeString) {
            acceptDeadlineLabel = acceptTimeString;
        } else {
            acceptDeadlineLabel = acceptTimeLabel;
        }

        const acceptDeadlineRawString =
            typeof acceptDeadlineSource === 'string' ? acceptDeadlineSource : '';

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
            acceptTimeRangeLabel,
            acceptDeadlineLabel,
            acceptDeadlineRaw: acceptDeadlineRawString,
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

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        entry.isDepartureToday = entry.acceptDate.getTime() === today.getTime();

        let acceptDeadline = null;

        if (hasParsedAcceptDeadline) {
            acceptDeadline = new Date(acceptDeadlineFromRaw);
        } else {
            const fallbackDeadline = new Date(entry.acceptDate);
            let deadlineHours = 23;
            let deadlineMinutes = 59;

            if (closingTimeMatch) {
                if (
                    Number.isFinite(closingTimeMatch.hours)
                    && closingTimeMatch.hours >= 0
                    && closingTimeMatch.hours <= 23
                ) {
                    deadlineHours = closingTimeMatch.hours;
                }

                if (
                    Number.isFinite(closingTimeMatch.minutes)
                    && closingTimeMatch.minutes >= 0
                    && closingTimeMatch.minutes <= 59
                ) {
                    deadlineMinutes = closingTimeMatch.minutes;
                }
            }

            fallbackDeadline.setHours(deadlineHours, deadlineMinutes, 0, 0);
            acceptDeadline = fallbackDeadline;
        }

        if (acceptDeadline instanceof Date && !Number.isNaN(acceptDeadline.getTime())) {
            entry.acceptDeadline = acceptDeadline;
            entry.isAcceptingRequests = Date.now() < acceptDeadline.getTime();
        } else {
            entry.acceptDeadline = null;
            entry.isAcceptingRequests = false;
        }

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

        const acceptDeadlineRaw =
            typeof entry.acceptDeadlineRaw === 'string' ? entry.acceptDeadlineRaw : '';

        if (acceptDeadlineRaw) {
            if (!payload.accept_deadline) {
                payload.accept_deadline = acceptDeadlineRaw;
            }

            if (!payload.acceptance_end) {
                payload.acceptance_end = acceptDeadlineRaw;
            }
        }

        if (payload.accept_deadline && !payload.acceptDeadline) {
            payload.acceptDeadline = payload.accept_deadline;
        } else if (!payload.acceptDeadline && acceptDeadlineRaw) {
            payload.acceptDeadline = acceptDeadlineRaw;
        }

        if (payload.acceptance_end && !payload.acceptanceEnd) {
            payload.acceptanceEnd = payload.acceptance_end;
        } else if (!payload.acceptanceEnd && acceptDeadlineRaw) {
            payload.acceptanceEnd = acceptDeadlineRaw;
        }

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

    parseAcceptDeadline(value, fallbackDate = null) {
        const emptyResult = { date: null, label: '', source: '', hasTime: false };

        if (value === undefined || value === null) {
            return emptyResult;
        }

        if (value instanceof Date && !Number.isNaN(value.getTime())) {
            const clone = new Date(value);
            const hours = clone.getHours();
            const minutes = clone.getMinutes();
            return {
                date: clone,
                label: `${hours.toString().padStart(2, '0')}:${minutes
                    .toString()
                    .padStart(2, '0')}`,
                source: clone.toISOString(),
                hasTime: true
            };
        }

        if (typeof value === 'number' && Number.isFinite(value)) {
            const date = new Date(value);
            if (!Number.isNaN(date.getTime())) {
                const hours = date.getHours();
                const minutes = date.getMinutes();
                return {
                    date,
                    label: `${hours.toString().padStart(2, '0')}:${minutes
                        .toString()
                        .padStart(2, '0')}`,
                    source: date.toISOString(),
                    hasTime: true
                };
            }

            return emptyResult;
        }

        if (typeof value !== 'string') {
            return emptyResult;
        }

        const stringValue = value.trim();
        if (!stringValue) {
            return emptyResult;
        }

        const rangeMatch = stringValue.match(/(\d{1,2}):(\d{2})\s*[-–—]\s*(\d{1,2}):(\d{2})/);
        let hours = null;
        let minutes = null;

        if (rangeMatch) {
            const parsedHours = Number(rangeMatch[3]);
            const parsedMinutes = Number(rangeMatch[4]);
            if (
                Number.isFinite(parsedHours)
                && Number.isFinite(parsedMinutes)
                && parsedHours >= 0
                && parsedHours <= 23
                && parsedMinutes >= 0
                && parsedMinutes <= 59
            ) {
                hours = parsedHours;
                minutes = parsedMinutes;
            }
        }

        if (hours === null || minutes === null) {
            const timeMatch = stringValue.match(/(\d{1,2}):(\d{2})/);
            if (timeMatch) {
                const parsedHours = Number(timeMatch[1]);
                const parsedMinutes = Number(timeMatch[2]);
                if (
                    Number.isFinite(parsedHours)
                    && Number.isFinite(parsedMinutes)
                    && parsedHours >= 0
                    && parsedHours <= 23
                    && parsedMinutes >= 0
                    && parsedMinutes <= 59
                ) {
                    hours = parsedHours;
                    minutes = parsedMinutes;
                }
            }
        }

        const hasTime = hours !== null && minutes !== null;

        let parsedDate = null;
        if (hasTime) {
            const normalized = stringValue.includes('T')
                ? stringValue
                : stringValue.replace(' ', 'T');
            let candidate = new Date(normalized);
            if (Number.isNaN(candidate.getTime())) {
                candidate = new Date(stringValue);
            }

            if (!Number.isNaN(candidate.getTime())) {
                parsedDate = candidate;
            }

            if (!parsedDate) {
                const base =
                    fallbackDate instanceof Date && !Number.isNaN(fallbackDate.getTime())
                        ? new Date(fallbackDate)
                        : new Date();
                base.setHours(hours, minutes, 0, 0);
                parsedDate = base;
            }
        }

        const label = hasTime
            ? `${hours.toString().padStart(2, '0')}:${minutes
                  .toString()
                  .padStart(2, '0')}`
            : '';

        return {
            date: parsedDate,
            label,
            source: stringValue,
            hasTime
        };
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

    resolveSelectedDayKey(preferredKey = '', days = null) {
        const weekDays = Array.isArray(days) && days.length ? days : this.getWeekDays();
        if (!weekDays.length) {
            return '';
        }

        const availableKeys = weekDays.map((day) => this.formatDateKey(day));

        if (preferredKey) {
            if (availableKeys.includes(preferredKey)) {
                return preferredKey;
            }

            const preferredIndex = this.getWeekdayIndexFromKey(preferredKey);
            if (preferredIndex >= 0 && preferredIndex < availableKeys.length) {
                return availableKeys[preferredIndex];
            }
        }

        const todayKey = this.formatDateKey(new Date());
        if (availableKeys.includes(todayKey)) {
            return todayKey;
        }

        return availableKeys[0];
    }

    getWeekdayIndexFromKey(key) {
        const date = this.parseDate(key);
        if (!date) {
            return -1;
        }

        const day = date.getDay();
        return day === 0 ? 6 : day - 1;
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

        const days = this.getWeekDays();
        const resolvedKey = this.resolveSelectedDayKey(this.state.selectedDayKey, days);
        if (resolvedKey !== this.state.selectedDayKey) {
            this.state.selectedDayKey = resolvedKey;
        }
        this.renderDaySwitcher(days);

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

        this.renderTimeline(days);
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

    renderTimeline(days = null) {
        const grid = this.elements.grid;
        if (!grid) {
            return;
        }

        const targetDays = Array.isArray(days) && days.length ? days : this.getWeekDays();
        if (!targetDays.length) {
            grid.innerHTML = '';
            return;
        }

        const activeKey = this.resolveSelectedDayKey(this.state.selectedDayKey, targetDays);
        if (activeKey !== this.state.selectedDayKey) {
            this.state.selectedDayKey = activeKey;
            this.renderDaySwitcher(targetDays);
        }

        const isMobile = Boolean(this.state.isMobile);
        let daysToRender = targetDays;

        if (isMobile) {
            const activeDay = targetDays.find(
                (day) => this.formatDateKey(day) === this.state.selectedDayKey
            );
            daysToRender = activeDay ? [activeDay] : targetDays.slice(0, 1);
        }

        let maxRows = 0;

        daysToRender.forEach((day) => {
            const dateKey = this.formatDateKey(day);
            const schedulesCount = this.getSchedulesForDay(dateKey).length;
            if (schedulesCount > maxRows) {
                maxRows = schedulesCount;
            }
        });

        const normalizedMaxRows = Math.max(maxRows, 1);
        const fragment = document.createDocumentFragment();

        daysToRender.forEach((day) => {
            const dateKey = this.formatDateKey(day);
            const isActive = dateKey === this.state.selectedDayKey;
            fragment.appendChild(this.createDayColumn(day, normalizedMaxRows, isActive));
        });

        grid.innerHTML = '';
        grid.classList.toggle('schedule-timeline--mobile', isMobile);
        grid.appendChild(fragment);
    }

    createDayColumn(date, maxRows, isActive = false) {
        const wrapper = document.createElement('article');
        wrapper.className = 'schedule-day';
        if (isActive) {
            wrapper.classList.add('is-active');
        }

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
        const normalizedMaxRows = typeof maxRows === 'number' && maxRows > 0 ? maxRows : 1;

        if (schedules.length) {
            schedules.forEach((entry) => {
                list.appendChild(
                    this.createSpacerElement({
                        child: this.createShipmentElement(entry)
                    })
                );
            });
        } else {
            list.appendChild(
                this.createSpacerElement({
                    message: 'Нет отправлений'
                })
            );
        }

        const filledRows = Math.max(schedules.length, 1);
        const rowsToAdd = Math.max(normalizedMaxRows - filledRows, 0);

        for (let index = 0; index < rowsToAdd; index += 1) {
            list.appendChild(this.createSpacerElement());
        }

        wrapper.appendChild(list);
        return wrapper;
    }

    createSpacerElement({ child = null, message = '' } = {}) {
        const spacer = document.createElement('div');
        spacer.className = 'schedule-day__spacer';

        if (child) {
            spacer.appendChild(child);
        } else if (message) {
            const label = document.createElement('div');
            label.className = 'schedule-day__empty';
            label.textContent = message;
            spacer.appendChild(label);
        } else {
            spacer.setAttribute('aria-hidden', 'true');
        }

        return spacer;
    }

    createShipmentElement(entry) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'schedule-shipment';
        button.dataset.scheduleId = entry.id;

        const header = document.createElement('div');
        header.className = 'schedule-shipment__header';

        const title = document.createElement('div');
        title.className = 'schedule-shipment__title';

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
        title.appendChild(destination);
        header.appendChild(title);

        button.appendChild(header);

        const meta = document.createElement('div');
        meta.className = 'schedule-shipment__meta';

        let acceptElement = null;

        let statusElement = null;

        if (entry.status) {
            statusElement = document.createElement('span');
            const statusClass = this.getStatusClass(entry.status);
            statusElement.className = `schedule-shipment__status${statusClass ? ` ${statusClass}` : ''}`;

            let statusText = entry.status;
            const normalizedStatusText = statusText.toLowerCase();
            const normalizedWithoutYo = normalizedStatusText.replace(/ё/g, 'е');
            const acceptDeadlineLabelForStatus =
                entry.acceptDeadlineLabel
                || (typeof entry.acceptTimeRaw === 'string' ? entry.acceptTimeRaw.trim() : '')
                || entry.acceptTimeLabel;
            const shouldShowAcceptDeadline =
                (normalizedWithoutYo.includes('прием заявок')
                    || normalizedWithoutYo.includes('приемка'))
                && entry.isDepartureToday
                && entry.isAcceptingRequests === true
                && acceptDeadlineLabelForStatus;

            if (shouldShowAcceptDeadline) {
                statusText = `Приём до ${acceptDeadlineLabelForStatus}`;
                statusElement.classList.remove('status-open');
                statusElement.classList.add('status-waiting');
            }

            statusElement.textContent = statusText;
            meta.appendChild(statusElement);
        }

        const acceptBadgeLabel =
            entry.acceptTimeRangeLabel
            || (typeof entry.acceptTimeRaw === 'string' ? entry.acceptTimeRaw.trim() : '')
            || entry.acceptTimeLabel;

        if (acceptBadgeLabel) {
            const accept = document.createElement('span');
            accept.className = 'schedule-shipment__chip';
            accept.textContent = `Приём: ${acceptBadgeLabel}`;
            meta.appendChild(accept);
            acceptElement = accept;
        }

        const normalizedMarketplace =
            typeof entry.marketplace === 'string' ? entry.marketplace.trim() : '';
        const marketplaceLabel =
            this.getMarketplaceBadge(entry.marketplace) || normalizedMarketplace;
        const marketplaceModifier = this.getMarketplaceModifier(marketplaceLabel);

        if (marketplaceLabel) {
            const marketplace = document.createElement('span');
            marketplace.className = 'schedule-shipment__marketplace';
            if (marketplaceModifier) {
                marketplace.classList.add(`schedule-shipment__marketplace--${marketplaceModifier}`);
            }
            if (normalizedMarketplace) {
                marketplace.dataset.marketplace = normalizedMarketplace;
            }
            marketplace.textContent = marketplaceLabel;

            if (acceptElement && acceptElement.parentNode === meta) {
                meta.insertBefore(marketplace, acceptElement.nextSibling);
            } else {
                meta.appendChild(marketplace);
            }
        }

        if (entry.deliveryDateRaw) {
            const delivery = document.createElement('span');
            delivery.className = 'schedule-shipment__chip';
            delivery.textContent = `Сдача: ${this.formatDate(entry.deliveryDateRaw)}`;
            meta.appendChild(delivery);
        }

        if (entry.isAcceptingRequests === false) {
            button.classList.add('schedule-shipment--closed');
            button.disabled = true;

            if (!statusElement) {
                statusElement = document.createElement('span');
                statusElement.className = 'schedule-shipment__status';
                meta.insertBefore(statusElement, meta.firstChild || null);
            }

            statusElement.className = 'schedule-shipment__status status-closed';
            statusElement.textContent = 'Приём закрыт';
        }

        if (meta.childElementCount > 0) {
            button.appendChild(meta);
        }

        if (entry.isAcceptingRequests !== false) {
            button.addEventListener('click', () => {
                this.openRequestForm(entry);
            });
        }

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

    getMarketplaceModifier(label) {
        if (!label) {
            return '';
        }

        const normalized = label.toLowerCase();
        if (normalized === 'wb') {
            return 'wb';
        }

        if (normalized === 'oz') {
            return 'oz';
        }

        return '';
    }

    getStatusClass(status) {
        if (!status) {
            return 'status-unknown';
        }

        const map = new Map([
            ['приём заявок', 'status-open'],
            ['прием заявок', 'status-open'],
            ['ожидает отправки', 'status-waiting'],
            ['в пути', 'status-transit'],
            ['завершено', 'status-closed'],
            ['приём закрыт', 'status-closed'],
            ['прием закрыт', 'status-closed']
        ]);

        const normalized = status.toLowerCase().trim();
        const normalizedWithoutYo = normalized.replace(/ё/g, 'е');

        if (map.has(normalized)) {
            return map.get(normalized);
        }

        if (normalized.startsWith('приём до ') || normalizedWithoutYo.startsWith('прием до ')) {
            return 'status-waiting';
        }

        if (normalized.startsWith('приём заявок до ') || normalizedWithoutYo.startsWith('прием заявок до ')) {
            return map.get('прием заявок');
        }

        return 'status-unknown';
    }

    openRequestForm(entry) {
        if (entry && entry.acceptDeadline instanceof Date) {
            const deadlineTime = entry.acceptDeadline.getTime();
            if (!Number.isNaN(deadlineTime)) {
                const isStillAccepting = Date.now() < deadlineTime;
                entry.isAcceptingRequests = isStillAccepting;
                if (!isStillAccepting) {
                    const message = 'Приём закрыт';
                    if (window.app && typeof window.app.showError === 'function') {
                        window.app.showError(message);
                    } else {
                        window.alert(message);
                    }
                    return;
                }
            }
        }

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
        this.state.selectedDayKey = this.resolveSelectedDayKey();

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
