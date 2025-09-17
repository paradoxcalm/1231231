import { fetchMarketplaces, fetchWarehouses } from './filterOptions.js';

// Управление расписанием отправлений с пошаговым выбором
class ScheduleManager {
    constructor() {
        this.schedules = [];
        this.filteredSchedules = [];
        this.currentStep = 1; // 1 = маркетплейс, 2 = склад, 3 = календарь
        this.currentMonth = new Date();
        this.filters = {
            marketplace: '',
            warehouse: ''
        };
        this.marketplaceOptions = [];
        this.warehouseOptions = [];
        this.calendarData = {};

        this.init();
    }

    init() {
        this.setupStepNavigation();
        this.setupCalendarControls();
        this.loadMarketplaces();
        this.showStep(1);
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

    setupCalendarControls() {
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

    showStep(stepNumber) {
        this.currentStep = stepNumber;
        
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
        try {
            const marketplaces = await fetchMarketplaces({ baseUrl: '../filter_options.php' });
            this.marketplaceOptions = marketplaces.map(mp => ({
                value: mp,
                label: mp,
                description: this.getMarketplaceDescription(mp)
            }));
            this.renderMarketplaces();
        } catch (error) {
            console.error('Ошибка загрузки маркетплейсов:', error);
            this.showError('Не удалось загрузить список маркетплейсов');
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

        if (this.marketplaceOptions.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-store-slash"></i>
                    <h3>Маркетплейсы недоступны</h3>
                    <p>Попробуйте обновить страницу</p>
                </div>
            `;
            return;
        }

        container.innerHTML = this.marketplaceOptions.map(option => `
            <div class="marketplace-card ${this.filters.marketplace === option.value ? 'selected' : ''}" 
                 data-value="${option.value}">
                <div class="marketplace-icon">
                    <i class="fas ${this.getMarketplaceIcon(option.value)}"></i>
                </div>
                <div class="marketplace-info">
                    <h3>${option.label}</h3>
                    <p>${option.description}</p>
                </div>
                <div class="marketplace-check">
                    <i class="fas fa-check"></i>
                </div>
            </div>
        `).join('');

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
        
        // Обновляем визуальное состояние
        document.querySelectorAll('.marketplace-card').forEach(card => {
            card.classList.toggle('selected', card.dataset.value === marketplace);
        });

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
            
            this.renderWarehouses();
        } catch (error) {
            console.error('Ошибка загрузки складов:', error);
            this.showError('Не удалось загрузить список складов');
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

        if (this.warehouseOptions.length === 0) {
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
        container.innerHTML = this.warehouseOptions.map(option => `
            <div class="warehouse-card ${this.filters.warehouse === option.value ? 'selected' : ''}" 
                 data-value="${option.value}">
                <div class="warehouse-icon">
                    <i class="fas fa-warehouse"></i>
                </div>
                <div class="warehouse-info">
                    <h4>${option.label}</h4>
                    <span class="warehouse-count">${option.count} отправлений</span>
                </div>
                <div class="warehouse-check">
                    <i class="fas fa-check"></i>
                </div>
            </div>
        `).join('');

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
        
        // Обновляем визуальное состояние
        document.querySelectorAll('.warehouse-card').forEach(card => {
            card.classList.toggle('selected', card.dataset.value === warehouse);
        });

        // Автоматически переходим к календарю
        setTimeout(() => {
            this.showStep(3);
        }, 300);
    }

    async loadSchedules() {
        if (!this.filters.marketplace || !this.filters.warehouse) {
            this.showStep(1);
            return;
        }

        try {
            const response = await fetch('../fetch_schedule.php', {
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error('Network response was not ok');
            }

            const data = await response.json();
            this.schedules = data;
            this.applyFilters();
            this.renderCalendar();
        } catch (error) {
            console.error('Ошибка загрузки расписания:', error);
            this.showError('Не удалось загрузить расписание');
        }
    }

    applyFilters() {
        this.filteredSchedules = this.schedules.filter(schedule => {
            const matchMarketplace = schedule.marketplace === this.filters.marketplace;
            const matchWarehouse = schedule.warehouses === this.filters.warehouse;
            return matchMarketplace && matchWarehouse;
        });

        // Группируем по датам для календаря
        this.calendarData = {};
        this.filteredSchedules.forEach(schedule => {
            const date = schedule.accept_date;
            if (!this.calendarData[date]) {
                this.calendarData[date] = [];
            }
            this.calendarData[date].push(schedule);
        });
    }

    renderCalendar() {
        const monthNames = [
            'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
            'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
        ];

        // Обновляем заголовок месяца
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

            // Проверяем, есть ли отправления на эту дату
            const hasSchedules = this.calendarData[dateStr] && this.calendarData[dateStr].length > 0;
            
            if (hasSchedules) {
                cell.classList.add('has-schedules');
                cell.innerHTML = `
                    <div class="cell-date">${day}</div>
                    <div class="schedule-indicator">
                        <i class="fas fa-plus pulse-icon"></i>
                        <span class="schedule-count">${this.calendarData[dateStr].length}</span>
                    </div>
                `;
                
                cell.addEventListener('click', () => {
                    this.openScheduleModal(dateStr, this.calendarData[dateStr]);
                });
            } else {
                cell.innerHTML = `<div class="cell-date">${day}</div>`;
            }

            calendarGrid.appendChild(cell);
        }

        // Заполняем оставшиеся ячейки следующего месяца
        const totalCells = 42; // 6 недель × 7 дней
        const currentCells = calendarGrid.children.length - 7; // минус заголовки
        const nextMonth = new Date(this.currentMonth.getFullYear(), this.currentMonth.getMonth() + 1, 1);
        
        for (let day = 1; currentCells + day <= totalCells - 7; day++) {
            const emptyCell = document.createElement('div');
            emptyCell.className = 'calendar-cell other-month';
            emptyCell.innerHTML = `<div class="cell-date">${day}</div>`;
            calendarGrid.appendChild(emptyCell);
        }
    }

    isToday(date) {
        const today = new Date();
        return date.getDate() === today.getDate() &&
               date.getMonth() === today.getMonth() &&
               date.getFullYear() === today.getFullYear();
    }

    openScheduleModal(date, schedules) {
        const modal = document.getElementById('scheduleDetailsModal');
        const content = document.getElementById('scheduleDetailsContent');
        
        if (!content) return;

        const formattedDate = new Date(date).toLocaleDateString('ru-RU', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

        content.innerHTML = `
            <div class="schedule-day-details">
                <div class="day-header">
                    <h4>Отправления на ${formattedDate}</h4>
                    <div class="day-stats">
                        <span class="schedule-count-badge">${schedules.length} отправлений</span>
                    </div>
                </div>
                
                <div class="schedules-list">
                    ${schedules.map(schedule => `
                        <div class="schedule-item" data-id="${schedule.id}">
                            <div class="schedule-item-header">
                                <div class="schedule-route">
                                    <i class="fas fa-route"></i>
                                    ${schedule.city} → ${schedule.warehouses}
                                </div>
                                <div class="schedule-status status-${this.getStatusClass(schedule.status)}">
                                    ${schedule.status}
                                </div>
                            </div>
                            
                            <div class="schedule-item-details">
                                <div class="detail-row">
                                    <span class="detail-label">Время приёмки:</span>
                                    <span class="detail-value">${schedule.accept_time || '—'}</span>
                                </div>
                                <div class="detail-row">
                                    <span class="detail-label">Дата сдачи:</span>
                                    <span class="detail-value">${this.formatDate(schedule.delivery_date)}</span>
                                </div>
                                <div class="detail-row">
                                    <span class="detail-label">Водитель:</span>
                                    <span class="detail-value">${schedule.driver_name || '—'}</span>
                                </div>
                                <div class="detail-row">
                                    <span class="detail-label">Автомобиль:</span>
                                    <span class="detail-value">${schedule.car_brand || '—'} ${schedule.car_number || ''}</span>
                                </div>
                            </div>
                            
                            <div class="schedule-item-actions">
                                <button class="create-order-btn" onclick="window.ScheduleManager.createOrderForSchedule(${schedule.id})">
                                    <i class="fas fa-plus"></i>
                                    Создать заявку
                                </button>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;

        window.app.openModal(modal);
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
        const schedule = this.schedules.find(s => s.id === scheduleId);
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