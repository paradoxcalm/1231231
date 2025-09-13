<?php
session_start();
require_once __DIR__ . '/../../db_connection.php';
require_once __DIR__ . '/../helpers.php';
require_once __DIR__ . '/../models/ScheduleModel.php';

$role = $_SESSION['role'] ?? 'client';
if (!in_array($role, ['admin', 'manager'])) {
    jsonResponse(['status' => 'error', 'message' => 'Нет прав']);
    exit;
}

$id = (int)($_POST['id'] ?? 0);
$status = $_POST['status'] ?? '';
$model = new ScheduleModel($conn);
$model->updateStatus($id, $status);
jsonResponse(['status' => 'success']);
$conn->close();
