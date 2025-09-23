<?php
require_once __DIR__ . '/../../session_init.php';
session_start();
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/../../db_connection.php';

$userId = $_SESSION['user_id'] ?? 0;
if (!$userId) {
    echo json_encode(['success' => false, 'message' => 'Не авторизован']);
    exit;
}

$data = $_POST;
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
$email = $data['email'] ?? '';

$stmt = $conn->prepare("UPDATE usersff SET phone=?, email=?, first_name=?, last_name=?, middle_name=?, company_name=?, store_name=? WHERE id=?");
$stmt->bind_param("sssssssi", $phone, $email, $first_name, $last_name, $middle_name, $company_name, $store_name, $userId);

if ($stmt->execute()) {
    echo json_encode([
        'success' => true,
        'data' => [
            'phone' => $phone,
            'email' => $email,
            'first_name' => $first_name,
            'last_name' => $last_name,
            'middle_name' => $middle_name,
            'company_name' => $company_name,
            'store_name' => $store_name
        ]
    ]);
} else {
    echo json_encode(['success' => false, 'message' => 'Ошибка при обновлении: ' . $stmt->error]);
}

$stmt->close();
$conn->close();
?>