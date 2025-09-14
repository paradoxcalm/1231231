<?php
session_start();
require_once __DIR__ . '/../db_connection.php';
require_once __DIR__ . '/../helpers.php';
require_once __DIR__ . '/../models/ScheduleModel.php';

$role = $_SESSION['role'] ?? 'client';
if ($role !== 'admin') {
    jsonResponse(['success' => false, 'message' => 'Доступ запрещён']);
    exit;
}

$id = (int)($_POST['id'] ?? 0);
$model = new ScheduleModel($conn);
try {
    $result = $model->deleteOrArchive($id);
    $msg = $result['archived'] ? 'Расписание архивировано' : 'Расписание удалено';
    jsonResponse(['success' => true, 'message' => $msg]);
} catch (Exception $e) {
    jsonResponse(['success' => false, 'message' => $e->getMessage()]);
}
$conn->close();
