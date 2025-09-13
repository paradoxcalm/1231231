<?php
function log_debug($msg, $context = []) {
    $log_file = __DIR__ . '/logs/schedule.log';

    if (!file_exists($log_file)) {
        touch($log_file);
        @chmod($log_file, 0666);
    }

    $time    = date('Y-m-d H:i:s');
    $ip      = $_SERVER['REMOTE_ADDR'] ?? 'CLI';
    $session = $_SESSION['role'] ?? 'none';
    $user    = $_SESSION['user_id'] ?? '0';
    $ctx     = json_encode($context, JSON_UNESCAPED_UNICODE | JSON_PARTIAL_OUTPUT_ON_ERROR);

    $line = "[Schedule][$time][$ip][uid:$user][role:$session] $msg | $ctx\n";

    if (file_put_contents($log_file, $line, FILE_APPEND) === false) {
        error_log('[Schedule] Failed to write to ' . $log_file);
    }
}

require_once 'session_init.php';
session_start();
require_once 'db_connection.php';  // содержит $conn

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
        if ($stmt->errno == 1615 && $i == 0) {  // ERROR 1615: Prepared statement needs to be re-prepared
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

// === Handle JSON body for POST (if needed) ===
$rawPost = file_get_contents('php://input');
if (empty($_POST) && $rawPost) {
    $_POST = json_decode($rawPost, true) ?? [];
}

$role   = $_SESSION['role']    ?? 'client';
$userId = $_SESSION['user_id'] ?? 0;

// Проверяем, включён ли модуль расписания
$configFile = __DIR__ . '/config.json';
$configData = [];
if (file_exists($configFile)) {
    $configData = json_decode(file_get_contents($configFile), true) ?: [];
}
if (isset($configData['SCHEDULE_ENABLED']) && !$configData['SCHEDULE_ENABLED']) {
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['error' => 'maintenance']);
    exit;
}

// Автоархив: переносим старые рейсы (delivery_date < сегодня) в архив
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $currentDate = date('Y-m-d');
    // Обновляем только неархивные записи, у которых дата сдачи уже прошла
    $archiveStmt = $conn->prepare(
        "UPDATE schedules
         SET status='Завершено', archived=1
         WHERE archived=0 AND delivery_date < ? AND status <> 'Завершено'"
    );
    if ($archiveStmt) {
        $archiveStmt->bind_param('s', $currentDate);
        $archiveStmt->execute();
        $archiveStmt->close();
    }
}

