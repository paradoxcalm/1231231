<?php
require_once 'db_connection.php';
require 'vendor/autoload.php';

use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;

// Получаем данные из таблицы shipments
$sql = "SELECT * FROM shipments";
$result = $conn->query($sql);

if ($result && $result->num_rows > 0) {
    $spreadsheet = new Spreadsheet();
    $sheet = $spreadsheet->getActiveSheet();

    // ✅ Заголовки таблицы Excel (без фотоотчета)
    $columns = [
        'ID', 'Город', 'Отправитель', 'Направление', 'Дата сдачи',
        'Тип отправки', 'Количество', 'Оплата', 'Способ оплаты',
        'Время приёмки', 'Дата отправки', 'Комментарий'
    ];
    $colIndex = 1;
    foreach ($columns as $col) {
        $sheet->setCellValueByColumnAndRow($colIndex, 1, $col);
        $colIndex++;
    }

    // ✅ Данные
    $rowIndex = 2;
    while ($row = $result->fetch_assoc()) {
        $sheet->setCellValueByColumnAndRow(1,  $rowIndex, $row['id']);
        $sheet->setCellValueByColumnAndRow(2,  $rowIndex, $row['city']);
        $sheet->setCellValueByColumnAndRow(3,  $rowIndex, $row['sender']);
        $sheet->setCellValueByColumnAndRow(4,  $rowIndex, $row['direction']);
        $sheet->setCellValueByColumnAndRow(5,  $rowIndex, $row['date_of_delivery']);
        $sheet->setCellValueByColumnAndRow(6,  $rowIndex, $row['shipment_type']);
        $sheet->setCellValueByColumnAndRow(7,  $rowIndex, $row['boxes']);
        $sheet->setCellValueByColumnAndRow(8,  $rowIndex, $row['payment']);
        $sheet->setCellValueByColumnAndRow(9,  $rowIndex, $row['payment_type']);
        $sheet->setCellValueByColumnAndRow(10, $rowIndex, $row['accept_time']);
        $sheet->setCellValueByColumnAndRow(11, $rowIndex, $row['submission_date']);
        $sheet->setCellValueByColumnAndRow(12, $rowIndex, $row['comment']);
        $rowIndex++;
    }

    // Вывод Excel
    $fileName = "exported_data.xlsx";
    header('Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    header("Content-Disposition: attachment;filename=\"$fileName\"");
    header('Cache-Control: max-age=0');
    $writer = new Xlsx($spreadsheet);
    $writer->save('php://output');
    exit();
} else {
    echo "Нет данных для экспорта.";
}

$conn->close();
