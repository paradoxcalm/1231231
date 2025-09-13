<?php
require_once '../error_handler.php';

try {
    session_start();
    header('Content-Type: application/json; charset=UTF-8');
    if (!isset($_SESSION['role']) || $_SESSION['role'] !== 'admin') {
        http_response_code(403);
        echo json_encode(['success' => false, 'message' => 'Forbidden']);
        exit;
    }
    require_once '../db_connection.php';

    $T_MARKETPLACES = 'marketplaces';
    $T_CITIES       = 'cities';
    $T_WAREHOUSES   = 'warehouses';
    $T_SCHEDULES    = 'schedules';
    $T_ORDERS       = 'orders';

    $method = $_SERVER['REQUEST_METHOD'];
    $action = $_GET['action'] ?? ($_POST['action'] ?? '');

    switch ($method) {
        case 'GET':
            handle_get($action, $conn, $T_MARKETPLACES, $T_CITIES, $T_WAREHOUSES, $T_SCHEDULES, $T_ORDERS);
            break;
        case 'POST':
            if ($action === 'toggle') {
                handle_toggle($conn, $T_SCHEDULES, $T_ORDERS);
            } else {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'Unknown action']);
            }
            break;
        case 'PATCH':
            if ($action === 'setup') {
                handle_setup($conn, $T_SCHEDULES);
            } else {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'Unknown action']);
            }
            break;
        case 'DELETE':
            if ($action === 'delete') {
                handle_delete($conn, $T_SCHEDULES, $T_ORDERS);
            } else {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'Unknown action']);
            }
            break;
        default:
            http_response_code(405);
            echo json_encode(['success' => false, 'message' => 'Method not allowed']);
    }

    $conn->close();
    exit;
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Internal Server Error']);
    exit;
}

