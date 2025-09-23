<?php
require_once __DIR__ . '/../../session_init.php';
session_start();
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/../../db_connection.php';

$role = $_SESSION['role'] ?? '';
if (!in_array($role, ['admin', 'manager'])) {
    echo json_encode(['success' => false, 'message' => 'Доступ запрещён']);
    exit;
}

$data = json_decode(file_get_contents('php://input'), true);
$userId = intval($data['user_id'] ?? 0);
if ($userId <= 0) {
    echo json_encode(['success' => false, 'message' => 'Некорректный ID']);
    exit;
}

$stmt = $conn->prepare('DELETE FROM usersff WHERE id = ?');
if (!$stmt) {
    echo json_encode(['success' => false, 'message' => 'DB error']);
    exit;
}
$stmt->bind_param('i', $userId);
if ($stmt->execute()) {
    echo json_encode(['success' => true]);
} else {
    echo json_encode(['success' => false, 'message' => $stmt->error]);
}
$stmt->close();
$conn->close();
?>
