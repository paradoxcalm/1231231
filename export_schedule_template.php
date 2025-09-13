<?php
require_once 'session_init.php';
session_start();

// Доступ только для администраторов и менеджеров
if (!isset($_SESSION['role']) || !in_array($_SESSION['role'], ['admin', 'manager'])) {
    header('Location: auth_form.php');
    exit();
}

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
