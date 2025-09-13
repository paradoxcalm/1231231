<?php
session_start();
require_once __DIR__ . '/../../db_connection.php';
require_once __DIR__ . '/../helpers.php';
require_once __DIR__ . '/../models/ScheduleModel.php';

$role = $_SESSION['role'] ?? 'client';
if ($role !== 'admin') {
    jsonResponse(['status' => 'error', 'message' => 'Доступ только для администратора']);
    exit;
}
$model = new ScheduleModel($conn);
header('Content-Type: application/vnd.ms-excel');
header('Content-Disposition: attachment; filename="schedule.xls"');
echo $model->exportSchedules();
$conn->close();