// === GET request: summary mode for calendar (count departures and deliveries between dates) ===
if ($_SERVER['REQUEST_METHOD'] === 'GET' && isset($_GET['summary']) && isset($_GET['from']) && isset($_GET['to'])) {
    header('Content-Type: application/json; charset=utf-8');
    $fromDate = $_GET['from'];
    $toDate   = $_GET['to'];

    // Prepare filter conditions (archived, city, warehouses, marketplace, status)
    $archivedFilter = isset($_GET['archived']) ? intval($_GET['archived']) : 0;
    $cityFilter       = isset($_GET['city'])       ? trim($_GET['city'])       : "";
    $warehouseFilter  = isset($_GET['warehouse'])  ? trim($_GET['warehouse'])  : "";
    $marketplaceFilter= isset($_GET['marketplace'])? trim($_GET['marketplace']): "";
    $statusFilter     = isset($_GET['status'])     ? trim($_GET['status'])     : "";

    $conditions = "archived = ?";
    $types = "i";
    $params = [ $archivedFilter ];

    if ($cityFilter !== "") {
        $conditions .= " AND city LIKE ?";
        $types      .= "s";
        $params[]    = "%{$cityFilter}%";
    }
    if ($warehouseFilter !== "") {
        $conditions .= " AND warehouses LIKE ?";
        $types      .= "s";
        $params[]    = "%{$warehouseFilter}%";
    }
    if ($marketplaceFilter !== "") {
        $conditions .= " AND marketplace = ?";
        $types      .= "s";
        $params[]    = $marketplaceFilter;
    }
    if ($statusFilter !== "") {
        $conditions .= " AND status = ?";
        $types      .= "s";
        $params[]    = $statusFilter;
    }

    // Query for departures count by accept_date in range
    $queryDepart = "SELECT accept_date AS date, COUNT(*) AS departures 
                    FROM schedules 
                    WHERE $conditions AND accept_date BETWEEN ? AND ? 
                    GROUP BY accept_date";
    $stmt1 = $conn->prepare($queryDepart);
    if (!$stmt1) {
        http_response_code(500);
        echo json_encode(["error" => "DB error (departures): " . $conn->error]);
        exit;
    }
    $types1 = $types . "ss";
    $params1 = array_merge($params, [ $fromDate, $toDate ]);
    $stmt1->bind_param($types1, ...$params1);
    if (!$stmt1->execute()) {
        http_response_code(500);
        echo json_encode(["error" => "DB exec error (departures): " . $stmt1->error]);
        $stmt1->close();
        exit;
    }
    $res1 = $stmt1->get_result();
    $departData = [];
    while ($row = $res1->fetch_assoc()) {
        $departData[$row['date']] = intval($row['departures']);
    }
    $stmt1->close();

    // Query for deliveries count by delivery_date in range
    $queryDeliver = "SELECT delivery_date AS date, COUNT(*) AS deliveries 
                     FROM schedules 
                     WHERE $conditions AND delivery_date BETWEEN ? AND ? 
                     GROUP BY delivery_date";
    $stmt2 = $conn->prepare($queryDeliver);
    if (!$stmt2) {
        http_response_code(500);
        echo json_encode(["error" => "DB error (deliveries): " . $conn->error]);
        exit;
    }
    $types2 = $types . "ss";
    $params2 = array_merge($params, [ $fromDate, $toDate ]);
    $stmt2->bind_param($types2, ...$params2);
    if (!$stmt2->execute()) {
        http_response_code(500);
        echo json_encode(["error" => "DB exec error (deliveries): " . $stmt2->error]);
        $stmt2->close();
        exit;
    }
    $res2 = $stmt2->get_result();
    $deliverData = [];
    while ($row = $res2->fetch_assoc()) {
        $deliverData[$row['date']] = intval($row['deliveries']);
    }
    $stmt2->close();

    // Combine results for each date in range
    $summary = [];
    $allDates = array_unique(array_merge(array_keys($departData), array_keys($deliverData)));
    sort($allDates);
    foreach ($allDates as $date) {
        $summary[] = [
            "date"       => $date,
            "departures" => $departData[$date]  ?? 0,
            "deliveries" => $deliverData[$date] ?? 0
        ];
    }
    echo json_encode($summary);
    $conn->close();
    exit;
}

