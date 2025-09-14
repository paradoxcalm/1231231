<?php
session_start();
header('Content-Type: application/json; charset=utf-8');
require_once 'db_connection.php';

$role = $_SESSION['role'] ?? '';

if ($role !== 'admin') {
    echo json_encode(['success' => false, 'message' => 'Доступ только для администратора']);
    exit;
}

try {
    $res = $conn->query("
        SELECT id, city, warehouses, accept_date, delivery_date,
               driver_name, driver_phone, car_number, car_brand, status
        FROM schedules
        ORDER BY accept_date DESC
    ");

    $list = [];
    while ($row = $res->fetch_assoc()) {
        $list[] = $row;
    }

    echo json_encode($list);

} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => 'Ошибка: ' . $e->getMessage()]);
} finally {
    $conn->close();
}
