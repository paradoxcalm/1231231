<?php
header('Content-Type: application/json; charset=utf-8');
require_once 'db_connection.php';

$city = trim($_GET['city'] ?? '');
$paymentType = trim($_GET['payment_type'] ?? '');

if ($city !== '' && $paymentType !== '') {
    $stmt = $conn->prepare("SELECT * FROM shipments WHERE city = ? AND payment_type = ? ORDER BY id DESC");
    if (!$stmt) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Ошибка подготовки запроса']);
        exit;
    }
    $stmt->bind_param('ss', $city, $paymentType);
} elseif ($city !== '') {
    $stmt = $conn->prepare("SELECT * FROM shipments WHERE city = ? ORDER BY id DESC");
    if (!$stmt) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Ошибка подготовки запроса']);
        exit;
    }
    $stmt->bind_param('s', $city);
} elseif ($paymentType !== '') {
    $stmt = $conn->prepare("SELECT * FROM shipments WHERE payment_type = ? ORDER BY id DESC");
    if (!$stmt) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Ошибка подготовки запроса']);
        exit;
    }
    $stmt->bind_param('s', $paymentType);
} else {
    $stmt = $conn->prepare("SELECT * FROM shipments ORDER BY id DESC");
    if (!$stmt) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Ошибка подготовки запроса']);
        exit;
    }
}

$stmt->execute();
$result = $stmt->get_result();
$data = [];

while ($row = $result->fetch_assoc()) {
    // декодируем JSON-массив путей
    $paths = json_decode($row['photo_path'] ?? '[]', true);
    if (!is_array($paths)) $paths = [];

    // нормируем каждый путь, чтобы начинался с "/"
    $normalized = array_map(function($p){
        return '/' . ltrim($p, '/');
    }, $paths);

    // первая картинка для мини-превью
    $thumb = count($normalized) ? $normalized[0] : null;

    // кладём их в два новых поля
    $row['photo_paths'] = $normalized;
    $row['photo_thumb'] = $thumb;

    // старое поле больше не нужно
    unset($row['photo_path']);

    $data[] = $row;
}

$stmt->close();
$conn->close();

echo json_encode($data);