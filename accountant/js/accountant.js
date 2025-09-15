// Современный интерфейс бухгалтера
class AccountantApp {
    constructor() {
        this.currentSection = 'dashboard';
        this.currentPage = 1;
        this.pageSize = 20;
        this.sortField = 'order_date';
        this.sortDirection = 'desc';
        this.filters = {};
        this.charts = {};
        
        this.init();
    }

    init() {
        this.setupNavigation();
        this.setupEventListeners();
        this.loadDashboard();
    }

    setupNavigation() {
        const navItems = document.querySelectorAll('.nav-item');
        navItems.forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const section = item.dataset.section;
                this.switchSection(section);
                
                // Обновляем активные состояния
                navItems.forEach(nav => nav.classList.remove('active'));
                item.classList.add('active');
            });
        });

        // Обработчики для ссылок "Посмотреть все"
        document.querySelectorAll('.view-all-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const section = link.dataset.section;
                if (section) {
                    this.switchSection(section);
                    document.querySelector(`[data-section="${section}"]`).classList.add('active');
                    document.querySelectorAll('.nav-item').forEach(nav => {
                        if (nav.dataset.section !== section) {
                            nav.classList.remove('active');
                        }
                    });
                }
            });
        });
    }

    setupEventListeners() {
        // Кнопки в заголовке
        document.getElementById('refreshBtn').addEventListener('click', () => {
            this.refreshCurrentSection();
        });

        document.getElementById('exportBtn').addEventListener('click', () => {
            this.exportData();
        });

        // Фильтры заказов
        document.getElementById('applyFilters').addEventListener('click', () => {
            this.applyFilters();
        });

        document.getElementById('resetFilters').addEventListener('click', () => {
            this.resetFilters();
        });

        // Пагинация
        document.getElementById('prevPage').addEventListener('click', () => {
            if (this.currentPage > 1) {
                this.currentPage--;
                this.loadOrders();
            }
        });

        document.getElementById('nextPage').addEventListener('click', () => {
            this.currentPage++;
            this.loadOrders();
        });

        // Модальные окна
        document.querySelectorAll('.modal-close').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const modal = e.target.closest('.modal');
                this.closeModal(modal);
            });
        });

        // Форма редактирования платежа
        document.getElementById('editPaymentForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.savePaymentEdit();
        });

        // Аналитика - переключение периодов
        document.querySelectorAll('.period-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.loadAnalytics(btn.dataset.period);
            });
        });

        // Поиск клиентов
        document.getElementById('clientSearch').addEventListener('input', (e) => {
            this.searchClients(e.target.value);
        });

        // Сортировка клиентов
        document.getElementById('clientSort').addEventListener('change', (e) => {
            this.sortClients(e.target.value);
        });
    }

    switchSection(sectionName) {
        // Скрываем все секции
        document.querySelectorAll('.content-section').forEach(section => {
            section.classList.remove('active');
        });

        // Показываем выбранную секцию
        const targetSection = document.getElementById(`${sectionName}-section`);
        if (targetSection) {
            targetSection.classList.add('active');
            this.currentSection = sectionName;
        }

        // Обновляем заголовок
        this.updatePageHeader(sectionName);

        // Загружаем данные для секции
        this.loadSectionData(sectionName);
    }

    updatePageHeader(sectionName) {
        const titles = {
            dashboard: { title: 'Дашборд', subtitle: 'Обзор финансовых показателей' },
            orders: { title: 'Заказы', subtitle: 'Управление заказами и платежами' },
            reports: { title: 'Отчёты', subtitle: 'Формирование отчётов' },
            analytics: { title: 'Аналитика', subtitle: 'Анализ данных и трендов' },
            clients: { title: 'Клиенты', subtitle: 'Информация о клиентах' },
            settings: { title: 'Настройки', subtitle: 'Настройки системы' }
        };

        const config = titles[sectionName] || { title: 'Панель', subtitle: '' };
        document.getElementById('pageTitle').textContent = config.title;
        document.getElementById('pageSubtitle').textContent = config.subtitle;
    }

    loadSectionData(sectionName) {
        switch (sectionName) {
            case 'dashboard':
                this.loadDashboard();
                break;
            case 'orders':
                this.loadOrders();
                break;
            case 'reports':
                this.loadReports();
                break;
            case 'analytics':
                this.loadAnalytics('month');
                break;
            case 'clients':
                this.loadClients();
                break;
            case 'settings':
                this.loadSettings();
                break;
        }
    }

    async loadDashboard() {
        try {
            // Загружаем сводные данные
            const summaryResponse = await fetch('../api/accountant/get_summary.php');
            const summaryData = await summaryResponse.json();

            if (summaryData.success) {
                this.updateMetrics(summaryData.data);
            }

            // Загружаем данные для графиков
            await this.loadDashboardCharts();
            await this.loadTopClients();
            await this.loadRecentOrders();

        } catch (error) {
            console.error('Ошибка загрузки дашборда:', error);
            this.showToast('Ошибка загрузки данных дашборда', 'error');
        }
    }

    updateMetrics(data) {
        document.getElementById('totalShipments').textContent = data.shipments_count || 0;
        document.getElementById('totalRevenue').textContent = this.formatCurrency(data.total_payments || 0);
        document.getElementById('totalClients').textContent = data.clients_count || 0;
        
        const avgOrder = data.shipments_count > 0 ? (data.total_payments / data.shipments_count) : 0;
        document.getElementById('avgOrder').textContent = this.formatCurrency(avgOrder);
    }

    async loadDashboardCharts() {
        try {
            // График выручки
            const revenueData = await this.fetchRevenueData(30);
            this.createRevenueChart(revenueData);

        } catch (error) {
            console.error('Ошибка загрузки графиков:', error);
        }
    }

    async loadTopClients() {
        try {
            const response = await fetch('../api/accountant/get_top_clients.php');
            const data = await response.json();

            if (data.success) {
                this.renderTopClients(data.clients);
            }
        } catch (error) {
            console.error('Ошибка загрузки топ клиентов:', error);
        }
    }

    renderTopClients(clients) {
        const container = document.getElementById('topClients');
        
        if (!clients || clients.length === 0) {
            container.innerHTML = '<div class="empty-state"><p>Нет данных о клиентах</p></div>';
            return;
        }

        container.innerHTML = clients.map(client => `
            <div class="client-item">
                <div class="client-avatar">
                    ${this.getInitials(client.client_name)}
                </div>
                <div class="client-info">
                    <div class="client-name">${client.client_name}</div>
                    <div class="client-stats">${client.orders_count} заказов</div>
                </div>
                <div class="client-revenue">${this.formatCurrency(client.total_revenue)}</div>
            </div>
        `).join('');
    }

    async loadRecentOrders() {
        try {
            const response = await fetch('../api/accountant/get_orders.php?page=1&per_page=5&sort_field=order_date&sort_dir=desc');
            const data = await response.json();

            if (data.success) {
                this.renderRecentOrders(data.data.orders);
            } else {
                this.showToast(data.message || 'Ошибка загрузки последних заказов', 'error');
            }
        } catch (error) {
            console.error('Ошибка загрузки последних заказов:', error);
        }
    }

    renderRecentOrders(orders) {
        const container = document.getElementById('recentOrders');
        
        if (!orders || orders.length === 0) {
            container.innerHTML = '<div class="empty-state"><p>Нет последних заказов</p></div>';
            return;
        }

        container.innerHTML = `
            <table>
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Клиент</th>
                        <th>Сумма</th>
                        <th>Статус</th>
                        <th>Дата</th>
                    </tr>
                </thead>
                <tbody>
                    ${orders.map(order => `
                        <tr>
                            <td>#${order.order_id}</td>
                            <td>${order.client || '—'}</td>
                            <td>${this.formatCurrency(order.payment)}</td>
                            <td><span class="status-badge ${this.getStatusClass(order.status)}">${order.status}</span></td>
                            <td>${this.formatDate(order.order_date)}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    }

    async loadOrders() {
        try {
            const params = new URLSearchParams({
                page: this.currentPage,
                per_page: this.pageSize,
                sort_field: this.sortField,
                sort_dir: this.sortDirection,
                ...this.filters
            });

            const response = await fetch(`../api/accountant/get_orders.php?${params}`);
            const data = await response.json();

            if (data.success) {
                this.renderOrdersTable(data.data.orders);
                this.updatePagination(data.data.total);
            } else {
                this.showToast(data.message || 'Ошибка загрузки заказов', 'error');
            }
        } catch (error) {
            console.error('Ошибка загрузки заказов:', error);
            this.showToast('Ошибка загрузки заказов', 'error');
        }
    }

    renderOrdersTable(orders) {
        const tbody = document.getElementById('ordersTableBody');
        
        if (!orders || orders.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="9" class="empty-state">
                        <i class="fas fa-inbox"></i>
                        <h3>Нет заказов</h3>
                        <p>По выбранным фильтрам заказы не найдены</p>
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = orders.map(order => `
            <tr>
                <td>#${order.order_id}</td>
                <td>${this.formatDate(order.order_date)}</td>
                <td>${this.formatDate(order.submission_date)}</td>
                <td>${order.city || '—'}${order.warehouses ? ' / ' + order.warehouses : ''}</td>
                <td>${order.client || '—'}</td>
                <td>${this.formatCurrency(order.payment)}</td>
                <td>${order.payment_type || '—'}</td>
                <td><span class="status-badge ${this.getStatusClass(order.status)}">${order.status}</span></td>
                <td>
                    <div class="table-actions">
                        <button class="action-btn edit" onclick="accountantApp.editPayment(${order.order_id}, ${order.payment}, '${order.payment_type || ''}')">
                            <i class="fas fa-edit"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');

        // Добавляем сортировку
        this.setupTableSorting();
    }

    setupTableSorting() {
        const headers = document.querySelectorAll('#ordersTable th[data-sort]');
        headers.forEach(header => {
            header.addEventListener('click', () => {
                const field = header.dataset.sort;
                
                if (this.sortField === field) {
                    this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
                } else {
                    this.sortField = field;
                    this.sortDirection = 'asc';
                }

                // Обновляем визуальные индикаторы
                headers.forEach(h => {
                    h.classList.remove('sort-asc', 'sort-desc');
                });
                header.classList.add(`sort-${this.sortDirection}`);

                this.currentPage = 1;
                this.loadOrders();
            });
        });
    }

    updatePagination(total) {
        const totalPages = Math.ceil(total / this.pageSize);
        
        // Обновляем информацию
        const start = (this.currentPage - 1) * this.pageSize + 1;
        const end = Math.min(this.currentPage * this.pageSize, total);
        document.getElementById('paginationInfo').textContent = `Показано ${start}-${end} из ${total}`;

        // Обновляем кнопки
        document.getElementById('prevPage').disabled = this.currentPage <= 1;
        document.getElementById('nextPage').disabled = this.currentPage >= totalPages;

        // Генерируем номера страниц
        this.renderPageNumbers(totalPages);
    }

    renderPageNumbers(totalPages) {
        const container = document.getElementById('pageNumbers');
        const maxVisible = 5;
        const start = Math.max(1, this.currentPage - Math.floor(maxVisible / 2));
        const end = Math.min(totalPages, start + maxVisible - 1);

        let html = '';
        for (let i = start; i <= end; i++) {
            html += `
                <button class="page-btn ${i === this.currentPage ? 'active' : ''}" 
                        onclick="accountantApp.goToPage(${i})">
                    ${i}
                </button>
            `;
        }

        container.innerHTML = html;
    }

    goToPage(page) {
        this.currentPage = page;
        this.loadOrders();
    }

    applyFilters() {
        this.filters = {
            date_from: document.getElementById('dateFrom').value,
            date_to: document.getElementById('dateTo').value,
            city: document.getElementById('cityFilter').value,
            client_id: document.getElementById('clientFilter').value
        };

        // Удаляем пустые фильтры
        Object.keys(this.filters).forEach(key => {
            if (!this.filters[key]) {
                delete this.filters[key];
            }
        });

        this.currentPage = 1;
        this.loadOrders();
    }

    resetFilters() {
        document.getElementById('dateFrom').value = '';
        document.getElementById('dateTo').value = '';
        document.getElementById('cityFilter').value = '';
        document.getElementById('clientFilter').value = '';
        
        this.filters = {};
        this.currentPage = 1;
        this.loadOrders();
    }

    editPayment(orderId, currentAmount, currentType) {
        document.getElementById('editOrderId').value = orderId;
        document.getElementById('editPaymentAmount').value = currentAmount;
        document.getElementById('editPaymentType').value = currentType;
        
        this.openModal(document.getElementById('editPaymentModal'));
    }

    async savePaymentEdit() {
        try {
            const orderId = document.getElementById('editOrderId').value;
            const amount = parseFloat(document.getElementById('editPaymentAmount').value);
            const type = document.getElementById('editPaymentType').value;

            const response = await fetch('../api/accountant/update_payment.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    order_id: parseInt(orderId),
                    payment: amount,
                    payment_type: type
                })
            });

            const result = await response.json();

            if (result.success) {
                this.showToast('Платёж успешно обновлён', 'success');
                this.closeModal(document.getElementById('editPaymentModal'));
                this.loadOrders();
                this.loadDashboard(); // Обновляем метрики
            } else {
                this.showToast(result.message || 'Ошибка обновления платежа', 'error');
            }
        } catch (error) {
            console.error('Ошибка сохранения платежа:', error);
            this.showToast('Ошибка сохранения платежа', 'error');
        }
    }

    async loadReports() {
        // Отчёты уже отрендерены в HTML, добавляем интерактивность
        console.log('Раздел отчётов загружен');
    }

    async loadAnalytics(period = 'month') {
        try {
            // Загружаем данные для графиков аналитики
            await this.loadCitiesChart();
            await this.loadPaymentTypesChart();
            await this.loadTrendsChart(period);
        } catch (error) {
            console.error('Ошибка загрузки аналитики:', error);
        }
    }

    async loadClients() {
        try {
            const response = await fetch('../api/accountant/get_clients_stats.php');
            const data = await response.json();

            if (data.success) {
                this.renderClientsGrid(data.clients);
            }
        } catch (error) {
            console.error('Ошибка загрузки клиентов:', error);
        }
    }

    renderClientsGrid(clients) {
        const container = document.getElementById('clientsGrid');
        
        if (!clients || clients.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-users"></i>
                    <h3>Нет клиентов</h3>
                    <p>Клиенты не найдены</p>
                </div>
            `;
            return;
        }

        container.innerHTML = clients.map(client => `
            <div class="client-card">
                <div class="client-card-header">
                    <div class="client-card-avatar">
                        ${this.getInitials(client.name)}
                    </div>
                    <div class="client-card-info">
                        <h4>${client.name}</h4>
                        <p>${client.email || client.phone || '—'}</p>
                    </div>
                </div>
                <div class="client-card-stats">
                    <div class="stat-item">
                        <div class="stat-value">${client.orders_count}</div>
                        <div class="stat-label">Заказов</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-value">${this.formatCurrency(client.total_revenue)}</div>
                        <div class="stat-label">Выручка</div>
                    </div>
                </div>
            </div>
        `).join('');
    }

    loadSettings() {
        // Настройки уже отрендерены в HTML
        console.log('Раздел настроек загружен');
    }

    // Графики
    async fetchRevenueData(days) {
        const response = await fetch(`../api/accountant/get_revenue_timeseries.php?days=${days}`);
        const json = await response.json();

        const labels = [];
        const data = [];

        if (json && json.success && Array.isArray(json.data)) {
            json.data.forEach(item => {
                labels.push(new Date(item.date).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' }));
                data.push(item.amount);
            });
        }

        return { labels, data };
    }

    createRevenueChart(chartData) {
        const ctx = document.getElementById('revenueChart').getContext('2d');
        
        if (this.charts.revenue) {
            this.charts.revenue.destroy();
        }

        this.charts.revenue = new Chart(ctx, {
            type: 'line',
            data: {
                labels: chartData.labels,
                datasets: [{
                    label: 'Выручка',
                    data: chartData.data,
                    borderColor: '#3b82f6',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: (value) => this.formatCurrency(value)
                        }
                    }
                }
            }
        });
    }

    async loadCitiesChart() {
        const canvasId = 'citiesChart';
        const canvas = document.getElementById(canvasId);
        const container = canvas.parentElement;

        try {
            const response = await fetch('../api/accountant/get_city_stats.php');
            const result = await response.json();

            if (!result.success) {
                throw new Error(result.message || 'Ошибка сервера');
            }

            const labels = result.labels || [];
            const dataValues = result.data || [];

            if (!labels.length || !dataValues.length) {
                container.innerHTML = '<div class="empty-state"><p>Нет данных по городам</p></div>';
                return;
            }

            container.innerHTML = `<canvas id="${canvasId}" width="300" height="300"></canvas>`;
            const ctx = document.getElementById(canvasId).getContext('2d');

            const data = {
                labels: labels,
                datasets: [{
                    data: dataValues,
                    backgroundColor: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316']
                }]
            };

            if (this.charts.cities) {
                this.charts.cities.destroy();
            }

            this.charts.cities = new Chart(ctx, {
                type: 'doughnut',
                data: data,
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'bottom'
                        }
                    }
                }
            });
        } catch (error) {
            console.error('Ошибка загрузки статистики по городам:', error);
            this.showToast('Ошибка загрузки статистики по городам', 'error');
            container.innerHTML = '<div class="empty-state"><p>Не удалось загрузить данные</p></div>';
        }
    }

    
    async loadPaymentTypesChart() {
        const canvasId = 'paymentTypesChart';
        const canvas = document.getElementById(canvasId);
        const container = canvas.parentElement;

        try {
            const response = await fetch('../api/accountant/get_payment_types.php');
            const result = await response.json();

            if (!result.success) {
                throw new Error(result.message || 'Ошибка сервера');
            }

            const labels = result.labels || [];
            const dataValues = result.data || [];

            if (!labels.length || !dataValues.length) {
                container.innerHTML = '<div class="empty-state"><p>Нет данных</p></div>';
                return;
            }

            container.innerHTML = `<canvas id="${canvasId}" width="300" height="300"></canvas>`;
            const ctx = document.getElementById(canvasId).getContext('2d');

            const data = {
                labels: labels,
                datasets: [{
                    data: dataValues,
                    backgroundColor: ['#10b981', '#3b82f6', '#ef4444', '#f59e0b', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316']
                }]
            };

            if (this.charts.paymentTypes) {
                this.charts.paymentTypes.destroy();
            }

            this.charts.paymentTypes = new Chart(ctx, {
                type: 'pie',
                data: data,
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'bottom'
                        }
                    }
                }
            });
        } catch (error) {
            console.error('Ошибка загрузки статистики по типам оплаты:', error);
            this.showToast('Ошибка загрузки статистики по типам оплаты', 'error');
            container.innerHTML = '<div class="empty-state"><p>Не удалось загрузить данные</p></div>';
        }
    }



    async loadTrendsChart(period) {
        const canvasId = 'trendsChart';
        const canvas = document.getElementById(canvasId);
        const container = canvas.parentElement;

        try {
            const response = await fetch(`../api/accountant/get_trends.php?period=${encodeURIComponent(period)}`);
            const result = await response.json();

            if (!result.success) {
                throw new Error(result.message || 'Ошибка сервера');
            }

            const points = result.data || [];
            if (!points.length) {
                container.innerHTML = '<div class="empty-state"><p>Нет данных</p></div>';
                return;
            }

            const labels = points.map(p => p.label);
            const revenueData = points.map(p => p.revenue);
            const ordersData = points.map(p => p.orders);

            container.innerHTML = `<canvas id="${canvasId}" width="400" height="300"></canvas>`;
            const ctx = document.getElementById(canvasId).getContext('2d');

            if (this.charts.trends) {
                this.charts.trends.destroy();
            }

            this.charts.trends = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: labels,
                    datasets: [{
                        label: 'Выручка',
                        data: revenueData,
                        borderColor: '#10b981',
                        backgroundColor: 'rgba(16, 185, 129, 0.1)',
                        borderWidth: 2,
                        fill: true,
                        yAxisID: 'y'
                    }, {
                        label: 'Заказы',
                        data: ordersData,
                        borderColor: '#3b82f6',
                        backgroundColor: 'rgba(59, 130, 246, 0.1)',
                        borderWidth: 2,
                        fill: true,
                        yAxisID: 'y1'
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    interaction: {
                        mode: 'index',
                        intersect: false
                    },
                    scales: {
                        y: {
                            type: 'linear',
                            display: true,
                            position: 'left',
                            ticks: {
                                callback: (value) => this.formatCurrency(value)
                            }
                        },
                        y1: {
                            type: 'linear',
                            display: true,
                            position: 'right',
                            grid: {
                                drawOnChartArea: false
                            }
                        }
                    }
                }
            });
        } catch (error) {
            console.error('Ошибка загрузки трендов:', error);
            this.showToast('Ошибка загрузки трендов', 'error');
            container.innerHTML = '<div class="empty-state"><p>Не удалось загрузить данные</p></div>';
        }
    }

    // Утилиты
    formatCurrency(amount) {
        return new Intl.NumberFormat('ru-RU', {
            style: 'currency',
            currency: 'RUB',
            minimumFractionDigits: 0
        }).format(amount);
    }

    formatDate(dateString) {
        if (!dateString) return '—';
        return new Date(dateString).toLocaleDateString('ru-RU');
    }

    getInitials(name) {
        if (!name) return '?';
        return name.split(' ').map(word => word[0]).join('').toUpperCase().slice(0, 2);
    }

    getStatusClass(status) {
        const statusMap = {
            'Выгрузите товар': 'status-pending',
            'Товар выгружен': 'status-pending',
            'Готов к отправке': 'status-pending',
            'В пути': 'status-pending',
            'Доставлен': 'status-completed',
            'Завершено': 'status-completed',
            'Отменен': 'status-cancelled',
            'Отклонён': 'status-cancelled'
        };
        
        return statusMap[status] || 'status-pending';
    }

    refreshCurrentSection() {
        this.loadSectionData(this.currentSection);
        this.showToast('Данные обновлены', 'success');
    }

    exportData() {
        // Экспорт данных текущей секции
        if (this.currentSection === 'orders') {
            this.exportOrders();
        } else if (this.currentSection === 'dashboard') {
            this.exportDashboard();
        }
    }

    exportOrders() {
        const params = new URLSearchParams(this.filters);
        window.open(`../api/accountant/export_orders.php?${params}`, '_blank');
    }

    exportDashboard() {
        window.open('../api/accountant/export_dashboard.php', '_blank');
    }

    searchClients(query) {
        // Реализация поиска клиентов
        console.log('Поиск клиентов:', query);
    }

    sortClients(sortBy) {
        // Реализация сортировки клиентов
        console.log('Сортировка клиентов по:', sortBy);
    }

    // Модальные окна
    openModal(modal) {
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    closeModal(modal) {
        modal.classList.remove('active');
        document.body.style.overflow = '';
    }

    // Уведомления
    showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `
            <div class="toast-content">
                <i class="fas ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle'}"></i>
                <span>${message}</span>
            </div>
        `;

        document.body.appendChild(toast);

        // Показываем toast
        setTimeout(() => toast.classList.add('show'), 100);

        // Автоматически скрываем
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 4000);
    }
}

// Функции для отчётов
function generateFinancialReport() {
    window.open('../api/accountant/reports/financial.php', '_blank');
}

function generateClientReport() {
    window.open('../api/accountant/reports/clients.php', '_blank');
}

function generateMonthlyReport() {
    const month = prompt('Введите месяц (YYYY-MM):');
    if (month) {
        window.open(`../api/accountant/reports/monthly.php?month=${month}`, '_blank');
    }
}

function closeModal(modalId) {
    const modal = typeof modalId === 'string' ? document.getElementById(modalId) : modalId;
    if (modal) {
        accountantApp.closeModal(modal);
    }
}

// Инициализация приложения
document.addEventListener('DOMContentLoaded', () => {
    window.accountantApp = new AccountantApp();
});