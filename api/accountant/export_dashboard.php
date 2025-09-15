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

    // Получаем сводные данные
    $summaryQuery = "SELECT 
                        COUNT(*) AS shipments_count,
                        COALESCE(SUM(s.payment), 0) AS total_payments,
                        COUNT(DISTINCT o.user_id) AS clients_count
                     FROM shipments s
                     JOIN orders o ON s.order_id = o.order_id";

    $result = $conn->query($summaryQuery);
    $summary = $result->fetch_assoc();

    // Данные по городам
    $citiesQuery = "SELECT 
                        s.city,
                        COUNT(*) AS orders_count,
                        COALESCE(SUM(s.payment), 0) AS total_revenue
                    FROM shipments s
                    JOIN orders o ON s.order_id = o.order_id
                    GROUP BY s.city
                    ORDER BY total_revenue DESC";

    $citiesResult = $conn->query($citiesQuery);
    $cities = [];
    while ($row = $citiesResult->fetch_assoc()) {
        $cities[] = $row;
    }

    // Устанавливаем заголовки для скачивания Excel
    header('Content-Type: application/vnd.ms-excel; charset=UTF-8');
    header('Content-Disposition: attachment; filename="dashboard_export_' . date('Y-m-d') . '.xls"');
    echo "\xEF\xBB\xBF"; // BOM

    // Сводка
    echo "СВОДНАЯ ИНФОРМАЦИЯ\n";
    echo "Общее количество отправлений\t" . $summary['shipments_count'] . "\n";
    echo "Общая выручка\t" . $summary['total_payments'] . "\n";
    echo "Количество клиентов\t" . $summary['clients_count'] . "\n";
    echo "\n";

    // Данные по городам
    echo "СТАТИСТИКА ПО ГОРОДАМ\n";
    echo "Город\tКоличество заказов\tВыручка\n";
    foreach ($cities as $city) {
        echo $city['city'] . "\t" . $city['orders_count'] . "\t" . $city['total_revenue'] . "\n";
    }

    $conn->close();
    exit;
} catch (Throwable $e) {
    http_response_code(500);
    echo 'Ошибка экспорта данных';
    exit;
}
?>