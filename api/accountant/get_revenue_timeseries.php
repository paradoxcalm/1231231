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

    $days = isset($_GET['days']) ? max(1, intval($_GET['days'])) : 7;

    require_once __DIR__ . '/../../db_connection.php';

    $sql = "SELECT DATE(submission_date) AS date, COALESCE(SUM(payment),0) AS amount
            FROM shipments
            WHERE submission_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
            GROUP BY DATE(submission_date)
            ORDER BY DATE(submission_date)";

    $stmt = $conn->prepare($sql);
    $stmt->bind_param('i', $days);
    $stmt->execute();
    $result = $stmt->get_result();
    $timeseries = [];
    while ($row = $result->fetch_assoc()) {
        $timeseries[] = [
            'date' => $row['date'],
            'amount' => (float)$row['amount']
        ];
    }
    $stmt->close();

    echo json_encode(['success' => true, 'data' => $timeseries]);
    $conn->close();
    exit;
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Internal Server Error']);
    exit;
}
?>
