<?php
session_start();
header('Content-Type: application/json');
require_once 'db_connection.php';

// Фильтры
$city        = $_GET['city']        ?? '';
$warehouse   = $_GET['warehouse']   ?? '';
$date        = $_GET['date']        ?? '';
$status      = $_GET['status']      ?? '';
$marketplace = $_GET['marketplace'] ?? '';

$recent    = (isset($_GET['recent']) && $_SESSION['role'] === 'client');

$query  = "SELECT * FROM schedules WHERE 1=1";
$params = [];
$types  = '';

// marketplace (ДОБАВЛЕНО)
if ($marketplace) {
    $query .= " AND marketplace = ?";
    $params[] = $marketplace;
    $types   .= 's';
}

// city
if ($city) {
    $query .= " AND city LIKE ?";
    $params[] = "%$city%";
    $types   .= 's';
}

// warehouse
if ($warehouse) {
    $query .= " AND warehouses LIKE ?";
    $params[] = "%$warehouse%";
    $types   .= 's';
}

// date (если хотите фильтровать по accept_date)
if ($date) {
    $query .= " AND accept_date = ?";
    $params[] = $date;
    $types   .= 's';
}

// status
if ($status) {
    $query .= " AND status = ?";
    $params[] = $status;
    $types   .= 's';
}

// recent
if ($recent) {
    // Показываем расписания за последние 30 дней, не завершённые
    $query .= " AND accept_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY) AND status != 'Завершено'";
}

$stmt = $conn->prepare($query);

if (!empty($params)) {
    $stmt->bind_param($types, ...$params);
}

$stmt->execute();
$result = $stmt->get_result();
$data = [];

while ($row = $result->fetch_assoc()) {
    $data[] = $row;
}

echo json_encode($data);

$conn->close();
?>
