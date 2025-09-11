<?php
require_once '../session_init.php';
session_start();
header('Content-Type: application/json; charset=utf-8');
require_once '../db_connection.php';

// Проверяем авторизацию пользователя
if (!isset($_SESSION['role'])) {
    echo json_encode(['success' => false, 'message' => 'Не авторизованы']);
    exit;
}

// SQL-запрос: получаем тарифы (город отправления, склад назначения и цены)
$result = $conn->query("SELECT city_from, warehouse_to, standard_box_price, pallet_price FROM price_settings");
if (!$result) {
    echo json_encode(['success' => false, 'message' => 'DB query error']);
    exit;
}

$tariffs = [];
while ($row = $result->fetch_assoc()) {
    $city = $row['city_from'];
    $warehouse = $row['warehouse_to'];
    $boxPrice = isset($row['standard_box_price']) ? floatval($row['standard_box_price']) : null;
    $palletPrice = isset($row['pallet_price']) ? floatval($row['pallet_price']) : null;
    // Организуем данные в массив по городам и складам
    if (!isset($tariffs[$city])) {
        $tariffs[$city] = [];
    }
    $tariffs[$city][$warehouse] = [
        'box_price'    => $boxPrice,
        'pallet_price' => $palletPrice
    ];
}
$result->free();
$conn->close();

// Отправляем данные в формате JSON
echo json_encode(['success' => true, 'data' => $tariffs]);