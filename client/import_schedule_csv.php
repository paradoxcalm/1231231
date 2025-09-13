<?php
session_start();
header('Content-Type: application/json; charset=utf-8');
ini_set('display_errors', 0);
ini_set('log_errors', 1);
ini_set('error_log', __DIR__ . '/logs/php_errors.log');

if (!isset($_SESSION['role']) || $_SESSION['role'] !== 'admin') {
    echo json_encode(['success' => false, 'message' => 'Доступ запрещён']);
    exit;
}

require_once __DIR__ . '/db_connection.php';

$logPath = __DIR__ . '/logs/import_schedule_debug.log';
if (!is_dir(dirname($logPath))) mkdir(dirname($logPath), 0777, true);
function logDebug($msg) {
    global $logPath;
    file_put_contents($logPath, "[" . date('Y-m-d H:i:s') . "] $msg\n", FILE_APPEND);
}

if (empty($_FILES['excel_file']['tmp_name']) || !is_uploaded_file($_FILES['excel_file']['tmp_name'])) {
    logDebug("Файл не загружен или невалиден");
    echo json_encode(['success' => false, 'message' => 'Файл не загружен']);
    exit;
}

$validCities = [];
$validWarehouses = [];
$validMarketplaces = ['Wildberries', 'Ozon', 'Яндекс.Маркет'];

$res = $conn->query("SELECT DISTINCT name FROM cities WHERE is_active = 1");
while ($r = $res->fetch_assoc()) $validCities[] = trim($r['name']);

$res = $conn->query("SELECT DISTINCT name FROM warehouses");
while ($r = $res->fetch_assoc()) $validWarehouses[] = trim($r['name']);

$inserted = 0;
$errors = [];
$rowNum = 1;

// !!! Готовим вставку acceptance_end как в ручном режиме !!!
$stmt = $conn->prepare("
    INSERT INTO schedules 
    (city, warehouses, accept_date, delivery_date, timeslot,
     marketplace, car_number, car_brand, driver_name, driver_phone, acceptance_end, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Ожидает отправки')
");

$handle = fopen($_FILES['excel_file']['tmp_name'], 'r');
if (!$handle) {
    echo json_encode(['success' => false, 'message' => 'Ошибка открытия CSV']);
    exit;
}

while (($row = fgetcsv($handle, 1000, ',')) !== false) {
    $rowNum++;
    if ($rowNum === 2) continue; // пропускаем заголовок

    // Гарантируем 11 полей
    $row = array_map('trim', $row + array_fill(0, 11, ''));

    // Пропускаем пустые строки
    $notEmpty = false;
    foreach ($row as $v) {
        if ($v !== '') {
            $notEmpty = true;
            break;
        }
    }
    if (!$notEmpty) {
        continue;
    }

    // Привязка к CSV (строго по вашему формату):
    [$city, $warehouses, $acceptDate, $acceptanceEnd, $deliveryDate,
     $timeslot, $marketplace, $carNumber, $carBrand, $driverName, $driverPhone] = $row;

    if ($city === '' || $warehouses === '' || $acceptDate === '' || $acceptanceEnd === '' || $deliveryDate === '') {
        $errors[] = ['row' => $rowNum, 'error' => 'Обязательные поля пусты'];
        continue;
    }

    if (!in_array($city, $validCities, true)) {
        $errors[] = ['row' => $rowNum, 'error' => "Недопустимый город: \"$city\""];
        continue;
    }
    if (!in_array($warehouses, $validWarehouses, true)) {
        $errors[] = ['row' => $rowNum, 'error' => "Недопустимый склад: \"$warehouses\""];
        continue;
    }
    if ($marketplace !== '' && !in_array($marketplace, $validMarketplaces, true)) {
        $errors[] = ['row' => $rowNum, 'error' => "Недопустимый маркетплейс: \"$marketplace\""];
        continue;
    }

    $d1 = date_create_from_format('d.m.Y', $acceptDate) ?: date_create_from_format('Y-m-d', $acceptDate);
    $d2 = date_create_from_format('d.m.Y', $deliveryDate) ?: date_create_from_format('Y-m-d', $deliveryDate);
    // Пробуем оба типа даты+время
    $acceptanceEndDT = date_create_from_format('d.m.Y H:i', $acceptanceEnd)
        ?: date_create_from_format('Y-m-d H:i:s', $acceptanceEnd);

    if (!$d1 || !$acceptanceEndDT || !$d2) {
        $errors[] = ['row' => $rowNum, 'error' => 'Неверный формат даты'];
        continue;
    }

    if ($d1 > $d2) {
        $errors[] = ['row' => $rowNum, 'error' => 'Дата приёмки позже даты сдачи'];
        continue;
    }

    $accDateStr = $d1->format('Y-m-d');
    $deliveryStr = $d2->format('Y-m-d');
    $acceptanceEndStr = $acceptanceEndDT->format('Y-m-d H:i:s');

    $stmt->bind_param(
        "sssssssssss",
        $city, $warehouses, $accDateStr, $deliveryStr,
        $timeslot, $marketplace, $carNumber, $carBrand, $driverName, $driverPhone, $acceptanceEndStr
    );

    if (!$stmt->execute()) {
        $errors[] = ['row' => $rowNum, 'error' => 'Ошибка записи в БД'];
        continue;
    }

    $inserted++;
}

fclose($handle);

echo json_encode(['success' => true, 'inserted' => $inserted, 'errors' => $errors]);
$conn->close();
exit;