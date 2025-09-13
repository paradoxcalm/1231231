<?php
session_start();
require_once __DIR__ . '/../db_connection.php';
require_once __DIR__ . '/../helpers.php';
require_once __DIR__ . '/../models/ScheduleModel.php';

$role = $_SESSION['role'] ?? 'client';
$id   = isset($_GET['id']) ? (int)$_GET['id'] : 0;

$model = new ScheduleModel($conn);
$schedule = $model->getScheduleById($id);
if ($schedule) {
    jsonResponse(['success' => true, 'schedule' => $schedule]);
} else {
    jsonResponse(['success' => false, 'message' => 'Расписание не найдено']);
}
$conn->close();
