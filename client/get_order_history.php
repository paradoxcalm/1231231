<?php
session_start();
header('Content-Type: application/json; charset=utf-8');
require_once 'db_connection.php';

$role = $_SESSION['role'] ?? 'client';
if ($role !== 'admin') {
    echo json_encode(["success" => false, "message" => "Access denied"]);
    exit;
}

$orderId = $_GET['order_id'] ?? 0;
if (!$orderId) {
    echo json_encode(["success" => false, "message" => "Missing order_id"]);
    exit;
}

try {
    $stmt = $conn->prepare("
        SELECT history_id, order_id, status_change, changed_by, change_date
        FROM order_history
        WHERE order_id = ?
        ORDER BY change_date DESC
    ");
    $stmt->bind_param("i", $orderId);
    $stmt->execute();
    $result = $stmt->get_result();

    $history = [];
    while ($row = $result->fetch_assoc()) {
        $history[] = $row;
    }

    echo json_encode(["success" => true, "history" => $history]);

} catch (Exception $e) {
    echo json_encode(["success" => false, "message" => $e->getMessage()]);
}
?>
