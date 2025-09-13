<?php
require_once 'db_connection.php';
require_once 'session_init.php';
session_start();
function prepareExecute($conn, $sql, $types = "", $params = []) {
    $stmt = $conn->prepare($sql);
    if (!$stmt) {
        throw new Exception("Prepare failed: " . $conn->error);
    }
    if ($types) {
        $stmt->bind_param($types, ...$params);
    }
    for ($i = 0; $i < 2; $i++) {
        if ($stmt->execute()) {
            return $stmt;
        }
        if ($stmt->errno == 1615 && $i == 0) {
            $stmt->close();
            $stmt = $conn->prepare($sql);
            if (!$stmt) {
                throw new Exception("Reprepare failed: " . $conn->error);
            }
            if ($types) {
                $stmt->bind_param($types, ...$params);
            }
            continue;
        }
        $err = $stmt->error;
        $stmt->close();
        throw new Exception($err);
    }
    return $stmt;
}

header('Content-Type: application/json; charset=utf-8');

// 1. Проверка прав
$role = $_SESSION['role'] ?? '';
if ($role !== 'admin') {
    http_response_code(403);
    echo json_encode(['success' => false, 'message' => 'Доступ запрещён']);
    exit;
}

// 2. Чтение и валидация JSON
$raw = file_get_contents("php://input");
if (empty($raw)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Пустой запрос']);
    exit;
}
$input = json_decode($raw, true);
if (json_last_error() !== JSON_ERROR_NONE) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Неверный формат JSON']);
    exit;
}

$action = $input['action'] ?? '';
$ids     = $input['schedule_ids'] ?? [];

if (!in_array($action, ['delete', 'archive'], true) || !is_array($ids)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Неверный формат данных']);
    exit;
}

// 3. Преобразуем и убираем дубли
$ids = array_values(array_unique(array_map('intval', $ids)));

$results = [];
foreach ($ids as $sid) {
    $results[$sid] = null; // зарезервируем место, чтобы сохранить порядок
}

// 4. Проверим, какие ID реально существуют
if (count($ids) > 0) {
    // динамические плейсхолдеры
    $placeholders = implode(',', array_fill(0, count($ids), '?'));
    $types = str_repeat('i', count($ids));

    $stmt = prepareExecute($conn, "SELECT id FROM schedules WHERE id IN ($placeholders)", $types, $ids);
    $res = $stmt->get_result();
    $existing = [];
    while ($row = $res->fetch_assoc()) {
        $existing[] = (int)$row['id'];
    }
    $stmt->close();

    // ID, которых нет
    foreach ($ids as $sid) {
        if (!in_array($sid, $existing, true)) {
            $results[$sid] = [
                'status'  => 'blocked',
                'message' => 'Расписание не найдено'
            ];
        }
    }
}

// 5. Начинаем транзакцию
$conn->begin_transaction();

try {
    foreach ($ids as $sid) {
        // если уже заблокирован (несуществующий) — пропускаем
        if (isset($results[$sid]) && $results[$sid]['status'] === 'blocked') {
            continue;
        }

        // Получаем статусы заказов, исключая удалённые
        $stmt = prepareExecute($conn, "SELECT status FROM orders WHERE schedule_id = ? AND is_deleted = 0 AND status <> 'Удалён клиентом'", "i", [$sid]);
        $res = $stmt->get_result();
        $statuses = [];
        while ($row = $res->fetch_assoc()) {
            $statuses[] = trim($row['status']);
        }
        $stmt->close();

        // 5.1. Нет заказов → удаляем
        if (empty($statuses)) {
            $del = prepareExecute($conn, "DELETE FROM schedules WHERE id = ?", "i", [$sid]);
            $results[$sid] = ['status' => 'deleted'];
            error_log("mass_update: Расписание $sid удалено");
            $del->close();
            continue;
        }

        // 5.2. Есть активные заказы → блокируем
        $active = [];
        foreach ($statuses as $st) {
            if ($st !== 'Товар отправлен' && $st !== 'Завершено') {
                $active[] = $st;
            }
        }
        if (!empty($active)) {
            $results[$sid] = [
                'status'  => 'blocked',
                'message' => 'Отправка в процессе'
            ];
            continue;
        }

        // 5.3. Все заказы завершены → архивируем
        $arch = prepareExecute($conn, "UPDATE schedules SET archived = 1 WHERE id = ?", "i", [$sid]);
        $results[$sid] = ['status' => 'archived'];
        error_log("mass_update: Расписание $sid архивировано");
        $arch->close();
    }

    // 6. Фиксим изменения
    $conn->commit();

} catch (Exception $e) {
    $conn->rollback();
    error_log("mass_update TRANSACTION FAILED: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Внутренняя ошибка сервера']);
    exit;
}

// 7. Отправляем результат в том же порядке, что пришёл запрос
echo json_encode(['success' => true, 'results' => $results]);
$conn->close();