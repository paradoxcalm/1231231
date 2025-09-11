<?php
function log_debug($msg, $context = []) {
    $log_file = __DIR__ . '/logs/shipments_debug.log';
    $time = date('Y-m-d H:i:s');
    $ip = $_SERVER['REMOTE_ADDR'] ?? 'CLI';
    $session = $_SESSION['role'] ?? 'none';
    $user = $_SESSION['user_id'] ?? '0';
    $ctx = json_encode($context, JSON_UNESCAPED_UNICODE | JSON_PARTIAL_OUTPUT_ON_ERROR);
    file_put_contents($log_file, "[$time][$ip][uid:$user][role:$session] $msg | $ctx\n", FILE_APPEND);
}
require_once 'session_init.php';
session_start();
header('Content-Type: application/json; charset=utf-8');
require_once 'db_connection.php';

$rawData = file_get_contents('php://input');
$data = json_decode($rawData, true);
if (!$data || !is_array($data)) {
    echo json_encode(["success" => false, "message" => "Неверный формат JSON"]);
    exit;
}

$company_name  = trim($data['company_name'] ?? '');
$store_name    = trim($data['store_name'] ?? '');
$shipment_type = $data['shipment_type'] ?? 'FBO';
$comment       = trim($data['comment'] ?? '');
$packaging_raw = $data['packaging_type'] ?? 'Box';
$marketplace_wb = !empty($data['marketplace_wildberries']) ? 1 : 0;
$marketplace_ozon = !empty($data['marketplace_ozon']) ? 1 : 0;
$items = $data['items'] ?? [];
$schedule_id = isset($data['schedule_id']) ? (int)$data['schedule_id'] : 0;

if (empty($company_name) || empty($items)) {
    echo json_encode(["success" => false, "message" => "Заполните ИП и добавьте товары"]);
    exit;
}

$userId = $_SESSION['user_id'] ?? 0;
if ($userId === 0) {
    echo json_encode(["success" => false, "message" => "Пользователь не авторизован"]);
    exit;
}

$translations = [
    "Box" => "Коробка",
    "Envelope" => "Конверт",
    "Pallet" => "Паллета"
];
$packaging_type = $translations[$packaging_raw] ?? $packaging_raw;

// Получаем данные расписания
$schedule_city = $schedule_accept_date = $schedule_accept_time = $schedule_timeslot = $schedule_delivery_date = $schedule_marketplace = $schedule_warehouses = null;

if ($schedule_id) {
    $stmt = $conn->prepare("SELECT city, accept_date, accept_time, timeslot, delivery_date, marketplace, warehouses FROM schedules WHERE id = ?");
    $stmt->bind_param("i", $schedule_id);
    $stmt->execute();
    $stmt->bind_result($schedule_city, $schedule_accept_date, $schedule_accept_time, $schedule_timeslot, $schedule_delivery_date, $schedule_marketplace, $schedule_warehouses);
    $stmt->fetch();
    $stmt->close();
}

// Если город расписания числовой, заменяем на название города
if ($schedule_city !== null && is_numeric($schedule_city)) {
    $stmtCity = $conn->prepare("SELECT name FROM cities WHERE id = ?");
    $cityId = (int)$schedule_city;
    $stmtCity->bind_param("i", $cityId);
    $stmtCity->execute();
    $resCity = $stmtCity->get_result();
    if ($rowCity = $resCity->fetch_assoc()) {
        $schedule_city = $rowCity['name'];
    } else {
        $stmtCity->close();
        $conn->close();
        echo json_encode(["success" => false, "message" => "Некорректный город"]);
        exit;
    }
    $stmtCity->close();
}

$conn->begin_transaction();
try {
    $status = 'Выгрузите товар';
    $stmt = $conn->prepare("
        INSERT INTO orders 
        (company_name, store_name, shipment_type, comment, status, user_id, packaging_type, 
         marketplace_wildberries, marketplace_ozon, schedule_id,
         schedule_city, schedule_accept_date, schedule_accept_time, schedule_timeslot,
         schedule_delivery_date, schedule_marketplace, schedule_warehouses)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ");
    $stmt->bind_param(
        "sssssisiiisssssss",
        $company_name,
        $store_name,
        $shipment_type,
        $comment,
        $status,
        $userId,
        $packaging_type,
        $marketplace_wb,
        $marketplace_ozon,
        $schedule_id,
        $schedule_city,
        $schedule_accept_date,
        $schedule_accept_time,
        $schedule_timeslot,
        $schedule_delivery_date,
        $schedule_marketplace,
        $schedule_warehouses
    );
    $stmt->execute();
    $orderId = $stmt->insert_id;
    $stmt->close();

    $itemSQL = "
        INSERT INTO order_items (
            order_id, barcode, total_qty,
            koledino_qty, elektrostal_qty, tula_qty, kazan_qty, ryazan_qty,
            kotovsk_qty, krasnodar_qty, nevinnomyssk_qty, remaining_qty
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ";
    $itemStmt = $conn->prepare($itemSQL);
    foreach ($items as $item) {
        $barcode = trim($item['barcode'] ?? '');
        $total = (int)($item['total_qty'] ?? 0);
        $koledino     = (int)($item['koledino_qty'] ?? 0);
        $elektrostal  = (int)($item['elektrostal_qty'] ?? 0);
        $tula         = (int)($item['tula_qty'] ?? 0);
        $kazan        = (int)($item['kazan_qty'] ?? 0);
        $ryazan       = (int)($item['ryazan_qty'] ?? 0);
        $kotovsk      = (int)($item['kotovsk_qty'] ?? 0);
        $krasnodar    = (int)($item['krasnodar_qty'] ?? 0);
        $nevinnomyssk = (int)($item['nevinnomyssk_qty'] ?? 0);
        $distributed = $koledino + $elektrostal + $tula + $kazan + $ryazan + $kotovsk + $krasnodar + $nevinnomyssk;
        $remaining = $total - $distributed;
        $itemStmt->bind_param(
            "isiiiiiiiiii",
            $orderId,
            $barcode,
            $total,
            $koledino,
            $elektrostal,
            $tula,
            $kazan,
            $ryazan,
            $kotovsk,
            $krasnodar,
            $nevinnomyssk,
            $remaining
        );
        $itemStmt->execute();
    }
    $itemStmt->close();

    $role = $_SESSION['role'] ?? 'client';
    $histText = "Заказ создан: $status";
    $hist = $conn->prepare("INSERT INTO order_history (order_id, status_change, changed_by) VALUES (?, ?, ?)");
    $hist->bind_param("iss", $orderId, $histText, $role);
    $hist->execute();
    $hist->close();

    if ($shipment_type === 'processing') {
        $proc = $conn->prepare("
            INSERT INTO order_processing_details 
            (order_id, manager_id, started_at, is_completed)
            VALUES (?, NULL, NOW(), 0)
        ");
        $proc->bind_param("i", $orderId);
        $proc->execute();
        $proc->close();
    }

    $conn->commit();
    echo json_encode(["success" => true, "order_id" => $orderId]);
} catch (Exception $e) {
    $conn->rollback();
    echo json_encode(["success" => false, "message" => "Ошибка: " . $e->getMessage()]);
}
$conn->close();
?>