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

    $city       = $_GET['city']       ?? null;
    $warehouses = isset($_GET['warehouses']) ? array_filter(array_map('trim', explode(',', $_GET['warehouses']))) : [];
    $client_id  = isset($_GET['client_id']) ? intval($_GET['client_id']) : null;
    $date_from  = $_GET['date_from']  ?? null;
    $date_to    = $_GET['date_to']    ?? null;

    $page       = max(1, intval($_GET['page'] ?? 1));
    $per_page   = max(1, min(100, intval($_GET['per_page'] ?? 20)));
    $offset     = ($page - 1) * $per_page;

    $sort_field = $_GET['sort_field'] ?? 'order_date';
    $sort_dir   = strtolower($_GET['sort_dir'] ?? 'desc') === 'asc' ? 'ASC' : 'DESC';

    $sort_map = [
        'order_id'       => 'o.order_id',
        'order_date'     => 'o.order_date',
        'submission_date'=> 's.submission_date',
        'city'           => 's.city',
        'payment'        => 'payment',
        'status'         => 'o.status',
        'client'         => 'client_name',
        'author'         => 'author_name'
    ];
    $order_by = $sort_map[$sort_field] ?? 'o.order_date';

    $where = ' WHERE 1=1';
    $params = [];
    $types  = '';

    if ($city) {
        $where    .= ' AND s.city = ?';
        $params[] = $city;
        $types   .= 's';
    }
    if ($client_id) {
        $where    .= ' AND o.user_id = ?';
        $params[] = $client_id;
        $types   .= 'i';
    }
    if ($date_from) {
        $where    .= ' AND s.submission_date >= ?';
        $params[] = $date_from;
        $types   .= 's';
    }
    if ($date_to) {
        $where    .= ' AND s.submission_date <= ?';
        $params[] = $date_to;
        $types   .= 's';
    }
    if (!empty($warehouses)) {
        $whParts = [];
        foreach ($warehouses as $wh) {
            $whParts[] = 's.warehouses LIKE ?';
            $params[]  = '%' . $wh . '%';
            $types    .= 's';
        }
        $where .= ' AND (' . implode(' OR ', $whParts) . ')';
    }

    // Count total
    $countSql = "SELECT COUNT(*) FROM orders o JOIN shipments s ON s.order_id = o.order_id JOIN usersff u ON o.user_id = u.id LEFT JOIN order_reception_details d ON o.order_id = d.order_id LEFT JOIN usersff au ON o.author_id = au.id" . $where;
    $stmt = $conn->prepare($countSql);
    if (!$stmt) {
        error_log('MySQL prepare error: ' . mysqli_error($conn));
        echo json_encode(['success' => false, 'message' => 'Ошибка подготовки запроса']);
        $conn->close();
        exit;
    }
    if ($params) {
        $stmt->bind_param($types, ...$params);
    }
    if (!$stmt->execute()) {
        error_log('MySQL execute error: ' . mysqli_error($conn));
        echo json_encode(['success' => false, 'message' => 'Ошибка выполнения запроса']);
        $stmt->close();
        $conn->close();
        exit;
    }
    $stmt->bind_result($total);
    $stmt->fetch();
    $stmt->close();

    // Data query
    $sql = "SELECT o.order_id, o.order_date, s.submission_date, s.city, s.warehouses, CONCAT(u.first_name, ' ', u.last_name) AS client_name, COALESCE(d.payment, s.payment, 0) AS payment, COALESCE(d.payment_type, s.payment_type) AS payment_type, o.status, CONCAT(au.first_name, ' ', au.last_name) AS author_name FROM orders o JOIN shipments s ON s.order_id = o.order_id JOIN usersff u ON o.user_id = u.id LEFT JOIN order_reception_details d ON o.order_id = d.order_id LEFT JOIN usersff au ON o.author_id = au.id" . $where . " ORDER BY $order_by $sort_dir LIMIT ? OFFSET ?";
    $stmt = $conn->prepare($sql);
    if (!$stmt) {
        error_log('MySQL prepare error: ' . mysqli_error($conn));
        echo json_encode(['success' => false, 'message' => 'Ошибка подготовки запроса']);
        $conn->close();
        exit;
    }
    $bindTypes = $types . 'ii';
    $bindParams = $params;
    $bindParams[] = $per_page;
    $bindParams[] = $offset;
    $stmt->bind_param($bindTypes, ...$bindParams);
    if (!$stmt->execute()) {
        error_log('MySQL execute error: ' . mysqli_error($conn));
        echo json_encode(['success' => false, 'message' => 'Ошибка выполнения запроса']);
        $stmt->close();
        $conn->close();
        exit;
    }
    $res = $stmt->get_result();
    $orders = [];
    while ($row = $res->fetch_assoc()) {
        $orders[] = [
            'order_id'       => (int)$row['order_id'],
            'order_date'     => $row['order_date'],
            'submission_date'=> $row['submission_date'],
            'city'           => $row['city'],
            'warehouses'     => $row['warehouses'],
            'client'         => $row['client_name'],
            'payment'        => (float)$row['payment'],
            'payment_type'   => $row['payment_type'],
            'status'         => $row['status'],
            'author'         => $row['author_name'],
        ];
    }
    $stmt->close();

    echo json_encode(['success' => true, 'data' => ['orders' => $orders, 'total' => $total]]);
    $conn->close();
    exit;
} catch (Throwable $e) {
    error_log('get_orders.php exception: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Внутренняя ошибка сервера']);
    exit;
}
?>
