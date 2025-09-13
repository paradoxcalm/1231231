<?php
require_once __DIR__ . '/../session_init.php';
session_start();
if (!isset($_SESSION['role']) || $_SESSION['role'] !== 'client') {
    header('Location: /index.php');
    exit();
}
$version = time();
?>
<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Панель клиента</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
</head>
<body class="min-h-screen flex flex-col">
<script>
Object.defineProperty(window,'userRole',{value:'client',writable:false,configurable:false});
const currentClientId = '<?php echo $_SESSION['user_id'] ?? 0; ?>';
</script>
<nav class="bg-blue-800 text-white flex items-center justify-between px-4 py-3">
    <div class="flex items-center space-x-4">
        <a href="#" id="navHome" class="font-bold">IDEAL TranSport</a>
        <a href="#" id="navSchedule" class="hover:underline">Расписание</a>
        <a href="#" id="navTariffs" class="hover:underline">Тарифы</a>
        <a href="#" id="navOrders" class="hover:underline">Мои заказы</a>
    </div>
    <div class="flex items-center space-x-4">
        <button id="notificationsBtn" class="relative">
            <i class="fas fa-bell"></i>
            <span id="notificationBadge" class="hidden absolute -top-1 -right-1 bg-red-600 rounded-full text-xs px-1">0</span>
        </button>
        <div class="relative">
            <button id="profileBtn"><i class="fas fa-user-circle text-xl"></i></button>
            <div id="profileDropdown" class="hidden absolute right-0 mt-2 w-40 bg-white text-gray-800 rounded shadow">
                <a href="#" id="profileLink" class="block px-4 py-2 hover:bg-gray-100">Личный кабинет</a>
                <a href="/logout.php" class="block px-4 py-2 hover:bg-gray-100">Выйти</a>
            </div>
        </div>
    </div>
</nav>
<div id="dynamicContent" class="p-4 flex-1 overflow-y-auto"></div>
<script type="module" src="/schedules/index.js?v=<?php echo $version; ?>"></script>
<script src="/lk.js?v=<?php echo $version; ?>"></script>
<script src="/requestForm.js?v=<?php echo $version; ?>"></script>
<script src="/tariffs/tariffs.js?v=<?php echo $version; ?>"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></script>
<script src="app.js?v=<?php echo $version; ?>"></script>
</body>
</html>
