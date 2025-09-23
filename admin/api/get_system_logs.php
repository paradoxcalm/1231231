<?php
require_once __DIR__ . '/../../session_init.php';
session_start();
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/../../db_connection.php';

$role = $_SESSION['role'] ?? '';
if ($role !== 'admin') {
    echo json_encode(['success' => false, 'message' => 'Доступ только для администратора']);
    exit;
}

try {
    $stmt = $conn->query("SELECT id, type, message, created_at, is_read FROM system_logs ORDER BY created_at DESC LIMIT 100");
    $logs = [];
    while ($row = $stmt->fetch_assoc()) {
        $logs[] = $row;
    }
    echo json_encode(['success' => true, 'logs' => $logs]);
} catch (Exception $e) {
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
}
$conn->close();