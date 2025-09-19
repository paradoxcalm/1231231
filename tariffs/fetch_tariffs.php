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

// Обработка необязательного фильтра по маркетплейсу
$marketplaceFilter = isset($_GET['marketplace']) ? trim($_GET['marketplace']) : '';
$hasMarketplaceFilter = ($marketplaceFilter !== '');

// SQL-запрос с LEFT JOIN, чтобы не терять тарифы без привязки к складу/маркетплейсу
$sql = "
    SELECT
        ps.city_from,
        ps.warehouse_to,
        ps.standard_box_price,
        ps.pallet_price,
        w.marketplace_id,
        m.name AS marketplace_name
    FROM price_settings AS ps
    LEFT JOIN warehouses AS w ON w.name = ps.warehouse_to
    LEFT JOIN marketplaces AS m ON m.id = w.marketplace_id
";

$types = '';
$params = [];
if ($hasMarketplaceFilter) {
    if (ctype_digit($marketplaceFilter)) {
        $sql .= " WHERE w.marketplace_id = ?";
        $types .= 'i';
        $params[] = (int)$marketplaceFilter;
    } else {
        $sql .= " WHERE LOWER(m.name) = ?";
        $types .= 's';
        $lowerName = function_exists('mb_strtolower')
            ? mb_strtolower($marketplaceFilter, 'UTF-8')
            : strtolower($marketplaceFilter);
        $params[] = $lowerName;
    }
}

$sql .= " ORDER BY ps.city_from, ps.warehouse_to";

$stmt = $conn->prepare($sql);
if (!$stmt) {
    echo json_encode(['success' => false, 'message' => 'DB prepare error']);
    $conn->close();
    exit;
}

if ($hasMarketplaceFilter && $types !== '') {
    $stmt->bind_param($types, ...$params);
}

if (!$stmt->execute()) {
    $stmt->close();
    $conn->close();
    echo json_encode(['success' => false, 'message' => 'DB query error']);
    exit;
}

$result = $stmt->get_result();
if ($result === false) {
    $stmt->close();
    $conn->close();
    echo json_encode(['success' => false, 'message' => 'DB fetch error']);
    exit;
}

$tariffs = [];
while ($row = $result->fetch_assoc()) {
    $city = $row['city_from'];
    $warehouse = $row['warehouse_to'];
    $boxPrice = isset($row['standard_box_price']) ? floatval($row['standard_box_price']) : null;
    $palletPrice = isset($row['pallet_price']) ? floatval($row['pallet_price']) : null;
    $marketplaceId = isset($row['marketplace_id']) ? (int)$row['marketplace_id'] : null;
    $marketplaceName = $row['marketplace_name'] ?? null;
    // Организуем данные в массив по городам и складам
    if (!isset($tariffs[$city])) {
        $tariffs[$city] = [];
    }
    $tariffs[$city][$warehouse] = [
        'box_price'       => $boxPrice,
        'pallet_price'    => $palletPrice,
        'marketplace_id'  => $marketplaceId,
        'marketplace'     => $marketplaceName
    ];
}
$result->free();
$stmt->close();
$conn->close();

// Отправляем данные в формате JSON
echo json_encode(['success' => true, 'data' => $tariffs]);