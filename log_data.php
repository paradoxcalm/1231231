<?php
// log_data.php
require_once 'session_init.php';
session_start();
require_once 'db_connection.php';

// Функция логирования
function log_debug($msg, $context = []) {
    $log_file = __DIR__ . '/logs/pickups_debug.log';
    $time = date('Y-m-d H:i:s');
    $ip = $_SERVER['REMOTE_ADDR'] ?? 'CLI';
    $uid = $_SESSION['user_id'] ?? '0';
    $ctx = json_encode($context, JSON_UNESCAPED_UNICODE | JSON_PARTIAL_OUTPUT_ON_ERROR);
    file_put_contents($log_file, "[$time][$ip][uid:$uid] $msg | $ctx\n", FILE_APPEND);
}

// Проверка авторизации
if (!isset($_SESSION['user_id'])) {
    echo json_encode(['status' => 'error', 'message' => 'Пользователь не авторизован']);
    exit;
}
$userId = $_SESSION['user_id'];

// Получаем данные текущего пользователя
$currentUser = [];
if ($stmtUser = $conn->prepare("SELECT company_name FROM usersff WHERE id = ? LIMIT 1")) {
    $stmtUser->bind_param("i", $userId);
    $stmtUser->execute();
    $resUser = $stmtUser->get_result();
    $currentUser = $resUser ? $resUser->fetch_assoc() : [];
    $stmtUser->close();
}

// Читаем данные формы
$senderPhone    = trim($_POST['sender'] ?? '');
$ip             = trim($_POST['ip'] ?? '');
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
$payment_type   = trim($_POST['payment_type'] ?? '');
$direction      = trim($_POST['direction'] ?? '');
$date_of_delivery = trim($_POST['date_of_delivery'] ?? '');
$accept_time    = trim($_POST['accept_time'] ?? '');

// shipment_type для orders: 'Коробка' или 'Паллета'
$shipment_type = ($packaging_type === 'Pallet') ? 'Паллета'
    : ($packaging_type === 'Box' ? 'Коробка' : $packaging_type);

// Если направление не задано — берем из warehouses
if ($direction === '') {
    $direction = $warehouses;
}

// Дата создания заявки
$submission_date = date('Y-m-d H:i:s');

// Заполняем недостающие поля из расписания
if ($schedule_id > 0) {
    $stmtSch = $conn->prepare("SELECT city, accept_time, delivery_date, warehouses FROM schedules WHERE id = ?");
    $stmtSch->bind_param("i", $schedule_id);
    $stmtSch->execute();
    $stmtSch->bind_result($scCity, $scAcceptTime, $scDeliveryDate, $scWarehouses);
    if ($stmtSch->fetch()) {
        if ($date_of_delivery === '' && $scDeliveryDate) $date_of_delivery = $scDeliveryDate;
        if ($city === '')              $city       = $scCity;
        if ($accept_time === '')       $accept_time= $scAcceptTime;
        if ($warehouses === '')        $warehouses = $scWarehouses;
        if ($direction === '')         $direction  = $scWarehouses;
    }
    $stmtSch->close();
}

// Проверяем обязательные поля
if (!$senderPhone || !$ip || !$city || !$warehouses || !$boxes) {
    echo json_encode(['status' => 'error', 'message' => 'Не все обязательные поля заполнены']);
    exit;
}

if (!$senderPhone || !$city || !$warehouses || !$boxes) {
    echo json_encode(['status' => 'error', 'message' => 'Не все обязательные поля заполнены']);
    exit;
}

// Загрузка фото
$photoPaths = [];
if (!empty($_FILES['photos']['tmp_name'][0])) {
    $uploadDir = __DIR__ . '/uploads/';
    if (!is_dir($uploadDir)) mkdir($uploadDir, 0777, true);
    foreach ($_FILES['photos']['tmp_name'] as $i => $tmp) {
        $fn = 'shipment_' . time() . "_$i.jpg";
        $fp = $uploadDir . $fn;
        if (move_uploaded_file($tmp, $fp)) {
            $photoPaths[] = 'uploads/' . $fn;
        }
    }
}
$photo_path = json_encode($photoPaths, JSON_UNESCAPED_UNICODE);

