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

    $metric = $_GET['metric'] ?? 'orders'; // 'orders' or 'payments'

    $sql = "SELECT city, COUNT(*) AS orders_count, COALESCE(SUM(payment),0) AS total_payment
            FROM shipments
            GROUP BY city";

    $stmt = $conn->prepare($sql);
    $stmt->execute();
    $result = $stmt->get_result();

    $labels = [];
    $data   = [];
    while ($row = $result->fetch_assoc()) {
        $labels[] = $row['city'] ?: 'Не указан';
        if ($metric === 'payments') {
            $data[] = (float)$row['total_payment'];
        } else {
            $data[] = (int)$row['orders_count'];
        }
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
