<?php
// 👤 Пользователь (ADMIN‑panel)
session_start();
header('Content-Type: application/json; charset=utf-8');
require_once 'db_connection.php';

if (!isset($_SESSION['role']) || $_SESSION['role'] !== 'admin') {
    echo json_encode(['success' => false, 'message' => 'Доступ запрещён']);
    exit;
}

/* ===== 1. ДИНАМИЧЕСКИЙ СПИСОК ГОРОДОВ вместо жёсткого массива ===== */
$citiesRes = $conn->query("SELECT name FROM cities WHERE is_active = 1 ORDER BY name ASC");
$cities = [];
while ($row = $citiesRes->fetch_assoc()) {
    $cities[] = $row['name'];
}

/* ===== 2. Список складов ===== */
$warehousesRes = $conn->query("SELECT name FROM warehouses");
$warehouses = [];
while ($row = $warehousesRes->fetch_assoc()) {
    $warehouses[] = $row['name'];
}

/* ===== 3. Данные, уже сохранённые в price_settings ===== */
$res  = $conn->query("SELECT * FROM price_settings");
$data = [];
while ($row = $res->fetch_assoc()) {
    $city  = $row['city_from'];
    $wh    = $row['warehouse_to'];
    $price = isset($row['standard_box_price']) ? floatval($row['standard_box_price']) : null;

    if (!isset($data[$city])) {
        $data[$city] = [
            'pallet_price' => isset($row['pallet_price']) ? floatval($row['pallet_price']) : 0,
            'box_coef'     => isset($row['box_coef'])     ? floatval($row['box_coef'])     : 0,
            'warehouses'   => []
        ];
    }
    $data[$city]['warehouses'][$wh] = $price;
}

/* ===== 4. Добиваем отсутствующие города/склады ===== */
foreach ($cities as $city) {
    if (!isset($data[$city])) {
        $data[$city] = [
            'pallet_price' => 0,
            'box_coef'     => 0,
            'warehouses'   => []
        ];
    }
    foreach ($warehouses as $wh) {
        if (!array_key_exists($wh, $data[$city]['warehouses'])) {
            $data[$city]['warehouses'][$wh] = null; // пустое значение для ввода
        }
    }
}

echo json_encode(['success' => true, 'data' => $data]);
$conn->close();
?>
