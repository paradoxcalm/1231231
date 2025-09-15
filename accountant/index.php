<?php
require_once __DIR__ . '/../db_connection.php';
require_once __DIR__ . '/../session_init.php';
require_once __DIR__ . '/../auth_helper.php';

session_start();
if (!isset($_SESSION['role']) || $_SESSION['role'] !== 'accountant') {
    header('Location: /index.php');
    exit();
}
requireRole(['accountant']);
?>
<!DOCTYPE html>
<html lang='ru'>
<head>
    <meta charset='utf-8'>
    <meta name='viewport' content='width=device-width, initial-scale=1.0'>
    <title>Панель бухгалтера - IDEAL TranSport</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <link rel="stylesheet" href="styles/accountant.css">
</head>
<body>
    <!-- Боковая панель -->
    <aside class="sidebar">
        <div class="sidebar-header">
            <div class="logo">
                <i class="fas fa-calculator"></i>
                <span>Бухгалтерия</span>
            </div>
        </div>
        
        <nav class="sidebar-nav">
            <a href="#" class="nav-item active" data-section="dashboard">
                <i class="fas fa-chart-line"></i>
                <span>Дашборд</span>
            </a>
            <a href="#" class="nav-item" data-section="orders">
                <i class="fas fa-file-invoice"></i>
                <span>Заказы</span>
            </a>
            <a href="#" class="nav-item" data-section="reports">
                <i class="fas fa-chart-bar"></i>
                <span>Отчёты</span>
            </a>
            <a href="#" class="nav-item" data-section="analytics">
                <i class="fas fa-analytics"></i>
                <span>Аналитика</span>
            </a>
            <a href="#" class="nav-item" data-section="clients">
                <i class="fas fa-users"></i>
                <span>Клиенты</span>
            </a>
            <a href="#" class="nav-item" data-section="settings">
                <i class="fas fa-cog"></i>
                <span>Настройки</span>
            </a>
        </nav>
        
        <div class="sidebar-footer">
            <a href="../logout.php" class="logout-btn">
                <i class="fas fa-sign-out-alt"></i>
                <span>Выйти</span>
            </a>
        </div>
    </aside>

    <!-- Основной контент -->
    <main class="main-content">
        <!-- Заголовок -->
        <header class="content-header">
            <div class="header-left">
                <h1 id="pageTitle">Дашборд</h1>
                <p id="pageSubtitle">Обзор финансовых показателей</p>
            </div>
            <div class="header-right">
                <button class="btn btn-secondary" id="refreshBtn">
                    <i class="fas fa-sync-alt"></i>
                    Обновить
                </button>
                <button class="btn btn-primary" id="exportBtn">
                    <i class="fas fa-download"></i>
                    Экспорт
                </button>
            </div>
        </header>

        <!-- Контент секций -->
        <div class="content-body">
            <!-- Дашборд -->
            <section id="dashboard-section" class="content-section active">
                <!-- Карточки метрик -->
                <div class="metrics-grid">
                    <div class="metric-card">
                        <div class="metric-icon">
                            <i class="fas fa-shipping-fast"></i>
                        </div>
                        <div class="metric-content">
                            <div class="metric-value" id="totalShipments">0</div>
                            <div class="metric-label">Отправлений</div>
                            <div class="metric-change positive">
                                <i class="fas fa-arrow-up"></i>
                                <span>+12%</span>
                            </div>
                        </div>
                    </div>
                    
                    <div class="metric-card">
                        <div class="metric-icon revenue">
                            <i class="fas fa-ruble-sign"></i>
                        </div>
                        <div class="metric-content">
                            <div class="metric-value" id="totalRevenue">0 ₽</div>
                            <div class="metric-label">Выручка</div>
                            <div class="metric-change positive">
                                <i class="fas fa-arrow-up"></i>
                                <span>+8%</span>
                            </div>
                        </div>
                    </div>
                    
                    <div class="metric-card">
                        <div class="metric-icon clients">
                            <i class="fas fa-users"></i>
                        </div>
                        <div class="metric-content">
                            <div class="metric-value" id="totalClients">0</div>
                            <div class="metric-label">Клиентов</div>
                            <div class="metric-change positive">
                                <i class="fas fa-arrow-up"></i>
                                <span>+5%</span>
                            </div>
                        </div>
                    </div>
                    
                    <div class="metric-card">
                        <div class="metric-icon avg">
                            <i class="fas fa-chart-pie"></i>
                        </div>
                        <div class="metric-content">
                            <div class="metric-value" id="avgOrder">0 ₽</div>
                            <div class="metric-label">Средний чек</div>
                            <div class="metric-change negative">
                                <i class="fas fa-arrow-down"></i>
                                <span>-2%</span>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Графики и таблицы -->
                <div class="dashboard-grid">
                    <div class="dashboard-card">
                        <div class="card-header">
                            <h3>Динамика выручки</h3>
                            <div class="card-actions">
                                <select id="revenueChartPeriod">
                                    <option value="7">7 дней</option>
                                    <option value="30" selected>30 дней</option>
                                    <option value="90">90 дней</option>
                                </select>
                            </div>
                        </div>
                        <div class="card-content">
                            <canvas id="revenueChart" width="400" height="200"></canvas>
                        </div>
                    </div>
                    
                    <div class="dashboard-card">
                        <div class="card-header">
                            <h3>Топ клиенты</h3>
                        </div>
                        <div class="card-content">
                            <div id="topClients" class="top-clients-list">
                                <!-- Заполняется JS -->
                            </div>
                        </div>
                    </div>
                    
                    <div class="dashboard-card full-width">
                        <div class="card-header">
                            <h3>Последние операции</h3>
                            <a href="#" class="view-all-link" data-section="orders">Посмотреть все</a>
                        </div>
                        <div class="card-content">
                            <div id="recentOrders" class="recent-orders-table">
                                <!-- Заполняется JS -->
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            <!-- Заказы -->
            <section id="orders-section" class="content-section">
                <div class="section-toolbar">
                    <div class="filters-panel">
                        <div class="filter-group">
                            <label>Период</label>
                            <input type="date" id="dateFrom" class="filter-input">
                            <input type="date" id="dateTo" class="filter-input">
                        </div>
                        <div class="filter-group">
                            <label>Город</label>
                            <input type="text" id="cityFilter" placeholder="Поиск по городу" class="filter-input">
                        </div>
                        <div class="filter-group">
                            <label>Клиент</label>
                            <input type="number" id="clientFilter" placeholder="ID клиента" class="filter-input">
                        </div>
                        <button class="btn btn-primary" id="applyFilters">
                            <i class="fas fa-search"></i>
                            Применить
                        </button>
                        <button class="btn btn-secondary" id="resetFilters">
                            <i class="fas fa-times"></i>
                            Сбросить
                        </button>
                    </div>
                </div>
                
                <div class="table-container">
                    <table id="ordersTable" class="data-table">
                        <thead>
                            <tr>
                                <th data-sort="order_id">ID</th>
                                <th data-sort="order_date">Дата заказа</th>
                                <th data-sort="submission_date">Дата отправки</th>
                                <th data-sort="city">Город/Склад</th>
                                <th data-sort="client">Клиент</th>
                                <th data-sort="payment">Сумма</th>
                                <th data-sort="payment_type">Тип оплаты</th>
                                <th data-sort="status">Статус</th>
                                <th>Действия</th>
                            </tr>
                        </thead>
                        <tbody id="ordersTableBody">
                            <!-- Заполняется JS -->
                        </tbody>
                    </table>
                </div>
                
                <div class="pagination-wrapper">
                    <div class="pagination-info">
                        <span id="paginationInfo">Показано 0 из 0</span>
                    </div>
                    <div class="pagination-controls">
                        <button class="btn btn-sm" id="prevPage" disabled>
                            <i class="fas fa-chevron-left"></i>
                        </button>
                        <div id="pageNumbers" class="page-numbers">
                            <!-- Заполняется JS -->
                        </div>
                        <button class="btn btn-sm" id="nextPage" disabled>
                            <i class="fas fa-chevron-right"></i>
                        </button>
                    </div>
                </div>
            </section>

            <!-- Отчёты -->
            <section id="reports-section" class="content-section">
                <div class="reports-grid">
                    <div class="report-card">
                        <div class="report-icon">
                            <i class="fas fa-file-excel"></i>
                        </div>
                        <div class="report-content">
                            <h3>Финансовый отчёт</h3>
                            <p>Детальный отчёт по доходам и расходам</p>
                            <button class="btn btn-primary" onclick="generateFinancialReport()">
                                Сформировать
                            </button>
                        </div>
                    </div>
                    
                    <div class="report-card">
                        <div class="report-icon">
                            <i class="fas fa-chart-line"></i>
                        </div>
                        <div class="report-content">
                            <h3>Отчёт по клиентам</h3>
                            <p>Анализ активности и платежей клиентов</p>
                            <button class="btn btn-primary" onclick="generateClientReport()">
                                Сформировать
                            </button>
                        </div>
                    </div>
                    
                    <div class="report-card">
                        <div class="report-icon">
                            <i class="fas fa-calendar-alt"></i>
                        </div>
                        <div class="report-content">
                            <h3>Месячный отчёт</h3>
                            <p>Сводка за выбранный месяц</p>
                            <button class="btn btn-primary" onclick="generateMonthlyReport()">
                                Сформировать
                            </button>
                        </div>
                    </div>
                </div>
            </section>

            <!-- Аналитика -->
            <section id="analytics-section" class="content-section">
                <div class="analytics-toolbar">
                    <div class="period-selector">
                        <button class="period-btn active" data-period="week">Неделя</button>
                        <button class="period-btn" data-period="month">Месяц</button>
                        <button class="period-btn" data-period="quarter">Квартал</button>
                        <button class="period-btn" data-period="year">Год</button>
                    </div>
                </div>
                
                <div class="analytics-grid">
                    <div class="analytics-card">
                        <div class="card-header">
                            <h3>Распределение по городам</h3>
                        </div>
                        <div class="card-content">
                            <canvas id="citiesChart" width="300" height="300"></canvas>
                        </div>
                    </div>
                    
                    <div class="analytics-card">
                        <div class="card-header">
                            <h3>Типы оплаты</h3>
                        </div>
                        <div class="card-content">
                            <canvas id="paymentTypesChart" width="300" height="300"></canvas>
                        </div>
                    </div>
                    
                    <div class="analytics-card full-width">
                        <div class="card-header">
                            <h3>Тренды доходов</h3>
                        </div>
                        <div class="card-content">
                            <canvas id="trendsChart" width="600" height="300"></canvas>
                        </div>
                    </div>
                </div>
            </section>

            <!-- Клиенты -->
            <section id="clients-section" class="content-section">
                <div class="clients-toolbar">
                    <div class="search-box">
                        <i class="fas fa-search"></i>
                        <input type="text" id="clientSearch" placeholder="Поиск клиентов...">
                    </div>
                    <div class="sort-options">
                        <select id="clientSort">
                            <option value="name">По имени</option>
                            <option value="revenue">По выручке</option>
                            <option value="orders">По заказам</option>
                            <option value="date">По дате</option>
                        </select>
                    </div>
                </div>
                
                <div id="clientsGrid" class="clients-grid">
                    <!-- Заполняется JS -->
                </div>
            </section>

            <!-- Настройки -->
            <section id="settings-section" class="content-section">
                <div class="settings-grid">
                    <div class="settings-card">
                        <h3>Уведомления</h3>
                        <div class="setting-item">
                            <label class="switch">
                                <input type="checkbox" id="emailNotifications" checked>
                                <span class="slider"></span>
                            </label>
                            <span>Email уведомления</span>
                        </div>
                        <div class="setting-item">
                            <label class="switch">
                                <input type="checkbox" id="pushNotifications">
                                <span class="slider"></span>
                            </label>
                            <span>Push уведомления</span>
                        </div>
                    </div>
                    
                    <div class="settings-card">
                        <h3>Отчёты</h3>
                        <div class="setting-item">
                            <label>Автоматические отчёты</label>
                            <select id="autoReports">
                                <option value="none">Отключено</option>
                                <option value="daily">Ежедневно</option>
                                <option value="weekly">Еженедельно</option>
                                <option value="monthly">Ежемесячно</option>
                            </select>
                        </div>
                    </div>
                </div>
            </section>
        </div>
    </main>

    <!-- Модальные окна -->
    <div id="editPaymentModal" class="modal">
        <div class="modal-content">
            <div class="modal-header">
                <h3>Редактировать платёж</h3>
                <button class="modal-close">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="modal-body">
                <form id="editPaymentForm">
                    <input type="hidden" id="editOrderId">
                    <div class="form-group">
                        <label>Сумма платежа</label>
                        <input type="number" id="editPaymentAmount" step="0.01" required>
                    </div>
                    <div class="form-group">
                        <label>Тип оплаты</label>
                        <select id="editPaymentType" required>
                            <option value="">Выберите тип</option>
                            <option value="Наличные">Наличные</option>
                            <option value="ТБанк">Т-Банк</option>
                            <option value="Долг">Долг</option>
                        </select>
                    </div>
                    <div class="form-actions">
                        <button type="button" class="btn btn-secondary" onclick="closeModal('editPaymentModal')">
                            Отмена
                        </button>
                        <button type="submit" class="btn btn-primary">
                            Сохранить
                        </button>
                    </div>
                </form>
            </div>
        </div>
    </div>

    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <script src="js/accountant.js"></script>
</body>
</html>