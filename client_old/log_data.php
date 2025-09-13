<?php
// 👤 Пользователь
session_start();
header('Content-Type: application/json');
require_once 'db_connection.php';
require_once 'notify_user.php'; // ✅ добавлен вызов функции напрямую

$userId = $_SESSION['user_id'] ?? 0;
if (!$userId) {
    echo json_encode(['status'=>'error','message'=>'Пользователь не авторизован']);
    exit;
}

$sender         = trim($_POST['sender'] ?? '');
$comment        = trim($_POST['comment'] ?? '');
$city           = trim($_POST['city'] ?? '');
$warehouses     = trim($_POST['warehouses'] ?? '');
$boxes          = intval($_POST['boxes'] ?? 0);
$boxLength      = floatval($_POST['box_length'] ?? 0);
$boxWidth       = floatval($_POST['box_width'] ?? 0);
$boxHeight      = floatval($_POST['box_height'] ?? 0);
$payment        = floatval($_POST['payment'] ?? 0);
$packaging_type = $_POST['packaging_type'] ?? 'Box';
$schedule_id    = intval($_POST['schedule_id'] ?? 0);
$shipment_type  = 'reception';
$payment_type   = trim($_POST['payment_type'] ?? '');
$direction      = trim($_POST['direction'] ?? '');
$date_of_delivery = trim($_POST['date_of_delivery'] ?? '');
$accept_time      = trim($_POST['accept_time'] ?? '');
$submission_date  = date('Y-m-d H:i:s');

if (!$sender || !$city || !$warehouses || !$boxes) {
    echo json_encode(['status'=>'error','message'=>'Не все обязательные поля заполнены']);
    exit;
}

$photoPaths = [];
if (!empty($_FILES['photos']['tmp_name'][0])) {
    $uploadDir = __DIR__ . '/uploads/';
    if (!is_dir($uploadDir)) mkdir($uploadDir, 0777, true);
    foreach ($_FILES['photos']['tmp_name'] as $i => $tmpName) {
        $fileName = 'shipment_' . time() . "_$i.jpg";
        $filePath = $uploadDir . $fileName;
        if (move_uploaded_file($tmpName, $filePath)) {
            $photoPaths[] = 'uploads/' . $fileName;
        }
    }
}
$photo_path = json_encode($photoPaths, JSON_UNESCAPED_UNICODE);

$pallets = [];
$heights = $_POST['pallet_height'] ?? [];
$weights = $_POST['pallet_weight'] ?? [];
for ($i = 0; $i < min(count($heights), count($weights), 20); $i++) {
    $h = floatval($heights[$i]);
    $w = floatval($weights[$i]);
    if ($h > 0 && $w > 0) {
        $pallets[] = ['height' => $h, 'weight' => $w];
    }
}
$pallet_json = json_encode($pallets, JSON_UNESCAPED_UNICODE);

$conn->begin_transaction();
try {
    $status = 'Выгрузите товар';
    $stmt = $conn->prepare("
        INSERT INTO orders
          (company_name, store_name, shipment_type, comment, status, user_id, packaging_type, marketplace_wildberries, marketplace_ozon, schedule_id)
        VALUES (?, '', ?, ?, ?, ?, ?, 0, 0, ?)
    ");
    $stmt->bind_param("ssssisi",
        $sender,
        $shipment_type,
        $comment,
        $status,
        $userId,
        $packaging_type,
        $schedule_id
    );
    $stmt->execute();
    $orderId = $stmt->insert_id;
    $stmt->close();

    // ✅ Вставка групп коробов, если box_type = custom
    if ($packaging_type === 'Box' && ($_POST['box_type'] ?? '') === 'custom') {
        $lenArr = $_POST['box_length'] ?? [];
        $widArr = $_POST['box_width']  ?? [];
        $heiArr = $_POST['box_height'] ?? [];
        $cntArr = $_POST['box_count']  ?? [];

        if (
            is_array($lenArr) && is_array($widArr) && is_array($heiArr) && is_array($cntArr) &&
            count($lenArr) === count($widArr) && count($widArr) === count($heiArr) && count($heiArr) === count($cntArr)
        ) {
            $insertBox = $conn->prepare("INSERT INTO order_boxes (order_id, box_length, box_width, box_height, box_count) VALUES (?, ?, ?, ?, ?)");
            for ($i = 0; $i < count($lenArr); $i++) {
                $L = intval($lenArr[$i]);
                $W = intval($widArr[$i]);
                $H = intval($heiArr[$i]);
                $C = intval($cntArr[$i]);
                if ($L > 0 && $W > 0 && $H > 0 && $C > 0) {
                    $insertBox->bind_param("iiiii", $orderId, $L, $W, $H, $C);
                    $insertBox->execute();
                }
            }
            $insertBox->close();
        }
    }

    $role = $_SESSION['role'] ?? 'client';
    $statusText = "Заказ создан: $status";
    $hist = $conn->prepare("INSERT INTO order_history (order_id, status_change, changed_by) VALUES (?, ?, ?)");
    $hist->bind_param("iss", $orderId, $statusText, $role);
    $hist->execute();
    $hist->close();

    $details = $conn->prepare("
        INSERT INTO order_reception_details
          (order_id, boxes, payment, packaging_type, warehouses, box_length, box_width, box_height, pallet_data)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ");
    $details->bind_param(
        "iidssddds",
        $orderId,
        $boxes,
        $payment,
        $packaging_type,
        $warehouses,
        $boxLength,
        $boxWidth,
        $boxHeight,
        $pallet_json
    );
    $details->execute();
    $details->close();

    $sStmt = $conn->prepare("
        INSERT INTO shipments (
            order_id, city, sender, direction, date_of_delivery, shipment_type,
            boxes, payment, payment_type, accept_time, submission_date,
            comment, warehouses, box_length, box_width, box_height, photo_path
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ");
    $sStmt->bind_param(
        "isssssidsssssddds",
        $orderId,
        $city,
        $sender,
        $direction,
        $date_of_delivery,
        $shipment_type,
        $boxes,
        $payment,
        $payment_type,
        $accept_time,
        $submission_date,
        $comment,
        $warehouses,
        $boxLength,
        $boxWidth,
        $boxHeight,
        $photo_path
    );
    $sStmt->execute();
    $sStmt->close();

    $randomSecret   = bin2hex(random_bytes(4));
    $qrCodeText     = "ORDER_{$orderId}_{$randomSecret}";
    $insertConfirm  = $conn->prepare("
        INSERT INTO order_reception_confirmations (order_id, qr_code, payment_amount)
        VALUES (?, ?, ?)
    ");
    $insertConfirm->bind_param("isd", $orderId, $qrCodeText, $payment);
    $insertConfirm->execute();
    $insertConfirm->close();

    // ✅ Уведомление вызывается как функция
    sendNotification($conn, $userId, "🎉 Ваша заявка #$orderId успешно создана");

    $conn->commit();
    echo json_encode(['status' => 'success', 'qr_code' => $qrCodeText]);
} catch (Exception $e) {
    $conn->rollback();
    echo json_encode(['status'=>'error', 'message'=>'Ошибка: '.$e->getMessage()]);
}
$conn->close();
