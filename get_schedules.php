<?php
require_once 'session_init.php';
session_start();
header('Content-Type: application/json; charset=utf-8');
require_once 'db_connection.php';

$role = $_SESSION['role'] ?? '';

if ($role !== 'admin') {
    echo json_encode(['success' => false, 'message' => 'Доступ только для администратора']);
    exit;
}

try {
    // Чтение фильтров из GET-параметров
    $marketplace = trim($_GET['marketplace'] ?? '');
    $city        = trim($_GET['city'] ?? '');
    $warehouse   = trim($_GET['warehouse'] ?? '');

    // Формируем WHERE-условие и параметры
    $where = [];
    $params = [];
    $types = '';

    if ($marketplace !== '') {
        $where[] = 'marketplace = ?';
        $params[] = $marketplace;
        $types .= 's';
    }
    if ($city !== '') {
        $where[] = 'city = ?';
        $params[] = $city;
        $types .= 's';
    }
    if ($warehouse !== '') {
        $where[] = 'warehouses = ?';
        $params[] = $warehouse;
        $types .= 's';
    }

    $sql = "
        SELECT id, city, warehouses, accept_date, delivery_date,
               driver_name, driver_phone, car_number, car_brand, status
        FROM schedules
    ";
    if (count($where) > 0) {
        $sql .= ' WHERE ' . implode(' AND ', $where);
    }
    $sql .= ' ORDER BY accept_date DESC';

    // Используем подготовленный запрос, если есть параметры
    if ($types !== '') {
        $stmt = $conn->prepare($sql);
        if (!$stmt) throw new Exception("Ошибка подготовки запроса: " . $conn->error);
        $stmt->bind_param($types, ...$params);
        $stmt->execute();
        $res = $stmt->get_result();
    } else {
        $res = $conn->query($sql);
    }

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