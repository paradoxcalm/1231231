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
        const cityFilter = document.getElementById('cityFilter');
        const warehouseFilter = document.getElementById('warehouseFilter');

        [marketplaceFilter, cityFilter, warehouseFilter].forEach(filter => {
            if (filter) {
                filter.addEventListener('change', (e) => {
                    const filterType = e.target.id.replace('Filter', '');
                    this.filters[filterType] = e.target.value;
                    this.applyFilters();
                });
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
            // Симуляция загрузки данных
            const mockSchedules = [
                {
                    id: 1,
                    city: 'Махачкала',
                    warehouse: 'Коледино',
                    acceptDate: '2025-01-15',
                    deliveryDate: '2025-01-18',
                    marketplace: 'Wildberries',
                    status: 'Приём заявок',
                    driverName: 'Петров И.И.',
                    driverPhone: '+7 999 111 22 33',
                    carBrand: 'Газель',
                    carNumber: 'А123БВ05',
                    ordersCount: 12
                },
                {
                    id: 2,
                    city: 'Хасавюрт',
                    warehouse: 'Невинномысск',
                    acceptDate: '2025-01-16',
                    deliveryDate: '2025-01-19',
                    marketplace: 'Ozon',
                    status: 'Ожидает отправки',
                    driverName: 'Сидоров П.П.',
                    driverPhone: '+7 999 222 33 44',
                    carBrand: 'Mercedes',
                    carNumber: 'В456ГД05',
                    ordersCount: 8
                },
                {
                    id: 3,
                    city: 'Каспийск',
                    warehouse: 'Коледино',
                    acceptDate: '2025-01-17',
                    deliveryDate: '2025-01-20',
                    marketplace: 'YandexMarket',
                    status: 'Приём заявок',
                    driverName: 'Иванов А.А.',
                    driverPhone: '+7 999 333 44 55',
                    carBrand: 'Ford',
                    carNumber: 'Г789ДЕ05',
                    ordersCount: 5
                }
            ];

            this.schedules = mockSchedules;
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
            const matchCity = !this.filters.city || 
                             schedule.city === this.filters.city;
            const matchWarehouse = !this.filters.warehouse || 
                                  schedule.warehouse === this.filters.warehouse;
            
            return matchMarketplace && matchCity && matchWarehouse;
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

        // Закрываем модальное окно деталей, если открыто
        const detailsModal = document.getElementById('scheduleDetailsModal');
        if (detailsModal) {
            window.app.closeModal(detailsModal);
        }

        // Предзаполняем данные в форме создания заказа
        const form = document.getElementById('createOrderForm');
        if (form) {
            // Здесь можно предзаполнить поля формы данными из расписания
            const costInput = form.querySelector('input[name="cost"]');
            if (costInput) {
                // Рассчитываем стоимость на основе тарифов
                this.calculateCost(schedule).then(cost => {
                    costInput.value = window.utils.formatCurrency(cost);
                });
            }
        }

        // Открываем модальное окно создания заказа
        const orderModal = document.getElementById('orderModal');
        window.app.openModal(orderModal);
    }

    async calculateCost(schedule) {
        // Симуляция расчета стоимости
        const baseCost = 650;
        const multipliers = {
            'Wildberries': 1.0,
            'Ozon': 1.1,
            'YandexMarket': 1.05
        };
        
        return baseCost * (multipliers[schedule.marketplace] || 1.0);
    }
}

// Инициализация после загрузки DOM
document.addEventListener('DOMContentLoaded', () => {
    window.ScheduleManager = new ScheduleManager();
});