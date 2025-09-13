<?php
session_start();
header('Content-Type: application/json; charset=utf-8');
require_once 'db_connection.php';

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

// === ОБРАБОТКА JSON-ТЕЛА ===
$rawPost = file_get_contents('php://input');
if (empty($_POST) && $rawPost) {
    $_POST = json_decode($rawPost, true) ?? [];
}

$role   = $_SESSION['role']    ?? 'client';
$userId = $_SESSION['user_id'] ?? 0;

// === Получение одного расписания по ID ===
if ($_SERVER['REQUEST_METHOD'] === 'GET' && isset($_GET['id']) && is_numeric($_GET['id'])) {
    $id   = intval($_GET['id']);
    $stmt = prepareExecute($conn, "SELECT * FROM schedules WHERE id = ?", "i", [$id]);
    $res  = $stmt->get_result();
    $row  = $res->fetch_assoc();
    $stmt->close();
    // Добавляем поле accept_deadline для фронтенда на основе acceptance_end
    if ($row) {
        $row['accept_deadline'] = $row['acceptance_end'] ?? null;
        echo json_encode(['success' => true, 'schedule' => $row]);
    } else {
        echo json_encode(['success' => false, 'message' => 'Расписание не найдено']);
    }
    $conn->close();
    exit;
}

// === Получение списка расписаний с фильтрацией ===
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $archived = isset($_GET['archived']) ? (int)$_GET['archived'] : 0;
    $city        = $_GET['city']        ?? '';
    $warehouse   = $_GET['warehouse']   ?? '';
    $date        = $_GET['date']        ?? '';
    $status      = $_GET['status']      ?? '';
    $idParam     = $_GET['id']          ?? '';
    $marketplace = $_GET['marketplace'] ?? '';
    // Базовый запрос + фильтр archived
    $query  = "SELECT * FROM schedules WHERE archived = ?";
    $params = [ $archived ];
    $types  = 'i';

    if ($city) {
        $query    .= " AND city LIKE ?";
        $params[]  = "%$city%";
        $types    .= 's';
    }
    if ($warehouse) {
        $query    .= " AND warehouses LIKE ?";
        $params[]  = "%$warehouse%";
        $types    .= 's';
    }
    if ($date) {
        $query    .= " AND accept_date = ?";
        $params[]  = $date;
        $types    .= 's';
    }
    if ($status) {
        $query    .= " AND status = ?";
        $params[]  = $status;
        $types    .= 's';
    }
    if ($idParam !== '') {
        $query    .= " AND id = ?";
        $params[]  = (int)$idParam;
        $types    .= 'i';
    }
    if ($marketplace !== '') {
        $query    .= " AND marketplace = ?";
        $params[]  = $marketplace;
        $types    .= 's';
    }

    $stmt = prepareExecute($conn, $query, $types, $params);
    $result = $stmt->get_result();
    $data   = [];
    while ($row = $result->fetch_assoc()) {
        // Копируем acceptance_end в поле accept_deadline для UI
        $row['accept_deadline'] = $row['acceptance_end'] ?? null;
        $data[] = $row;
    }
    $stmt->close();
    echo json_encode($data);
    $conn->close();
    exit;
}

$action = $_POST['action'] ?? '';

