<?php
require_once 'session_init.php';
session_start();
if (!isset($_SESSION['role'])) {
    header('Location: auth_form.php');
    exit();
}
$role = $_SESSION['role'];

// Если у пользователя роль "deliverer", отправляем его на страницу курьера
if ($role === 'deliverer') {
    header('Location: /deliver/index.php');
    exit();
}

// Если пользователь не админ и не менеджер, отправляем его в личный кабинет клиента
if ($role !== 'admin' && $role !== 'manager') {
    header('Location: /client/dashboard.php');
    exit();
}


?>

<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <title>IDEAL TranSport</title>
    
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <script src="https://api-maps.yandex.ru/2.1/?lang=ru_RU" type="text/javascript"></script>
    <?php $version = time(); ?>
    <link rel="stylesheet" href="styles/layout.css?v=<?php echo $version; ?>">
    <link rel="stylesheet" href="styles/base.css?v=<?php echo $version; ?>">
    <link rel="stylesheet" href="styles/buttons.css?v=<?php echo $version; ?>">
    <link rel="stylesheet" href="styles/components.css?v=<?php echo $version; ?>">
    <link rel="stylesheet" href="styles/tariffs_section.css?v=<?php echo $version; ?>">
    <link rel="stylesheet" href="styles/form.css?v=<?php echo $version; ?>">
    <link rel="stylesheet" href="styles/table.css?v=<?php echo $version; ?>">
    <link rel="stylesheet" href="styles/edit_profile_styles.css?v=<?php echo $version; ?>">
    <link rel="stylesheet" href="styles/delivery_pricing_styles.css?v=<?php echo $version; ?>">
    <link rel="stylesheet" href="styles/navbar.css?v=<?php echo $version; ?>">
    <link rel="stylesheet" href="styles/styles.css?v=<?php echo $version; ?>">
    <link rel="stylesheet" href="styles/fbs.css?v=<?php echo $version; ?>">
    <link rel="stylesheet" href="styles/import.css?v=<?php echo $version; ?>">
    <link rel="stylesheet" href="styles/auth_form.css?v=<?php echo $version; ?>">
    <link rel="stylesheet" href="styles/order_tile_styles.css?v=<?php echo $version; ?>">
    <link rel="stylesheet" href="styles/schedule.css?v=<?php echo $version; ?>">
    <link rel="stylesheet" href="styles/processing_styles.css?v=<?php echo $version; ?>">
    <link rel="stylesheet" href="styles/profile.css?v=<?php echo $version; ?>">
    <link rel="stylesheet" href="styles/responsive.css?v=<?php echo $version; ?>">
    <link rel="stylesheet" href="styles/camera.css?v=<?php echo $version; ?>">
    <link rel="stylesheet" href="styles/clients.css?v=<?php echo $version; ?>">
    <link rel="stylesheet" href="styles/photo-preview.css?v=<?php echo $version; ?>">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@700&display=swap" rel="stylesheet">
</head>
<body>
<script>
Object.defineProperty(window, 'userRole', {
  value: '<?php echo $_SESSION['role'] ?? 'client'; ?>',
  writable: false,
  configurable: false
});
const currentClientId = '<?php echo $_SESSION['user_id'] ?? 0; ?>';
</script>