// === GET request: combined departures/deliveries lists for a given date (calendar modal) ===
if ($_SERVER['REQUEST_METHOD'] === 'GET' && isset($_GET['combinedDate'])) {
    header('Content-Type: text/html; charset=utf-8');
    $date = $_GET['combinedDate'];

    // Filter conditions (similar to summary)
    $archivedFilter = isset($_GET['archived']) ? intval($_GET['archived']) : 0;
    $cityFilter       = isset($_GET['city'])       ? trim($_GET['city'])       : "";
    $warehouseFilter  = isset($_GET['warehouse'])  ? trim($_GET['warehouse'])  : "";
    $marketplaceFilter= isset($_GET['marketplace'])? trim($_GET['marketplace']): "";
    $statusFilter     = isset($_GET['status'])     ? trim($_GET['status'])     : "";

    $conditions = "archived = ?";
    $types = "i";
    $params = [ $archivedFilter ];
    if ($cityFilter !== "") {
        $conditions .= " AND city = ?";
        $types      .= "s";
        $params[]    = $cityFilter;
    }
    if ($warehouseFilter !== "") {
        $conditions .= " AND warehouses = ?";
        $types      .= "s";
        $params[]    = $warehouseFilter;
    }
    if ($marketplaceFilter !== "") {
        $conditions .= " AND marketplace = ?";
        $types      .= "s";
        $params[]    = $marketplaceFilter;
    }
    if ($statusFilter !== "") {
        $conditions .= " AND status = ?";
        $types      .= "s";
        $params[]    = $statusFilter;
    }

    // Fetch departures (accept_date = $date)
    $queryA = "SELECT * FROM schedules WHERE $conditions AND accept_date = ?";
    $stmtA = $conn->prepare($queryA);
    $typesA = $types . "s";
    $paramsA = array_merge($params, [ $date ]);
    if (!$stmtA) {
        echo "<div class='calendar-modal-content'><p>Ошибка выборки данных: ". htmlspecialchars($conn->error) ."</p></div>";
        exit;
    }
    $stmtA->bind_param($typesA, ...$paramsA);
    if (!$stmtA->execute()) {
        echo "<div class='calendar-modal-content'><p>Ошибка выборки данных: ". htmlspecialchars($stmtA->error) ."</p></div>";
        $stmtA->close();
        exit;
    }
    $resA = $stmtA->get_result();
    $departuresList = $resA->fetch_all(MYSQLI_ASSOC);
    $stmtA->close();

    // Fetch deliveries (delivery_date = $date)
    $queryB = "SELECT * FROM schedules WHERE $conditions AND delivery_date = ?";
    $stmtB = $conn->prepare($queryB);
    $typesB = $types . "s";
    $paramsB = array_merge($params, [ $date ]);
    if (!$stmtB) {
        echo "<div class='calendar-modal-content'><p>Ошибка выборки данных: ". htmlspecialchars($conn->error) ."</p></div>";
        exit;
    }
    $stmtB->bind_param($typesB, ...$paramsB);
    if (!$stmtB->execute()) {
        echo "<div class='calendar-modal-content'><p>Ошибка выборки данных: ". htmlspecialchars($stmtB->error) ."</p></div>";
        $stmtB->close();
        exit;
    }
    $resB = $stmtB->get_result();
    $deliveriesList = $resB->fetch_all(MYSQLI_ASSOC);
    $stmtB->close();

    // Begin HTML output for modal
    echo "<div class='calendar-modal-content'>";
    echo "<h3 style='margin-bottom:10px;'>Расписание на " . htmlspecialchars($date) . "</h3>";

    // Departures block
    echo "<h4>Выезды (" . htmlspecialchars($date) . ")</h4>";
    if (count($departuresList) > 0) {
        echo "<table class='schedule-table' style='margin-bottom:20px; width:100%; border-collapse:collapse;' border='1'>";
        echo "<tr><th>ID</th><th>Город</th><th>Склад</th><th>Маркетплейс</th><th>Дата выезда</th><th>Дата сдачи</th><th>Статус</th></tr>";
        foreach ($departuresList as $row) {
            echo "<tr>";
            echo "<td>" . htmlspecialchars($row['id'])            . "</td>";
            echo "<td>" . htmlspecialchars($row['city'])          . "</td>";
            echo "<td>" . htmlspecialchars($row['warehouses'])    . "</td>";
            echo "<td>" . htmlspecialchars($row['marketplace'])   . "</td>";
            echo "<td>" . htmlspecialchars($row['accept_date'])   . "</td>";
            echo "<td>" . htmlspecialchars($row['delivery_date']) . "</td>";
            echo "<td>" . htmlspecialchars($row['status'])        . "</td>";
            echo "</tr>";
        }
        echo "</table>";
    } else {
        echo "<p><em>Нет выездов в эту дату.</em></p>";
    }

    // Deliveries block
    echo "<h4>Сдачи (" . htmlspecialchars($date) . ")</h4>";
    if (count($deliveriesList) > 0) {
        echo "<table class='schedule-table' style='margin-bottom:20px; width:100%; border-collapse:collapse;' border='1'>";
        echo "<tr><th>ID</th><th>Город</th><th>Склад</th><th>Маркетплейс</th><th>Дата выезда</th><th>Дата сдачи</th><th>Статус</th></tr>";
        foreach ($deliveriesList as $row) {
            // skip if this shipment already listed as departure (to avoid duplicate if accept_date == delivery_date)
            $isDuplicate = false;
            foreach ($departuresList as $drow) {
                if ($drow['id'] == $row['id']) {
                    $isDuplicate = true;
                    break;
                }
            }
            if ($isDuplicate) continue;
            echo "<tr>";
            echo "<td>" . htmlspecialchars($row['id'])            . "</td>";
            echo "<td>" . htmlspecialchars($row['city'])          . "</td>";
            echo "<td>" . htmlspecialchars($row['warehouses'])    . "</td>";
            echo "<td>" . htmlspecialchars($row['marketplace'])   . "</td>";
            echo "<td>" . htmlspecialchars($row['accept_date'])   . "</td>";
            echo "<td>" . htmlspecialchars($row['delivery_date']) . "</td>";
            echo "<td>" . htmlspecialchars($row['status'])        . "</td>";
            echo "</tr>";
        }
        echo "</table>";
    } else {
        echo "<p><em>Нет сдач в эту дату.</em></p>";
    }

    echo "</div>";
    $conn->close();
    exit;
}