try {
    // === СОЗДАНИЕ (admin/manager) ===
    if ($action === 'create') {
        if (!in_array($role, ['admin','manager'])) {
            echo json_encode(['status'=>'error','message'=>'Нет прав на создание']);
            exit;
        }
        $city            = $_POST['city']            ?? '';
        $accept_date     = $_POST['accept_date']     ?? '';
        $accept_time     = $_POST['accept_time']     ?? '';
        $delivery_date   = $_POST['delivery_date']   ?? '';
        $warehousesArr   = $_POST['warehouses']      ?? [];
        $marketplace     = $_POST['marketplace']     ?? 'None';
        $timeslot        = $_POST['timeslot']        ?? null;
        $car_number      = $_POST['car_number']      ?? '';
        $driver_name     = $_POST['driver_name']     ?? '';
        $driver_phone    = $_POST['driver_phone']    ?? '';
        $car_brand       = $_POST['car_brand']       ?? '';
        $accept_deadline = $_POST['accept_deadline'] ?? '';
        $statusVal       = 'Приём заявок';

        if (!$city || !$accept_date || !$delivery_date || !$accept_deadline) {
            echo json_encode(['status'=>'error','message'=>'Заполните все обязательные поля']);
            exit;
        }
        if (strtotime($delivery_date) < strtotime($accept_date)) {
            echo json_encode(['status'=>'error','message'=>'Сдача не может быть раньше приёмки']);
            exit;
        }

        foreach ($warehousesArr as $warehouseName) {
            $stmt = prepareExecute(
                $conn,
                "INSERT INTO schedules (
                    city, accept_date, accept_time, delivery_date, warehouses,
                    timeslot, status, marketplace, car_number, driver_name,
                    driver_phone, car_brand, acceptance_end
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                "sssssssssssss",
                [
                    $city,
                    $accept_date,
                    $accept_time,
                    $delivery_date,
                    $warehouseName,
                    $timeslot,
                    $statusVal,
                    $marketplace,
                    $car_number,
                    $driver_name,
                    $driver_phone,
                    $car_brand,
                    $accept_deadline
                ]
            );
            $stmt->close();
        }

        echo json_encode(['status' => 'success']);
        exit;
    }

    // === РЕДАКТИРОВАНИЕ (admin/manager) ===
    if ($action === 'edit') {
        if (!in_array($role, ['admin','manager'])) {
            echo json_encode(['status'=>'error','message'=>'Нет прав на редактирование']);
            exit;
        }

        $id = (int)($_POST['id'] ?? 0);
        $stmt = prepareExecute($conn, "SELECT * FROM schedules WHERE id=? LIMIT 1", "i", [$id]);
        $oldRow = $stmt->get_result()->fetch_assoc();
        $stmt->close();

        if (!$oldRow) {
            echo json_encode(['status'=>'error','message'=>'Запись не найдена']);
            exit;
        }

        $city            = $_POST['city']            ?? $oldRow['city'];
        $accept_date     = $_POST['accept_date']     ?? $oldRow['accept_date'];
        $accept_time     = $_POST['accept_time']     ?? $oldRow['accept_time'];
        $delivery_date   = $_POST['delivery_date']   ?? $oldRow['delivery_date'];
        $warehousesArr   = $_POST['warehouses']      ?? explode(',', $oldRow['warehouses']);
        $timeslot        = $_POST['timeslot']        ?? $oldRow['timeslot'];
        $statusVal       = $_POST['status']          ?? $oldRow['status'];
        $marketplace     = $_POST['marketplace']     ?? $oldRow['marketplace'];
        $car_number      = $_POST['car_number']      ?? $oldRow['car_number'];
        $driver_name     = $_POST['driver_name']     ?? $oldRow['driver_name'];
        $driver_phone    = $_POST['driver_phone']    ?? $oldRow['driver_phone'];
        $car_brand       = $_POST['car_brand']       ?? $oldRow['car_brand'];
        // Берём accept_deadline из нового поля (или старого acceptance_end, если POST нет)
        $accept_deadline = $_POST['accept_deadline'] ?? $oldRow['acceptance_end'];

        if (!$city || !$accept_date || !$delivery_date || !$accept_deadline) {
            echo json_encode(['status'=>'error','message'=>'Отсутствуют обязательные поля']);
            exit;
        }

        $warehousesStr = implode(',', $warehousesArr);
        $stmt = prepareExecute(
            $conn,
            "UPDATE schedules SET
                city = ?, accept_date = ?, accept_time = ?, delivery_date = ?, warehouses = ?,
                timeslot = ?, status = ?, marketplace = ?, car_number = ?, driver_name = ?,
                driver_phone = ?, car_brand = ?, acceptance_end = ?
            WHERE id = ?",
            "sssssssssssssi",
            [
                $city, $accept_date, $accept_time, $delivery_date, $warehousesStr,
                $timeslot, $statusVal, $marketplace, $car_number, $driver_name,
                $driver_phone, $car_brand, $accept_deadline, $id
            ]
        );
        echo json_encode(['status' => 'success']);
        $stmt->close();
        $conn->close();
        exit;
    }

    // === УДАЛЕНИЕ / АРХИВАЦИЯ ===
    if ($action === 'delete') {
        if ($role !== 'admin') {
            echo json_encode(['success' => false, 'message' => 'Доступ запрещён']);
            exit;
        }
        $scheduleId = intval($_POST['id'] ?? 0);
        if (!$scheduleId) {
            echo json_encode(['success' => false, 'message' => 'Некорректный ID расписания']);
            exit;
        }

        $stmt = prepareExecute($conn, "SELECT status FROM orders WHERE schedule_id = ?", "i", [$scheduleId]);
        $res      = $stmt->get_result();
        $statuses = [];
        while ($row = $res->fetch_assoc()) {
            $statuses[] = trim($row['status']);
        }
        $stmt->close();

        if (empty($statuses)) {
            $del = prepareExecute($conn, "DELETE FROM schedules WHERE id = ?", "i", [$scheduleId]);
            $del->close();
            echo json_encode(['success' => true, 'message' => 'Расписание удалено']);
            exit;
        }

        $active = [];
        foreach ($statuses as $st) {
            if ($st !== 'Товар отправлен' && $st !== 'Завершено') {
                $active[] = $st;
            }
        }
        if (!empty($active)) {
            echo json_encode([
                'success' => false,
                'message' => 'Отправка ещё не завершена — удалить нельзя'
            ]);
            exit;
        }

        $arch = prepareExecute($conn, "UPDATE schedules SET archived = 1 WHERE id = ?", "i", [$scheduleId]);
        $arch->close();
        echo json_encode(['success' => true, 'message' => 'Расписание архивировано']);
        exit;
    }

    // === ОБНОВЛЕНИЕ СТАТУСА ===
    if ($action === 'update_status') {
        if (!in_array($role, ['admin','manager'])) {
            echo json_encode(['status'=>'error','message'=>'Нет прав']);
            exit;
        }
        $id        = (int)($_POST['id'] ?? 0);
        $newStatus = $_POST['status']     ?? '';
        $stmt = prepareExecute($conn, "UPDATE schedules SET status = ? WHERE id = ?", "si", [$newStatus, $id]);
        echo json_encode(['status'=>'success']);
        $stmt->close();
        $conn->close();
        exit;
    }

    // === ЭКСПОРТ В Excel ===
    if ($action === 'export') {
        if ($role !== 'admin') {
            echo json_encode(['status'=>'error','message'=>'Доступ только для администратора']);
            exit;
        }
        header('Content-Type: application/vnd.ms-excel');
        header('Content-Disposition: attachment; filename="schedule.xls"');
        $result = $conn->query("SELECT * FROM schedules");
        $output = "ID\tГород\tДата выезда\tВремя приёма\tДата сдачи\tСклады\tТайм-слот\tСтатус\tМаркетплейс\tАвто\tВодитель\tТелефон\tМарка\tDeadline\n";
        while ($row = $result->fetch_assoc()) {
            $output .= implode("\t", [
                $row['id'],
                $row['city'],
                $row['accept_date'],
                $row['accept_time'],
                $row['delivery_date'],
                $row['warehouses'],
                $row['timeslot'],
                $row['status'],
                $row['marketplace'],
                $row['car_number'],
                $row['driver_name'],
                $row['driver_phone'],
                $row['car_brand'],
                ($row['acceptance_end'] ?? '')
            ]) . "\n";
        }
        echo $output;
        $conn->close();
        exit;
    }
} catch (Exception $e) {
    echo json_encode(['status'=>'error','message'=>$e->getMessage()]);
    $conn->close();
    exit;
}
?>
