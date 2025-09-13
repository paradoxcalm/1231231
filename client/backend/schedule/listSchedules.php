<?php
session_start();
require_once __DIR__ . '/../../db_connection.php';
require_once __DIR__ . '/../helpers.php';
require_once __DIR__ . '/../models/ScheduleModel.php';

$filters = [
    'archived'    => isset($_GET['archived']) ? (int)$_GET['archived'] : 0,
    'city'        => $_GET['city']        ?? '',
    'warehouse'   => $_GET['warehouse']   ?? '',
    'date'        => $_GET['date']        ?? '',
    'status'      => $_GET['status']      ?? '',
    'id'          => $_GET['id']          ?? '',
    'marketplace' => $_GET['marketplace'] ?? ''
];
$model = new ScheduleModel($conn);
$data = $model->getSchedules($filters);
jsonResponse($data);
$conn->close();
