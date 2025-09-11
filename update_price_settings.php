<?php
// 👤 Пользователь (ADMIN-panel)
require_once 'session_init.php';
session_start();
header('Content-Type: application/json; charset=utf-8');
require_once 'db_connection.php';

$logPath = __DIR__ . '/logs/pricing_debug.log';
if ($_SESSION['role'] !== 'admin') {
    error_log("[ACCESS DENIED] Non-admin tried to save pricing\n", 3, $logPath);
    echo json_encode(['success' => false, 'message' => 'Доступ запрещён']);
    exit;
}

$dataRaw = file_get_contents('php://input');
$data    = json_decode($dataRaw, true);
error_log("[RAW JSON] $dataRaw\n", 3, $logPath);

if (!is_array($data)) {
    error_log("[ERROR] JSON не массив\n", 3, $logPath);
    echo json_encode(['success' => false, 'message' => 'Неверный формат']);
    exit;
}

$stmt = $conn->prepare("
    INSERT INTO price_settings
      (city_from, warehouse_to, standard_box_price, per_liter, pallet_price, box_coef)
    VALUES (?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      standard_box_price = VALUES(standard_box_price),
      per_liter          = VALUES(per_liter),
      pallet_price       = VALUES(pallet_price),
      box_coef           = VALUES(box_coef)
");
if (!$stmt) {
    error_log("[ERROR] Prepare failed: " . $conn->error . "\n", 3, $logPath);
    echo json_encode(['success' => false, 'message' => 'Ошибка подготовки запроса']);
    exit;
}

foreach ($data as $city => $info) {
    // раньше pallet_price брали из $info напрямую :contentReference[oaicite:7]{index=7}
    $boxCoef = isset($info['box_coef']) ? floatval($info['box_coef']) : 0;

    if (!isset($info['warehouses']) || !is_array($info['warehouses'])) {
        error_log("[WARN] Город '$city' без складов\n", 3, $logPath);
        continue;
    }

    foreach ($info['warehouses'] as $wh => $prices) {
        // вместо $boxPrice = $prices старого формата :contentReference[oaicite:8]{index=8}
        $boxPrice    = floatval($prices['box_price']    ?? 0);
        $palletPrice = floatval($prices['pallet_price'] ?? 0);
        $perLiter    = round($boxPrice / 96, 4);

        error_log("[SAVE] $city → $wh: box={$boxPrice}, pallet={$palletPrice}, per_liter={$perLiter}, coef={$boxCoef}\n", 3, $logPath);

        $stmt->bind_param("ssdddd",
            $city,
            $wh,
            $boxPrice,
            $perLiter,
            $palletPrice,
            $boxCoef
        );
        $stmt->execute();
    }
}

$stmt->close();
$conn->close();
echo json_encode(['success' => true]);