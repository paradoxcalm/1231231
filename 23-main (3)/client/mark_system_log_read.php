<?php
session_start();
header('Content-Type: application/json; charset=utf-8');
require_once 'db_connection.php';

if ($_SESSION['role'] !== 'admin') {
    echo json_encode(['success' => false, 'message' => 'Доступ запрещён']);
    exit;
}

$id = intval($_POST['id'] ?? 0);
if (!$id) {
    echo json_encode(['success' => false, 'message' => 'Некорректный ID']);
    exit;
}

$stmt = $conn->prepare("UPDATE system_logs SET is_read = 1 WHERE id = ?");
$stmt->bind_param("i", $id);
$stmt->execute();
$stmt->close();

echo json_encode(['success' => true]);
$conn->close();
