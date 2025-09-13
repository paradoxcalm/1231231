<?php
session_start();
require_once __DIR__ . '/../db_connection.php';
require_once __DIR__ . '/../helpers.php';
require_once __DIR__ . '/../models/ScheduleModel.php';

$role = $_SESSION['role'] ?? 'client';
if (!in_array($role, ['admin', 'manager'])) {
    jsonResponse(['status' => 'error', 'message' => 'Нет прав на создание']);
    exit;
}

$data = $_POST + [];
$model = new ScheduleModel($conn);
try {
    $model->createSchedule($data);
    jsonResponse(['status' => 'success']);
} catch (Exception $e) {
    jsonResponse(['status' => 'error', 'message' => $e->getMessage()]);
}
$conn->close();
