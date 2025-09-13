<?php
// fetch_schedule.php — отдаёт список расписаний
// Доступен любому авторизованному пользователю (клиенту, менеджеру, админу).

require_once 'auth_helper.php';
requireLogin(); // проверяем, что пользователь вошёл в систему

require_once 'db_connection.php';
header('Content-Type: application/json; charset=utf-8');

// Чтение параметров фильтра
$city        = trim($_GET['city']        ?? '');
$warehouse   = trim($_GET['warehouse']   ?? '');
$date        = trim($_GET['date']        ?? '');
$status      = trim($_GET['status']      ?? '');
$marketplace = trim($_GET['marketplace'] ?? '');

$query  = "SELECT * FROM schedules WHERE 1=1";
$params = [];
$types  = '';

// Фильтр по маркетплейсу
if ($marketplace !== '') {
    $query   .= " AND marketplace = ?";
    $params[] = $marketplace;
    $types   .= 's';
}

// Фильтр по городу (частичное совпадение)
if ($city !== '') {
    $query   .= " AND city LIKE ?";
    $params[] = "%$city%";
    $types   .= 's';
}

// Фильтр по складу (частичное совпадение)
if ($warehouse !== '') {
    $query   .= " AND warehouses LIKE ?";
    $params[] = "%$warehouse%";
    $types   .= 's';
}

// Фильтр по дате приёмки
if ($date !== '') {
    $query   .= " AND accept_date = ?";
    $params[] = $date;
    $types   .= 's';
}

// Фильтр по статусу: если статус задан, используем его; иначе исключаем завершённые записи
if ($status !== '') {
    $query   .= " AND status = ?";
    $params[] = $status;
    $types   .= 's';
} else {
    $query   .= " AND status != 'Завершено'";
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
