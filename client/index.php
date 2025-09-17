<?php
require_once __DIR__ . '/../session_init.php';

session_start();

if (empty($_SESSION['user_id'])) {
    header('Location: ../auth_form.php');
    exit;
}
?>
<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>IDEAL TranSport - Клиентская панель</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <link rel="stylesheet" href="../styles/components.css">
    <link rel="stylesheet" href="styles/main.css">
    <link rel="stylesheet" href="styles/request-modal.css">
</head>
<body>
    <!-- Верхняя навигация для десктопа -->
    <nav class="desktop-nav">
        <div class="nav-container">
            <div class="nav-brand">
                <h1>FF IDEAL</h1>
                <span class="tagline">TranSport</span>
            </div>
            <div class="nav-links">
                <button class="nav-link active" data-section="schedule">
                    <i class="fas fa-calendar-alt"></i>
                    <span>Расписание</span>
                </button>
                <button class="nav-link" data-section="tariffs">
                    <i class="fas fa-money-bill-wave"></i>
                    <span>Тарифы</span>
                </button>
                <button class="nav-link" data-section="orders">
                    <i class="fas fa-box"></i>
                    <span>Мои заказы</span>
                </button>
                <button class="nav-link" data-section="profile">
                    <i class="fas fa-user-circle"></i>
                    <span>Личный кабинет</span>
                </button>
            </div>
            <div class="nav-actions">
                <button class="notification-btn" id="notificationBtn">
                    <i class="fas fa-bell"></i>
                    <span class="notification-badge" id="notificationBadge">3</span>
                </button>
                <div class="profile-menu">
                    <button class="profile-btn">
                        <div class="avatar" data-profile-initials></div>
                        <span class="profile-name" data-profile-name></span>
                        <i class="fas fa-chevron-down"></i>
                    </button>
                    <div class="profile-dropdown">
                        <a href="#" class="dropdown-item">
                            <i class="fas fa-cog"></i>
                            Настройки
                        </a>
                        <a href="../logout.php" class="dropdown-item" data-action="logout">
                            <i class="fas fa-sign-out-alt"></i>
                            Выйти
                        </a>
                    </div>
                </div>
            </div>
        </div>
    </nav>

    <!-- Основной контент -->
    <main class="main-content" id="mainContent">
        <!-- Раздел расписания -->
        <section class="content-section active" id="scheduleSection">
            <div class="section-header">
                <h2>Расписание отправлений</h2>
                <p>Пошаговый выбор: маркетплейс → склад → дата отправления</p>
            </div>

            <div class="step-wizard" data-progress="1">
                <div class="step-indicators">
                    <div class="step-indicator active" data-step="1">
                        <div class="step-circle">
                            <span class="step-number">1</span>
                            <i class="fas fa-check step-check"></i>
                        </div>
                        <span class="step-label">Маркетплейс</span>
                    </div>
                    <div class="step-line"></div>
                    <div class="step-indicator" data-step="2">
                        <div class="step-circle">
                            <span class="step-number">2</span>
                            <i class="fas fa-check step-check"></i>
                        </div>
                        <span class="step-label">Склад</span>
                    </div>
                    <div class="step-line"></div>
                    <div class="step-indicator" data-step="3">
                        <div class="step-circle">
                            <span class="step-number">3</span>
                            <i class="fas fa-check step-check"></i>
                        </div>
                        <span class="step-label">Расписание</span>
                    </div>
                </div>
            </div>

            <div class="steps-container">
                <div class="step-content active" id="step1">
                    <div class="step-card">
                        <div class="step-header">
                            <h3>
                                <i class="fas fa-store"></i>
                                Выберите маркетплейс
                            </h3>
                            <p>Укажите площадку, на которой оформляете отправку</p>
                        </div>

                        <div class="selection-banner" id="marketplaceBanner" data-state="active">
                            <div class="selection-banner__icon">
                                <i class="fas fa-store"></i>
                            </div>
                            <div class="selection-banner__content">
                                <h4 class="selection-banner__title" data-banner-title>Выберите маркетплейс</h4>
                                <p class="selection-banner__description" data-banner-description>
                                    После выбора площадки мы покажем подходящие склады и даты отправлений.
                                </p>
                            </div>
                            <div class="selection-banner__status" data-banner-status>Шаг 1 из 3</div>
                        </div>

                        <div class="selection-grid marketplace-grid" id="marketplaceGrid" role="list">
                            <div class="loading">
                                <div class="spinner"></div>
                                Загрузка маркетплейсов...
                            </div>
                        </div>
                    </div>
                </div>

                <div class="step-content" id="step2">
                    <div class="step-card">
                        <div class="step-header">
                            <h3>
                                <i class="fas fa-warehouse"></i>
                                Выберите склад назначения
                            </h3>
                            <p>Доступные склады для маркетплейса <span id="selectedMarketplace">—</span></p>
                        </div>

                        <div class="selection-banner" id="warehouseBanner" data-state="locked">
                            <div class="selection-banner__icon">
                                <i class="fas fa-warehouse"></i>
                            </div>
                            <div class="selection-banner__content">
                                <h4 class="selection-banner__title" data-banner-title>Сначала выберите маркетплейс</h4>
                                <p class="selection-banner__description" data-banner-description>
                                    Как только выберете площадку, мы подгрузим доступные склады.
                                </p>
                            </div>
                            <div class="selection-banner__status" data-banner-status>Шаг 2 из 3</div>
                        </div>

                        <div class="selection-grid warehouse-grid" id="warehouseGrid" role="list"></div>
                    </div>
                </div>

                <div class="step-content" id="step3">
                    <div class="step-card">
                        <div class="step-header">
                            <h3>
                                <i class="fas fa-calendar-alt"></i>
                                Расписание отправлений
                            </h3>
                            <p id="scheduleStepSubtitle">Чтобы увидеть расписание, выберите маркетплейс и склад</p>
                        </div>

                        <div class="step-summary">
                            <span class="summary-pill" id="summaryMarketplace">Маркетплейс: —</span>
                            <span class="summary-pill" id="summaryWarehouse">Склад: —</span>
                        </div>

                        <div class="schedule-step-layout">
                            <div class="schedule-grid" id="scheduleGrid"></div>

                            <div class="calendar-panel">
                                <div class="calendar-controls">
                                    <button class="calendar-nav" id="prevMonth">
                                        <i class="fas fa-chevron-left"></i>
                                    </button>
                                    <h3 id="currentMonth">Январь 2025</h3>
                                    <button class="calendar-nav" id="nextMonth">
                                        <i class="fas fa-chevron-right"></i>
                                    </button>
                                </div>
                                <div class="calendar-grid" id="calendarGrid"></div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="step-navigation">
                <button class="step-nav-btn secondary" id="stepBackBtn" style="display: none;">
                    <i class="fas fa-arrow-left"></i>
                    Назад
                </button>
                <button class="step-nav-btn primary" id="stepNextBtn" style="display: none;">
                    Далее
                    <i class="fas fa-arrow-right"></i>
                </button>
                <button class="step-nav-btn ghost" id="resetStepsBtn">
                    <i class="fas fa-rotate-right"></i>
                    Сбросить выбор
                </button>
            </div>
        </section>

        <!-- Раздел тарифов -->
        <section class="content-section" id="tariffsSection">
            <div class="section-header">
                <h2>Тарифы доставки</h2>
                <p>Актуальные цены на доставку по направлениям</p>
            </div>

            <div class="tariffs-container">
                <div class="city-tabs" id="cityTabs">
                    <!-- Табы городов генерируются динамически -->
                </div>
                <div class="tariffs-table-container" id="tariffsTable">
                    <!-- Таблица тарифов генерируется динамически -->
                </div>
            </div>
        </section>

        <!-- Раздел заказов -->
        <section class="content-section" id="ordersSection">
            <div class="section-header">
                <h2>Мои заказы</h2>
                <p>Управление вашими заявками и отслеживание статусов</p>
            </div>

            <div class="orders-controls">
                <div class="orders-tabs">
                    <button class="tab-btn active" data-tab="active">Активные</button>
                    <button class="tab-btn" data-tab="archive">Архив</button>
                </div>
                <button class="create-order-btn" id="createOrderBtn">
                    <i class="fas fa-plus"></i>
                    Создать заказ
                </button>
            </div>

            <div class="orders-grid" id="ordersGrid">
                <!-- Карточки заказов генерируются динамически -->
            </div>
        </section>

        <!-- Раздел профиля -->
        <section class="content-section" id="profileSection">
            <div class="section-header">
                <h2>Личный кабинет</h2>
                <p>Управление данными профиля и настройками</p>
            </div>

            <div class="profile-container">
                <div class="profile-card">
                    <div class="profile-header">
                        <div class="profile-avatar" data-profile-card-initials></div>
                        <div class="profile-info">
                            <h3 class="profile-full-name" data-profile-full-name></h3>
                            <p>Клиент с января 2024</p>
                        </div>
                    </div>

                    <form class="profile-form" id="profileForm">
                        <div class="form-row">
                            <div class="form-group">
                                <label>Фамилия</label>
                                <input type="text" name="lastName" value="" required>
                            </div>
                            <div class="form-group">
                                <label>Имя</label>
                                <input type="text" name="firstName" value="" required>
                            </div>
                        </div>

                        <div class="form-row">
                            <div class="form-group">
                                <label>Отчество</label>
                                <input type="text" name="middleName" value="">
                            </div>
                            <div class="form-group">
                                <label>Телефон</label>
                                <input type="tel" name="phone" value="" required>
                            </div>
                        </div>

                        <div class="form-group">
                            <label>Email</label>
                            <input type="email" name="email" value="" required>
                        </div>

                        <div class="form-group">
                            <label>Название ИП</label>
                            <input type="text" name="companyName" value="" required>
                        </div>

                        <div class="form-group">
                            <label>Название магазина</label>
                            <input type="text" name="storeName" value="" required>
                        </div>

                        <button type="submit" class="save-btn">
                            <i class="fas fa-save"></i>
                            Сохранить изменения
                        </button>
                    </form>
                </div>

                <div class="stats-card">
                    <h3>Статистика</h3>
                    <div class="stats-grid">
                        <div class="stat-item">
                            <div class="stat-value">12</div>
                            <div class="stat-label">Всего заказов</div>
                        </div>
                        <div class="stat-item">
                            <div class="stat-value">8</div>
                            <div class="stat-label">Выполнено</div>
                        </div>
                        <div class="stat-item">
                            <div class="stat-value">₽24,500</div>
                            <div class="stat-label">Общая сумма</div>
                        </div>
                        <div class="stat-item">
                            <div class="stat-value">95%</div>
                            <div class="stat-label">Успешность</div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    </main>

    <!-- Мобильная навигация -->
    <nav class="mobile-nav">
        <button class="mobile-nav-item active" data-section="schedule">
            <i class="fas fa-calendar-alt"></i>
            <span>Расписание</span>
        </button>
        <button class="mobile-nav-item" data-section="tariffs">
            <i class="fas fa-money-bill-wave"></i>
            <span>Тарифы</span>
        </button>
        <button class="mobile-nav-item" data-section="orders">
            <i class="fas fa-box"></i>
            <span>Заказы</span>
        </button>
        <button class="mobile-nav-item" data-section="profile">
            <i class="fas fa-user"></i>
            <span>Профиль</span>
        </button>
    </nav>

    <div class="modal" id="orderDetailsModal">
        <div class="modal-content">
            <div class="modal-header">
                <h3>Детали заказа</h3>
                <button class="modal-close" id="closeDetailsModal">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="modal-body" id="orderDetailsContent">
                <!-- Контент заполняется динамически -->
            </div>
        </div>
    </div>

    <div class="modal" id="scheduleDetailsModal">
        <div class="modal-content">
            <div class="modal-header">
                <h3>Детали отправления</h3>
                <button class="modal-close" id="closeScheduleModal">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="modal-body" id="scheduleDetailsContent">
                <!-- Контент заполняется динамически -->
            </div>
        </div>
    </div>

    <div class="modal" id="clientRequestModal">
        <div class="modal-content" id="clientRequestModalContent"></div>
    </div>

    <!-- Уведомления -->
    <div class="notifications-panel" id="notificationsPanel">
        <div class="notifications-header">
            <h3>Уведомления</h3>
            <button class="close-notifications" id="closeNotifications">
                <i class="fas fa-times"></i>
            </button>
        </div>
        <div class="notifications-content" id="notificationsContent">
            <!-- Уведомления генерируются динамически -->
        </div>
    </div>

    <script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></script>
    <script src="../requestForm.js"></script>
    <script src="js/app.js"></script>
    <script type="module" src="js/schedule/index.js"></script>
    <script src="js/tariffs.js"></script>
    <script src="js/orders.js"></script>
    <script src="js/profile.js"></script>
</body>
</html>