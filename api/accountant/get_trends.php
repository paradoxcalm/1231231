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

    $period = $_GET['period'] ?? 'month';
    $validPeriods = ['week', 'month', 'quarter', 'year'];
    if (!in_array($period, $validPeriods, true)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Invalid period']);
        exit;
    }

    require_once __DIR__ . '/../../db_connection.php';

    switch ($period) {
        case 'week':
            $days = 6; // последние 7 дней
            $labelSelect = "DATE_FORMAT(submission_date, '%d.%m')";
            $groupBy = "DATE(submission_date)";
            break;
        case 'month':
            $days = 29; // последние 30 дней
            $labelSelect = "DATE_FORMAT(submission_date, '%d.%m')";
            $groupBy = "DATE(submission_date)";
            break;
        case 'quarter':
            $days = 89; // последние 90 дней
            $labelSelect = "DATE_FORMAT(submission_date, '%m.%Y')";
            $groupBy = "DATE_FORMAT(submission_date, '%Y-%m')";
            break;
        case 'year':
        default:
            $days = 364; // последние 365 дней
            $labelSelect = "DATE_FORMAT(submission_date, '%m.%Y')";
            $groupBy = "DATE_FORMAT(submission_date, '%Y-%m')";
            break;
    }

    $sql = "SELECT $labelSelect AS label,
                   COALESCE(SUM(payment),0) AS revenue,
                   COUNT(*) AS orders
            FROM shipments
            WHERE submission_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
            GROUP BY $groupBy
            ORDER BY $groupBy";

    $stmt = $conn->prepare($sql);
    $stmt->bind_param('i', $days);
    $stmt->execute();
    $result = $stmt->get_result();

    $points = [];
    while ($row = $result->fetch_assoc()) {
        $points[] = [
            'label' => $row['label'],
            'revenue' => (float)$row['revenue'],
            'orders' => (int)$row['orders']
        ];
    }

    $stmt->close();
    $conn->close();

    echo json_encode(['success' => true, 'data' => $points]);
    exit;
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Internal Server Error']);
    exit;
}
?>
