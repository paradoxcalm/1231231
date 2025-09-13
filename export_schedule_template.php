<?php
header('Content-Type: text/csv; charset=utf-8');
header('Content-Disposition: attachment; filename="шаблон_расписания.csv"');

$output = fopen('php://output', 'w');

// 🔄 Обновлённые заголовки
$headers = [
    'Город',
    'Склады',
    'Дата выезда',
    'Дата и Время окончания приёмки',
    'Дата сдачи',
    'Таймслот',
    'Маркетплейс',
    'Номер автомобиля',
    'Марка автомобиля',
    'ФИО водителя',
    'Телефон водителя'
];

// Пишем в CSV (разделитель — точка с запятой)
fputcsv($output, $headers, ';');

fclose($output);
exit;
