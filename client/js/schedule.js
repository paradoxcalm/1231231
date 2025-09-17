import { fetchMarketplaces, fetchWarehouses, populateSelect } from './filterOptions.js';

// Управление расписанием отправлений
class ScheduleManager {
    constructor() {
        this.schedules = [];
        this.filteredSchedules = [];
        this.currentTab = 'upcoming';
        this.currentMonth = new Date();
        this.filters = {
            marketplace: '',
            warehouse: ''
        };
        this.selectedCity = localStorage.getItem('selectedCity') || '';
        this.marketplaceFilterElement = null;
        this.warehouseFilterElement = null;

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
        const marketplaceFilter = document.getElementById('marketplaceFilter');
        const warehouseFilter = document.getElementById('warehouseFilter');

        if (!marketplaceFilter || !warehouseFilter) {
            return;
        }

        this.marketplaceFilterElement = marketplaceFilter;
        this.warehouseFilterElement = warehouseFilter;

        const baseUrl = '../filter_options.php';

        const initializeFilters = async () => {
            try {
                const marketplaces = await fetchMarketplaces({ baseUrl });
                const marketplaceValue = populateSelect(marketplaceFilter, marketplaces, {
                    selectedValue: this.filters.marketplace,
                    placeholder: 'Выберите маркетплейс'
                });

                this.filters.marketplace = marketplaceValue;
                marketplaceFilter.disabled = marketplaces.length === 0;
            } catch (error) {
                console.error('Ошибка инициализации фильтров расписания:', error);
                marketplaceFilter.disabled = true;
            } finally {
                this.updateWarehouseOptions();
            }
        };

        initializeFilters();

        marketplaceFilter.addEventListener('change', (event) => {
            this.filters.marketplace = event.target.value;
            this.updateWarehouseOptions();
            this.applyFilters();
        });

        warehouseFilter.addEventListener('change', (event) => {
            this.filters.warehouse = event.target.value;
            this.applyFilters();
        });

        document.querySelectorAll('.filter-step-action').forEach(button => {
            const targetId = button.dataset.target;
            if (!targetId) {
                return;
            }

            button.addEventListener('click', () => {
                const targetElement = document.getElementById(targetId);
                if (targetElement) {
                    targetElement.focus();
                    if (typeof targetElement.showPicker === 'function') {
                        targetElement.showPicker();
                    }
                }
            });
        });
    }

    updateWarehouseOptions() {
        const warehouseFilter = this.warehouseFilterElement || document.getElementById('warehouseFilter');
        if (!warehouseFilter) {
            return;
        }

        const warehouses = this.collectWarehouses(this.filters.marketplace);
        const placeholder = this.filters.marketplace ? 'Выберите склад' : 'Сначала выберите маркетплейс';
        const selectedValue = populateSelect(warehouseFilter, warehouses, {
            selectedValue: this.filters.warehouse,
            placeholder
        });

        const hasWarehouses = warehouses.length > 0;
        warehouseFilter.disabled = !hasWarehouses || !this.filters.marketplace;
        this.filters.warehouse = hasWarehouses ? selectedValue : '';

        if (!hasWarehouses && this.filters.marketplace) {
            warehouseFilter.title = 'Склады недоступны для выбранного маркетплейса';
        } else {
            warehouseFilter.removeAttribute('title');
        }
    }

