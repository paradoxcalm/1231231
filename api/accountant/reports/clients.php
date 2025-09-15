<?php
require_once __DIR__ . '/../../../error_handler.php';

try {
    session_start();
    if (!isset($_SESSION['role']) || $_SESSION['role'] !== 'accountant') {
        http_response_code(403);
        echo 'Доступ запрещён';
        exit;
    }

    require_once __DIR__ . '/../../../db_connection.php';

    $sql = "SELECT 
                u.id,
                CONCAT(u.first_name, ' ', u.last_name) AS client_name,
                u.email,
                u.phone,
                u.company_name,
                COUNT(o.order_id) AS orders_count,
                COALESCE(SUM(COALESCE(d.payment, s.payment, 0)), 0) AS total_revenue,
                MIN(o.order_date) AS first_order,
                MAX(o.order_date) AS last_order,
                AVG(COALESCE(d.payment, s.payment, 0)) AS avg_order_value
            FROM usersff u
            LEFT JOIN orders o ON u.id = o.user_id
            LEFT JOIN order_reception_details d ON o.order_id = d.order_id
            LEFT JOIN shipments s ON o.order_id = s.order_id
            WHERE u.role = 'client'
            GROUP BY u.id, u.first_name, u.last_name, u.email, u.phone, u.company_name
            ORDER BY total_revenue DESC";

    $result = $conn->query($sql);

    // Устанавливаем заголовки для Excel
    header('Content-Type: application/vnd.ms-excel; charset=UTF-8');
    header('Content-Disposition: attachment; filename="clients_report_' . date('Y-m-d') . '.xls"');
    echo "\xEF\xBB\xBF"; // BOM

    echo "ОТЧЁТ ПО КЛИЕНТАМ\n";
    echo "Сформирован: " . date('d.m.Y H:i') . "\n\n";

    echo "ID\tКлиент\tEmail\tТелефон\tКомпания\tЗаказов\tВыручка\tПервый заказ\tПоследний заказ\tСредний чек\n";

    while ($row = $result->fetch_assoc()) {
        echo $row['id'] . "\t" . 
             $row['client_name'] . "\t" . 
             ($row['email'] ?: '—') . "\t" . 
             ($row['phone'] ?: '—') . "\t" . 
             ($row['company_name'] ?: '—') . "\t" . 
             $row['orders_count'] . "\t" . 
             $row['total_revenue'] . "\t" . 
             ($row['first_order'] ?: '—') . "\t" . 
             ($row['last_order'] ?: '—') . "\t" . 
             round($row['avg_order_value'], 2) . "\n";
    }

    $conn->close();
    exit;
} catch (Throwable $e) {
    http_response_code(500);
    echo 'Ошибка формирования отчёта';
    exit;
}
?>