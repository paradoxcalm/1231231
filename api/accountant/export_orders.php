<?php
require_once __DIR__ . '/../../error_handler.php';

try {
    session_start();
    if (!isset($_SESSION['role']) || $_SESSION['role'] !== 'accountant') {
        http_response_code(403);
        echo 'Доступ запрещён';
        exit;
    }

    require_once __DIR__ . '/../../db_connection.php';

    // Получаем фильтры
    $city = $_GET['city'] ?? '';
    $client_id = isset($_GET['client_id']) ? intval($_GET['client_id']) : null;
    $date_from = $_GET['date_from'] ?? '';
    $date_to = $_GET['date_to'] ?? '';

    $where = ' WHERE 1=1';
    $params = [];
    $types = '';

    if ($city) {
        $where .= ' AND s.city = ?';
        $params[] = $city;
        $types .= 's';
    }
    if ($client_id) {
        $where .= ' AND o.user_id = ?';
        $params[] = $client_id;
        $types .= 'i';
    }
    if ($date_from) {
        $where .= ' AND s.submission_date >= ?';
        $params[] = $date_from;
        $types .= 's';
    }
    if ($date_to) {
        $where .= ' AND s.submission_date <= ?';
        $params[] = $date_to;
        $types .= 's';
    }

    $sql = "SELECT 
                o.order_id,
                o.order_date,
                s.submission_date,
                s.city,
                s.warehouses,
                CONCAT(u.first_name, ' ', u.last_name) AS client_name,
                COALESCE(d.payment, s.payment, 0) AS payment,
                COALESCE(d.payment_type, s.payment_type) AS payment_type,
                o.status,
                CONCAT(au.first_name, ' ', au.last_name) AS author_name
            FROM orders o
            JOIN shipments s ON s.order_id = o.order_id
            JOIN usersff u ON o.user_id = u.id
            LEFT JOIN order_reception_details d ON o.order_id = d.order_id
            LEFT JOIN usersff au ON o.author_id = au.id" . $where . "
            ORDER BY o.order_date DESC";

    $stmt = $conn->prepare($sql);
    if ($params) {
        $stmt->bind_param($types, ...$params);
    }
    $stmt->execute();
    $result = $stmt->get_result();

    // Устанавливаем заголовки для скачивания Excel
    header('Content-Type: application/vnd.ms-excel; charset=UTF-8');
    header('Content-Disposition: attachment; filename="orders_export_' . date('Y-m-d') . '.xls"');
    echo "\xEF\xBB\xBF"; // BOM для корректного отображения UTF-8

    // Заголовки колонок
    $headers = [
        'ID заказа',
        'Дата заказа',
        'Дата отправки',
        'Город',
        'Склады',
        'Клиент',
        'Сумма',
        'Тип оплаты',
        'Статус',
        'Автор'
    ];

    echo implode("\t", $headers) . "\n";

    // Данные
    while ($row = $result->fetch_assoc()) {
        $data = [
            $row['order_id'],
            $row['order_date'],
            $row['submission_date'],
            $row['city'],
            $row['warehouses'],
            $row['client_name'],
            $row['payment'],
            $row['payment_type'],
            $row['status'],
            $row['author_name']
        ];
        echo implode("\t", $data) . "\n";
    }

    $stmt->close();
    $conn->close();
    exit;
} catch (Throwable $e) {
    http_response_code(500);
    echo 'Ошибка экспорта данных';
    exit;
}
?>