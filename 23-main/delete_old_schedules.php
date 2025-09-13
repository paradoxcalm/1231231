<?php
session_start();
header('Content-Type: application/json; charset=utf-8');
require_once 'db_connection.php';

if ($_SESSION['role'] !== 'admin') {
    echo json_encode(['success' => false, 'message' => 'Доступ только для администратора']);
    exit;
}

$data = json_decode(file_get_contents('php://input'), true);
$days = (int)($data['days'] ?? 60);

// Вычисляем пороговую дату (days дней назад)
$dateThreshold = date('Y-m-d', strtotime("-$days days"));

// Удаляем из schedules, где accept_date < ? и status = 'Завершено'
$stmt = $conn->prepare("DELETE FROM schedules WHERE accept_date < ? AND status = 'Завершено'");
$stmt->bind_param("s", $dateThreshold);
$stmt->execute();

if ($stmt->affected_rows > 0) {
    echo json_encode(['success' => true]);
} else {
    echo json_encode(['success' => false, 'message' => 'Нет записей для удаления']);
}

$conn->close();
?>
