<?php
require_once '../session_init.php';
session_start();
require_once '../db_connection.php';

// Только для admin/manager
if ($_SESSION['role'] !== 'admin' && $_SESSION['role'] !== 'manager') {
    header('HTTP/1.0 403 Forbidden');
    exit('Доступ запрещен');
}

$city = trim($_GET['city'] ?? '');
$filterPhone   = trim($_GET['filterPhone'] ?? '');
$filterStart   = trim($_GET['filterStart'] ?? '');
$filterEnd     = trim($_GET['filterEnd'] ?? '');
$filterStatus  = $_GET['filterStatus'] ?? '';
$sort          = $_GET['sort'] ?? 'created_at';
$order         = $_GET['order'] ?? 'desc';

// Валидируем поле сортировки
$allowedSortFields = ['created_at','company','phone','quantity','amount','comment','payment_status'];
if (!in_array($sort, $allowedSortFields)) {
    $sort = 'created_at';
}
$order = strtolower($order) === 'asc' ? 'ASC' : 'DESC';

header('Content-Type: text/csv; charset=utf-8');
header('Content-Disposition: attachment; filename="FBS_' . $city . '.csv"');
// Добавляем BOM для корректного открытия в Excel
echo "\xEF\xBB\xBF";

// Запишем заголовки колонок (на русском)
$output = fopen('php://output', 'w');
fputcsv($output, ['Дата создания', 'ИП', 'Телефон', 'Количество', 'Сумма', 'Комментарий', 'Статус оплаты'], ';');

// Формируем SQL с фильтрами (без лимита, чтобы выгрузить все подходящие записи)
$conditions = ["city = ?"];
$params = [$city];
$types = "s";
if ($filterPhone !== '') {
    $conditions[] = "phone LIKE ?";
    $params[] = "%{$filterPhone}%";
    $types .= "s";
}
if ($filterStart !== '') {
    $conditions[] = "created_at >= ?";
    $params[] = $filterStart . " 00:00:00";
    $types .= "s";
}
if ($filterEnd !== '') {
    $conditions[] = "created_at <= ?";
    $params[] = $filterEnd . " 23:59:59";
    $types .= "s";
}
if (in_array($filterStatus, ['paid','debt'], true)) {
    $conditions[] = "payment_status = ?";
    $params[] = $filterStatus;
    $types .= "s";
}
$whereSql = implode(' AND ', $conditions);
$query = "SELECT created_at, company, phone, quantity, amount, comment, payment_status FROM fbs
          WHERE $whereSql
          ORDER BY $sort $order";
$stmt = $conn->prepare($query);
if (!$stmt) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Ошибка подготовки запроса']);
    exit;
}

if ($params) {
    $a_params = array_merge([$types], $params);
    foreach ($a_params as $key => $value) { $a_params[$key] = &$a_params[$key]; }
    call_user_func_array([$stmt, 'bind_param'], $a_params);
}
$stmt->execute();
$result = $stmt->get_result();
// Выгружаем каждую строку в CSV
while ($row = $result->fetch_assoc()) {
    // Преобразуем дату в формат ДД.ММ.ГГГГ чч:мм
    $date = date('d.m.Y H:i', strtotime($row['created_at']));
    // Формируем строку CSV (учитываем, что поля могут содержать разделители или переносы)
    $status = $row['payment_status'] === 'debt' ? 'Долг' : 'Оплачено';
    $line = [
        $date,
        $row['company'],
        $row['phone'],
        $row['quantity'],
        $row['amount'],
        $row['comment'],
        $status
    ];
    // Пишем строку в CSV (используем точку с запятой в качестве разделителя)
    fputcsv($output, $line, ';');
}
fclose($output);
?>