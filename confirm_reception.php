<?php
require_once 'session_init.php';
session_start();
header('Content-Type: application/json; charset=utf-8');
require_once 'db_connection.php';

// Проверяем авторизацию
if (!isset($_SESSION['user_id'])) {
    echo json_encode(['success' => false, 'message' => 'Пользователь не авторизован']);
    exit;
}

$userId  = $_SESSION['user_id'];
$orderId = intval($_POST['order_id'] ?? 0);
$qrCode  = trim($_POST['qr_code'] ?? '');
$action  = trim($_POST['action'] ?? '');

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
        $stmtSel = $conn->prepare("
            SELECT confirmed_at
            FROM order_reception_confirmations
            WHERE order_id = ? AND qr_code = ?
            FOR UPDATE
        ");
        $stmtSel->bind_param("is", $orderId, $qrCode);
    } else {
        $stmtSel = $conn->prepare("
            SELECT confirmed_at
            FROM order_reception_confirmations
            WHERE order_id = ?
            FOR UPDATE
        ");
        $stmtSel->bind_param("i", $orderId);
    }
    $stmtSel->execute();
    $res  = $stmtSel->get_result();
    $conf = $res->fetch_assoc();
    $stmtSel->close();

    if (!$conf) {
        throw new Exception('Запись подтверждения не найдена');
    }
    if (!empty($conf['confirmed_at'])) {
        throw new Exception('Этот QR‑код уже использован');
    }

    // Загрузка фото
    $uploaded = [];
    if (!empty($_FILES['photos']['tmp_name'][0])) {
        $uploadDir = __DIR__ . '/uploads/';
        if (!is_dir($uploadDir)) mkdir($uploadDir, 0777, true);
        foreach ($_FILES['photos']['tmp_name'] as $i => $tmp) {
            $fname = 'confirm_' . time() . "_$i.jpg";
            $fpath = $uploadDir . $fname;
            if (move_uploaded_file($tmp, $fpath)) {
                $uploaded[] = 'uploads/' . $fname;
            }
        }
    }
    $photosJson = json_encode($uploaded, JSON_UNESCAPED_UNICODE);
    $now = date('Y-m-d H:i:s');

    if ($action === 'approve') {
        // Обновляем orders: статус "Готов к отправке" по правильному ключу order_id
        $stmtOrd = $conn->prepare("UPDATE orders SET status = 'Готов к отправке' WHERE order_id = ?");
        $stmtOrd->bind_param("i", $orderId);
        $stmtOrd->execute();
        $stmtOrd->close();

        // Обновляем shipments: время приёмки и фото
        $stmtShip = $conn->prepare("UPDATE shipments SET accept_time = ?, photo_path = ? WHERE order_id = ?");
        $stmtShip->bind_param("ssi", $now, $photosJson, $orderId);
        $stmtShip->execute();
        $stmtShip->close();

        // Отмечаем подтверждение в order_reception_confirmations
        if ($qrCode !== '') {
            $stmtConf = $conn->prepare("
                UPDATE order_reception_confirmations
                SET confirmed_at = ?
                WHERE order_id = ? AND qr_code = ?
            ");
            $stmtConf->bind_param("sis", $now, $orderId, $qrCode);
        } else {
            $stmtConf = $conn->prepare("
                UPDATE order_reception_confirmations
                SET confirmed_at = ?
                WHERE order_id = ?
            ");
            $stmtConf->bind_param("si", $now, $orderId);
        }
        $stmtConf->execute();
        $stmtConf->close();

        // Ищем связанное задание в pickups и обновляем его статус
        if ($qrCode !== '') {
            $stmtPickupSel = $conn->prepare(
                "SELECT id, status FROM pickups WHERE order_id = ? OR qr_code = ? FOR UPDATE"
            );
            $stmtPickupSel->bind_param("is", $orderId, $qrCode);
        } else {
            $stmtPickupSel = $conn->prepare(
                "SELECT id, status FROM pickups WHERE order_id = ? FOR UPDATE"
            );
            $stmtPickupSel->bind_param("i", $orderId);
        }
        $stmtPickupSel->execute();
        $pickupRow = $stmtPickupSel->get_result()->fetch_assoc();
        $stmtPickupSel->close();

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
            $stmtPickupUpd = $conn->prepare($sqlPickup);
            $stmtPickupUpd->bind_param("si", $newStatus, $pickupRow['id']);
            $stmtPickupUpd->execute();
            $stmtPickupUpd->close();
        }

        // Фиксируем транзакцию
        $conn->commit();
        echo json_encode(['success' => true, 'message' => 'Заявка принята. Статус: «Готов к отправке».']);
    } else {
        // Отказ по приёмке: обновляем orders по order_id
        $stmtOrd = $conn->prepare("UPDATE orders SET status = 'Отклонён' WHERE order_id = ?");
        $stmtOrd->bind_param("i", $orderId);
        $stmtOrd->execute();
        $stmtOrd->close();

        // Записываем дату отказа в order_reception_confirmations
        if ($qrCode !== '') {
            $stmtConf = $conn->prepare("
                UPDATE order_reception_confirmations
                SET confirmed_at = ?
                WHERE order_id = ? AND qr_code = ?
            ");
            $stmtConf->bind_param("sis", $now, $orderId, $qrCode);
        } else {
            $stmtConf = $conn->prepare("
                UPDATE order_reception_confirmations
                SET confirmed_at = ?
                WHERE order_id = ?
            ");
            $stmtConf->bind_param("si", $now, $orderId);
        }
        $stmtConf->execute();
        $stmtConf->close();

        $conn->commit();
        echo json_encode(['success' => true, 'message' => 'Приёмка отклонена.']);
    }
} catch (Exception $e) {
    // Откатываем транзакцию при ошибке
    $conn->rollback();
    echo json_encode(['success' => false, 'message' => 'Ошибка: ' . $e->getMessage()]);
}
$conn->close();