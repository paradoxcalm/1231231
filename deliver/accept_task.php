<?php
// deliver/accept_task.php
// This script handles the acceptance of a pickup task by a deliverer.
// It updates the pickup record to assign it to the current deliverer,
// sets the status to 'accepted', and stores the acceptance timestamp
// and daily task number.

require_once __DIR__ . '/../db_connection.php';
require_once '../session_init.php';
session_start();

// Ensure only deliverers can accept tasks
if (!isset($_SESSION['role']) || $_SESSION['role'] !== 'deliverer') {
    header('Location: /index.php');
    exit();
}

// ID текущего доставщика
$delivererId = (int)($_SESSION['user_id'] ?? 0);

// ID заявки на забор
$pickupId = isset($_GET['pickup_id']) ? (int)$_GET['pickup_id'] : 0;

// Фильтр для возврата (active|own|archive)
$filter = isset($_GET['filter']) ? $_GET['filter'] : 'active';

if ($pickupId <= 0 || $delivererId <= 0) {
    header('Location: /deliver/index.php?filter=' . urlencode($filter));
    exit();
}

// Принятие задачи должно быть атомарным: используем транзакцию
$conn->begin_transaction();
try {
    // Убедимся, что заявка свободна (new) и не принята ещё
    $stmt = $conn->prepare("SELECT status FROM pickups WHERE id = ? FOR UPDATE");
    $stmt->bind_param('i', $pickupId);
    $stmt->execute();
    $stmt->bind_result($currentStatus);
    if (!$stmt->fetch()) {
        // Нет такой записи
        $stmt->close();
        $conn->rollback();
        header('Location: /deliver/index.php?filter=' . urlencode($filter));
        exit();
    }
    $stmt->close();

    if ($currentStatus !== 'new') {
        // Уже принята кем‑то или завершена
    $conn->rollback();
        header('Location: /deliver/index.php?filter=' . urlencode($filter));
        exit();
    }

    // Получим следующий порядковый номер задания на сегодня.
    // Используем блокировку строк, чтобы номер был уникален.
    $taskStmt = $conn->prepare(
        "SELECT task_number
         FROM pickups
         WHERE DATE(accepted_at) = CURDATE()
         ORDER BY task_number DESC
         LIMIT 1
         FOR UPDATE"
    );
    $taskStmt->execute();
    $taskStmt->bind_result($maxTaskNumber);
    $taskStmt->fetch();
    $taskStmt->close();
    $newTaskNumber = (int)$maxTaskNumber + 1;

    // Обновляем запись: назначаем доставщика, статус accepted, время и номер
    $update = $conn->prepare("UPDATE pickups SET status = 'accepted', assigned_to = ?, accepted_at = NOW(), task_number = ? WHERE id = ?");
    $update->bind_param('iii', $delivererId, $newTaskNumber, $pickupId);
    $update->execute();

    $conn->commit();
    
} catch (Exception $e) {
    // В случае ошибки откатываем
    $conn->rollback();
}

// Возвращаемся на страницу с текущим фильтром
header('Location: index.php?filter=' . urlencode($filter));
exit();