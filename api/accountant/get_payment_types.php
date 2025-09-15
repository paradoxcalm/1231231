<?php
require_once __DIR__ . '/../../error_handler.php';

try {
    session_start();
    header('Content-Type: application/json; charset=UTF-8');
    if (!isset($_SESSION['role']) || $_SESSION['role'] !== 'accountant') {
        http_response_code(403);
        echo json_encode(['success' => false, 'message' => 'Forbidden']);
        exit;
    }

    require_once __DIR__ . '/../../db_connection.php';

    $sql = "SELECT COALESCE(d.payment_type, s.payment_type) AS payment_type, COUNT(*) AS cnt
            FROM shipments s
            LEFT JOIN order_reception_details d ON s.order_id = d.order_id
            GROUP BY COALESCE(d.payment_type, s.payment_type)";

    $stmt = $conn->prepare($sql);
    $stmt->execute();
    $result = $stmt->get_result();

    $labels = [];
    $data = [];
    while ($row = $result->fetch_assoc()) {
        $labels[] = $row['payment_type'] ?: 'Не указан';
        $data[] = (int)$row['cnt'];
    }

    $stmt->close();
    $conn->close();

    echo json_encode(['success' => true, 'labels' => $labels, 'data' => $data]);
    exit;
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Internal Server Error']);
    exit;
}
?>
