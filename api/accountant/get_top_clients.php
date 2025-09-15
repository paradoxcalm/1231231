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

    $sql = "SELECT 
                CONCAT(u.first_name, ' ', u.last_name) AS client_name,
                COUNT(o.order_id) AS orders_count,
                COALESCE(SUM(COALESCE(d.payment, s.payment, 0)), 0) AS total_revenue
            FROM usersff u
            LEFT JOIN orders o ON u.id = o.user_id
            LEFT JOIN order_reception_details d ON o.order_id = d.order_id
            LEFT JOIN shipments s ON o.order_id = s.order_id
            WHERE u.role = 'client'
            GROUP BY u.id, u.first_name, u.last_name
            HAVING orders_count > 0
            ORDER BY total_revenue DESC
            LIMIT 10";

    $result = $conn->query($sql);
    $clients = [];

    if ($result) {
        while ($row = $result->fetch_assoc()) {
            $clients[] = [
                'client_name' => $row['client_name'],
                'orders_count' => (int)$row['orders_count'],
                'total_revenue' => (float)$row['total_revenue']
            ];
        }
    }

    echo json_encode(['success' => true, 'clients' => $clients]);
    $conn->close();
    exit;
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Internal Server Error']);
    exit;
}
?>