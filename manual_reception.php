<?php
header('Content-Type: application/json');

// Подключаемся к базе (поменяйте на своё подключение)
require_once 'config.php';

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
    $stmt = $pdo->prepare('INSERT INTO orders 
      (schedule_id, sender_phone, shipment_type, boxes, payment_amount, payment_type, created_at) 
      VALUES (?, ?, ?, ?, ?, ?, NOW())');
    $stmt->execute([
        $scheduleId,
        $senderPhone,
        $shipmentType,
        $boxes,
        $paymentAmount,
        $paymentType
    ]);

    // Обработка файлов
    $uploadDir = 'uploads/';
    if (!empty($_FILES['photo']['name'][0])) {
        if (!is_dir($uploadDir)) {
            mkdir($uploadDir, 0777, true);
        }
        foreach ($_FILES['photo']['tmp_name'] as $index => $tmpName) {
            $originalName = basename($_FILES['photo']['name'][$index]);
            $newName = uniqid() . '_' . $originalName;
            move_uploaded_file($tmpName, $uploadDir . $newName);
            // можно также сохранить имя файла в отдельной таблице, связанной с заявкой
        }
    }

    echo json_encode(['status' => 'success']);
} catch (Exception $e) {
    echo json_encode(['status' => 'error', 'message' => $e->getMessage()]);
}
