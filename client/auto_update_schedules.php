<?php
// auto_update_schedules.php
// Автоматическая смена статуса расписания + уведомления клиентам

require_once 'db_connection.php';

date_default_timezone_set('Europe/Moscow');
$currentDate = date('Y-m-d');
$currentTime = date('H:i:s');

// Шаг 1: Получаем ID расписаний, которые нужно обновить
$scheduleIds = [];
$stmt = $conn->prepare("
    SELECT id FROM schedules 
    WHERE status = 'Ожидает отправки'
      AND accept_date <= ?
      AND accept_time <= ?
");
$stmt->bind_param("ss", $currentDate, $currentTime);
$stmt->execute();
$res = $stmt->get_result();
while ($row = $res->fetch_assoc()) {
    $scheduleIds[] = intval($row['id']);
}
$stmt->close();

if (empty($scheduleIds)) {
    echo json_encode(["success" => true, "message" => "Нет активных расписаний"]);
    exit;
}

// Шаг 2: Обновляем статусы
$idList = implode(',', $scheduleIds);
$update = $conn->query("
    UPDATE schedules 
    SET status = 'В пути'
    WHERE id IN ($idList)
");

// Шаг 3: Для каждого расписания — найти заказы, добавить уведомления
foreach ($scheduleIds as $sid) {
    $orders = $conn->prepare("SELECT order_id FROM orders WHERE schedule_id = ?");
    $orders->bind_param("i", $sid);
    $orders->execute();
    $res2 = $orders->get_result();
    while ($ord = $res2->fetch_assoc()) {
        $oid = intval($ord['order_id']);
        $msg = "Отправка началась. Ваш заказ в пути.";
        $insert = $conn->prepare("
            INSERT INTO order_history (order_id, status_change, changed_by)
            VALUES (?, ?, 'system')
        ");
        $insert->bind_param("is", $oid, $msg);
        $insert->execute();
        $insert->close();
    }
    $orders->close();
}

echo json_encode([
    "success" => true,
    "updated_schedules" => count($scheduleIds)
]);

$conn->close();
?>
