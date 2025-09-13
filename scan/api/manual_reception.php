<?php
require_once __DIR__ . '/../../session_init.php';
header('Content-Type: application/json');

// Подключаемся к базе
require_once __DIR__ . '/../../db_connection.php';

try {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        throw new Exception('Неверный метод запроса');
    }

    // Получаем данные
    $scheduleId   = $_POST['scheduleId'] ?? null;
    $senderPhone  = $_POST['senderPhone'] ?? '';
    $shipmentType = $_POST['shipmentType'] ?? '';
    $boxes        = $_POST['boxes'] ?? 0;
    $paymentAmount= $_POST['paymentAmount'] ?? 0;
    $paymentType  = $_POST['paymentType'] ?? '';

    if (!$scheduleId) {
        throw new Exception('Не выбрано отправление');
    }

    // Валидация (по необходимости расширьте)
    if (empty($senderPhone) || !preg_match('/^[0-9]{10,15}$/', $senderPhone)) {
        throw new Exception('Некорректный номер телефона');
    }

    // Сохраняем заявку в таблицу (пример: table "orders")
    $stmt = $conn->prepare('INSERT INTO orders
      (schedule_id, sender_phone, shipment_type, boxes, payment_amount, payment_type, created_at)
      VALUES (?, ?, ?, ?, ?, ?, NOW())');
    if (!$stmt) {
        throw new Exception('Ошибка подготовки запроса: ' . $conn->error);
    }
    $stmt->bind_param('issids',
        $scheduleId,
        $senderPhone,
        $shipmentType,
        $boxes,
        $paymentAmount,
        $paymentType
    );
    $stmt->execute();
    $orderId = $conn->insert_id;
    $stmt->close();

    // Обработка файлов
    $uploadDir = __DIR__ . '/../../uploads/';
    if (!empty($_FILES['photo']['name'][0])) {
        if (!is_dir($uploadDir)) {
            mkdir($uploadDir, 0777, true);
        }
        foreach ($_FILES['photo']['tmp_name'] as $index => $tmpName) {
            $originalName = basename($_FILES['photo']['name'][$index]);
            $newName = uniqid() . '_' . $originalName;
            if (move_uploaded_file($tmpName, $uploadDir . $newName)) {
                $relative = 'uploads/' . $newName;
                $stmtPhoto = $conn->prepare("INSERT INTO order_photos (order_id, file_path) VALUES (?, ?)");
                if ($stmtPhoto) {
                    $stmtPhoto->bind_param('is', $orderId, $relative);
                    $stmtPhoto->execute();
                    $stmtPhoto->close();
                }
            }
        }
    }

    echo json_encode(['status' => 'success']);
} catch (Exception $e) {
    echo json_encode(['status' => 'error', 'message' => $e->getMessage()]);
} finally {
    if (isset($conn) && $conn instanceof mysqli) {
        $conn->close();
    }
}