<div class="main-panel">
    <div class="navigation">
        <?php if ($role === 'admin' || $role === 'manager'): ?>
            <button class="icon-button" onclick="loadForm()"><i class="fas fa-box"></i> Приёмка</button>
            <button class="icon-button" onclick="loadProcessing()"><i class="fas fa-cogs"></i> Обработка</button>
            <button class="icon-button" onclick="loadFBS()"><i class="fas fa-warehouse"></i> FBS</button>
            <button class="icon-button" onclick="loadAllOrders()"><i class="fas fa-list"></i> Все заказы</button>
            <button class="icon-button" onclick="loadTable()"><i class="fas fa-table"></i> Таблица</button>
        <?php endif; ?>

            <button id="tariffsBtn" class="icon-button">
                <i class="fas fa-money-bill"></i> Тарифы
            </button>

        <button class="icon-button" onclick="loadSchedule()"><i class="fas fa-calendar"></i> Расписание</button>

        <?php if ($role === 'admin' || $role === 'manager'): ?>
            <button class="icon-button" onclick="loadStatistics()"><i class="fas fa-chart-pie"></i> Статистика</button>
        <?php endif; ?>

        <?php if ($role === 'admin' || $role === 'manager'): ?>
            <button class="icon-button" onclick="loadClients()"><i class="fas fa-users"></i> Клиенты</button>
        <?php endif; ?>
        <?php if ($role === 'admin'): ?>
            <button class="icon-button" onclick="loadSystemLogs()"><i class="fas fa-tools"></i> Система</button>
        <?php endif; ?>

        <button class="icon-button" id="notificationsBtn">
            <i class="fas fa-bell"></i>
            <span id="notificationBadge" class="badge hidden">0</span>
        </button>

        <div class="profile-menu">
            <button class="icon-button profile-button" onclick="toggleProfileMenu()">
                <i class="fas fa-user-circle"></i> Личный кабинет
            </button>
            <div class="profile-dropdown" id="profileDropdown">
                <ul>
                    <li onclick="loadOrders()">Мои заказы</li>
                    <?php if ($role === 'admin'): ?>
                        <li onclick="loadChangeHistory()">История изменений</li>
                        <li onclick="loadScheduleSettings()">Настройки расписания</li>
                    <?php endif; ?>
                    <li onclick="loadEditData()">Редактирование данных</li>
                    <li onclick="loadSettings()">Настройки</li>
                    <li><a href="logout.php">Выйти</a></li>
                </ul>
            </div>
        </div>
    </div>
</div>

<div class="dynamic-content" id="dynamicContent"></div>

<!-- Мобильная нижняя навигация -->
<nav class="mobile-tab-bar">
    <?php if ($role === 'admin' || $role === 'manager'): ?>
        <!-- Приёмка (для админа и менеджера) -->
        <button onclick="loadForm()" title="Приёмка">
            <i class="fas fa-inbox"></i>
        </button>
    <?php endif; ?>

    <!-- Расписание -->
    <button onclick="loadSchedule()" title="Расписание">
        <i class="fas fa-calendar"></i>
    </button>

    <!-- Уведомления -->
    <button onclick="loadNotifications()" title="Уведомления">
        <i class="fas fa-bell"></i>
    </button>

    <!-- Тарифы -->
    <button id="mobileTariffsBtn" onclick="loadTariffs()" title="Тарифы">
        <i class="fas fa-money-bill"></i>
    </button>

    <?php if ($role === 'admin' || $role === 'manager'): ?>
        <!-- FBS -->
        <button onclick="loadFBS()" title="FBS">
            <i class="fas fa-warehouse"></i>
        </button>
        <!-- Все заказы -->
        <button onclick="loadAllOrders()" title="Все заказы">
            <i class="fas fa-list"></i>
        </button>
        <!-- Таблица -->
        <button onclick="loadTable()" title="Таблица">
            <i class="fas fa-table"></i>
        </button>
    <?php endif; ?>

    <!-- Профиль -->
    <button onclick="toggleMobileProfileMenu()" title="Профиль">
        <i class="fas fa-user-circle"></i>
    </button>
</nav>



<!-- Мобильное выдвижное меню профиля -->
<div class="mobile-profile-menu" id="mobileProfileMenu">
    <?php if ($role === 'admin'): ?>
        <button onclick="loadEditData()">Редактировать данные</button>
        <button onclick="loadOrders()">Мои заказы</button>
        <button onclick="loadChangeHistory()">История изменений</button>
        <button onclick="loadScheduleSettings()">Настройки расписания</button>
        <a href="logout.php">Выйти</a>
    <?php elseif ($role === 'manager'): ?>
        <button onclick="loadEditData()">Редактировать данные</button>
        <button onclick="loadOrders()">Мои заказы</button>
        <a href="logout.php">Выйти</a>
    <?php else: ?>
        <button onclick="loadOrders()">Мои заказы</button>
        <a href="logout.php">Выйти</a>
    <?php endif; ?>
</div>

<div class="modal" id="requestModal">
    <div class="modal-content">
        <div id="requestModalContent"></div>
    </div>
</div>


