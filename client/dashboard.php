<?php
session_start();
if (!isset($_SESSION['role'])) {
    header('Location: auth_form.php');
    exit();
}
$role = $_SESSION['role'];
?>
<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <title>IDEAL TranSport</title>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <?php $version = time(); ?>
    <link rel="stylesheet" href="/client/styles/layout.css?v=<?php echo $version; ?>">
    <link rel="stylesheet" href="/client/styles/base.css?v=<?php echo $version; ?>">
    <link rel="stylesheet" href="/client/styles/buttons.css?v=<?php echo $version; ?>">
    <link rel="stylesheet" href="/client/styles/components.css?v=<?php echo $version; ?>">
    <link rel="stylesheet" href="/client/styles/form.css?v=<?php echo $version; ?>">
    <link rel="stylesheet" href="/client/styles/table.css?v=<?php echo $version; ?>">
    <link rel="stylesheet" href="/client/styles/edit_profile_styles.css?v=<?php echo $version; ?>">
    <link rel="stylesheet" href="/client/styles/delivery_pricing_styles.css?v=<?php echo $version; ?>">
    <link rel="stylesheet" href="/client/styles/navbar.css?v=<?php echo $version; ?>">
    <link rel="stylesheet" href="/client/styles/styles.css?v=<?php echo $version; ?>">
    <link rel="stylesheet" href="/client/styles/order_tile_styles.css?v=<?php echo $version; ?>">
    <link rel="stylesheet" href="/client/styles/schedule.css?v=<?php echo $version; ?>">
    <link rel="stylesheet" href="/client/styles/processing_styles.css?v=<?php echo $version; ?>">
    <link rel="stylesheet" href="/client/styles/profile.css?v=<?php echo $version; ?>">
    <link rel="stylesheet" href="/client/styles/responsive.css?v=<?php echo $version; ?>">
    <link rel="stylesheet" href="/client/styles/camera.css?v=<?php echo $version; ?>">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@700&display=swap" rel="stylesheet">
</head>
<body>
<script>
    window.userRole = '<?php echo $_SESSION['role'] ?? 'client'; ?>';
    const currentClientId = '<?php echo $_SESSION['user_id'] ?? 0; ?>';
</script>
<div class="main-panel">
    <div class="navigation">
        <button class="icon-button" id="btnSchedule"><i class="fas fa-calendar"></i> Расписание</button>
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
                    <li onclick="loadEditData()">Редактирование данных</li>
                    <li onclick="loadSettings()">Настройки</li>
                    <li><a href="logout.php">Выйти</a></li>
                </ul>
            </div>
        </div>
    </div>
</div>
<div class="dynamic-content" id="dynamicContent"></div>
<nav class="mobile-tab-bar">
    <button onclick="loadSchedule()" title="Расписание"><i class="fas fa-calendar"></i></button>
    <button onclick="loadNotifications()" title="Уведомления"><i class="fas fa-bell"></i></button>
    <button onclick="toggleMobileProfileMenu()" title="Профиль"><i class="fas fa-user-circle"></i></button>
</nav>
<div class="mobile-profile-menu hidden" id="mobileProfileMenu">
    <button onclick="loadEditData()">Редактировать данные</button>
    <button onclick="loadOrders()">Мои заказы</button>
    <button onclick="loadNotifications()">Уведомления</button>
    <a href="logout.php">Выйти</a>
</div>
<div class="modal" id="requestModal">
    <div class="modal-content">
        <div id="requestModalContent"></div>
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
<div class="modal" id="importResultModal" style="display:none;">
    <div class="modal-content">
        <span class="modal-close" onclick="document.getElementById('importResultModal').style.display='none';">&times;</span>
        <div id="importResultModalContent" style="padding: 20px;"></div>
    </div>
</div>
<!-- ✅ Скрипты -->
<!-- Личный кабинет: скрипты для раздела заказов пользователя -->
<script src="/client/lk.js?v=<?php echo $version; ?>"></script>
<!-- Библиотека jsQR для распознавания QR-кодов -->
<script src="https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js"></script>
<!-- Сканирование QR через камеру (видео + распознавание QR) -->
<script src="/client/scan.js?v=<?php echo $version; ?>"></script>
<!-- Автозаполнение поля "ИП" (название компании) по ФИО -->
<script src="/client/auto_ip_fill.js?v=<?php echo $version; ?>"></script>
<!-- Автогенерация названия компании из ФИО (профиль пользователя) -->
<script src="/client/auto_company_from_fio.js?v=<?php echo $version; ?>"></script>
<!-- Раздел "Обработка": добавление товаров, распределение по складам -->
<script src="/client/processing.js?v=<?php echo $version; ?>"></script>
<!-- Основные функции: загрузка разделов "Приёмка", "Таблица" и др. -->
<script src="/client/main.js?v=<?php echo $version; ?>"></script>
<!-- Раздел "Таблица": загрузка данных, пагинация, фильтрация -->
<script src="/client/table.js?v=<?php echo $version; ?>"></script>
<!-- Раздел "Приёмка": отрисовка и динамика формы приёмки -->
<script src="/client/form.js?v=<?php echo $version; ?>"></script>
<!-- Автозаполнение данных пользователя (ИП, магазин) в формах -->
<script src="/client/autofill_user_fields.js?v=<?php echo $version; ?>"></script>
<!-- Модальное окно заявки: вкладки "Приёмка" и "Обработка" -->
<script src="/client/requestForm.js?v=<?php echo $version; ?>"></script>
<!-- Предпросмотр фото и галерея изображений -->
<script src="/client/photoPreview.js?v=<?php echo $version; ?>"></script>
<!-- Модуль "Расписание": импортирует scheduleMain.js и задаёт loadSchedule() -->
<script type="module" src="/client/schedule.js?v=<?=$version?>"></script>
<!-- Библиотека QRCode.js для генерации QR-кодов -->
<script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></script>
<!-- Библиотека pdfmake для формирования PDF-файлов -->
<script src="https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.1.70/pdfmake.min.js"></script>
<!-- Встроенные шрифты для pdfmake -->
<script src="https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.1.70/vfs_fonts.js"></script>

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
    loadSchedule();
};

// ✅ Обработка формы импорта Excel
document.getElementById("importScheduleForm").addEventListener("submit", function(e) {
    e.preventDefault();
    const form = e.target;
    const formData = new FormData(form);

    fetch('import_schedule_csv.php', {
        method: 'POST',
        body: formData
    })
    .then(r => r.json())
    .then(data => {
        if (data.success) {
            if (data.errors && data.errors.length > 0) {
                showImportResultModal(data.inserted, data.errors);
            } else {
                alert(`✅ Загружено ${data.inserted} строк без ошибок.`);
            }
        } else {
            alert("❌ Ошибка: " + data.message);
        }
    })
    .catch(err => {
        alert("❌ Сетевая ошибка: " + err.message);
    });
});

// ✅ Модалка отчёта об импорте
function showImportResultModal(inserted, errors) {
    let html = `<p>✅ Успешно добавлено: <strong>${inserted}</strong></p>`;
    if (errors.length > 0) {
        html += `<p>❌ Ошибки:</p><ul style="padding-left:16px;">`;
        for (const e of errors) {
            html += `<li>Строка ${e.row}: ${e.error}</li>`;
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
        <span class="modal-close" onclick="document.getElementById('shipmentReportModal').style.display='none';">&times;</span>
        <h2>Список отправлений</h2>
        <!-- сюда JS запишет таблицу -->
        <div id="shipmentReportText" style="padding:16px; overflow:auto; max-height:80vh;"></div>
    </div>
</div>

</body>
</html>
