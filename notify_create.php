<?php
require_once 'session_init.php';
session_start();

// Разрешаем отправку уведомлений только администраторам и менеджерам
$role = $_SESSION['role'] ?? '';
if (!in_array($role, ['admin', 'manager'])) {
    http_response_code(403);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['success' => false, 'message' => 'Доступ запрещён']);
    exit();
}

require_once 'db_connection.php';
require_once 'notify_user.php';
header('Content-Type: application/json; charset=utf-8');

// Получение user_id через POST (или можешь брать из сессии)
$userId = intval($_POST['user_id'] ?? 0);
$message = trim($_POST['message'] ?? '');

if ($userId <= 0 || $message === '') {
    echo json_encode(['success' => false, 'message' => 'Некорректные данные']);
    exit;
}

if (sendNotification($conn, $userId, $message)) {
    echo json_encode([
        'success' => true,
        'message' => 'Уведомление создано',
    ]);
} else {
    echo json_encode(['success' => false, 'message' => 'Ошибка создания уведомления']);
}

$conn->close();