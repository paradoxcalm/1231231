<?php
// import_schedule_confirm.php — полная замена
require_once 'session_init.php';
session_start();
header('Content-Type: application/json; charset=UTF-8');
require_once 'db_connection.php'; // должен создать $conn (mysqli)

/**
 * Чтение и разбор входных данных
 */
$rawInput = file_get_contents('php://input');
$data = json_decode($rawInput, true);

if (!is_array($data)) {
    echo json_encode([
        "added"     => 0,
        "not_added" => 1,
        "errors"    => [
            [ "row" => 1, "messages" => [ "Некорректный формат данных" ] ]
        ]
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

/**
 * Готовим INSERT
 */
$sql = "INSERT INTO schedules (
            city, accept_date, accept_time, delivery_date, warehouses,
            timeslot, status, marketplace, car_number, driver_name,
            driver_phone, car_brand, acceptance_end
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
$stmt = $conn->prepare($sql);
if (!$stmt) {
    echo json_encode([
        "added"     => 0,
        "not_added" => count($data),
        "errors"    => [
            [ "row" => 1, "messages" => [ "Ошибка подготовки запроса: " . $conn->error ] ]
        ]
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

// Привязываем параметры по ссылке (переиспользуем $stmt в цикле)
$city = $accept_date = $accept_time = $delivery_date = $warehouses = "";
$timeslot = $status = $marketplace = $car_number = $driver_name = "";
$driver_phone = $car_brand = $acceptance_end = "";
$stmt->bind_param(
    "sssssssssssss",
    $city, $accept_date, $accept_time, $delivery_date, $warehouses,
    $timeslot, $status, $marketplace, $car_number, $driver_name,
    $driver_phone, $car_brand, $acceptance_end
);

/**
 * Statement для проверки дубликатов в БД (активных)
 * Ключ: city + warehouses + accept_date
 */
$checkSql  = "SELECT id FROM schedules 
              WHERE city = ? AND warehouses = ? AND accept_date = ? 
              AND archived = 0 LIMIT 1";
$checkStmt = $conn->prepare($checkSql);
if (!$checkStmt) {
    echo json_encode([
        "added"     => 0,
        "not_added" => count($data),
        "errors"    => [[
            "row"      => 1,
            "messages" => [ "Ошибка подготовки запроса (проверка дубликатов): " . $conn->error ]
        ]]
    ], JSON_UNESCAPED_UNICODE);
    $stmt->close();
    exit;
}

$statusDefault = "Приём заявок";  // статус по умолчанию
$addedCount    = 0;
$errorEntries  = [];

/**
 * Доп. защита: дубликаты внутри одного файла/пакета (по ключу city|warehouses|accept_date)
 */
$seenKeys = []; // normalized key => 1

// Транзакция (ускоряет вставки и делает их атомарными)
$conn->begin_transaction();

try {
    foreach ($data as $index => $row) {
        $rowNumber = $index + 1;

        // 1) Извлечение исходных значений
        $cityRaw         = trim($row['city'] ?? "");
        $warehousesRaw   = trim($row['warehouses'] ?? "");
        $departureRaw    = trim($row['departureDate'] ?? "");
        $acceptEndRaw    = trim($row['acceptanceEnd'] ?? "");
        $deliveryRaw     = trim($row['deliveryDate'] ?? "");
        $timeslotValRaw  = trim($row['timeslot'] ?? "");
        $marketplaceRaw  = trim($row['marketplace'] ?? "");
        $carNumRaw       = trim($row['carNumber'] ?? "");
        $carBrandRaw     = trim($row['carBrand'] ?? "");
        $driverNameRaw   = trim($row['driverName'] ?? "");
        $driverPhoneRaw  = trim($row['driverPhone'] ?? "");

        // 2) Валидация форматов/обязательных полей (как у вас)
        $rowErrors = [];
        if ($cityRaw === '')        $rowErrors[] = "Город не указан";
        if ($warehousesRaw === '')  $rowErrors[] = "Склад не указан";

        if ($departureRaw === '') {
            $rowErrors[] = "Дата выезда не указана";
        } else {
            if (!preg_match('/^\d{2}\.\d{2}\.\d{4}$/', $departureRaw) ||
                !DateTime::createFromFormat('d.m.Y', $departureRaw)) {
                $rowErrors[] = "Неверная дата выезда";
            }
        }

        if ($deliveryRaw === '') {
            $rowErrors[] = "Дата сдачи не указана";
        } else {
            if (!preg_match('/^\d{2}\.\d{2}\.\d{4}$/', $deliveryRaw) ||
                !DateTime::createFromFormat('d.m.Y', $deliveryRaw)) {
                $rowErrors[] = "Неверная дата сдачи";
            }
        }

        if ($acceptEndRaw === '' || $acceptEndRaw === '-') {
            $rowErrors[] = "Время окончания приёмки не указано";
        } else {
            if (!preg_match('/^\d{2}\.\d{2}\.\d{4}\s+\d{2}:\d{2}$/', $acceptEndRaw) ||
                !DateTime::createFromFormat('d.m.Y H:i', $acceptEndRaw)) {
                $rowErrors[] = "Неверное дата/время окончания приёмки";
            }
        }

        if ($timeslotValRaw !== '' && $timeslotValRaw !== '-' && !preg_match('/^[\w\s\-\:]+$/u', $timeslotValRaw)) {
            $rowErrors[] = "Таймслот указан некорректно";
        }

        if ($marketplaceRaw === '') $rowErrors[] = "Маркетплейс не указан";
        if ($carNumRaw === '')     $rowErrors[] = "Номер авто не указан";
        if ($carBrandRaw === '')   $rowErrors[] = "Марка авто не указана";
        if ($driverNameRaw === '') $rowErrors[] = "ФИО водителя не указано";

        if ($driverPhoneRaw === '') {
            $rowErrors[] = "Телефон не указан";
        } else {
            $digits = preg_replace('/\D+/', '', $driverPhoneRaw);
            if (strlen($digits) < 10 || strlen($digits) > 15) {
                $rowErrors[] = "Телефон указан некорректно";
            }
        }

        if (!empty($rowErrors)) {
            $errorEntries[] = ["row" => $rowNumber, "messages" => $rowErrors];
            continue; // к следующей строке
        }

        // 3) Нормализация форматов для БД
        // даты
        $depDateObj      = DateTime::createFromFormat('d.m.Y', $departureRaw);
        $accept_date     = $depDateObj ? $depDateObj->format('Y-m-d') : $departureRaw;

        $delDateObj      = DateTime::createFromFormat('d.m.Y', $deliveryRaw);
        $delivery_date   = $delDateObj ? $delDateObj->format('Y-m-d') : $deliveryRaw;

        $accEndObj       = DateTime::createFromFormat('d.m.Y H:i', $acceptEndRaw);
        $acceptance_end  = $accEndObj ? $accEndObj->format('Y-m-d H:i:s') : $acceptEndRaw;

        // прочие
        $accept_time     = ""; // у вас не передаётся
        $city            = $cityRaw;
        $warehouses      = $warehousesRaw;
        $timeslot        = ($timeslotValRaw === '-' ? "" : $timeslotValRaw);
        $status          = $statusDefault;
        $marketplace     = $marketplaceRaw;
        $car_number      = $carNumRaw;
        $car_brand       = $carBrandRaw;
        $driver_name     = $driverNameRaw;
        $driver_phone    = $driverPhoneRaw;

        // 4) Клиентский пакет — защита от дублей внутри одного импорта
        $normCity       = mb_strtolower(trim($city));
        $normWarehouse  = mb_strtolower(trim($warehouses));
        $key            = $normCity . '|' . $normWarehouse . '|' . $accept_date;
        if (isset($seenKeys[$key])) {
            $errorEntries[] = [
                "row"      => $rowNumber,
                "messages" => [ "Дубликат внутри файла: такое направление и дата выезда уже встречались" ]
            ];
            continue;
        }
        $seenKeys[$key] = 1;

        // 5) Проверка на дубликат в БД (среди активных)
        $checkStmt->bind_param("sss", $city, $warehouses, $accept_date);
        if (!$checkStmt->execute()) {
            $errorEntries[] = [
                "row"      => $rowNumber,
                "messages" => [ "Ошибка БД при проверке дубликатов ({$checkStmt->errno}): {$checkStmt->error}" ]
            ];
            continue;
        }
        $resCheck = $checkStmt->get_result();
        if ($resCheck && $resCheck->fetch_assoc()) {
            // Уже есть такая запись
            $errorEntries[] = [
                "row"      => $rowNumber,
                "messages" => [ "Отправление для данного города, склада и даты выезда уже существует" ]
            ];
            $resCheck->free();
            continue;
        }
        if ($resCheck) $resCheck->free();

        // 6) Вставка
        if (!$stmt->execute()) {
            $errorEntries[] = [
                "row"      => $rowNumber,
                "messages" => [ "Ошибка БД ({$stmt->errno}): {$stmt->error}" ]
            ];
        } else {
            $addedCount++;
        }
    }

    $conn->commit();

} catch (Throwable $e) {
    $conn->rollback();
    // Общая аварийная ошибка
    echo json_encode([
        "added"     => $addedCount,
        "not_added" => count($data) - $addedCount,
        "errors"    => array_merge($errorEntries, [[
            "row" => 0,
            "messages" => [ "Неожиданная ошибка: " . $e->getMessage() ]
        ]])
    ], JSON_UNESCAPED_UNICODE);
    $stmt->close();
    $checkStmt->close();
    $conn->close();
    exit;
}

// Закрытие ресурсов
$stmt->close();
$checkStmt->close();
$conn->close();

// Ответ
echo json_encode([
    "added"     => $addedCount,
    "not_added" => count($errorEntries),
    "errors"    => $errorEntries
], JSON_UNESCAPED_UNICODE);