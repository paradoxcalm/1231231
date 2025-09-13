<?php
require_once 'session_init.php';
session_start();
header('Content-Type: application/json; charset=utf-8');
require_once 'db_connection.php';
mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);

$data = json_decode(file_get_contents("php://input"), true);
$orderId = $data['order_id'] ?? 0;
$role    = $_SESSION['role'] ?? 'client';
$userId  = $_SESSION['user_id'] ?? 0;

if (!$orderId) {
    echo json_encode(["success" => false, "message" => "Некорректный ID заказа"]);
    exit;
}

// Проверяем, существует ли заказ и его статус
$stmt = $conn->prepare("SELECT user_id, status FROM orders WHERE order_id = ? AND is_deleted = 0 AND status <> 'Удалён клиентом'");
$stmt->bind_param("i", $orderId);
$stmt->execute();
$result = $stmt->get_result();
$order = $result->fetch_assoc();
$stmt->close();

if (!$order) {
    echo json_encode(["success" => false, "message" => "Заказ не найден"]);
    exit;
}

// Ограничения по ролям
if ($role === 'client') {
    if ($order['user_id'] != $userId) {
        echo json_encode(["success" => false, "message" => "Можно удалять только свои заказы"]);
        exit;
    }
    if (trim($order['status']) !== 'Выгрузите товар') {
        echo json_encode(["success" => false, "message" => "Удаление возможно только до выгрузки"]);
        exit;
    }
}

// Начинаем транзакцию
$conn->begin_transaction();

// Лог в историю
$histText = "Удалён пользователем ($role)";
$hist = $conn->prepare("INSERT INTO order_history (order_id, status_change, changed_by) VALUES (?, ?, ?)");
$hist->bind_param("iss", $orderId, $histText, $role);
$hist->execute();
$hist->close();

// Помечаем заказ как удалён вместо физического удаления
$updOrder = $conn->prepare("UPDATE orders SET status='Удалён клиентом', is_deleted=1 WHERE order_id = ?");
$updOrder->bind_param("i", $orderId);
$updOrder->execute();
$success = $updOrder->affected_rows > 0;
$updOrder->close();

// Фиксируем транзакцию
if ($success) {
    $conn->commit();
} else {
    $conn->rollback();
}

echo json_encode([
    "success" => $success,
    "message" => $success ? "Заказ удалён" : "Ошибка удаления"
]);

$conn->close();
?>