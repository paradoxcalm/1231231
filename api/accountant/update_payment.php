<?php
require_once __DIR__ . '/../../auth_helper.php';
requireRole(['accountant']);
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/../../db_connection.php';

$data = json_decode(file_get_contents('php://input'), true);
$orderId = intval($data['order_id'] ?? 0);
$payment = isset($data['payment']) ? floatval($data['payment']) : null;
$paymentType = isset($data['payment_type']) ? trim($data['payment_type']) : null;
$userId = $_SESSION['user_id'] ?? '';

if (!$orderId || $payment === null || $paymentType === null) {
    echo json_encode(['success' => false, 'message' => 'Недостаточно данных']);
    exit;
}

$conn->begin_transaction();
try {
    // Получаем старые значения для лога
    $stmtOld = $conn->prepare("SELECT payment, payment_type FROM shipments WHERE order_id = ?");
    $stmtOld->bind_param('i', $orderId);
    $stmtOld->execute();
    $stmtOld->bind_result($oldPayment, $oldType);
    $stmtOld->fetch();
    $stmtOld->close();

    // Обновляем shipments
    $stmt = $conn->prepare("UPDATE shipments SET payment = ?, payment_type = ? WHERE order_id = ?");
    $stmt->bind_param('dsi', $payment, $paymentType, $orderId);
    $stmt->execute();
    $stmt->close();

    // Обновляем orders
    $stmt = $conn->prepare("UPDATE orders SET payment_amount = ? WHERE order_id = ?");
    $stmt->bind_param('di', $payment, $orderId);
    $stmt->execute();
    $stmt->close();

    // Обновляем order_reception_details
    $stmt = $conn->prepare("INSERT INTO order_reception_details (order_id, payment, payment_type) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE payment = VALUES(payment), payment_type = VALUES(payment_type)");
    $stmt->bind_param('ids', $orderId, $payment, $paymentType);
    $stmt->execute();
    $stmt->close();

    // Лог
    $logText = sprintf('Оплата изменена с %s (%s) на %s (%s)', $oldPayment ?? 'null', $oldType ?? 'null', $payment, $paymentType);
    $log = $conn->prepare("INSERT INTO order_history (order_id, status_change, changed_by) VALUES (?, ?, ?)");
    $changedBy = (string)$userId;
    $log->bind_param('iss', $orderId, $logText, $changedBy);
    $log->execute();
    $log->close();

    $conn->commit();
    echo json_encode(['success' => true]);
} catch (Throwable $e) {
    $conn->rollback();
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Ошибка сервера']);
}

$conn->close();
?>
