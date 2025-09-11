<?php
// move_orders.php
require_once 'session_init.php';
session_start();
header('Content-Type: application/json; charset=UTF-8');
require_once 'db_connection.php'; // $conn = new mysqli(...)

$role = $_SESSION['role'] ?? 'client';
if ($role !== 'admin') {
    echo json_encode(['success' => false, 'message' => 'Нет прав']);
    exit;
}

$payload = json_decode(file_get_contents('php://input'), true);
$fromId  = isset($payload['from_id']) ? (int)$payload['from_id'] : 0;
$toId    = isset($payload['to_id'])   ? (int)$payload['to_id']   : 0;
$force   = !empty($payload['force']); // 0/1

if (!$fromId || !$toId || $fromId === $toId) {
    echo json_encode(['success' => false, 'message' => 'Некорректные ID']);
    exit;
}

// Загружаем оба расписания
$sql = "SELECT id, city, warehouses, accept_date, delivery_date, archived
        FROM schedules WHERE id IN (?, ?) LIMIT 2";
$stmt = $conn->prepare($sql);
if (!$stmt) {
    echo json_encode(['success' => false, 'message' => 'Ошибка БД: ' . $conn->error]);
    exit;
}
$stmt->bind_param("ii", $fromId, $toId);
$stmt->execute();
$res = $stmt->get_result();

$from = $to = null;
while ($row = $res->fetch_assoc()) {
    if ((int)$row['id'] === $fromId) $from = $row;
    if ((int)$row['id'] === $toId)   $to   = $row;
}
$stmt->close();

if (!$from || !$to) {
    echo json_encode(['success' => false, 'message' => 'Расписание не найдено']);
    exit;
}
if ((int)$from['archived'] === 1) {
    echo json_encode(['success' => false, 'message' => 'Исходное расписание архивировано']);
    exit;
}
if ((int)$to['archived'] === 1) {
    echo json_encode(['success' => false, 'message' => 'Целевое расписание архивировано']);
    exit;
}

// Проверка совместимости (по умолчанию — обязательна)
if (!$force) {
    $sameCity       = trim(mb_strtolower($from['city']))       === trim(mb_strtolower($to['city']));
    $sameWarehouse  = trim(mb_strtolower($from['warehouses'])) === trim(mb_strtolower($to['warehouses']));
    $sameAcceptDate = trim($from['accept_date']) === trim($to['accept_date']);
    if (!($sameCity && $sameWarehouse && $sameAcceptDate)) {
        echo json_encode([
            'success' => false,
            'message' => 'Несовпадение направления или даты. Для принудительного переноса укажите force=1.'
        ]);
        exit;
    }
}

$conn->begin_transaction();
try {
    // Переносим заявки
    $upd = $conn->prepare("UPDATE orders SET schedule_id = ? WHERE schedule_id = ?");
    if (!$upd) {
        throw new Exception('Ошибка подготовки UPDATE: ' . $conn->error);
    }
    $upd->bind_param("ii", $toId, $fromId);
    $upd->execute();
    $moved = $upd->affected_rows;
    $upd->close();

    // >>> Если есть другие таблицы с внешней ссылкой на schedule_id — перенесите их аналогично:
    // Примеры:
    // $conn->query("UPDATE order_history SET schedule_id = {$toId} WHERE schedule_id = {$fromId}");
    // $conn->query("UPDATE notifications SET schedule_id = {$toId} WHERE schedule_id = {$fromId}");

    $conn->commit();
    echo json_encode(['success' => true, 'message' => "Перенесено заявок: {$moved}"]);
} catch (Throwable $e) {
    $conn->rollback();
    echo json_encode(['success' => false, 'message' => 'Ошибка переноса: ' . $e->getMessage()]);
} finally {
    $conn->close();
}