function handle_get($action, $conn, $T_MARKETPLACES, $T_CITIES, $T_WAREHOUSES, $T_SCHEDULES, $T_ORDERS)
{
    if ($action === 'marketplaces') {
        $rows = [];
        if ($stmt = $conn->prepare("SELECT id, name FROM $T_MARKETPLACES ORDER BY name")) {
            $stmt->execute();
            $res = $stmt->get_result();
            while ($row = $res->fetch_assoc()) {
                $rows[] = $row;
            }
            $stmt->close();
        }
        echo json_encode($rows);
        return;
    }

    if ($action === 'cities') {
        $rows = [];
        if ($stmt = $conn->prepare("SELECT name FROM $T_CITIES ORDER BY name")) {
            $stmt->execute();
            if ($stmt->error) {
                http_response_code(500);
                echo json_encode(['success' => false, 'message' => $stmt->error]);
                exit;
            }
            $res = $stmt->get_result();
            while ($row = $res->fetch_assoc()) {
                // Используем имя в качестве уникального идентификатора
                $rows[] = ['id' => $row['name'], 'name' => $row['name']];
            }
            $stmt->close();
        } else {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => $conn->error]);
            exit;
        }
        echo json_encode($rows);
        return;
    }

    if ($action === 'grid') {
        $marketplace_id = intval($_GET['marketplace_id'] ?? 0);
        $origin_city_id = $_GET['origin_city_id'] ?? '';
        $date_from = $_GET['date_from'] ?? date('Y-m-d');
        $days = intval($_GET['days'] ?? 14);
        $date_to = date('Y-m-d', strtotime($date_from . ' +' . ($days - 1) . ' day'));

        $warehouses = [];
        if ($stmt = $conn->prepare("SELECT id, name FROM $T_WAREHOUSES WHERE marketplace_id = ? ORDER BY name")) {
            $stmt->bind_param('i', $marketplace_id);
            $stmt->execute();
            $res = $stmt->get_result();
            while ($row = $res->fetch_assoc()) {
                $warehouses[] = ['id' => $row['id'], 'name' => $row['name']];
            }
            $stmt->close();
        } else {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => $conn->error]);
            exit;
        }

        $dates = [];
        for ($i = 0; $i < $days; $i++) {
            $dates[] = date('Y-m-d', strtotime($date_from . " +$i day"));
        }

        $cells = [];
        $column_summary = [];
        $schedule_ids = [];

        if ($stmt = $conn->prepare("SELECT id, accept_date, warehouses, status, accept_time, acceptance_end, delivery_date, driver_name, driver_phone, car_number, car_brand, comment FROM $T_SCHEDULES WHERE marketplace_id = ? AND city = ? AND accept_date BETWEEN ? AND ?")) {
            $stmt->bind_param('isss', $marketplace_id, $origin_city_id, $date_from, $date_to);
            $stmt->execute();
            $res = $stmt->get_result();
            while ($row = $res->fetch_assoc()) {
                $schedule_ids[] = $row['id'];
                $d = $row['accept_date'];
                $column_summary[$d] = [
                    'orders' => 0,
                    'status' => $row['status'],
                    'accept_time' => $row['accept_time'],
                    'deadline' => $row['acceptance_end'],
                    'delivery_date' => $row['delivery_date'],
                    'driver_name' => $row['driver_name'],
                    'driver_phone' => $row['driver_phone'],
                    'car_number' => $row['car_number'],
                    'car_brand' => $row['car_brand'],
                    'comment' => $row['comment']
                ];
                $names = array_map('trim', explode(',', $row['warehouses'] ?? ''));
                foreach ($warehouses as $wh) {
                    $cells[$d][$wh['id']] = [
                        'checked' => in_array($wh['name'], $names, true),
                        'schedule_id' => $row['id']
                    ];
                }
            }
            $stmt->close();
        }

        if (!empty($schedule_ids)) {
            $placeholders = implode(',', array_fill(0, count($schedule_ids), '?'));
            $types = str_repeat('i', count($schedule_ids));
            if ($stmt = $conn->prepare("SELECT schedule_id, COUNT(*) as c FROM $T_ORDERS WHERE schedule_id IN ($placeholders) GROUP BY schedule_id")) {
                $stmt->bind_param($types, ...$schedule_ids);
                $stmt->execute();
                $res = $stmt->get_result();
                $orders = [];
                while ($row = $res->fetch_assoc()) {
                    $orders[$row['schedule_id']] = $row['c'];
                }
                $stmt->close();
                foreach ($dates as $d) {
                    foreach ($warehouses as $wh) {
                        if (isset($cells[$d][$wh['id']])) {
                            $sid = $cells[$d][$wh['id']]['schedule_id'];
                            if (isset($orders[$sid])) {
                                $column_summary[$d]['orders'] = (int)$orders[$sid];
                            }
                        }
                    }
                }
            }
        }

        foreach ($dates as $d) {
            if (!isset($cells[$d])) $cells[$d] = [];
            foreach ($warehouses as $wh) {
                if (!isset($cells[$d][$wh['id']])) {
                    $cells[$d][$wh['id']] = ['checked' => false, 'schedule_id' => null];
                }
            }
            if (!isset($column_summary[$d])) {
                $column_summary[$d] = [
                    'orders' => 0,
                    'status' => 'accepting',
                    'accept_time' => null,
                    'deadline' => null,
                    'delivery_date' => null,
                    'driver_name' => '',
                    'driver_phone' => '',
                    'car_number' => '',
                    'car_brand' => '',
                    'comment' => ''
                ];
            }
        }

        echo json_encode([
            'success' => true,
            'warehouses' => $warehouses,
            'dates' => $dates,
            'cells' => $cells,
            'column_summary' => $column_summary
        ]);
        return;
    }

    if ($action === 'stats') {
        $marketplace_id = intval($_GET['marketplace_id'] ?? 0);
        $origin_city_id = $_GET['origin_city_id'] ?? '';
        $date_from = $_GET['date_from'] ?? date('Y-m-d');
        $days = intval($_GET['days'] ?? 14);
        $date_to = date('Y-m-d', strtotime($date_from . ' +' . ($days - 1) . ' day'));

        $trips = $orders = $active = $closed = $done = 0;
        $ids = [];
        if ($stmt = $conn->prepare("SELECT id, status FROM $T_SCHEDULES WHERE marketplace_id = ? AND city = ? AND accept_date BETWEEN ? AND ?")) {
            $stmt->bind_param('isss', $marketplace_id, $origin_city_id, $date_from, $date_to);
            $stmt->execute();
            $res = $stmt->get_result();
            while ($row = $res->fetch_assoc()) {
                $trips++;
                $ids[] = $row['id'];
                if ($row['status'] === 'accepting') $active++;
                if ($row['status'] === 'closed') $closed++;
                if ($row['status'] === 'done') $done++;
            }
            $stmt->close();
        }
        if (!empty($ids)) {
            $placeholders = implode(',', array_fill(0, count($ids), '?'));
            $types = str_repeat('i', count($ids));
            if ($stmt = $conn->prepare("SELECT COUNT(*) as c FROM $T_ORDERS WHERE schedule_id IN ($placeholders)")) {
                $stmt->bind_param($types, ...$ids);
                $stmt->execute();
                $stmt->bind_result($orders);
                $stmt->fetch();
                $stmt->close();
            }
        }
        $avg = $trips > 0 ? round($orders / $trips, 2) : 0;
        echo json_encode([
            'trips' => $trips,
            'orders' => $orders,
            'active' => $active,
            'closed' => $closed,
            'done' => $done,
            'avg_per_trip' => $avg
        ]);
        return;
    }

    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Unknown action']);
}

