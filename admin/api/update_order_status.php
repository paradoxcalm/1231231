<?php
require_once __DIR__ . '/../../auth_helper.php';
requireRole(['admin','manager']);

require_once __DIR__ . '/../../db_connection.php';
require_once __DIR__ . '/../../notify_user.php';
header('Content-Type: application/json; charset=utf-8');

$data      = json_decode(file_get_contents('php://input'), true);
$orderId   = intval($data['order_id'] ?? 0);
$newStatus = trim($data['status'] ?? '');

$role = $_SESSION['role'];

if (!$orderId || $newStatus === '') {
    echo json_encode(['success' => false, 'message' => 'Недостаточно данных']);
    exit;
}

$conn->begin_transaction();
try {
    // Получим старый статус
    $get = $conn->prepare("SELECT status, user_id FROM orders WHERE order_id = ?");
    $get->bind_param("i", $orderId);
    $get->execute();
    $get->bind_result($oldStatus, $clientId);
    $get->fetch();
    $get->close();

    if (!$oldStatus) {
        echo json_encode(['success' => false, 'message' => 'Заказ не найден']);
        $conn->rollback();
        exit;
    }

    // Обновляем статус
    $stmt = $conn->prepare("UPDATE orders SET status = ? WHERE order_id = ?");
    $stmt->bind_param("si", $newStatus, $orderId);
    $stmt->execute();
    $stmt->close();

    // История
    $logText = "Статус изменён с \"$oldStatus\" на \"$newStatus\" ($role)";
    $log = $conn->prepare("INSERT INTO order_history (order_id, status_change, changed_by) VALUES (?, ?, ?)");
    $log->bind_param("iss", $orderId, $logText, $role);
    $log->execute();
    $log->close();

    // 🔔 Уведомление клиенту
    if ($clientId && $role !== 'client') {
        $notif = "🔄 Ваш заказ #$orderId обновлён: $newStatus";
        sendNotification($conn, $clientId, $notif);
    }

    $conn->commit();
    echo json_encode(['success' => true]);
} catch (Exception $e) {
    $conn->rollback();
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
}
$conn->close();
