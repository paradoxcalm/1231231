<?php
session_start();
header('Content-Type: application/json; charset=utf-8');
require_once 'db_connection.php';

$userId = $_SESSION['user_id'] ?? 0;
if (!$userId) {
    echo json_encode(['success' => false, 'message' => 'Не авторизован']);
    exit;
}

$data = json_decode(file_get_contents('php://input'), true);
if (!$data) {
    echo json_encode(['success' => false, 'message' => 'Нет данных']);
    exit;
}

$first_name = $data['first_name'] ?? '';
$last_name = $data['last_name'] ?? '';
$middle_name = $data['middle_name'] ?? '';
$company_name = $data['company_name'] ?? '';
$store_name = $data['store_name'] ?? '';
$phone = $data['phone'] ?? '';

$stmt = $conn->prepare("UPDATE usersff SET phone=?, first_name=?, last_name=?, middle_name=?, company_name=?, store_name=? WHERE id=?");
$stmt->bind_param("ssssssi", $phone, $first_name, $last_name, $middle_name, $company_name, $store_name, $userId);

if ($stmt->execute()) {
    echo json_encode(['success' => true]);
} else {
    echo json_encode(['success' => false, 'message' => 'Ошибка при обновлении: ' . $stmt->error]);
}

$stmt->close();
$conn->close();
?>