// Данные паллет
$pallets = [];
$hArr = $_POST['pallet_height'] ?? [];
$wArr = $_POST['pallet_weight'] ?? [];
for ($i = 0; $i < min(count($hArr), count($wArr), 20); $i++) {
    $h = floatval($hArr[$i]);
    $w = floatval($wArr[$i]);
    if ($h > 0 && $w > 0) $pallets[] = ['height' => $h, 'weight' => $w];
}
$pallet_json = json_encode($pallets, JSON_UNESCAPED_UNICODE);

$conn->begin_transaction();
try {
    // 1. Записываем заказ в orders
    $status = 'Выгрузите товар';
    $stmtOrd = $conn->prepare("
        INSERT INTO orders (company_name, store_name, shipment_type, comment, status, user_id, packaging_type, marketplace_wildberries, marketplace_ozon, schedule_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0, ?)
    ");
    $stmtOrd->bind_param("sssssisi", $ip, $senderPhone, $shipment_type, $comment, $status, $userId, $packaging_type, $schedule_id);
    $stmtOrd->execute();
    $orderId = $stmtOrd->insert_id;
    $stmtOrd->close();

    if (!empty($photoPaths)) {
        $stmtPhoto = $conn->prepare("INSERT INTO order_photos (order_id, file_path) VALUES (?, ?)");
        if ($stmtPhoto) {
            foreach ($photoPaths as $p) {
                $stmtPhoto->bind_param("is", $orderId, $p);
                $stmtPhoto->execute();
            }
            $stmtPhoto->close();
        }
    }

    // 2. Записываем нестандартные коробки (если необходимо)
    if ($packaging_type === 'Box' && ($_POST['box_type'] ?? '') === 'custom') {
        $lenArr = $_POST['box_length'] ?? [];
        $widArr = $_POST['box_width']  ?? [];
        $heiArr = $_POST['box_height'] ?? [];
        $cntArr = $_POST['box_count']  ?? [];
        if (count($lenArr) === count($widArr) && count($widArr) === count($heiArr) && count($heiArr) === count($cntArr)) {
            $stmtBox = $conn->prepare("INSERT INTO order_boxes (order_id, box_length, box_width, box_height, box_count) VALUES (?, ?, ?, ?, ?)");
            for ($i = 0; $i < count($lenArr); $i++) {
                $L = intval($lenArr[$i]);
                $W = intval($widArr[$i]);
                $H = intval($heiArr[$i]);
                $C = intval($cntArr[$i]);
                if ($L > 0 && $W > 0 && $H > 0 && $C > 0) {
                    $stmtBox->bind_param("iiiii", $orderId, $L, $W, $H, $C);
                    $stmtBox->execute();
                }
            }
            $stmtBox->close();
        }
    }

    // 3. Сохраняем детали приёмки
    $stmtDet = $conn->prepare("
        INSERT INTO order_reception_details (order_id, boxes, payment, packaging_type, warehouses, box_length, box_width, box_height, pallet_data)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ");
    $stmtDet->bind_param("iidssddds", $orderId, $boxes, $payment, $packaging_type, $warehouses, $boxLength, $boxWidth, $boxHeight, $pallet_json);
    $stmtDet->execute();
    $stmtDet->close();

    // 4. Создаём запись в shipments
    $stmtShip = $conn->prepare("
        INSERT INTO shipments (order_id, city, sender, direction, date_of_delivery, shipment_type, boxes, payment, payment_type, accept_time, submission_date, comment, warehouses, box_length, box_width, box_height, photo_path)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ");
    $stmtShip->bind_param("isssssidsssssddds", $orderId, $city, $ip, $direction, $date_of_delivery, $shipment_type, $boxes, $payment, $payment_type, $accept_time, $submission_date, $comment, $warehouses, $boxLength, $boxWidth, $boxHeight, $photo_path);
    $stmtShip->execute();
    $stmtShip->close();

    // 5. Создаём запись в order_reception_confirmations (QR‑код)
    $secret = bin2hex(random_bytes(4));
    $qrCode = "ORDER_{$orderId}_{$secret}";
    $stmtConf = $conn->prepare("INSERT INTO order_reception_confirmations (order_id, qr_code, payment_amount) VALUES (?, ?, ?)");
    $stmtConf->bind_param("isd", $orderId, $qrCode, $payment);
    $stmtConf->execute();
    $stmtConf->close();

    // 6. Отправляем уведомление (если функция определена)
    if (function_exists('sendNotification')) {
        sendNotification($conn, $userId, "🎉 Ваша заявка #$orderId успешно создана");
    }
    // Был ли выбран забор груза
    $wantPickup = !empty($_POST['pickup_checkbox']);
    
    // Данные из формы
    $pickupLat     = $_POST['pickup_lat'] ?? null;
    $pickupLng     = $_POST['pickup_lng'] ?? null;
    $contactPhone  = trim($_POST['client_phone'] ?? '');
    $contactName   = trim($currentUser['company_name'] ?? '');  // или имя клиента из профиля
    $addrText      = trim($_POST['pickup_address'] ?? ''); // если хранишь строковый адрес (необязательно)
    $goodsList     = $_POST['goods_list'] ?? '';           // если передаёшь с формы
    
    // Вставка в pickups
    if ($wantPickup) {
        if (
            $pickupLat === null || $pickupLat === '' || !is_numeric($pickupLat) ||
            $pickupLng === null || $pickupLng === '' || !is_numeric($pickupLng) ||
            $contactPhone === ''
        ) {
            $conn->rollback();
            log_debug('Не заданы координаты или телефон для забора', [
                'lat' => $pickupLat,
                'lng' => $pickupLng,
                'phone' => $contactPhone
            ]);
            echo json_encode(['status' => 'error', 'message' => 'Не указаны координаты или телефон для забора']);
            exit;
        }

        $pickupLat = (float)$pickupLat;
        $pickupLng = (float)$pickupLng;

        if (
            $pickupLat < -90 || $pickupLat > 90 ||
            $pickupLng < -180 || $pickupLng > 180
        ) {
            $conn->rollback();
            log_debug('Координаты вне допустимого диапазона', [
                'lat' => $pickupLat,
                'lng' => $pickupLng
            ]);
            echo json_encode(['status' => 'error', 'message' => 'Некорректные координаты забора']);
            exit;
        }

        $stmt = $conn->prepare("
            INSERT INTO pickups
                (order_id, client_id, address, latitude, longitude,
                 contact_name, contact_phone, goods_list,
                 qr_code, status, requested_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'new', NOW())
        ");
        $clientId = (int)($_SESSION['user_id'] ?? 0);
        $stmt->bind_param(
            'iisddssss',
            $orderId,       // ID из orders
            $clientId,      // кто оформил
            $addrText,      // опционально (можно пустым)
            $pickupLat,     // широта
            $pickupLng,     // долгота
            $contactName,   // имя/название клиента
            $contactPhone,  // телефон для связи
            $goodsList,     // список товаров (если надо)
            $qrCode         // QR заявки (связка с order)
        );
        if (!$stmt->execute()) {
            log_debug('Ошибка вставки в pickups', ['error' => $stmt->error]);
            $stmt->close();
            $conn->rollback();
            echo json_encode(['status' => 'error', 'message' => 'Ошибка сохранения данных забора']);
            exit;
        }
        $stmt->close();
    }
    

    $conn->commit();
    echo json_encode(['status' => 'success', 'qr_code' => $qrCode]);
} catch (Exception $e) {
    $conn->rollback();
    echo json_encode(['status' => 'error', 'message' => 'Ошибка: ' . $e->getMessage()]);
}
$conn->close();