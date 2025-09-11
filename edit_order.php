<?php
require_once 'auth_helper.php';
requireRole(['admin','manager']);

require_once 'db_connection.php';
header('Content-Type: application/json; charset=utf-8');

$data    = json_decode(file_get_contents('php://input'), true);
$orderId = $data['order_id'] ?? 0;
$comment = trim($data['comment'] ?? '');
$boxes   = isset($data['boxes']) ? intval($data['boxes']) : null;

$role = $_SESSION['role'];


if (!$orderId || ($comment === '' && $boxes === null)) {
    echo json_encode(["success" => false, "message" => "Неверные данные"]);
    exit;
}

// Обновляем комментарий
if ($comment !== '') {
    $stmt = $conn->prepare("UPDATE orders SET comment = ? WHERE order_id = ?");
    $stmt->bind_param("si", $comment, $orderId);
    $stmt->execute();
    $stmt->close();

    $histText = "Комментарий обновлён пользователем ($role)";
    $hist = $conn->prepare("INSERT INTO order_history (order_id, status_change, changed_by) VALUES (?, ?, ?)");
    $hist->bind_param("iss", $orderId, $histText, $role);
    $hist->execute();
    $hist->close();
}

// Обновляем количество коробок
if ($boxes !== null) {
    $stmt2 = $conn->prepare("UPDATE order_reception_details SET boxes = ? WHERE order_id = ?");
    $stmt2->bind_param("ii", $boxes, $orderId);
    $stmt2->execute();
    $stmt2->close();

    $histText2 = "Обновлено количество коробок: $boxes ($role)";
    $hist2 = $conn->prepare("INSERT INTO order_history (order_id, status_change, changed_by) VALUES (?, ?, ?)");
    $hist2->bind_param("iss", $orderId, $histText2, $role);
    $hist2->execute();
    $hist2->close();
}

echo json_encode([
    "success" => true,
    "message" => "Изменения сохранены"
]);

$conn->close();
?>
