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

    $search = $_GET['search'] ?? '';
    $sortBy = $_GET['sort'] ?? 'name';

    $whereClause = "WHERE u.role = 'client'";
    $params = [];
    $types = '';

    if ($search) {
        $whereClause .= " AND (CONCAT(u.first_name, ' ', u.last_name) LIKE ? OR u.email LIKE ? OR u.phone LIKE ?)";
        $searchParam = "%{$search}%";
        $params = [$searchParam, $searchParam, $searchParam];
        $types = 'sss';
    }

    $orderClause = match($sortBy) {
        'revenue' => 'ORDER BY total_revenue DESC',
        'orders' => 'ORDER BY orders_count DESC',
        'date' => 'ORDER BY u.id DESC',
        default => 'ORDER BY client_name ASC'
    };

    $sql = "SELECT 
                u.id,
                CONCAT(u.first_name, ' ', u.last_name) AS name,
                u.email,
                u.phone,
                COUNT(o.order_id) AS orders_count,
                COALESCE(SUM(COALESCE(d.payment, s.payment, 0)), 0) AS total_revenue,
                MAX(o.order_date) AS last_order_date
            FROM usersff u
            LEFT JOIN orders o ON u.id = o.user_id
            LEFT JOIN order_reception_details d ON o.order_id = d.order_id
            LEFT JOIN shipments s ON o.order_id = s.order_id
            {$whereClause}
            GROUP BY u.id, u.first_name, u.last_name, u.email, u.phone
            {$orderClause}";

    $stmt = $conn->prepare($sql);
    if ($params) {
        $stmt->bind_param($types, ...$params);
    }
    $stmt->execute();
    $result = $stmt->get_result();

    $clients = [];
    while ($row = $result->fetch_assoc()) {
        $clients[] = [
            'id' => (int)$row['id'],
            'name' => $row['name'],
            'email' => $row['email'],
            'phone' => $row['phone'],
            'orders_count' => (int)$row['orders_count'],
            'total_revenue' => (float)$row['total_revenue'],
            'last_order_date' => $row['last_order_date']
        ];
    }

    $stmt->close();
    echo json_encode(['success' => true, 'clients' => $clients]);
    $conn->close();
    exit;
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Internal Server Error']);
    exit;
}
?>