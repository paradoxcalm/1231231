<?php
require_once 'auth_helper.php';
requireLogin();

header('Content-Type: application/json; charset=utf-8');

require_once 'db_connection.php';

$marketplace = isset($_GET['marketplace']) ? trim((string) $_GET['marketplace']) : '';
$warehouse   = isset($_GET['warehouse']) ? trim((string) $_GET['warehouse']) : '';

if ($marketplace === '' || $warehouse === '') {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'message' => 'Параметры marketplace и warehouse обязательны'
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

/**
 * Подсчёт количества заказов с учётом выбранного маркетплейса и склада.
 */
function normalizeMarketplaceKey(string $value): string
{
    $lower = mb_strtolower($value, 'UTF-8');
    return str_replace([' ', '-', '_'], '', $lower);
}

function normalizeWarehouseValue(string $value): string
{
    return mb_strtolower(trim($value), 'UTF-8');
}


function countOrdersByMarketplace(mysqli $conn, string $marketplace, ?string $warehouse = null): int
{
    $sql = "SELECT COUNT(*) AS total FROM orders WHERE is_deleted = 0 AND status <> 'Удалён клиентом'";
    $params = [];
    $types  = '';

    $normalizedMarketplace = normalizeMarketplaceKey($marketplace);
    if ($normalizedMarketplace !== '') {
        $marketplaceConditions = [];

        $marketplaceConditions[] = "REPLACE(REPLACE(REPLACE(LOWER(schedule_marketplace), ' ', ''), '-', ''), '_', '') = ?";
        $params[] = $normalizedMarketplace;
        $types   .= 's';

        if ($normalizedMarketplace === 'wildberries') {
            $marketplaceConditions[] = 'marketplace_wildberries = 1';
        } elseif ($normalizedMarketplace === 'ozon') {
            $marketplaceConditions[] = 'marketplace_ozon = 1';
        }

        if (!empty($marketplaceConditions)) {
            $sql .= ' AND (' . implode(' OR ', $marketplaceConditions) . ')';
        }
    }

    if ($warehouse !== null && $warehouse !== '') {
        $sql        .= ' AND LOWER(TRIM(schedule_warehouses)) = ?';
        $params[]    = normalizeWarehouseValue($warehouse);

        $params[]    = mb_strtolower($warehouse, 'UTF-8');
        $types      .= 's';
    }

    $stmt = $conn->prepare($sql);
    if (!empty($params)) {
        $stmt->bind_param($types, ...$params);
    }
    $stmt->execute();
    $stmt->bind_result($count);
    $stmt->fetch();
    $stmt->close();

    return (int) $count;
}

function countSchedulesByWarehouse(mysqli $conn, string $marketplace, string $warehouse): array
{
    $sql = <<<SQL
        SELECT
            COUNT(*) AS schedules_total,
            COUNT(DISTINCT NULLIF(TRIM(accept_date), '')) AS departures_unique
        FROM schedules
        WHERE status <> 'Завершено'
          AND LOWER(TRIM(marketplace)) = ?
          AND LOWER(TRIM(warehouses)) = ?
    SQL;

    $stmt = $conn->prepare($sql);
    if (!$stmt) {
        throw new RuntimeException('Ошибка подготовки запроса статистики расписаний: ' . $conn->error);
    }

    $marketplaceParam = normalizeWarehouseValue($marketplace);
    $warehouseParam   = normalizeWarehouseValue($warehouse);
    $stmt->bind_param('ss', $marketplaceParam, $warehouseParam);
    $stmt->execute();
    $stmt->bind_result($total, $unique);
    $stmt->fetch();
    $stmt->close();

    return [
        'schedules_total'   => (int) $total,
        'departures_unique' => (int) $unique,
    ];
}

try {
    $ordersTotal = countOrdersByMarketplace($conn, $marketplace);
    $ordersForWarehouse = countOrdersByMarketplace($conn, $marketplace, $warehouse);
    $schedulesStats = countSchedulesByWarehouse($conn, $marketplace, $warehouse);
try {
    $ordersTotal = countOrdersByMarketplace($conn, $marketplace);
    $ordersForWarehouse = countOrdersByMarketplace($conn, $marketplace, $warehouse);

    $percentage = 0.0;
    if ($ordersTotal > 0) {
        $percentage = ($ordersForWarehouse / $ordersTotal) * 100;
    }

    echo json_encode([
        'success' => true,
        'marketplace' => $marketplace,
        'warehouse' => $warehouse,
        'orders_total' => $ordersTotal,
        'orders_for_warehouse' => $ordersForWarehouse,
        'orders_percentage' => round($percentage, 2),
        'departures_unique' => $schedulesStats['departures_unique'],
        'departures_total' => $schedulesStats['schedules_total'],

    ], JSON_UNESCAPED_UNICODE);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Не удалось получить статистику склада',
        'error' => $e->getMessage(),
    ], JSON_UNESCAPED_UNICODE);
} finally {
    if (isset($conn) && $conn instanceof mysqli) {
        $conn->close();
    }
}
