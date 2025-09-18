<?php
header('Content-Type: application/json; charset=utf-8');
require_once 'db_connection.php';

$action = $_GET['action'] ?? '';

switch ($action) {
    // Уникальные маркетплейсы с расписаниями
    case 'marketplaces':
        $res = $conn->query("SELECT DISTINCT marketplace FROM schedules WHERE status != 'Завершено' AND marketplace IS NOT NULL AND marketplace != ''");
        $data = [];
        while ($row = $res->fetch_assoc()) $data[] = $row['marketplace'];
        echo json_encode(['success' => true, 'marketplaces' => $data]);
        break;

    // Города по маркетплейсу
    case 'cities':
        $marketplace = trim($_GET['marketplace'] ?? '');
        if ($marketplace === '') {
            echo json_encode(['success' => false, 'message' => 'marketplace required']);
            break;
        }
        $stmt = $conn->prepare("SELECT DISTINCT city FROM schedules WHERE status != 'Завершено' AND marketplace = ? AND city IS NOT NULL AND city != ''");
        $stmt->bind_param("s", $marketplace);
        $stmt->execute();
        $res = $stmt->get_result();
        $data = [];
        while ($row = $res->fetch_assoc()) $data[] = $row['city'];
        $stmt->close();
        echo json_encode(['success' => true, 'cities' => $data]);
        break;

    // Склады по маркетплейсу и городу
    case 'warehouses':
        $marketplace = trim($_GET['marketplace'] ?? '');
        $city = trim($_GET['city'] ?? '');
        if ($marketplace === '' || $city === '') {
            echo json_encode(['success' => false, 'message' => 'marketplace and city required']);
            break;
        }
        $stmt = $conn->prepare("SELECT DISTINCT warehouses FROM schedules WHERE status != 'Завершено' AND marketplace = ? AND city = ? AND warehouses IS NOT NULL AND warehouses != ''");
        $stmt->bind_param("ss", $marketplace, $city);
        $stmt->execute();
        $res = $stmt->get_result();
        $data = [];
        while ($row = $res->fetch_assoc()) $data[] = $row['warehouses'];
        $stmt->close();
        echo json_encode(['success' => true, 'warehouses' => $data]);
        break;

    // --- ВСЕ ГОРОДА (по всем маркетплейсам) ---
    case 'all_cities':
    $res = $conn->query("
        SELECT DISTINCT
            CASE
                WHEN city REGEXP '^[0-9]+$' THEN (
                    SELECT name FROM cities WHERE id = schedules.city LIMIT 1
                )
                ELSE city
            END AS city_name
        FROM schedules
        WHERE city IS NOT NULL AND city <> ''
    ");
    $cities = [];
    while ($row = $res->fetch_assoc()) {
        $name = trim($row['city_name']);
        if ($name !== '') $cities[] = $name;
    }
    echo json_encode(['success' => true, 'cities' => $cities]);
    break;


        // --- ВСЕ СКЛАДЫ (по всем городам/маркетплейсам или по конкретному городу) ---
        case 'all_warehouses':
        $sql = "SELECT DISTINCT warehouses FROM schedules
                WHERE warehouses IS NOT NULL
                  AND warehouses != ''
                  AND status != 'Завершено'
                  AND accept_date >= CURDATE()";
        $params = [];
        $types  = "";

        $marketplace = isset($_GET['marketplace']) ? trim($_GET['marketplace']) : '';
        $city = isset($_GET['city']) ? trim($_GET['city']) : '';

        if ($marketplace !== '') {
            $sql     .= " AND marketplace = ?";
            $params[] = $marketplace;
            $types   .= "s";
        }

        if ($city !== '') {
            $sql     .= " AND city = ?";
            $params[] = $city;
            $types   .= "s";
        }
        $stmt = $conn->prepare($sql);
        if ($params) {
            $stmt->bind_param($types, ...$params);
        }
        $stmt->execute();
        $res = $stmt->get_result();
        $whs = [];
        while ($row = $res->fetch_assoc()) {
            $whs[] = $row['warehouses'];
        }
        $stmt->close();
        echo json_encode(['success' => true, 'warehouses' => $whs]);
        break;


    default:
        echo json_encode(['success' => false, 'message' => 'Unknown action']);
}

$conn->close();
?>
