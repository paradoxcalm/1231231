<?php
require_once 'session_init.php';
session_start();
header('Content-Type: application/json; charset=utf-8');
require_once 'db_connection.php';

$userId = $_SESSION['user_id'] ?? 0;
$role   = $_SESSION['role'] ?? 'client';

if (!$userId || $role !== 'client') {
    echo json_encode(['success' => false, 'message' => 'Доступ запрещён']);
    exit;
}

try {
    // Получаем уникальные schedule_id, где есть заказы этого клиента
    $stmt = $conn->prepare("
        SELECT s.id, s.city, s.accept_date, s.accept_time, s.delivery_date, s.status, s.car_brand, s.car_number, s.driver_name, s.driver_phone,
               COUNT(o.order_id) as my_orders_count
        FROM schedules s
        INNER JOIN orders o ON o.schedule_id = s.id
        WHERE o.user_id = ?
        GROUP BY s.id
        ORDER BY s.accept_date DESC
    ");
    $stmt->bind_param("i", $userId);
    $stmt->execute();
    $res = $stmt->get_result();
    $schedules = [];
    while ($row = $res->fetch_assoc()) {
        $schedules[] = $row;
    }
    echo json_encode(['success' => true, 'schedules' => $schedules]);
} catch (Exception $e) {
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
}
$conn->close();