<?php
require_once __DIR__ . '/../../session_init.php';
session_start();
header('Content-Type: application/json');
require_once __DIR__ . '/../../db_connection.php';

// Проверка прав администратора или менеджера
if (!isset($_SESSION['role']) || ($_SESSION['role'] !== 'admin' && $_SESSION['role'] !== 'manager')) {
    echo json_encode(['success' => false, 'message' => 'Доступ запрещён']);
    exit;
}

// Получение списка клиентов
$stmt = $conn->prepare(
    "SELECT id, email, phone, first_name, last_name 
     FROM usersff 
     WHERE role = 'client' 
     ORDER BY id ASC"
);
if (!$stmt) {
    echo json_encode(['success' => false, 'message' => 'Ошибка базы данных']);
    exit;
}
$stmt->execute();
$result = $stmt->get_result();
$clients = [];
while ($row = $result->fetch_assoc()) {
    $clients[] = $row;
}
$stmt->close();

echo json_encode(['success' => true, 'clients' => $clients]);
$conn->close();
?>