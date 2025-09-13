<?php
session_start();
require_once 'db_connection.php';

// Очистка токена в БД
if (!empty($_SESSION['user_id'])) {
    $stmt = $conn->prepare("UPDATE usersff SET remember_token = NULL, token_expiry = NULL WHERE id = ?");
    $stmt->bind_param("i", $_SESSION['user_id']);
    $stmt->execute();
    $stmt->close();
}

// Удаление куки
$secure = !empty($_SERVER['HTTPS']);
setcookie('remember_token', '', time() - 3600, "/", "", $secure, true);
setcookie('remember_user', '', time() - 3600, "/", "", $secure, true);

// Очистка сессии
$_SESSION = [];
session_unset();
session_destroy();

// Редирект
header('Location: auth_form.php');
exit();
?>
