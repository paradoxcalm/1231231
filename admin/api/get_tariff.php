<?php
require_once __DIR__ . '/../../session_init.php';
session_start();
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/../../db_connection.php';

// Авторизация
if (!isset($_SESSION['role'])) {
    echo json_encode(['success' => false, 'message' => 'Не авторизован']);
    exit;
}

// Читаем город и склад(ы) из GET
$city      = trim($_GET['city']      ?? '');
$warehouse = trim($_GET['warehouse'] ?? '');
if ($city === '' || $warehouse === '') {
    echo json_encode(['success' => false, 'message' => 'Город и склад обязательны']);
    exit;
}

// Разбиваем список складов, если их несколько через запятую
$warehousesList = (strpos($warehouse, ',') !== false)
    ? array_map('trim', explode(',', $warehouse))
    : [$warehouse];

/**
 * Функция нормализации названий:
 * - переводит в нижний регистр;
 * - заменяет 'ё' на 'е';
 * - удаляет текст в скобках (...);
 * - отбрасывает суффикс "ozon"/"озон" в конце;
 * - убирает лишние пробелы.
 */
function normalizeName(string $value): string {
    $norm = mb_strtolower($value, 'UTF-8');
    $norm = str_replace('ё', 'е', $norm);
    // убираем текст в скобках
    $norm = preg_replace('/\s*\(.+?\)\s*/u', '', $norm);
    // убираем суффикс ozon/озон
    $norm = preg_replace('/\s*(ozon|озон)\s*$/u', '', $norm);
    // сводим множественные пробелы к одному
    $norm = preg_replace('/\s+/u', ' ', $norm);
    return trim($norm);
}

// Нормализуем город
$normCity = normalizeName($city);
$found    = null;

// Перебираем каждый склад из списка
foreach ($warehousesList as $wh) {
    $normWh = normalizeName($wh);

    // Запрашиваем все тарифы для данного города
    $stmt = $conn->prepare("
        SELECT warehouse_to, standard_box_price, pallet_price, box_coef, per_liter
        FROM price_settings
        WHERE LOWER(REPLACE(city_from, 'ё', 'е')) = ?
    ");
    if ($stmt) {
        $stmt->bind_param('s', $normCity);
        $stmt->execute();
        $res = $stmt->get_result();

        // Ищем точное совпадение нормализованного названия склада
        while ($row = $res->fetch_assoc()) {
            $dbNormalized = normalizeName($row['warehouse_to']);
            if ($dbNormalized === $normWh) {
                $found = [
                    'standard_box_price' => floatval($row['standard_box_price']),
                    'pallet_price'       => floatval($row['pallet_price']),
                    'box_coef'           => ($row['box_coef'] !== null ? floatval($row['box_coef']) : 1.0),
                    'per_liter'          => floatval($row['per_liter'])
                ];
                break 2; // выходим из обоих циклов
            }
        }
        $stmt->close();
    }
}

// Если тариф найден — возвращаем его
if ($found) {
    echo json_encode([
        'success'      => true,
        'base_price'   => $found['standard_box_price'],
        'box_coef'     => $found['box_coef'],
        'pallet_price' => $found['pallet_price'],
        'per_liter'    => $found['per_liter']
    ]);
} else {
    // иначе — сообщение о ненахождении
    echo json_encode(['success' => false, 'message' => 'Тариф не найден']);
}

$conn->close();
?>