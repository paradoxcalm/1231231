<?php
require_once __DIR__ . '/../../db_connection.php';

$sql = "SELECT * FROM shipments";
$result = $conn->query($sql);

if (!$result) {
    echo "Ошибка экспорта: " . htmlspecialchars($conn->error, ENT_QUOTES, 'UTF-8');
    $conn->close();
    exit;
}

header('Content-Type: application/vnd.ms-excel; charset=UTF-8');
header('Content-Disposition: attachment; filename="exported_data.xls"');

// Вывод BOM для корректного отображения UTF-8 в Excel
echo "\xEF\xBB\xBF";

$columns = [
    'ID', 'Город', 'Отправитель', 'Направление', 'Дата сдачи',
    'Тип отправки', 'Количество', 'Оплата', 'Способ оплаты',
    'Время приёмки', 'Дата отправки', 'Комментарий'
];

echo implode("\t", $columns) . "\n";
while ($row = $result->fetch_assoc()) {
    echo implode("\t", [
        $row['id'],
        $row['city'],
        $row['sender'],
        $row['direction'],
        $row['date_of_delivery'],
        $row['shipment_type'],
        $row['boxes'],
        $row['payment'],
        $row['payment_type'],
        $row['accept_time'],
        $row['submission_date'],
        $row['comment']
    ]) . "\n";
}

$conn->close();
exit;