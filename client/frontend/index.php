<?php
$version = time();
?>
<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <title>Личный кабинет клиента</title>
    <link rel="stylesheet" href="/styles/layout.css?v=<?= $version ?>">
    <link rel="stylesheet" href="/styles/navbar.css?v=<?= $version ?>">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
</head>
<body>
<script>
    window.userRole = '<?= $_SESSION['role'] ?? 'client' ?>';
    const currentClientId = '<?= $_SESSION['user_id'] ?? 0 ?>';
</script>
<div class="navigation">
    <button class="icon-button" onclick="loadSchedule()"><i class="fas fa-calendar"></i> Расписание</button>
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
                <li onclick="loadChangeHistory()">История изменений</li>
                <li onclick="loadScheduleSettings()">Настройки расписания</li>
                <li onclick="loadEditData()">Редактирование данных</li>
                <li onclick="loadSettings()">Настройки</li>
                <li><a href="logout.php">Выйти</a></li>
            </ul>
        </div>
    </div>
</div>
<div id="dynamicContent"></div>
<script src="/client/lk.js?v=<?= $version ?>"></script>
<script type="module" src="/client/schedule.js?v=<?= $version ?>"></script>
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

document.addEventListener('DOMContentLoaded', () => {
    const bell = document.getElementById('notificationsBtn');
    if (bell) {
        bell.addEventListener('click', loadNotifications);
    }
    loadSchedule();
    fetchLiveNotifications();
});
setInterval(fetchLiveNotifications, 30000);
</script>
</body>
</html>
