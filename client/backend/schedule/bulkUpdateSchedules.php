<?php
session_start();
require_once __DIR__ . '/../../db_connection.php';
require_once __DIR__ . '/../helpers.php';
require_once __DIR__ . '/../models/ScheduleModel.php';

$role = $_SESSION['role'] ?? 'client';
if ($role !== 'admin') {
    jsonResponse(['status' => 'error', 'message' => 'Нет прав']);
    exit;
}
$action = $_POST['action'] ?? '';
$ids = $_POST['ids'] ?? [];
$model = new ScheduleModel($conn);
$results = [];
foreach ($ids as $id) {
    try {
        if ($action === 'archive') {
            $model->deleteOrArchive($id);
        } elseif ($action === 'delete') {
            $model->deleteOrArchive($id);
        }
        $results[$id] = 'ok';
    } catch (Exception $e) {
        $results[$id] = $e->getMessage();
    }
}
jsonResponse($results);
$conn->close();