    collectWarehouses(marketplace) {
        if (!Array.isArray(this.schedules) || this.schedules.length === 0) {
            return [];
        }

        const values = [];

        this.schedules.forEach(schedule => {
            if (marketplace && schedule.marketplace !== marketplace) {
                return;
            }

            const rawWarehouse = schedule.warehouse ?? schedule.warehouses;

            if (Array.isArray(rawWarehouse)) {
                rawWarehouse.forEach(item => {
                    if (typeof item === 'string') {
                        const trimmed = item.trim();
                        if (trimmed) {
                            values.push(trimmed);
                        }
                    }
                });
            } else if (typeof rawWarehouse === 'string') {
                const trimmed = rawWarehouse.trim();
                if (trimmed) {
                    values.push(trimmed);
                }
            }
        });

        const uniqueWarehouses = Array.from(new Set(values)).sort((a, b) => {
            try {
                return a.localeCompare(b, 'ru', { sensitivity: 'base' });
            } catch (error) {
                return a.localeCompare(b);
            }
        });

        return uniqueWarehouses.map(value => ({ value, label: value }));
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
                marketplace,
                driver_name,
                driver_phone,
                car_brand,
                car_number,
                ...rest
            }) => ({
                ...rest,
                acceptDate: accept_date,
                deliveryDate: delivery_date,
                city,
                warehouse: warehouses,
                status,
                marketplace,
                driverName: driver_name,
                driverPhone: driver_phone,
                carBrand: car_brand,
                carNumber: car_number
            }));

            this.updateWarehouseOptions();
            this.applyFilters();
        } catch (error) {
            console.error('Ошибка загрузки расписания:', error);
            window.app.showError('Не удалось загрузить расписание');
        }
    }

    applyFilters() {
        this.filteredSchedules = this.schedules.filter(schedule => {
            const matchMarketplace = !this.filters.marketplace ||
                                   schedule.marketplace === this.filters.marketplace;
            const matchWarehouse = !this.filters.warehouse ||
                                  schedule.warehouse === this.filters.warehouse;

            return matchMarketplace && matchWarehouse;
        });

        if (this.currentTab === 'upcoming') {
            this.renderScheduleGrid();
        } else {
            this.renderCalendar();
        }
    }

    renderScheduleGrid() {
        const grid = document.getElementById('scheduleGrid');
        if (!grid) return;

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

        grid.innerHTML = this.filteredSchedules.map(schedule => {
            const canCreateOrder = this.canCreateOrderForSchedule(schedule);
            const statusClass = this.getStatusClass(schedule.status);
            
            return `
                <div class="schedule-card ${canCreateOrder ? 'can-create-order' : 'cannot-create-order'}" data-id="${schedule.id}">
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
                            <span class="date-value">${schedule.driverName || '—'}</span>
                        </div>
                    </div>

                    <div class="schedule-status ${statusClass}">
                        <i class="fas fa-circle"></i>
                        ${schedule.status}
                    </div>

                    <div class="schedule-action">
                        ${canCreateOrder ? `
                            <button class="create-order-btn" onclick="window.ScheduleManager.createOrderForSchedule(${schedule.id})">
                                <i class="fas fa-plus"></i>
                                Создать заявку
                            </button>
                        ` : `
                            <div class="order-closed">
                                <i class="fas fa-lock"></i>
                                Приём заявок закрыт
                            </div>
                        `}
                    </div>
                </div>
            `;
        }).join('');

        // Добавляем обработчики кликов
        grid.querySelectorAll('.schedule-card').forEach(card => {
            card.addEventListener('click', (e) => {
                if (!e.target.closest('.create-order-btn')) {
                    const scheduleId = parseInt(card.dataset.id);
                    this.showScheduleDetails(scheduleId);
                }
            });
        });
    }

    canCreateOrderForSchedule(schedule) {
        if (!schedule) return false;
        
        // Проверяем статус
        const closedStatuses = ['Завершено', 'Товар отправлен', 'Отменено'];
        if (closedStatuses.includes(schedule.status)) return false;

        // Проверяем дедлайн приёмки
        const deadline = schedule.acceptance_end || schedule.accept_deadline;
        if (deadline) {
            const now = new Date();
            const deadlineDate = new Date(deadline);
            if (now > deadlineDate) return false;
        }

        return true;
    }

    getStatusClass(status) {
        const statusMap = {
            'Приём заявок': 'status-open',
            'Ожидает отправки': 'status-waiting',
            'Готов к отправке': 'status-ready',
            'В пути': 'status-transit',
            'Завершено': 'status-completed',
            'Отменено': 'status-cancelled'
        };
        
        return statusMap[status] || 'status-unknown';
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
                ${schedules.map(schedule => {
                    const canCreateOrder = this.canCreateOrderForSchedule(schedule);
                    return `
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
                                    <span>${schedule.driverName || '—'}</span>
                                </div>
                                <div class="info-row">
                                    <span>Автомобиль:</span>
                                    <span>${schedule.carBrand || '—'} ${schedule.carNumber || ''}</span>
                                </div>
                                <div class="info-row">
                                    <span>Статус:</span>
                                    <span class="${this.getStatusClass(schedule.status)}">${schedule.status}</span>
                                </div>
                            </div>
                            ${canCreateOrder ? `
                                <button class="create-order-small" onclick="window.ScheduleManager.createOrderForSchedule(${schedule.id})">
                                    <i class="fas fa-plus"></i>
                                    Создать заявку
                                </button>
                            ` : `
                                <div class="order-closed-small">
                                    <i class="fas fa-lock"></i>
                                    Приём закрыт
                                </div>
                            `}
                        </div>
                    `;
                }).join('')}
            </div>
        `;

        window.app.openModal(modal);
    }

    showScheduleDetails(scheduleId) {
        const schedule = this.schedules.find(s => s.id === scheduleId);
        if (!schedule) return;

        const modal = document.getElementById('scheduleDetailsModal');
        const content = document.getElementById('scheduleDetailsContent');
        
        if (!content) return;

        const canCreateOrder = this.canCreateOrderForSchedule(schedule);

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
                            <span class="detail-value ${this.getStatusClass(schedule.status)}">${schedule.status}</span>
                        </div>
                    </div>
                </div>

                <div class="details-section">
                    <h4>Транспорт</h4>
                    <div class="details-grid">
                        <div class="detail-item">
                            <span class="detail-label">Водитель:</span>
                            <span class="detail-value">${schedule.driverName || '—'}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Телефон:</span>
                            <span class="detail-value">${schedule.driverPhone || '—'}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Автомобиль:</span>
                            <span class="detail-value">${schedule.carBrand || '—'} ${schedule.carNumber || ''}</span>
                        </div>
                    </div>
                </div>

                <div class="modal-actions">
                    ${canCreateOrder ? `
                        <button class="action-btn action-btn-primary" onclick="window.ScheduleManager.createOrderForSchedule(${schedule.id})">
                            <i class="fas fa-plus"></i>
                            Создать заявку
                        </button>
                    ` : `
                        <div class="order-closed-message">
                            <i class="fas fa-info-circle"></i>
                            Приём заявок для этого отправления закрыт
                        </div>
                    `}
                </div>
            </div>
        `;

        window.app.openModal(modal);
    }

    createOrderForSchedule(scheduleId) {
        const schedule = this.schedules.find(s => s.id === scheduleId);
        if (!schedule) return;

        // Проверяем, можно ли создать заявку
        if (!this.canCreateOrderForSchedule(schedule)) {
            window.app.showError('Приём заявок для этого отправления закрыт');
            return;
        }

        // Закрываем модальное окно деталей, если оно открыто
        const detailsModal = document.getElementById('scheduleDetailsModal');
        if (detailsModal) {
            window.app.closeModal(detailsModal);
        }

        // Открываем модальное окно создания заявки
        this.openOrderModal(schedule);
    }

    openOrderModal(schedule) {
        const modal = document.getElementById('clientRequestModal');
        const content = document.getElementById('clientRequestModalContent');
        
        if (!modal || !content) {
            console.error('Модальное окно заявки не найдено');
            return;
        }

        // Загружаем шаблон формы заявки
        this.loadOrderFormTemplate(content, schedule);
        
        // Показываем модальное окно
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    async loadOrderFormTemplate(container, schedule) {
        try {
            const response = await fetch('templates/customOrderModal.html');
            const template = await response.text();
            
            container.innerHTML = template;
            
            // Инициализируем форму с данными расписания
            this.initializeOrderForm(container, schedule);
            
        } catch (error) {
            console.error('Ошибка загрузки шаблона формы:', error);
            container.innerHTML = `
                <div class="error-message">
                    <h3>Ошибка загрузки формы</h3>
                    <p>Не удалось загрузить форму создания заявки. Попробуйте обновить страницу.</p>
                    <button onclick="window.app.closeModal(document.getElementById('clientRequestModal'))">
                        Закрыть
                    </button>
                </div>
            `;
        }
    }

    initializeOrderForm(container, schedule) {
        // Заполняем скрытые поля данными расписания
        const setValue = (selector, value) => {
            const element = container.querySelector(selector);
            if (element) element.value = value || '';
        };

        setValue('#formScheduleId', schedule.id);
        setValue('#acceptDateField', schedule.acceptDate);
        setValue('#deliveryDateField', schedule.deliveryDate);
        setValue('#acceptTimeField', schedule.accept_time || '');
        setValue('#directionField', schedule.warehouse);
        setValue('#warehouses', schedule.warehouse);
        setValue('#driver_name', schedule.driverName || '');
        setValue('#driver_phone', schedule.driverPhone || '');
        setValue('#car_number', schedule.carNumber || '');
        setValue('#car_brand', schedule.carBrand || '');

        // Отображаем информацию о выбранном расписании
        const directionElement = container.querySelector('#legacyDirection');
        if (directionElement) {
            directionElement.textContent = `${schedule.city} → ${schedule.warehouse}`;
        }

        const datesElement = container.querySelector('#legacyDates');
        if (datesElement) {
            datesElement.textContent = `${window.utils.formatDate(schedule.acceptDate)} → ${window.utils.formatDate(schedule.deliveryDate)}`;
        }

        const marketplaceElement = container.querySelector('#legacyMarketplace');
        if (marketplaceElement) {
            marketplaceElement.textContent = schedule.marketplace;
        }

        const warehouseElement = container.querySelector('#legacyWarehouse');
        if (warehouseElement) {
            warehouseElement.textContent = schedule.warehouse;
        }

        // Настраиваем выбор города
        this.setupCitySelection(container);
        
        // Настраиваем обработчики формы
        this.setupFormHandlers(container, schedule);
        
        // Настраиваем кнопку закрытия
        const closeBtn = container.querySelector('[data-close-modal]');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                this.closeOrderModal();
            });
        }
    }

    async setupCitySelection(container) {
        const citySelect = container.querySelector('#city');
        if (!citySelect) return;

        try {
            // Загружаем список городов
            const response = await fetch('../filter_options.php?action=all_cities');
            const data = await response.json();
            const cities = data.cities || data || [];

            // Заполняем селект городов
            citySelect.innerHTML = '<option value="" disabled selected>Выберите город</option>';
            cities.forEach(city => {
                const option = document.createElement('option');
                option.value = city;
                option.textContent = city;
                citySelect.appendChild(option);
            });

            // Устанавливаем сохранённый город, если есть
            if (this.selectedCity && cities.includes(this.selectedCity)) {
                citySelect.value = this.selectedCity;
                this.enableFormFields(container);
            } else {
                this.disableFormFields(container);
            }

            // Обработчик изменения города
            citySelect.addEventListener('change', () => {
                const selectedCity = citySelect.value;
                if (selectedCity) {
                    this.selectedCity = selectedCity;
                    localStorage.setItem('selectedCity', selectedCity);
                    setValue('#sender', this.selectedCity); // Автозаполнение отправителя
                    this.enableFormFields(container);
                    this.showCityConfirmation(container, selectedCity);
                } else {
                    this.disableFormFields(container);
                }
            });

        } catch (error) {
            console.error('Ошибка загрузки городов:', error);
            citySelect.innerHTML = '<option value="">Ошибка загрузки городов</option>';
            citySelect.disabled = true;
        }
    }

    showCityConfirmation(container, cityName) {
        // Создаём оверлей подтверждения города
        const overlay = document.createElement('div');
        overlay.className = 'city-confirm-overlay city-confirm-overlay--visible';
        
        overlay.innerHTML = `
            <div class="city-confirm-dialog city-confirm-dialog--visible">
                <button class="city-confirm-close" aria-label="Закрыть"></button>
                <div class="city-confirm-icon">📍</div>
                <h3 class="city-confirm-title">Подтвердите город отправления</h3>
                <p class="city-confirm-message">
                    Вы выбрали город <span class="city-confirm-city">${cityName}</span>. 
                    Это правильно?
                </p>
                <div class="city-confirm-actions">
                    <button class="city-confirm-button city-confirm-continue">
                        Да, продолжить
                    </button>
                    <button class="city-confirm-button city-confirm-edit">
                        Изменить город
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);
        document.body.classList.add('city-confirm-open');

        // Обработчики
        const closeBtn = overlay.querySelector('.city-confirm-close');
        const continueBtn = overlay.querySelector('.city-confirm-continue');
        const editBtn = overlay.querySelector('.city-confirm-edit');

        const closeConfirmation = () => {
            overlay.classList.add('city-confirm-overlay--closing');
            overlay.querySelector('.city-confirm-dialog').classList.add('city-confirm-dialog--closing');
            
            setTimeout(() => {
                document.body.removeChild(overlay);
                document.body.classList.remove('city-confirm-open');
            }, 250);
        };

        closeBtn.addEventListener('click', closeConfirmation);
        
        continueBtn.addEventListener('click', () => {
            closeConfirmation();
            // Город подтверждён, форма остаётся активной
        });

        editBtn.addEventListener('click', () => {
            closeConfirmation();
            // Возвращаем фокус на селект города
            const citySelect = container.querySelector('#city');
            if (citySelect) {
                citySelect.focus();
            }
        });

        // Закрытие по клику на оверлей
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                closeConfirmation();
            }
        });

        // Закрытие по Escape
        const escapeHandler = (e) => {
            if (e.key === 'Escape') {
                closeConfirmation();
                document.removeEventListener('keydown', escapeHandler);
            }
        };
        document.addEventListener('keydown', escapeHandler);
    }

    enableFormFields(container) {
        // Включаем все поля формы
        const fields = container.querySelectorAll('input:not([type="hidden"]), select:not(#city), textarea');
        fields.forEach(field => {
            field.disabled = false;
        });

        // Скрываем сообщение о необходимости выбора города
        const warningMessage = container.querySelector('.city-warning');
        if (warningMessage) {
            warningMessage.style.display = 'none';
        }

        // Показываем кнопку отправки
        const submitBtn = container.querySelector('.request-form__submit');
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.style.opacity = '1';
        }
    }

    disableFormFields(container) {
        // Отключаем все поля формы кроме выбора города
        const fields = container.querySelectorAll('input:not([type="hidden"]):not(#city), select:not(#city), textarea');
        fields.forEach(field => {
            field.disabled = true;
        });

        // Показываем предупреждение
        let warningMessage = container.querySelector('.city-warning');
        if (!warningMessage) {
            warningMessage = document.createElement('div');
            warningMessage.className = 'city-warning';
            warningMessage.innerHTML = `
                <div class="warning-content">
                    <i class="fas fa-map-marker-alt"></i>
                    <div>
                        <h4>Выберите город отправления</h4>
                        <p>Пожалуйста, выберите город отправления, чтобы продолжить оформление заявки.</p>
                    </div>
                </div>
            `;
            
            // Вставляем после селекта города
            const cityGroup = container.querySelector('.request-form__city-group');
            if (cityGroup) {
                cityGroup.parentNode.insertBefore(warningMessage, cityGroup.nextSibling);
            }
        }
        warningMessage.style.display = 'block';

        // Отключаем кнопку отправки
        const submitBtn = container.querySelector('.request-form__submit');
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.style.opacity = '0.5';
        }
    }

    setupFormHandlers(container, schedule) {
        const form = container.querySelector('#dataForm');
        if (!form) return;

        // Автозаполнение данных пользователя
        this.loadUserDataIntoForm(container);

        // Обработчик отправки формы
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            if (!this.selectedCity) {
                window.app.showError('Выберите город отправления');
                return;
            }

            await this.submitOrderForm(form, schedule);
        });

        // Обработчик изменения типа упаковки
        const packagingRadios = container.querySelectorAll('input[name="packaging_type"]');
        packagingRadios.forEach(radio => {
            radio.addEventListener('change', () => {
                this.handlePackagingTypeChange(container);
            });
        });

        // Обработчик изменения количества
        const boxesInput = container.querySelector('#boxes');
        if (boxesInput) {
            boxesInput.addEventListener('input', () => {
                this.calculateCost(container, schedule);
            });
        }

        // Инициализируем расчёт стоимости
        this.calculateCost(container, schedule);
    }

    async loadUserDataIntoForm(container) {
        try {
            const response = await fetch('../fetch_user_data.php');
            const data = await response.json();
            
            if (data.success && data.data) {
                const user = data.data;
                
                // Автозаполнение полей
                const setValue = (selector, value) => {
                    const element = container.querySelector(selector);
                    if (element && value) element.value = value;
                };

                setValue('#sender', user.company_name);
                setValue('#clientPhone', user.phone);
            }
        } catch (error) {
            console.error('Ошибка загрузки данных пользователя:', error);
        }
    }

    handlePackagingTypeChange(container) {
        const selectedType = container.querySelector('input[name="packaging_type"]:checked')?.value;
        const palletBlock = container.querySelector('#palletInputBlock');
        const boxTypeBlock = container.querySelector('#boxTypeBlock');
        const boxSizeBlock = container.querySelector('#boxSizeBlock');

        if (selectedType === 'Pallet') {
            if (palletBlock) palletBlock.classList.remove('request-form__hidden');
            if (boxTypeBlock) boxTypeBlock.classList.add('request-form__hidden');
            if (boxSizeBlock) boxSizeBlock.classList.add('request-form__hidden');
        } else {
            if (palletBlock) palletBlock.classList.add('request-form__hidden');
            if (boxTypeBlock) boxTypeBlock.classList.remove('request-form__hidden');
            if (boxSizeBlock) boxSizeBlock.classList.remove('request-form__hidden');
        }
    }

    async calculateCost(container, schedule) {
        const boxesInput = container.querySelector('#boxes');
        const paymentInput = container.querySelector('#payment');
        const volumeDisplay = container.querySelector('#box_volume');
        const tariffDisplay = container.querySelector('#tariff_rate');

        if (!boxesInput || !paymentInput) return;

        const quantity = parseInt(boxesInput.value) || 0;
        const packagingType = container.querySelector('input[name="packaging_type"]:checked')?.value || 'Box';

        if (quantity <= 0) {
            if (paymentInput) paymentInput.value = '';
            if (volumeDisplay) volumeDisplay.textContent = '—';
            if (tariffDisplay) tariffDisplay.textContent = '—';
            return;
        }

        try {
            // Получаем тариф
            const response = await fetch(`../get_tariff.php?city=${encodeURIComponent(schedule.city)}&warehouse=${encodeURIComponent(schedule.warehouse)}`);
            const data = await response.json();

            if (data.success) {
                const unitPrice = packagingType === 'Pallet' ? data.pallet_price : data.base_price;
                const totalCost = unitPrice * quantity;

                if (paymentInput) paymentInput.value = totalCost.toFixed(2);
                if (tariffDisplay) tariffDisplay.textContent = window.utils.formatCurrency(unitPrice) + ' за ' + (packagingType === 'Pallet' ? 'паллету' : 'коробку');

                // Расчёт объёма для коробок
                if (packagingType === 'Box' && volumeDisplay) {
                    const volume = quantity * 0.096; // стандартная коробка 60x40x40 см = 0.096 м³
                    volumeDisplay.textContent = volume.toFixed(3) + ' м³';
                }
            }
        } catch (error) {
            console.error('Ошибка расчёта стоимости:', error);
        }
    }

    async submitOrderForm(form, schedule) {
        const submitBtn = form.querySelector('.request-form__submit');
        const statusElement = form.querySelector('#status');
        
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Отправка...';
        }

        try {
            const formData = new FormData(form);
            
            // Добавляем данные расписания
            formData.append('schedule_id', schedule.id);
            formData.append('city', this.selectedCity);
            formData.append('warehouses', schedule.warehouse);
            formData.append('accept_date', schedule.acceptDate);
            formData.append('delivery_date', schedule.deliveryDate);

            const response = await fetch('../log_data.php', {
                method: 'POST',
                body: formData
            });

            const result = await response.json();

            if (result.status === 'success') {
                // Успешно создана заявка
                this.closeOrderModal();
                window.app.showSuccess('Заявка успешно создана!');
                
                // Обновляем список заказов, если доступен
                if (window.OrdersManager && typeof window.OrdersManager.loadOrders === 'function') {
                    window.OrdersManager.loadOrders();
                }
            } else {
                throw new Error(result.message || 'Ошибка создания заявки');
            }

        } catch (error) {
            console.error('Ошибка отправки заявки:', error);
            window.app.showError(error.message || 'Не удалось создать заявку');
            
            if (statusElement) {
                statusElement.textContent = error.message || 'Ошибка отправки заявки';
                statusElement.style.color = 'red';
            }
        } finally {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = '<span class="button__label">Отправить</span>';
            }
        }
    }

    closeOrderModal() {
        const modal = document.getElementById('clientRequestModal');
        if (modal) {
            modal.classList.remove('active');
            document.body.style.overflow = '';
            
            // Очищаем содержимое
            const content = document.getElementById('clientRequestModalContent');
            if (content) {
                content.innerHTML = '';
            }
        }
    }
}

// Инициализация после загрузки DOM
document.addEventListener('DOMContentLoaded', () => {
    window.ScheduleManager = new ScheduleManager();
});