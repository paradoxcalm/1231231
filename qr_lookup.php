<?php
// qr_lookup.php
header('Content-Type: application/json; charset=utf-8');
require_once 'db_connection.php';
require_once 'session_init.php';
session_start();

$data = json_decode(file_get_contents("php://input"), true);
$qrCode = trim($data['qr_code'] ?? '');
if ($qrCode === '' || !preg_match('/^[A-Za-z0-9\-_]{1,64}$/', $qrCode)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Неверный формат QR-кода']);
    exit;
}

// Найдём order_id
$stmt = $conn->prepare("SELECT order_id FROM order_reception_confirmations WHERE qr_code = ? LIMIT 1");
$stmt->bind_param("s", $qrCode);
$stmt->execute();
$result = $stmt->get_result();
$orderRow = $result->fetch_assoc();
$stmt->close();
if (!$orderRow) {
    echo json_encode(['success' => false, 'error' => 'Заказ по QR не найден']);
    exit;
}
$orderId = (int)$orderRow['order_id'];

// Получаем всё нужное
$stmt = $conn->prepare("
    SELECT 
        o.order_id,
        o.company_name AS sender,
        u.phone AS sender_phone,
        s.city,
        s.warehouses,
        s.delivery_date,
        s.driver_name,
        s.driver_phone,
        s.car_number,
        s.car_brand,
        d.boxes
    FROM orders o
    LEFT JOIN schedules s ON o.schedule_id = s.id
    LEFT JOIN usersff u ON o.user_id = u.id
    LEFT JOIN order_reception_details d ON o.order_id = d.order_id
    WHERE o.order_id = ? AND o.is_deleted = 0 AND o.status <> 'Удалён клиентом'
    LIMIT 1
");
$stmt->bind_param("i", $orderId);
$stmt->execute();
$stmt->bind_result(
    $id, $sender, $senderPhone,
    $city, $warehouses, $deliveryDate,
    $driverName, $driverPhone, $carNumber, $carBrand, $boxes
);
$stmt->fetch();
$stmt->close();

// Ответ
echo json_encode([
    'success' => true,
    'data' => [
        'order_id'     => $id,
        'sender'       => $sender,
        'sender_phone' => $senderPhone,
        'city'         => $city,
        'warehouses'   => $warehouses,
        'delivery_date'=> $deliveryDate,
        'driver_name'  => $driverName,
        'driver_phone' => $driverPhone,
        'car_number'   => $carNumber,
        'car_brand'    => $carBrand,
        'boxes'        => $boxes
    ]
]);
?>