<?php
// 👤 Пользователь (ADMIN-panel)
require_once __DIR__ . '/../../session_init.php';
session_start();
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/../../db_connection.php';

if (!isset($_SESSION['role']) || $_SESSION['role'] !== 'admin') {
    echo json_encode(['success' => false, 'message' => 'Доступ запрещён']);
    exit;
}

/* ===== 1. ДИНАМИЧЕСКИЙ СПИСОК ГОРОДОВ ===== */
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

/* ===== 3. Данные из price_settings ===== */
$res  = $conn->query("SELECT * FROM price_settings");
$data = [];
while ($row = $res->fetch_assoc()) {
    $city  = $row['city_from'];
    $wh    = $row['warehouse_to'];
    // старые поля:
    // $price = isset($row['standard_box_price']) ? floatval(... ) : null; :contentReference[oaicite:0]{index=0}

    // новый формат хранения
    $boxPrice    = isset($row['standard_box_price']) ? floatval($row['standard_box_price']) : null;
    $palletPrice = isset($row['pallet_price'])       ? floatval($row['pallet_price'])       : null;

    if (!isset($data[$city])) {
        $data[$city] = [
            // убрано поле 'pallet_price' в корне :contentReference[oaicite:1]{index=1}
            'box_coef'   => isset($row['box_coef']) ? floatval($row['box_coef']) : 0,
            'warehouses' => []
        ];
    }
    // вместо простого числа now массив с двумя полями :contentReference[oaicite:2]{index=2}
    $data[$city]['warehouses'][$wh] = [
        'box_price'    => $boxPrice,
        'pallet_price' => $palletPrice
    ];
}

/* ===== 4. Дополняем отсутствующие города/склады ===== */
foreach ($cities as $cityName) {
    if (!isset($data[$cityName])) {
        $data[$cityName] = [
            'box_coef'   => 0,
            'warehouses' => []
        ];
    }
    foreach ($warehouses as $whName) {
        if (!array_key_exists($whName, $data[$cityName]['warehouses'])) {
            // раньше было null :contentReference[oaicite:3]{index=3}
            $data[$cityName]['warehouses'][$whName] = [
                'box_price'    => null,
                'pallet_price' => null
            ];
        }
    }
}

echo json_encode(['success' => true, 'data' => $data]);
$conn->close();