<?php
require_once __DIR__ . '/../../session_init.php';
session_start();
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/../../db_connection.php';

// Проверяем авторизацию
if (!isset($_SESSION['user_id'])) {
    echo json_encode(['success' => false, 'message' => 'Пользователь не авторизован']);
    exit;
}

$userId  = $_SESSION['user_id'];
$orderId = intval($_POST['order_id'] ?? 0);
$qrCode  = trim($_POST['qr_code'] ?? '');
$action  = trim($_POST['action'] ?? '');
$paymentType = trim($_POST['payment_type'] ?? '');
$allowedPaymentTypes = ['Наличные', 'ТБанк', 'Долг'];
if (!in_array($paymentType, $allowedPaymentTypes, true)) {
    echo json_encode(['success' => false, 'message' => 'Недопустимый способ оплаты']);
    exit;
}
$paymentRaw  = str_replace(',', '.', trim($_POST['payment'] ?? ''));
$payment = ($paymentRaw === '') ? null : floatval($paymentRaw);

// Валидация входных данных
if (!$orderId || !in_array($action, ['confirm','approve','reject'])) {
    echo json_encode(['success' => false, 'message' => 'Неверные входные параметры']);
    exit;
}
if ($action === 'confirm') $action = 'approve';

$conn->begin_transaction();
try {
    // Находим запись подтверждения по order_id и qr_code (если передан)
    if ($qrCode !== '') {
        $stmt = $conn->prepare("
            SELECT confirmed_at
            FROM order_reception_confirmations
            WHERE order_id = ? AND qr_code = ?
            FOR UPDATE
        ");
if (!$stmt) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Ошибка подготовки запроса']);
    exit;
}

        $stmt->bind_param("is", $orderId, $qrCode);
    } else {
        $stmt = $conn->prepare("
            SELECT confirmed_at
            FROM order_reception_confirmations
            WHERE order_id = ?
            FOR UPDATE
        ");
if (!$stmt) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Ошибка подготовки запроса']);
    exit;
}

        $stmt->bind_param("i", $orderId);
    }
    $stmt->execute();
    $res  = $stmt->get_result();
    $conf = $res->fetch_assoc();
    $stmt->close();

    if (!$conf) {
        throw new Exception('Запись подтверждения не найдена');
    }
    if (!empty($conf['confirmed_at'])) {
        throw new Exception('Этот QR‑код уже использован');
    }

    // Загрузка фото (одно изображение)
    $uploaded = [];
    if (isset($_FILES['photo']) && is_uploaded_file($_FILES['photo']['tmp_name'])) {
        $uploadDir = __DIR__ . '/../../uploads/';
        if (!is_dir($uploadDir)) mkdir($uploadDir, 0777, true);

        $fname = 'confirm_' . time() . '.jpg';
        $fpath = $uploadDir . $fname;
        if (move_uploaded_file($_FILES['photo']['tmp_name'], $fpath)) {
            $relative = 'uploads/' . $fname;
            $uploaded[] = $relative;
            $stmtPhoto = $conn->prepare("INSERT INTO order_photos (order_id, file_path) VALUES (?, ?)");
            if ($stmtPhoto) {
                $stmtPhoto->bind_param("is", $orderId, $relative);
                $stmtPhoto->execute();
                $stmtPhoto->close();
            }
        }
    }
    $photosJson = json_encode($uploaded, JSON_UNESCAPED_UNICODE);
    $now = date('Y-m-d H:i:s');

    if ($action === 'approve') {
        // Обновляем orders: статус "Готов к отправке" по правильному ключу order_id
        $stmt = $conn->prepare("UPDATE orders SET status = 'Готов к отправке' WHERE order_id = ?");
if (!$stmt) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Ошибка подготовки запроса']);
    exit;
}

        $stmt->bind_param("i", $orderId);
        $stmt->execute();
        $stmt->close();

        // Получаем сумму из shipments (указана при создании заявки)
        if ($payment === null) {
            $stmtSelect = $conn->prepare("SELECT payment FROM shipments WHERE order_id = ?");
            if (!$stmtSelect) {
                http_response_code(500);
                echo json_encode(['success' => false, 'message' => 'Ошибка подготовки запроса']);
                exit;
            }

            $stmtSelect->bind_param("i", $orderId);
            $stmtSelect->execute();
            $stmtSelect->bind_result($payment);
            $stmtSelect->fetch();
            $stmtSelect->close();
            $payment = floatval($payment);
        }

        // Обновляем shipments: время приёмки, фото и информацию об оплате
        $stmtUpdate = $conn->prepare("UPDATE shipments SET accept_time = ?, photo_path = ?, payment = ?, payment_type = ? WHERE order_id = ?");
        if (!$stmtUpdate) {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Ошибка подготовки запроса']);
            exit;
        }

        $stmtUpdate->bind_param("ssdsi", $now, $photosJson, $payment, $paymentType, $orderId);
        $stmtUpdate->execute();
        $stmtUpdate->close();

        // Сохраняем данные об оплате в order_reception_details
        $stmt = $conn->prepare("INSERT INTO order_reception_details (order_id, payment_type, payment) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE payment_type = VALUES(payment_type), payment = VALUES(payment)");
if (!$stmt) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Ошибка подготовки запроса']);
    exit;
}

        $stmt->bind_param("isd", $orderId, $paymentType, $payment);
        $stmt->execute();
        $stmt->close();

        // Отмечаем подтверждение в order_reception_confirmations
        if ($qrCode !== '') {
            $stmt = $conn->prepare("
                UPDATE order_reception_confirmations
                SET confirmed_at = ?
                WHERE order_id = ? AND qr_code = ?
            ");
if (!$stmt) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Ошибка подготовки запроса']);
    exit;
}

            $stmt->bind_param("sis", $now, $orderId, $qrCode);
        } else {
            $stmt = $conn->prepare("
                UPDATE order_reception_confirmations
                SET confirmed_at = ?
                WHERE order_id = ?
            ");
if (!$stmt) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Ошибка подготовки запроса']);
    exit;
}

            $stmt->bind_param("si", $now, $orderId);
        }
        $stmt->execute();
        $stmt->close();

        // Ищем связанное задание в pickups и обновляем его статус
        if ($qrCode !== '') {
            $stmt = $conn->prepare(
                "SELECT id, status FROM pickups WHERE order_id = ? OR qr_code = ? FOR UPDATE"
            );
if (!$stmt) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Ошибка подготовки запроса']);
    exit;
}

            $stmt->bind_param("is", $orderId, $qrCode);
        } else {
            $stmt = $conn->prepare(
                "SELECT id, status FROM pickups WHERE order_id = ? FOR UPDATE"
            );
if (!$stmt) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Ошибка подготовки запроса']);
    exit;
}

            $stmt->bind_param("i", $orderId);
        }
        $stmt->execute();
        $pickupRow = $stmt->get_result()->fetch_assoc();
        $stmt->close();

        if ($pickupRow) {
            $currentStatus = $pickupRow['status'];
            $allowed = [
                'in_transit' => ['status' => 'picked_up', 'time_field' => 'picked_up_at'],
                'picked_up'  => ['status' => 'delivered',  'time_field' => 'delivered_at'],
            ];

            if (!isset($allowed[$currentStatus])) {
                throw new Exception('Недопустимый статус для обновления');
            }

            $newStatus  = $allowed[$currentStatus]['status'];
            $timeField  = $allowed[$currentStatus]['time_field'];
            $sqlPickup  = "UPDATE pickups SET status = ?, $timeField = NOW() WHERE id = ?";
            $stmt = $conn->prepare($sqlPickup);
if (!$stmt) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Ошибка подготовки запроса']);
    exit;
}

            $stmt->bind_param("si", $newStatus, $pickupRow['id']);
            $stmt->execute();
            $stmt->close();
        }

        // Фиксируем транзакцию
        $conn->commit();
        echo json_encode(['success' => true, 'message' => 'Приёмка подтверждена, данные об оплате сохранены. Статус: «Готов к отправке».']);
    } else {
        // Отказ по приёмке: обновляем orders по order_id
        $stmt = $conn->prepare("UPDATE orders SET status = 'Отклонён' WHERE order_id = ?");
if (!$stmt) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Ошибка подготовки запроса']);
    exit;
}

        $stmt->bind_param("i", $orderId);
        $stmt->execute();
        $stmt->close();

        // Записываем дату отказа в order_reception_confirmations
        if ($qrCode !== '') {
            $stmt = $conn->prepare("
                UPDATE order_reception_confirmations
                SET confirmed_at = ?
                WHERE order_id = ? AND qr_code = ?
            ");
if (!$stmt) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Ошибка подготовки запроса']);
    exit;
}

            $stmt->bind_param("sis", $now, $orderId, $qrCode);
        } else {
            $stmt = $conn->prepare("
                UPDATE order_reception_confirmations
                SET confirmed_at = ?
                WHERE order_id = ?
            ");
if (!$stmt) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Ошибка подготовки запроса']);
    exit;
}

            $stmt->bind_param("si", $now, $orderId);
        }
        $stmt->execute();
        $stmt->close();

        $conn->commit();
        echo json_encode(['success' => true, 'message' => 'Приёмка отклонена.']);
    }
} catch (Exception $e) {
    // Откатываем транзакцию при ошибке
$conn->rollback();
echo json_encode(['success' => false, 'message' => 'Ошибка: ' . $e->getMessage()]);
}
$conn->close();