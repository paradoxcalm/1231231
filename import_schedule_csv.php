<?php
// import_schedule_csv.php
require_once 'session_init.php';
session_start();
header('Content-Type: application/json; charset=UTF-8');

// Проверяем, что файл передан
if (!isset($_FILES['excel_file']) || $_FILES['excel_file']['error'] !== UPLOAD_ERR_OK) {
    echo json_encode([
        "success" => false,
        "message" => "Ошибка загрузки файла"
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

$filePath = $_FILES['excel_file']['tmp_name'];

// Открываем файл и пытаемся определить разделитель (запятая, точка с запятой или табуляция)
$handle = fopen($filePath, 'r');
if (!$handle) {
    echo json_encode([
        "success" => false,
        "message" => "Не удалось открыть файл"
    ], JSON_UNESCAPED_UNICODE);
    exit;
}
$firstLine = fgets($handle);
if ($firstLine === false) {
    echo json_encode([
        "success" => false,
        "message" => "Файл пустой или не читается"
    ], JSON_UNESCAPED_UNICODE);
    fclose($handle);
    exit;
}
rewind($handle);

// Определяем разделитель по первой строке
$commaCount    = substr_count($firstLine, ',');
$semicolonCount= substr_count($firstLine, ';');
$tabCount      = substr_count($firstLine, "\t");
if ($tabCount > max($commaCount, $semicolonCount)) {
    $delimiter = "\t";
} elseif ($semicolonCount > $commaCount) {
    $delimiter = ';';
} else {
    $delimiter = ',';
}

// Массив результатов для JSON
$rows = [];
$lineNumber     = 0;
$headerSkipped  = false;
while (($data = fgetcsv($handle, 0, $delimiter)) !== false) {
    $lineNumber++;
    // Пропускаем заголовок
    if (!$headerSkipped) {
        $firstCell = $data[0] ?? '';
        if (mb_strtolower(trim($firstCell)) === mb_strtolower('Город')) {
            $headerSkipped = true;
            continue;
        }
    }
    // Игнорируем полностью пустые строки
    $isEmptyRow = true;
    foreach ($data as $cell) {
        if (trim($cell) !== '') { $isEmptyRow = false; break; }
    }
    if ($isEmptyRow) continue;

    // Приводим к 11 полям
    $count = count($data);
    if ($count < 11) {
        for ($i = $count; $i < 11; $i++) {
            $data[$i] = '';
        }
    } elseif ($count > 11) {
        $data = array_slice($data, 0, 11);
    }

    // Обрезаем пробелы
    $data = array_map('trim', $data);

    // Распаковываем
    list(
        $city, $warehouses,
        $departureDate, $acceptanceEnd,
        $deliveryDate, $timeslot,
        $marketplace, $carNumber,
        $carBrand, $driverName,
        $driverPhone
    ) = $data;

    $errors = [];

    // Проверки остаются без изменений:
    if ($city === '') {
        $errors[] = ["field" => "Город",               "message" => "не указан"];
    }
    if ($warehouses === '') {
        $errors[] = ["field" => "Склад",               "message" => "не указан"];
    }
    // Дата выезда
    if ($departureDate === '') {
        $errors[] = ["field" => "Дата выезда",         "message" => "не указана"];
    } else {
        if (!preg_match('/^\d{2}\.\d{2}\.\d{4}$/', $departureDate)) {
            $errors[] = ["field" => "Дата выезда",     "message" => "неверный формат"];
        } else {
            $dt = DateTime::createFromFormat('d.m.Y', $departureDate);
            if (!$dt) {
                $errors[] = ["field" => "Дата выезда", "message" => "некорректная дата"];
            }
        }
    }
    // Дата сдачи
    if ($deliveryDate === '') {
        $errors[] = ["field" => "Дата сдачи",         "message" => "не указана"];
    } else {
        if (!preg_match('/^\d{2}\.\d{2}\.\d{4}$/', $deliveryDate)) {
            $errors[] = ["field" => "Дата сдачи",     "message" => "неверный формат"];
        } else {
            $dt = DateTime::createFromFormat('d.m.Y', $deliveryDate);
            if (!$dt) {
                $errors[] = ["field" => "Дата сдачи", "message" => "некорректная дата"];
            }
        }
    }
    // Окончание приёмки
    if ($acceptanceEnd === '' || $acceptanceEnd === '-') {
        $errors[] = ["field" => "Окончание приёмки",   "message" => "не указано"];
    } else {
        if (!preg_match('/^\d{2}\.\d{2}\.\d{4}\s+\d{2}:\d{2}$/', $acceptanceEnd)) {
            $errors[] = ["field" => "Окончание приёмки", "message" => "неверный формат"];
        } else {
            $dt = DateTime::createFromFormat('d.m.Y H:i', $acceptanceEnd);
            if (!$dt) {
                $errors[] = ["field" => "Окончание приёмки", "message" => "некорректная дата/время"];
            }
        }
    }
    // Таймслот (опционально, но проверяем формат)
    if ($timeslot !== '' && $timeslot !== '-' && !preg_match('/^[\w\s\-\:]+$/u', $timeslot)) {
        $errors[] = ["field" => "Таймслот",           "message" => "некорректное значение"];
    }
    if ($marketplace === '') {
        $errors[] = ["field" => "Маркетплейс",        "message" => "не указан"];
    }
    if ($carNumber === '') {
        $errors[] = ["field" => "Номер авто",         "message" => "не указан"];
    }
    if ($carBrand === '') {
        $errors[] = ["field" => "Марка",              "message" => "не указана"];
    }
    // Убраны только эти две проверки:
    // if ($driverName === '') {
    //     $errors[] = ["field" => "ФИО водителя",   "message" => "не указано"];
    // }
    // if ($driverPhone === '') {
    //     $errors[] = ["field" => "Телефон",        "message" => "не указан"];
    // } else {
    //     $digits = preg_replace('/\D+/', '', $driverPhone);
    //     if (strlen($digits) < 10 || strlen($digits) > 15) {
    //         $errors[] = ["field" => "Телефон",    "message" => "некорректный"];
    //     }
    // }

    // Собираем результат
    $rowData = compact(
        'city','warehouses','departureDate',
        'acceptanceEnd','deliveryDate','timeslot',
        'marketplace','carNumber','carBrand',
        'driverName','driverPhone'
    );
    $rows[] = [
        "values"  => $rowData,
        "success" => empty($errors),
        "errors"  => $errors
    ];
}

fclose($handle);

// Возвращаем JSON
echo json_encode(["rows" => $rows], JSON_UNESCAPED_UNICODE);