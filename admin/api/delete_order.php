<?php
require_once __DIR__ . '/../../session_init.php';
session_start();
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/../../db_connection.php';
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
$stmt = $conn->prepare("SELECT user_id, status FROM orders WHERE order_id = ?");
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

// Удаление из зависимых таблиц
$tables = [
    'order_history',
    'order_items',
    'order_reception_details',
    'order_processing_details',
    'order_reception_confirmations'
];
foreach ($tables as $t) {
    $del = $conn->prepare("DELETE FROM `$t` WHERE order_id = ?");
    $del->bind_param("i", $orderId);
    $del->execute();
    $del->close();
}

// Удаление из основной таблицы
$delOrder = $conn->prepare("DELETE FROM orders WHERE order_id = ?");
$delOrder->bind_param("i", $orderId);
$delOrder->execute();
$success = $delOrder->affected_rows > 0;
$delOrder->close();

// Удаление из pickups
if ($success) {
    $delPickup = $conn->prepare("DELETE FROM pickups WHERE order_id = ?");
    $delPickup->bind_param("i", $orderId);
    $success = $delPickup->execute();
    $delPickup->close();
}

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