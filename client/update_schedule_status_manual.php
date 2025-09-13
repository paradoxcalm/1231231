<?php
session_start();
header('Content-Type: application/json');
require_once 'db_connection.php';

if ($_SESSION['role'] !== 'admin') {
    echo json_encode(['success' => false, 'message' => 'Доступ только для администратора']);
    exit;
}

$data = json_decode(file_get_contents('php://input'), true);
$id     = $data['id']     ?? 0;
$status = $data['status'] ?? '';

$stmt = $conn->prepare("UPDATE schedules SET status = ? WHERE id = ?");
$stmt->bind_param("si", $status, $id);
$stmt->execute();

echo json_encode(['success' => $stmt->affected_rows > 0]);

$conn->close();
?>
