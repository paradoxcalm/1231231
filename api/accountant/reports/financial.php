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

    $dateFrom = $_GET['date_from'] ?? date('Y-m-01'); // Начало текущего месяца
    $dateTo = $_GET['date_to'] ?? date('Y-m-d'); // Сегодня

    // Основной запрос для финансового отчёта
    $sql = "SELECT 
                DATE(s.submission_date) AS date,
                s.city,
                s.payment_type,
                COUNT(*) AS orders_count,
                SUM(COALESCE(d.payment, s.payment, 0)) AS total_amount,
                AVG(COALESCE(d.payment, s.payment, 0)) AS avg_amount
            FROM shipments s
            JOIN orders o ON s.order_id = o.order_id
            LEFT JOIN order_reception_details d ON o.order_id = d.order_id
            WHERE DATE(s.submission_date) BETWEEN ? AND ?
            GROUP BY DATE(s.submission_date), s.city, s.payment_type
            ORDER BY date DESC, total_amount DESC";

    $stmt = $conn->prepare($sql);
    $stmt->bind_param('ss', $dateFrom, $dateTo);
    $stmt->execute();
    $result = $stmt->get_result();

    // Устанавливаем заголовки для Excel
    header('Content-Type: application/vnd.ms-excel; charset=UTF-8');
    header('Content-Disposition: attachment; filename="financial_report_' . date('Y-m-d') . '.xls"');
    echo "\xEF\xBB\xBF"; // BOM

    echo "ФИНАНСОВЫЙ ОТЧЁТ\n";
    echo "Период: {$dateFrom} - {$dateTo}\n";
    echo "Сформирован: " . date('d.m.Y H:i') . "\n\n";

    echo "Дата\tГород\tТип оплаты\tКоличество\tОбщая сумма\tСредняя сумма\n";

    $totalOrders = 0;
    $totalAmount = 0;

    while ($row = $result->fetch_assoc()) {
        echo $row['date'] . "\t" . 
             $row['city'] . "\t" . 
             $row['payment_type'] . "\t" . 
             $row['orders_count'] . "\t" . 
             $row['total_amount'] . "\t" . 
             round($row['avg_amount'], 2) . "\n";
        
        $totalOrders += $row['orders_count'];
        $totalAmount += $row['total_amount'];
    }

    echo "\nИТОГО:\n";
    echo "Общее количество заказов\t{$totalOrders}\n";
    echo "Общая сумма\t{$totalAmount}\n";
    echo "Средний чек\t" . ($totalOrders > 0 ? round($totalAmount / $totalOrders, 2) : 0) . "\n";

    $stmt->close();
    $conn->close();
    exit;
} catch (Throwable $e) {
    http_response_code(500);
    echo 'Ошибка формирования отчёта';
    exit;
}
?>