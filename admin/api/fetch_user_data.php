<?php
require_once __DIR__ . '/../../session_init.php';
session_start();
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/../../db_connection.php';

$userId = $_SESSION['user_id'] ?? 0;

if (!$userId) {
    echo json_encode([
        'success' => false,
        'message' => 'Пользователь не авторизован'
    ]);
    exit;
}

$stmt = $conn->prepare("
    SELECT
        phone,
        email,
        first_name,
        last_name,
        middle_name,
        company_name,
        store_name
    FROM usersff
    WHERE id = ?
");
if (!$stmt) {
    echo json_encode(['success' => false, 'message' => 'Ошибка подготовки запроса']);
    exit;
}

$stmt->bind_param("i", $userId);
$stmt->execute();
$result = $stmt->get_result();
$user = $result->fetch_assoc();
$stmt->close();
$conn->close();

if ($user) {
    echo json_encode([
        'success' => true,
        'data' => $user
    ]);
} else {
    echo json_encode([
        'success' => false,
        'message' => 'Пользователь не найден'
    ]);
}
?>