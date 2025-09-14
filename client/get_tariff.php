<?php
session_start();
header('Content-Type: application/json; charset=utf-8');
require_once 'db_connection.php';

// Проверка авторизации
if (!isset($_SESSION['role'])) {
    echo json_encode(['success' => false, 'message' => 'Не авторизован']);
    exit;
}

$city      = trim($_GET['city']     ?? '');
$warehouse = trim($_GET['warehouse']?? '');

// Проверка входных параметров
if ($city === '' || $warehouse === '') {
    echo json_encode(['success' => false, 'message' => 'Город и склад обязательны']);
    exit;
}

// Запрос тарифных настроек
$stmt = $conn->prepare("
    SELECT 
        standard_box_price,
        coefficient,
        pallet_price,
        box_coef,
        per_liter
    FROM price_settings
    WHERE city_from = ? AND warehouse_to = ?
    LIMIT 1
");
if (!$stmt) {
    echo json_encode(['success' => false, 'message' => 'Ошибка подготовки запроса']);
    exit;
}
$stmt->bind_param("ss", $city, $warehouse);
$stmt->execute();
$res = $stmt->get_result();

if ($row = $res->fetch_assoc()) {
    echo json_encode([
        'success'        => true,
        'rate'           => floatval($row['standard_box_price']) * floatval($row['coefficient']),
        'base_price'     => floatval($row['standard_box_price']),
        'coefficient'    => floatval($row['coefficient']),
        'pallet_price'   => floatval($row['pallet_price']),
        'box_coef'       => floatval($row['box_coef']),
        'per_liter'      => floatval($row['per_liter']),           // ✅ добавлено
        'price_per_cm'   => floatval($row['pallet_price'])         // оставлено для паллет
    ]);
} else {
    echo json_encode([
        'success' => false,
        'message' => 'Тариф не найден'
    ]);
}

$stmt->close();
$conn->close();