function handle_toggle($conn, $T_SCHEDULES, $T_ORDERS)
{
    $input = json_decode(file_get_contents('php://input'), true);
    $marketplace_id = intval($input['marketplace_id'] ?? 0);
    $origin_city_id = $input['origin_city_id'] ?? '';
    $warehouse_name = $input['warehouse_id'] ?? '';
    $date = $input['date'] ?? date('Y-m-d');
    $checked = !empty($input['checked']);

    if ($warehouse_name === '') {
        http_response_code(404);
        echo json_encode(['success' => false, 'message' => 'Warehouse not found']);
        return;
    }

    $schedule_id = null;
    $warehouses_csv = '';
    if ($stmt = $conn->prepare("SELECT id, warehouses FROM $T_SCHEDULES WHERE marketplace_id = ? AND city = ? AND accept_date = ?")) {
        $stmt->bind_param('iss', $marketplace_id, $origin_city_id, $date);
        $stmt->execute();
        $stmt->bind_result($schedule_id, $warehouses_csv);
        $stmt->fetch();
        $stmt->close();
    }

    $warehouses_arr = array_filter(array_map('trim', explode(',', $warehouses_csv)));

    if ($checked) {
        if (!$schedule_id) {
            if ($stmt = $conn->prepare("INSERT INTO $T_SCHEDULES (city, marketplace_id, accept_date, warehouses, status) VALUES (?,?,?,?, 'accepting')")) {
                $new_csv = $warehouse_name;
                $stmt->bind_param('siss', $origin_city_id, $marketplace_id, $date, $new_csv);
                $stmt->execute();
                $schedule_id = $stmt->insert_id;
                $stmt->close();
            }
        } else {
            if (!in_array($warehouse_name, $warehouses_arr, true)) {
                $warehouses_arr[] = $warehouse_name;
                $new_csv = implode(',', $warehouses_arr);
                if ($stmt = $conn->prepare("UPDATE $T_SCHEDULES SET warehouses = ? WHERE id = ?")) {
                    $stmt->bind_param('si', $new_csv, $schedule_id);
                    $stmt->execute();
                    $stmt->close();
                }
            }
        }
        echo json_encode(['success' => true, 'schedule_id' => $schedule_id]);
        return;
    }

    // unchecked
    if (!$schedule_id) {
        echo json_encode(['success' => true]);
        return;
    }

    $index = array_search($warehouse_name, $warehouses_arr, true);
    if ($index !== false) {
        unset($warehouses_arr[$index]);
    }

    if (empty($warehouses_arr)) {
        if ($stmt = $conn->prepare("SELECT COUNT(*) FROM $T_ORDERS WHERE schedule_id = ?")) {
            $stmt->bind_param('i', $schedule_id);
            $stmt->execute();
            $stmt->bind_result($cnt);
            $stmt->fetch();
            $stmt->close();
        } else {
            $cnt = 0;
        }
        if ($cnt > 0) {
            http_response_code(409);
            echo json_encode(['success' => false, 'message' => 'Рейс содержит заявки']);
            return;
        }
        if ($stmt = $conn->prepare("DELETE FROM $T_SCHEDULES WHERE id = ?")) {
            $stmt->bind_param('i', $schedule_id);
            $stmt->execute();
            $stmt->close();
        }
        echo json_encode(['success' => true]);
        return;
    }

    $new_csv = implode(',', $warehouses_arr);
    if ($stmt = $conn->prepare("UPDATE $T_SCHEDULES SET warehouses = ? WHERE id = ?")) {
        $stmt->bind_param('si', $new_csv, $schedule_id);
        $stmt->execute();
        $stmt->close();
    }
    echo json_encode(['success' => true]);
}

