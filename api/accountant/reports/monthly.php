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

    $month = $_GET['month'] ?? date('Y-m');
    
    if (!preg_match('/^\d{4}-\d{2}$/', $month)) {
        echo 'Некорректный формат месяца';
        exit;
    }

    $dateFrom = $month . '-01';
    $dateTo = date('Y-m-t', strtotime($dateFrom)); // Последний день месяца

    // Сводка за месяц
    $summaryQuery = "SELECT 
                        COUNT(*) AS total_orders,
                        COALESCE(SUM(COALESCE(d.payment, s.payment, 0)), 0) AS total_revenue,
                        COUNT(DISTINCT o.user_id) AS active_clients,
                        AVG(COALESCE(d.payment, s.payment, 0)) AS avg_order_value
                     FROM orders o
                     JOIN shipments s ON o.order_id = s.order_id
                     LEFT JOIN order_reception_details d ON o.order_id = d.order_id
                     WHERE DATE(o.order_date) BETWEEN ? AND ?";

    $stmt = $conn->prepare($summaryQuery);
    $stmt->bind_param('ss', $dateFrom, $dateTo);
    $stmt->execute();
    $summary = $stmt->get_result()->fetch_assoc();
    $stmt->close();

    // Данные по дням
    $dailyQuery = "SELECT 
                        DATE(o.order_date) AS date,
                        COUNT(*) AS orders_count,
                        COALESCE(SUM(COALESCE(d.payment, s.payment, 0)), 0) AS daily_revenue
                   FROM orders o
                   JOIN shipments s ON o.order_id = s.order_id
                   LEFT JOIN order_reception_details d ON o.order_id = d.order_id
                   WHERE DATE(o.order_date) BETWEEN ? AND ?
                   GROUP BY DATE(o.order_date)
                   ORDER BY date";

    $stmt = $conn->prepare($dailyQuery);
    $stmt->bind_param('ss', $dateFrom, $dateTo);
    $stmt->execute();
    $dailyResult = $stmt->get_result();
    $stmt->close();

    // Устанавливаем заголовки для Excel
    header('Content-Type: application/vnd.ms-excel; charset=UTF-8');
    header('Content-Disposition: attachment; filename="monthly_report_' . $month . '.xls"');
    echo "\xEF\xBB\xBF"; // BOM

    echo "МЕСЯЧНЫЙ ОТЧЁТ\n";
    echo "Месяц: {$month}\n";
    echo "Сформирован: " . date('d.m.Y H:i') . "\n\n";

    echo "СВОДКА ЗА МЕСЯЦ\n";
    echo "Общее количество заказов\t" . $summary['total_orders'] . "\n";
    echo "Общая выручка\t" . $summary['total_revenue'] . "\n";
    echo "Активных клиентов\t" . $summary['active_clients'] . "\n";
    echo "Средний чек\t" . round($summary['avg_order_value'], 2) . "\n\n";

    echo "ЕЖЕДНЕВНАЯ СТАТИСТИКА\n";
    echo "Дата\tЗаказов\tВыручка\n";

    while ($row = $dailyResult->fetch_assoc()) {
        echo $row['date'] . "\t" . $row['orders_count'] . "\t" . $row['daily_revenue'] . "\n";
    }

    $conn->close();
    exit;
} catch (Throwable $e) {
    http_response_code(500);
    echo 'Ошибка формирования отчёта';
    exit;
}
?>