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

    $sql = "SELECT COUNT(*) AS shipments_count, COALESCE(SUM(s.payment),0) AS total_payments, COUNT(DISTINCT o.user_id) AS clients_count
            FROM shipments s
            JOIN orders o ON s.order_id = o.order_id
            JOIN usersff u ON o.user_id = u.id
            WHERE 1=1";

    $params = [];
    $types  = '';

    if ($city) {
        $sql      .= " AND s.city = ?";
        $params[] = $city;
        $types   .= 's';
    }
    if ($client_id) {
        $sql      .= " AND o.user_id = ?";
        $params[] = $client_id;
        $types   .= 'i';
    }
    if ($date_from) {
        $sql      .= " AND s.submission_date >= ?";
        $params[] = $date_from;
        $types   .= 's';
    }
    if ($date_to) {
        $sql      .= " AND s.submission_date <= ?";
        $params[] = $date_to;
        $types   .= 's';
    }
    if (!empty($warehouses)) {
        $whParts = [];
        foreach ($warehouses as $wh) {
            $whParts[] = "s.warehouses LIKE ?";
            $params[]  = '%' . $wh . '%';
            $types    .= 's';
        }
        $sql .= ' AND (' . implode(' OR ', $whParts) . ')';
    }

    $stmt = $conn->prepare($sql);
    if ($params) {
        $stmt->bind_param($types, ...$params);
    }
    $stmt->execute();
    $res = $stmt->get_result();
    $data = $res->fetch_assoc() ?: ['shipments_count' => 0, 'total_payments' => 0, 'clients_count' => 0];
    $stmt->close();

    echo json_encode(['success' => true, 'data' => $data]);
    $conn->close();
    exit;
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Internal Server Error']);
    exit;
}
