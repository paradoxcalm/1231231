<?php
require_once '../session_init.php';
session_start();

/**
 * Подтверждение совпадения QR‑кода курьером.
 *
 * Endpoint получает POST‑запрос от сканера курьера (см. deliver/scan.js).
 * Ожидается JSON с полями `pickup_id` и `qr_code` или аналогичные
 * параметры формы.  При совпадении кода записывается отметка
 * `courier_verified = NOW()` (и при необходимости статус переводится
 * в `in_transit`).  На фронтенд отправляется лишь подтверждение
 * совпадения/несовпадения QR‑кода без архивирования заявки.
 */

// Helper to output a JSON response and terminate.
function respond_json($success, $message) {
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['success' => (bool)$success, 'message' => (string)$message], JSON_UNESCAPED_UNICODE);
    exit;
}

// Determine the request type.
$contentType = $_SERVER['CONTENT_TYPE'] ?? '';
$isJson      = stripos($contentType, 'application/json') !== false;
$isAjax      = !empty($_SERVER['HTTP_X_REQUESTED_WITH']) && strtolower($_SERVER['HTTP_X_REQUESTED_WITH']) === 'xmlhttprequest';

// Ensure only deliverers can access this endpoint.
if (($_SESSION['role'] ?? '') !== 'deliverer') {
    $msg = 'Доступ запрещён.';
    if ($isAjax || $isJson) {
        respond_json(false, $msg);
    }
    echo $msg;
    exit;
}

// Include database connection; adjust the path as necessary.
require_once __DIR__ . '/../db_connection.php';

$delivererId = (int)($_SESSION['user_id'] ?? 0);

// Initialize variables.
$pickup_id   = (int)($_GET['pickup_id'] ?? $_GET['id'] ?? 0);
$scannedCode = '';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if ($isJson) {
        // Read and decode JSON body.
        $raw = file_get_contents('php://input');
        $data = json_decode($raw, true);
        if (is_array($data)) {
            $scannedCode = isset($data['qr_code']) ? trim((string)$data['qr_code']) : '';
            if (!empty($data['pickup_id'])) {
                $pickup_id = (int)$data['pickup_id'];
            }
        }
    } else {
        // Fallback for form submission.
        $scannedCode = trim($_POST['qr_code'] ?? '');
        if (!empty($_POST['pickup_id'])) {
            $pickup_id = (int)$_POST['pickup_id'];
        }
    }
}

// Validate pickup ID.
if (!$pickup_id) {
    $msg = 'Идентификатор заявки не указан.';
    if ($isAjax || $isJson) {
        respond_json(false, $msg);
    }
    echo $msg;
    exit;
}

// Fetch pickup record and ensure it belongs to current deliverer.
$stmt = $conn->prepare('SELECT id, address, qr_code, status, courier_verified, assigned_to FROM pickups WHERE id = ?');
$stmt->bind_param('i', $pickup_id);
$stmt->execute();
$pickup = $stmt->get_result()->fetch_assoc();
$stmt->close();

if (!$pickup) {
    $msg = 'Заявка не найдена.';
    if ($isAjax || $isJson) {
        respond_json(false, $msg);
    }
    echo $msg;
    exit;
}

// Ensure the pickup is assigned to the current deliverer.
if ((int)($pickup['assigned_to'] ?? 0) !== $delivererId) {
    $msg = 'Вы не назначены на эту заявку.';
    if ($isAjax || $isJson) {
        respond_json(false, $msg);
    }
    echo $msg;
    exit;
}

// If request is POST, perform confirmation logic.
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if ($scannedCode === $pickup['qr_code']) {
        // Re-check assignment before updating status.
        $check = $conn->prepare('SELECT assigned_to FROM pickups WHERE id = ?');
        $check->bind_param('i', $pickup_id);
        $check->execute();
        $assignedRow = $check->get_result()->fetch_assoc();
        $check->close();

        if ((int)($assignedRow['assigned_to'] ?? 0) !== $delivererId) {
            $msg = 'Вы больше не назначены на эту заявку.';
            if ($isAjax || $isJson) {
                respond_json(false, $msg);
            }
            echo $msg;
            exit;
        }

        // Зафиксировать проверку курьером и при необходимости перевести заявку в транзит.
        $upd = $conn->prepare("UPDATE pickups SET courier_verified = NOW(), status = 'in_transit' WHERE id = ?");
        $upd->bind_param('i', $pickup_id);
        $upd->execute();
        $upd->close();
        $msg = 'QR‑код подтверждён.';
        if ($isAjax || $isJson) {
            respond_json(true, $msg);
        }
        echo $msg;
        exit;
    } else {
        $msg = 'Сканированный код не совпадает. Пожалуйста, проверьте заявку.';
        if ($isAjax || $isJson) {
            respond_json(false, $msg);
        }
        echo $msg;
        exit;
    }
}

// For GET requests or other methods, render a simple page to allow manual
// confirmation if needed.  This provides a fallback UI for environments where
// JavaScript scanning is unavailable.
?>
<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <title>Подтверждение забора</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .error { color: red; }
    </style>
</head>
<body>
    <h2>Подтверждение забора заявки №<?php echo htmlspecialchars($pickup_id); ?></h2>
    <p>Адрес забора: <?php echo htmlspecialchars($pickup['address']); ?></p>
    <?php if (!empty($pickup['courier_verified'])): ?>
        <p>QR‑код уже был подтверждён.</p>
    <?php else: ?>
        <?php if (!empty($msg) && !$isAjax && !$isJson): ?>
            <p class="error"><?php echo htmlspecialchars($msg); ?></p>
        <?php endif; ?>
        <form method="post" action="">
            <input type="hidden" name="pickup_id" value="<?php echo htmlspecialchars($pickup_id); ?>">
            <label for="qr_code">Сканируйте QR‑код и введите его значение:</label><br>
            <input type="text" name="qr_code" id="qr_code" required><br><br>
            <button type="submit">Подтвердить забор</button>
        </form>
    <?php endif; ?>
</body>
</html>