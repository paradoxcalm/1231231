<?php
// deliver/reject_task.php
// Отказ от принятого задания: возвращает заявку в пул (status='new').

declare(strict_types=1);

require_once __DIR__ . '/../db_connection.php';
require_once '../session_init.php';
session_start();

// Пускаем только доставщика
if (empty($_SESSION['user_id']) || ($_SESSION['role'] ?? '') !== 'deliverer') {
    header('Location: /'); exit;
}

$delivererId = (int)$_SESSION['user_id'];

// Принимаем pickup_id и filter из GET или POST
$pickupId = isset($_REQUEST['pickup_id']) ? (int)$_REQUEST['pickup_id'] : 0;
$filter   = isset($_REQUEST['filter']) ? (string)$_REQUEST['filter'] : 'active';

// Валидация
if ($pickupId <= 0) {
    header('Location: /deliver/index.php?filter=' . urlencode($filter));
    exit;
}

try {
    // Начинаем транзакцию для защиты от гонок
    if (method_exists($conn, 'begin_transaction')) {
        $conn->begin_transaction();
    } else {
        $conn->query('START TRANSACTION');
    }

    // Блокируем запись: берём статус и назначенного исполнителя
    $stmt = $conn->prepare("SELECT status, assigned_to FROM pickups WHERE id = ? FOR UPDATE");
    if (!$stmt) throw new RuntimeException('prepare failed: ' . $conn->error);
    $stmt->bind_param('i', $pickupId);
    $stmt->execute();
    $res = $stmt->get_result();
    $row = $res ? $res->fetch_assoc() : null;
    $stmt->close();

    if (!$row) {
        // Нет такой заявки
        $conn->rollback();
        header('Location: /deliver/index.php?filter=' . urlencode($filter));
        exit;
    }

    // Проверяем, что заявка именно ВАША и в статусе accepted
    $status   = (string)$row['status'];
    $assigned = (int)$row['assigned_to'];

    if ($status !== 'accepted' || $assigned !== $delivererId) {
        // Нельзя отказаться: либо уже свободна/завершена, либо чужая
        $conn->rollback();
        header('Location: /deliver/index.php?filter=' . urlencode($filter));
        exit;
    }

    // Возвращаем заявку в пул (разблокируем)
    $upd = $conn->prepare("
        UPDATE pickups
        SET status='new',
            assigned_to=NULL,
            accepted_at=NULL,
            task_number=NULL
        WHERE id=?
        LIMIT 1
    ");
    if (!$upd) throw new RuntimeException('prepare failed: ' . $conn->error);
    $upd->bind_param('i', $pickupId);
    $upd->execute();
    $upd->close();

    // Фиксируем
    $conn->commit();

    // Возвращаемся на список (обычно на активные)
    header('Location: /deliver/index.php?filter=' . urlencode($filter));
    exit;

} catch (Throwable $e) {
    // В случае ошибки — откат и редирект
    if ($conn && $conn->errno === 0) {
        // если транзакция активна — откатить
        $conn->rollback();
    }
    // Можно залогировать: error_log($e->getMessage());
    header('Location: /deliver/index.php?filter=' . urlencode($filter));
    exit;
}