<!-- Модальное окно тарифов -->
<div id="tariffsModal" class="tariffs-modal">
  <div class="tariffs-modal-dialog">
   
    <!-- Список городов (кнопки) -->
    <div class="city-list"><!-- Кнопки городов вставляются скриптом --></div>
    <!-- Контейнер для таблицы тарифов -->
    <div id="tariffTableContainer"></div>
  </div>
</div>
 
<!-- ✅ Модальное окно: импорт расписания (CSV) -->
<div class="modal" id="importScheduleModal" style="display:none;">
  <div class="modal-content">
    <span class="modal-close" onclick="closeModal('importScheduleModal')">&times;</span>
    <h2>Импорт расписаний (.csv)</h2>
    <form id="importScheduleForm" enctype="multipart/form-data">
      <input type="file" name="excel_file" accept=".csv" required>
      <br><br>
      <button type="submit">Загрузить</button>
      <p id="importResult" style="color:green;"></p>
    </form>
  </div>
</div>

<div id="photoModal" class="modal">
  <span id="photoModalClose" class="close-button">&times;</span>
  <img id="photoModalImg" class="modal-image" src="" alt="Фото">
</div>

<div class="modal" id="importResultModal" style="display:none;">
  <div class="modal-content">
    <span class="modal-close" onclick="document.getElementById('importResultModal').style.display='none';">&times;</span>
    <div id="importResultModalContent" style="padding: 20px;"></div>
  </div>
</div>
<!-- ✅ Скрипты -->
<script src="lk.js?v=<?php echo $version; ?>"></script>
<script src="https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js"></script>
<script src="scan.js?v=<?php echo $version; ?>"></script>
<script src="reception_pdf.js"></script>
<script src="auto_ip_fill.js?v=<?php echo $version; ?>"></script>
<script src="auto_company_from_fio.js?v=<?php echo $version; ?>"></script>
<script src="processing.js?v=<?php echo $version; ?>"></script>
<script src="main.js?v=<?php echo $version; ?>"></script>
<script src="table.js?v=<?php echo $version; ?>"></script>
<script src="form.js?v=<?php echo $version; ?>"></script>
<script src="clients.js?v=<?php echo $version; ?>"></script>
<script src="tariffs/tariffs.js?v=<?php echo $version; ?>"></script>
<script src="autofill_user_fields.js?v=<?php echo $version; ?>"></script>
<script src="schedule.js?v=<?php echo $version; ?>"></script>
<script src="fbs/fbs.js?v=<?php echo $version; ?>"></script>
<script src="fbs/fbs_pdf.js?v=<?php echo $version; ?>"></script>
<script src="requestForm.js?v=<?php echo $version; ?>"></script>
<script src="photoPreview.js?v=<?php echo $version; ?>"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.1.70/pdfmake.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.1.70/vfs_fonts.js"></script>
<script src="import.js?v=<?php echo $version; ?>"></script>
<script>
function toggleProfileMenu() {
    const dropdown = document.getElementById('profileDropdown');
    const isVisible = dropdown.style.display === 'block';
    dropdown.style.display = isVisible ? 'none' : 'block';
    document.removeEventListener('click', handleClickOutsideProfile);
    if (!isVisible) {
        setTimeout(() => {
            document.addEventListener('click', handleClickOutsideProfile);
        }, 0);
    }
}
function handleClickOutsideProfile(e) {
    const dropdown = document.getElementById('profileDropdown');
    const button = document.querySelector('.profile-button');
    if (!dropdown || !button) return;
    const clickedInside = e.target.closest('.profile-dropdown') || e.target.closest('.profile-button');
    if (!clickedInside) {
        dropdown.style.display = 'none';
        document.removeEventListener('click', handleClickOutsideProfile);
    }
}
function toggleMobileProfileMenu() {
    const menu = document.getElementById("mobileProfileMenu");
    if (!menu || window.innerWidth > 768) return;
    menu.classList.toggle("visible");
}
document.addEventListener('click', function (e) {
    const menu = document.getElementById("mobileProfileMenu");
    if (!menu) return;
    const isInside = e.target.closest('.mobile-profile-menu');
    const isFromButton = e.target.closest('.mobile-tab-bar');
    if (!isInside && !isFromButton) {
        menu.classList.remove("visible");
    }
});
window.addEventListener('resize', () => {
    const menu = document.getElementById("mobileProfileMenu");
    if (window.innerWidth > 768 && menu) {
        menu.classList.remove("visible");
    }
});
function updateNotificationBadge(count) {
    const badge = document.getElementById("notificationBadge");
    if (!badge) return;
    if (count > 0) {
        badge.textContent = count;
        badge.classList.remove("hidden");
    } else {
        badge.classList.add("hidden");
    }
}
function fetchLiveNotifications() {
    fetch('fetch_notifications.php')
        .then(r => r.json())
        .then(data => {
            if (!Array.isArray(data)) return;
            updateNotificationBadge(data.length);
        });
}
document.addEventListener('DOMContentLoaded', () => {
    const bell = document.getElementById("notificationsBtn");
    if (bell) {
        bell.addEventListener("click", loadNotifications);
    }
});
setInterval(fetchLiveNotifications, 30000);
window.onload = function () {
    switch (userRole) {
        case 'admin': loadTable(); break;
        case 'manager': loadForm(); break;
        default: loadSchedule(); break;
    }
};




