<?php
session_start();
header('Content-Type: application/json; charset=utf-8');
require_once 'db_connection.php';
require_once 'notify_user.php'; // ✅ импорт функции

$userId = $_SESSION['user_id'] ?? 0;
$role   = $_SESSION['role'] ?? '';
if (!$userId || !in_array($role, ['admin', 'manager'])) {
    echo json_encode(['success' => false, 'message' => 'Доступ запрещён']);
    exit;
}

$orderId = intval($_POST['order_id'] ?? 0);
$action  = $_POST['action']    ?? '';
if (!$orderId || !in_array($action, ['confirm', 'reject'])) {
    echo json_encode(['success' => false, 'message' => 'Некорректные данные']);
    exit;
}

$conn->begin_transaction();
try {
    $stmt = $conn->prepare("
        SELECT s.city, s.warehouses 
        FROM orders o 
        LEFT JOIN schedules s ON o.schedule_id = s.id 
        WHERE o.order_id = ? LIMIT 1
    ");
    $stmt->bind_param("i", $orderId);
    $stmt->execute();
    $stmt->bind_result($city, $warehouse);
    $stmt->fetch();
    $stmt->close();

    if ($action === 'confirm') {
        $u1 = $conn->prepare("UPDATE orders SET status = 'Товар выгружен' WHERE order_id = ?");
        $u1->bind_param("i", $orderId);
        $u1->execute();
        $u1->close();

        $d1 = $conn->prepare("DELETE FROM order_reception_confirmations WHERE order_id = ?");
        $d1->bind_param("i", $orderId);
        $d1->execute();
        $d1->close();

        // Загрузка фото
        $paths = [];
        $logPath = __DIR__ . '/logs/upload_debug.log';
        $uploadDir = __DIR__ . '/uploads/';
        if (!is_dir($uploadDir)) {
            mkdir($uploadDir, 0777, true);
            error_log("Создан каталог: $uploadDir\n", 3, $logPath);
        }
        if (!empty($_FILES['photos']['tmp_name'][0])) {
            foreach ($_FILES['photos']['tmp_name'] as $i => $tmpName) {
                $fileName = 'reception_' . $orderId . '_' . time() . "_$i.jpg";
                $filePath = $uploadDir . $fileName;
                error_log("Попытка сохранить: $tmpName → $filePath\n", 3, $logPath);
                if (move_uploaded_file($tmpName, $filePath)) {
                    $paths[] = 'uploads/' . $fileName;
                    error_log("✅ Успешно сохранено: $filePath\n", 3, $logPath);
                } else {
                    error_log("❌ Ошибка move_uploaded_file: $tmpName → $filePath\n", 3, $logPath);
                }
            }
        } else {
            error_log("⚠️ Нет файлов в \$_FILES[photos]\n", 3, $logPath);
        }

        if (!empty($paths)) {
            $jsonPaths = json_encode($paths, JSON_UNESCAPED_UNICODE);
            $up1 = $conn->prepare("UPDATE order_reception_details SET photo_path = ? WHERE order_id = ?");
            $up1->bind_param("si", $jsonPaths, $orderId);
            $up1->execute();
            $up1->close();

            $get = $conn->prepare("SELECT photo_path FROM shipments WHERE order_id = ?");
            $get->bind_param("i", $orderId);
            $get->execute();
            $oldJson = $get->get_result()->fetch_row()[0] ?? '[]';
            $get->close();

            $oldArr = json_decode($oldJson, true);
            if (!is_array($oldArr)) $oldArr = [];
            $allArr = array_merge($oldArr, $paths);
            $jsonAll = json_encode($allArr, JSON_UNESCAPED_UNICODE);

            $up2 = $conn->prepare("UPDATE shipments SET photo_path = ? WHERE order_id = ?");
            $up2->bind_param("si", $jsonAll, $orderId);
            $up2->execute();
            $up2->close();
        }

        $statusText = "Подтверждено менеджером. Город: $city → Склад: $warehouse";
    } else {
        $u2 = $conn->prepare("UPDATE orders SET status = 'Отказ от приёмки' WHERE order_id = ?");
        $u2->bind_param("i", $orderId);
        $u2->execute();
        $u2->close();

        $d2 = $conn->prepare("DELETE FROM order_reception_confirmations WHERE order_id = ?");
        $d2->bind_param("i", $orderId);
        $d2->execute();
        $d2->close();

        $statusText = "Отклонено менеджером. Город: $city → Склад: $warehouse";
    }

    $history = $conn->prepare("
        INSERT INTO order_history (order_id, status_change, changed_by)
        VALUES (?, ?, ?)
    ");
    $history->bind_param("iss", $orderId, $statusText, $role);
    $history->execute();
    $history->close();

    // 🔔 Отправка уведомления клиенту
    $getUid = $conn->prepare("SELECT user_id FROM orders WHERE order_id = ?");
    $getUid->bind_param("i", $orderId);
    $getUid->execute();
    $getUid->bind_result($clientId);
    $getUid->fetch();
    $getUid->close();

    if ($clientId) {
        $notifText = $action === 'confirm'
            ? "Ваш заказ #$orderId подтверждён: $city → $warehouse"
            : "Ваш заказ #$orderId отклонён менеджером";
        sendNotification($conn, $clientId, $notifText); // ✅
    }

    $conn->commit();
    echo json_encode(['success'=>true]);
} catch (Exception $e) {
    $conn->rollback();
    error_log("❌ Исключение в confirm_reception.php: ".$e->getMessage()."\n", 3, __DIR__ . '/logs/upload_debug.log');
    echo json_encode(['success'=>false,'message'=>'Ошибка: '.$e->getMessage()]);
}
$conn->close();
