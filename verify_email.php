<?php
require_once 'session_init.php';
session_start();
require_once 'db_connection.php';

if (!isset($_GET['token'])) {
    header("Location: auth_form.php");
    exit();
}

$token = $_GET['token'];
$stmt  = $conn->prepare("SELECT id, is_verified FROM usersff WHERE verify_token = ? LIMIT 1");
$stmt->bind_param("s", $token);
$stmt->execute();
$result = $stmt->get_result();
$user   = $result->fetch_assoc();
$stmt->close();

if ($user) {
    if ($user['is_verified'] == 0) {
        // Помечаем пользователя подтверждённым
        $upd = $conn->prepare("UPDATE usersff SET is_verified = 1, verify_token = NULL WHERE id = ?");
        $upd->bind_param("i", $user['id']);
        $upd->execute();
        $upd->close();
    }
    // Перенаправляем на форму входа с сообщением об успешном подтверждении
    header("Location: auth_form.php?success=Ваш Email успешно подтверждён.");
    exit();
} else {
    // Неверный или устаревший токен подтверждения
    header("Location: auth_form.php?error=Недействительная ссылка подтверждения");
    exit();
}
?>