function handle_setup($conn, $T_SCHEDULES)
{
    $input = json_decode(file_get_contents('php://input'), true);
    $schedule_id = intval($input['schedule_id'] ?? 0);
    if (!$schedule_id) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'schedule_id required']);
        return;
    }

    $fields = [];
    $params = [];
    $types = '';

    if (isset($input['accept_time'])) { $fields[] = 'accept_time = ?'; $params[] = $input['accept_time']; $types .= 's'; }
    if (isset($input['deadline'])) { $fields[] = 'acceptance_end = ?'; $params[] = $input['deadline']; $types .= 's'; }
    if (isset($input['delivery_date'])) { $fields[] = 'delivery_date = ?'; $params[] = $input['delivery_date']; $types .= 's'; }
    if (isset($input['comment'])) { $fields[] = 'comment = ?'; $params[] = $input['comment']; $types .= 's'; }
    if (isset($input['status'])) { $fields[] = 'status = ?'; $params[] = $input['status']; $types .= 's'; }

    if (isset($input['driver_id'])) {
        $driver_id = intval($input['driver_id']);
        if ($stmt = $conn->prepare("SELECT name, phone FROM drivers WHERE id = ?")) {
            $stmt->bind_param('i', $driver_id);
            $stmt->execute();
            $stmt->bind_result($dname, $dphone);
            if ($stmt->fetch()) {
                $fields[] = 'driver_name = ?'; $params[] = $dname; $types .= 's';
                $fields[] = 'driver_phone = ?'; $params[] = $dphone; $types .= 's';
            }
            $stmt->close();
        }
    }

    if (isset($input['car_id'])) {
        $car_id = intval($input['car_id']);
        if ($stmt = $conn->prepare("SELECT number, brand FROM cars WHERE id = ?")) {
            $stmt->bind_param('i', $car_id);
            $stmt->execute();
            $stmt->bind_result($cnum, $cbrand);
            if ($stmt->fetch()) {
                $fields[] = 'car_number = ?'; $params[] = $cnum; $types .= 's';
                $fields[] = 'car_brand = ?'; $params[] = $cbrand; $types .= 's';
            }
            $stmt->close();
        }
    }

    if (empty($fields)) {
        echo json_encode(['success' => true]);
        return;
    }

    $params[] = $schedule_id;
    $types .= 'i';
    $sql = "UPDATE $T_SCHEDULES SET " . implode(',', $fields) . " WHERE id = ?";
    if ($stmt = $conn->prepare($sql)) {
        $stmt->bind_param($types, ...$params);
        $stmt->execute();
        $stmt->close();
    }
    echo json_encode(['success' => true]);
}

function handle_delete($conn, $T_SCHEDULES, $T_ORDERS)
{
    $schedule_id = intval($_GET['schedule_id'] ?? 0);
    if (!$schedule_id) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'schedule_id required']);
        return;
    }

    $cnt = 0;
    if ($stmt = $conn->prepare("SELECT COUNT(*) FROM $T_ORDERS WHERE schedule_id = ?")) {
        $stmt->bind_param('i', $schedule_id);
        $stmt->execute();
        $stmt->bind_result($cnt);
        $stmt->fetch();
        $stmt->close();
    }
    if ($cnt > 0) {
        http_response_code(409);
        echo json_encode(['success' => false, 'message' => 'Schedule has orders']);
        return;
    }
    if ($stmt = $conn->prepare("DELETE FROM $T_SCHEDULES WHERE id = ?")) {
        $stmt->bind_param('i', $schedule_id);
        $stmt->execute();
        $stmt->close();
    }
    echo json_encode(['success' => true]);
}