document.addEventListener('DOMContentLoaded', function() {
    const btn = document.getElementById('tariffsBtn');
    if (btn && typeof loadTariffs === 'function') {
        btn.addEventListener('click', loadTariffs);
    } else if (!btn) {
        console.error('Кнопка #tariffsBtn не найдена');
    } else {
        console.error('Функция loadTariffs не определена');
    }
});



// Модальное окно с результатами импорта
function showImportResultModal(result) {
    let html = `<p>Всего строк: <strong>${result.rows}</strong></p>`;
    html += `<p>Добавлено: <strong>${result.inserted}</strong></p>`;
    html += `<p>Ошибок: <strong>${result.failed}</strong></p>`;
    if (result.failed > 0) {
        html += `<p>Детали ошибок:</p><ul style="padding-left:16px;">`;
        for (const entry of result.details) {
            if (!entry.success) {
                for (const err of entry.errors) {
                    // Формируем описание ошибки в формате [код, поле, сообщение, причина]
                    let errorText = `[${err.code}`;
                    if (err.field)   errorText += `, ${err.field}`;
                    if (err.message) errorText += `, ${err.message}`;
                    if (err.cause)   errorText += `, ${err.cause}`;
                    errorText += ']';
                    html += `<li>Строка ${entry.row}: ${errorText}</li>`;
                }
            }
        }
        html += `</ul>`;
    }
    document.getElementById("importResultModalContent").innerHTML = html;
    document.getElementById("importResultModal").style.display = "block";
}

function closeModal(id) {
    const modal = document.getElementById(id);
    if (modal) {
        modal.style.display = 'none';
    }
}

</script>
<div id="modalContainer" class="modal"></div>
<!-- Модальное окно управления расписанием -->
<div id="scheduleManagementModal" class="modal" style="display:none;">
    <div class="modal-content">
        <span class="close" onclick="closeScheduleManagementModal()">&times;</span>
        <h2>Управление отправлениями</h2>

        <!-- Сюда JS подставит таблицу расписаний -->
        <div id="managementScheduleList" style="margin-top:20px;"></div>
        <div class="modal-actions" style="margin-top:20px;">
            <button id="btnMassDelete" class="action-button delete-btn" onclick="massManageSchedules('delete')">Удалить</button>
            <button id="btnMassArchive" class="action-button archive-btn" onclick="massManageSchedules('archive')">Отправить в архив</button>
        </div>
        <div id="massManageMessages" style="margin-top:10px;"></div>
    </div>
</div>
<!-- Модальное окно «Список отправлений» -->
<div class="modal" id="shipmentReportModal" style="display:none;">
  <div class="modal-content" style="max-width:1100px;">
    <span class="modal-close"
          onclick="document.getElementById('shipmentReportModal').style.display='none';">&times;</span>
    <h2>Список отправлений</h2>
    <!-- сюда JS запишет таблицу -->
    <div id="shipmentReportText" style="padding:16px;overflow:auto;max-height:80vh;"></div>
  </div>
</div>

</body>
</html>