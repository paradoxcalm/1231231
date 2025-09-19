<?php
// *** logout.php ***
require_once 'session_init.php';
session_start();
require_once 'db_connection.php';

// Очистка токена в БД при наличии
if (!empty($_SESSION['user_id'])) {
    $stmt = $conn->prepare("UPDATE usersff SET remember_token = NULL, token_expiry = NULL WHERE id = ?");
    $stmt->bind_param("i", $_SESSION['user_id']);
    $stmt->execute();
    $stmt->close();
}

// Удаление cookie «Запомнить меня» и сессии
$cookieSecurity = ff_get_cookie_security_options();
$expiredOptions = array_merge([
    'expires' => time() - 3600,
    'path' => '/',
], $cookieSecurity);
setcookie('remember_token', '', $expiredOptions);
setcookie('remember_user', '', $expiredOptions);

// Удаление cookie сессии (чтобы браузер не хранил устаревший PHPSESSID)
setcookie(session_name(), '', $expiredOptions);

// Завершение сессии на сервере
$_SESSION = [];
session_unset();
session_destroy();

// Редирект на страницу входа
header('Location: auth_form.php');
exit();
?>