// === GET request: fetch one schedule by ID (JSON) ===
if ($_SERVER['REQUEST_METHOD'] === 'GET' && isset($_GET['id']) && is_numeric($_GET['id'])) {
    header('Content-Type: application/json; charset=utf-8');
    $id = intval($_GET['id']);
    $stmt = prepareExecute($conn, "SELECT * FROM schedules WHERE id = ?", "i", [ $id ]);
    $res  = $stmt->get_result();
    $row  = $res->fetch_assoc();
    $stmt->close();
    if ($row) {
        // Add accept_deadline field as alias of acceptance_end (for convenience)
        $row['accept_deadline'] = $row['acceptance_end'] ?? null;
        echo json_encode([ 'success' => true, 'schedule' => $row ]);
    } else {
        echo json_encode([ 'success' => false, 'message' => 'Расписание не найдено' ]);
    }
    $conn->close();
    exit;
}




// =======================================================================
// Ниже - обработка POST-запросов (создание, редактирование, удаление и т.д.)
// Весь блок оставлен как в исходной версии, без изменений
// =======================================================================
try {
    // === GET request: fetch list of schedules (with optional filters + orders_count) ===
    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        header('Content-Type: application/json; charset=utf-8');
        $archived     = isset($_GET['archived']) ? (int)$_GET['archived'] : 0;
        $city         = $_GET['city']          ?? '';
        $warehouse    = $_GET['warehouse']     ?? '';
        $marketplace  = $_GET['marketplace']   ?? '';
        $status       = $_GET['status']        ?? '';
        $date         = $_GET['date']          ?? '';   // accept_date
        $deliveryDate = $_GET['delivery_date'] ?? '';   // delivery_date
        $noOrders     = isset($_GET['no_orders']) && $_GET['no_orders'] == '1';

        // Выбираем расписания + считаем заявки через подзапрос (без GROUP BY — безопасно при ONLY_FULL_GROUP_BY)
        $query = "SELECT
                    s.*,
                    (SELECT COUNT(*) FROM orders o WHERE o.schedule_id = s.id AND o.is_deleted = 0 AND o.status <> 'Удалён клиентом') AS orders_count
                  FROM schedules s
                  WHERE s.archived = ?";
        $params = [ $archived ];
        $types  = 'i';

        if ($city !== '') {
            $query   .= " AND s.city LIKE ?";
            $params[] = "%$city%";
            $types   .= 's';
        }
        if ($warehouse !== '') {
            $query   .= " AND s.warehouses LIKE ?";
            $params[] = "%$warehouse%";
            $types   .= 's';
        }
        if ($marketplace !== '') {
            $query   .= " AND s.marketplace = ?";
            $params[] = $marketplace;
            $types   .= 's';
        }
        if ($status !== '') {
            $query   .= " AND s.status = ?";
            $params[] = $status;
            $types   .= 's';
        }
        if ($date !== '') {
            $query   .= " AND s.accept_date = ?";
            $params[] = $date;
            $types   .= 's';
        }
        if ($deliveryDate !== '') {
            $query   .= " AND s.delivery_date = ?";
            $params[] = $deliveryDate;
            $types   .= 's';
        }

        // Только расписания без заявок (удобно для чистки дублей)
        if ($noOrders) {
            $query .= " AND NOT EXISTS (SELECT 1 FROM orders o2 WHERE o2.schedule_id = s.id AND o2.is_deleted = 0 AND o2.status <> 'Удалён клиентом')";
        }

        // Исключаем завершённые (как было у вас)
        $query   .= " AND s.status <> ?";
        $params[] = 'Завершено';
        $types   .= 's';

        // Сортировка
        $query .= " ORDER BY s.accept_date ASC, s.id ASC";

        $stmt   = prepareExecute($conn, $query, $types, $params);
        $result = $stmt->get_result();
        $data   = [];
        while ($row = $result->fetch_assoc()) {
            $row['accept_deadline'] = $row['acceptance_end'] ?? null;
            // на всякий случай приводим счётчик к int
            $row['orders_count'] = isset($row['orders_count']) ? (int)$row['orders_count'] : 0;
            $data[] = $row;
        }
        $stmt->close();
        echo json_encode($data);
        $conn->close();
        exit;
    }

    // === CREATE schedule (admin/manager only) ===
    if (($_POST['action'] ?? '') === 'create') {
        header('Content-Type: application/json; charset=utf-8');
        if (!in_array($role, ['admin', 'manager'])) {
            echo json_encode(['status' => 'error', 'message' => 'Нет прав на создание']);
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

        // If city is passed as numeric ID, replace with its name
        if (is_numeric($city)) {
            $cityId = (int)$city;
            $stmtCity = prepareExecute($conn, "SELECT name FROM cities WHERE id = ? LIMIT 1", "i", [ $cityId ]);
            $cityRow = $stmtCity->get_result()->fetch_assoc();
            $stmtCity->close();
            $city = $cityRow['name'] ?? '';
        }

        if (!$city || !$accept_date || !$delivery_date || !$accept_deadline) {
            echo json_encode(['status' => 'error', 'message' => 'Заполните все обязательные поля']);
            exit;
        }
        if (strtotime($delivery_date) < strtotime($accept_date)) {
            echo json_encode(['status' => 'error', 'message' => 'Сдача не может быть раньше приёмки']);
            exit;
        }
        if (empty($warehousesArr) || !is_array($warehousesArr)) {
            echo json_encode(['status' => 'error', 'message' => 'Выберите хотя бы один склад.']);
            exit;
        }

        // Combine multiple warehouses into a single comma-separated string
        $warehousesStr = implode(',', $warehousesArr);
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
                $warehousesStr,
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
        echo json_encode(['status' => 'success']);
        exit;
    }

    // === EDIT schedule (admin/manager only) ===
    if (($_POST['action'] ?? '') === 'edit') {
        header('Content-Type: application/json; charset=utf-8');
        if (!in_array($role, ['admin', 'manager'])) {
            echo json_encode(['status' => 'error', 'message' => 'Нет прав на редактирование']);
            exit;
        }

        $id = (int)($_POST['id'] ?? 0);
        $stmt = prepareExecute($conn, "SELECT * FROM schedules WHERE id = ? LIMIT 1", "i", [ $id ]);
        $oldRow = $stmt->get_result()->fetch_assoc();
        $stmt->close();

        if (!$oldRow) {
            echo json_encode(['status' => 'error', 'message' => 'Запись не найдена']);
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
        $accept_deadline = $_POST['accept_deadline'] ?? $oldRow['acceptance_end'];

        // If city is passed as numeric ID, replace with its name
        if (is_numeric($city)) {
            $cityId = (int)$city;
            $stmtCity = prepareExecute($conn, "SELECT name FROM cities WHERE id = ? LIMIT 1", "i", [ $cityId ]);
            $cityRow = $stmtCity->get_result()->fetch_assoc();
            $stmtCity->close();
            $city = $cityRow['name'] ?? '';
        }

        if (!$city || !$accept_date || !$delivery_date || !$accept_deadline) {
            echo json_encode(['status' => 'error', 'message' => 'Отсутствуют обязательные поля']);
            exit;
        }

        // Combine warehouses array into comma-separated string
        $warehousesStr = implode(',', (array)$warehousesArr);
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
        $stmt->close();
        $conn->close();
        echo json_encode(['status' => 'success']);
        exit;
    }

    // === DELETE (or archive) schedule (admin only) ===
    if (($_POST['action'] ?? '') === 'delete') {
        header('Content-Type: application/json; charset=utf-8');
        if ($role !== 'admin') {
            echo json_encode(['success' => false, 'message' => 'Доступ запрещён']);
            exit;
        }
        $scheduleId = intval($_POST['id'] ?? 0);
        if (!$scheduleId) {
            echo json_encode(['success' => false, 'message' => 'Некорректный ID расписания']);
            exit;
        }

        // Check if any orders are linked to this schedule and their statuses
        $stmt = prepareExecute($conn, "SELECT status FROM orders WHERE schedule_id = ? AND is_deleted = 0 AND status <> 'Удалён клиентом'", "i", [ $scheduleId ]);
        $res = $stmt->get_result();
        $statuses = [];
        while ($row = $res->fetch_assoc()) {
            $statuses[] = trim($row['status']);
        }
        $stmt->close();

        // If no orders linked, delete the schedule
        if (empty($statuses)) {
            $del = prepareExecute($conn, "DELETE FROM schedules WHERE id = ?", "i", [ $scheduleId ]);
            $del->close();
            echo json_encode(['success' => true, 'message' => 'Расписание удалено']);
            exit;
        }

        // If there are orders and any are not finished, cannot delete
        $active = [];
        foreach ($statuses as $st) {
            if ($st !== 'Товар отправлен' && $st !== 'Завершено') {
                $active[] = $st;
            }
        }
        if (!empty($active)) {
            echo json_encode(['success' => false, 'message' => 'Отправка ещё не завершена — удалить нельзя']);
            exit;
        }

        // All orders are finished, archive the schedule instead of deleting
        $arch = prepareExecute($conn, "UPDATE schedules SET archived = 1 WHERE id = ?", "i", [ $scheduleId ]);
        $arch->close();
        echo json_encode(['success' => true, 'message' => 'Расписание архивировано']);
        exit;
    }

    // === UPDATE status of schedule (admin/manager) ===
    if (($_POST['action'] ?? '') === 'update_status') {
        header('Content-Type: application/json; charset=utf-8');
        if (!in_array($role, ['admin', 'manager'])) {
            echo json_encode(['status' => 'error', 'message' => 'Нет прав']);
            exit;
        }
        $id        = (int)($_POST['id'] ?? 0);
        $newStatus = $_POST['status'] ?? '';
        $stmt = prepareExecute($conn, "UPDATE schedules SET status = ? WHERE id = ?", "si", [ $newStatus, $id ]);
        $stmt->close();
        $conn->close();
        echo json_encode(['status' => 'success']);
        exit;
    }

    // === EXPORT schedules to Excel (admin only) ===
    if (($_POST['action'] ?? '') === 'export') {
        if ($role !== 'admin') {
            echo json_encode(['status' => 'error', 'message' => 'Доступ только для администратора']);
            exit;
        }
        header('Content-Type: application/vnd.ms-excel');
        header('Content-Disposition: attachment; filename="schedule.xls"');
        $result = $conn->query("SELECT * FROM schedules");
        if (!$result) {
            echo "Ошибка экспорта: " . htmlspecialchars($conn->error);
            $conn->close();
            exit;
        }
        // Header row
        echo "ID\tГород\tДата выезда\tВремя приёма\tДата сдачи\tСклады\tТайм-слот\tСтатус\tМаркетплейс\tАвто\tВодитель\tТелефон\tМарка\tDeadline\n";
        while ($row = $result->fetch_assoc()) {
            echo implode("\t", [
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
        $conn->close();
        exit;
    }

} catch (Throwable $e) {
    header('Content-Type: application/json; charset=utf-8');
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => $e->getMessage()]);
    if ($conn instanceof mysqli) {
        $conn->close();
    }
    exit;
}

