<?php
session_start();
header('Content-Type: application/json; charset=utf-8');
require_once 'db_connection.php';

$role   = $_SESSION['role']    ?? 'client';
$userId = $_SESSION['user_id'] ?? 0;
$all    = isset($_GET['all']) ? (int)$_GET['all'] : 0;
$status = $_GET['status'] ?? [];
$orderIdFilter = $_GET['order_id'] ?? null;
$shipmentType = $_GET['shipment_type'] ?? null;

try {
    $sql = "
        SELECT o.*,
               s.city             AS schedule_city,
               s.warehouses       AS schedule_warehouses,
               s.accept_date      AS schedule_accept_date,
               s.acceptance_end   AS schedule_accept_deadline,
               s.delivery_date    AS schedule_delivery_date,
               s.driver_name      AS schedule_driver_name,
               s.driver_phone     AS schedule_driver_phone,
               s.car_brand        AS schedule_car_brand,
               s.car_number       AS schedule_car_number,
               d.boxes            AS reception_boxes,
               d.payment          AS reception_payment,
               d.payment_type     AS reception_payment_type,
               d.packaging_type   AS reception_packaging,
               d.photo_path       AS reception_photo,
               p.manager_id       AS processing_manager,
               p.started_at       AS processing_started,
               p.finished_at      AS processing_finished,
               p.is_completed     AS processing_done,
               p.comment          AS processing_comment,
               p.photo_path       AS processing_photo,
               u.first_name       AS client_first_name,
               u.last_name        AS client_last_name,
               u.phone            AS client_phone,
               c.qr_code          AS qr_code
        FROM orders o
        LEFT JOIN schedules                s ON o.schedule_id = s.id
        LEFT JOIN order_reception_details  d ON o.order_id   = d.order_id
        LEFT JOIN order_processing_details p ON o.order_id   = p.order_id
        LEFT JOIN usersff                  u ON o.user_id    = u.id
        LEFT JOIN order_reception_confirmations c ON o.order_id = c.order_id
    ";
    $params = [];
    $types  = [];

    if ($orderIdFilter) {
        $sql    .= " WHERE o.order_id = ?";
        $params[] = $orderIdFilter;
        $types[]  = "i";
    } elseif ($role === 'client' && $userId > 0) {
        $sql    .= " WHERE o.user_id = ?";
        $params[] = $userId;
        $types[]  = "i";
    } elseif (!$all && $userId > 0) {
        $sql    .= " WHERE o.user_id = ?";
        $params[] = $userId;
        $types[]  = "i";
    }

    if (!empty($shipmentType)) {
        $sql    .= (empty($params) ? " WHERE" : " AND") . " o.shipment_type = ?";
        $params[] = $shipmentType;
        $types[]  = "s";
    }

    if (!is_array($status)) {
        $status = [$status];
    }
    if (!empty($status)) {
        $placeholders = implode(',', array_fill(0, count($status), '?'));
        $sql    .= (empty($params) ? " WHERE" : " AND") . " o.status IN ($placeholders)";
        foreach ($status as $st) {
            $params[] = $st;
            $types[]  = "s";
        }
    }

    $sql .= " ORDER BY o.order_date DESC";
    $stmt = $conn->prepare($sql);
    if (!empty($params)) {
        $stmt->bind_param(implode('', $types), ...$params);
    }
    $stmt->execute();
    $result = $stmt->get_result();

    $orders = [];
    while ($row = $result->fetch_assoc()) {
        $decodedPhoto = json_decode($row['reception_photo'] ?? '', true);

        // Получаем информацию о коробках нестандартных размеров
        $boxGroups = [];
        $stmtB = $conn->prepare("SELECT box_length, box_width, box_height, box_count FROM order_boxes WHERE order_id = ?");
        $stmtB->bind_param("i", $row['order_id']);
        $stmtB->execute();
        $resB = $stmtB->get_result();
        while ($b = $resB->fetch_assoc()) {
            $boxGroups[] = $b;
        }
        $stmtB->close();

        $orders[] = [
            "order_id"      => $row['order_id'] ?? 0,
            "order_date"    => $row['order_date'] ?? '—',
            "company_name"  => $row['company_name'] ?? '—',
            "store_name"    => $row['store_name'] ?? '—',
            "shipment_type" => $row['shipment_type'] ?? '—',
            "comment"       => $row['comment'] ?? '—',
            "status"        => $row['status'] ?? 'Не указан',
            "packaging_type"=> $row['packaging_type'] ?? '—',
            "marketplace_wildberries" => !empty($row['marketplace_wildberries']),
            "marketplace_ozon"       => !empty($row['marketplace_ozon']),
            "client_id"     => $row['user_id'] ?? 0,
            "source_order_id" => $row['source_order_id'] ?? null,
            "items"         => [],
            "is_rejected"   => false,
            "client_info"   => [
                "first_name" => $row['client_first_name'] ?? '',
                "last_name"  => $row['client_last_name'] ?? '',
                "phone"      => $row['client_phone'] ?? ''
            ],
            "schedule"      => [
                "id"              => $row['schedule_id'] ?? null,
                "city"            => $row['schedule_city'] ?? null,
                "warehouses"      => $row['schedule_warehouses'] ?? null,
                "accept_date"     => $row['schedule_accept_date'] ?? null,
                "accept_deadline" => $row['schedule_accept_deadline'] ?? null,
                "delivery_date"   => $row['schedule_delivery_date'] ?? null,
                "driver_name"     => $row['schedule_driver_name'] ?? null,
                "driver_phone"    => $row['schedule_driver_phone'] ?? null,
                "car_brand"       => $row['schedule_car_brand'] ?? null,
                "car_number"      => $row['schedule_car_number'] ?? null
            ],
            "reception" => [
                "boxes"          => $row['reception_boxes'] ?? 0,
                "payment"        => $row['reception_payment'] ?? 0.00,
                "payment_type"   => $row['reception_payment_type'] ?? '',
                "packaging_type" => $row['reception_packaging'] ?? '',
                "photo_path"     => is_array($decodedPhoto) ? $decodedPhoto : []
            ],
            "processing" => [
                "manager_id"    => $row['processing_manager'] ?? null,
                "started_at"    => $row['processing_started'] ?? null,
                "finished_at"   => $row['processing_finished'] ?? null,
                "is_completed"  => !empty($row['processing_done']),
                "comment"       => $row['processing_comment'] ?? '',
                "photo_path"    => $row['processing_photo'] ?? ''
            ],
            "qr_code"      => $row['qr_code'] ?? null,
            "custom_boxes" => $boxGroups
        ];
    }
    echo json_encode(["success" => true, "orders" => $orders]);
} catch (Exception $e) {
    echo json_encode(["success" => false, "message" => $e->getMessage()]);
}
$conn->close();
?>
