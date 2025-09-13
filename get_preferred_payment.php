<?php
require_once 'session_init.php';
session_start();
header('Content-Type: application/json; charset=utf-8');
require_once 'db_connection.php';

if (!isset($_SESSION['user_id'])) {
    echo json_encode(['success' => false, 'message' => 'Пользователь не авторизован']);
    exit;
}

$input = file_get_contents('php://input');
$data = json_decode($input, true);
$orderId = intval($data['order_id'] ?? $_POST['order_id'] ?? 0);
if (!$orderId) {
    echo json_encode(['success' => false, 'message' => 'Некорректный order_id']);
    exit;
}

$stmt = $conn->prepare("SELECT payment_type, payment FROM order_reception_details WHERE order_id = ?");
if (!$stmt) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Ошибка подготовки запроса']);
    exit;
}
$stmt->bind_param("i", $orderId);
$stmt->execute();
$res = $stmt->get_result();
$info = $res->fetch_assoc();
$stmt->close();

if ($info && ($info['payment_type'] !== null || $info['payment'] !== null)) {
    $conn->close();
    echo json_encode([
        'success' => true,
        'payment_type' => $info['payment_type'],
        'payment' => $info['payment'] !== null ? floatval($info['payment']) : null
    ]);
    exit;
}

$stmt = $conn->prepare("SELECT payment_type, payment FROM shipments WHERE order_id = ?");
if (!$stmt) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Ошибка подготовки запроса']);
    exit;
}
$stmt->bind_param("i", $orderId);
$stmt->execute();
$res = $stmt->get_result();
$info = $res->fetch_assoc();
$stmt->close();
$infoFound = $info && ($info['payment_type'] !== null || $info['payment'] !== null);

if ($infoFound) {
    $conn->close();
    echo json_encode([
        'success' => true,
        'payment_type' => $info['payment_type'],
        'payment' => $info['payment'] !== null ? floatval($info['payment']) : null
    ]);
    exit;
}

$stmt = $conn->prepare("SELECT payment_amount FROM order_reception_confirmations WHERE order_id = ?");
if (!$stmt) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Ошибка подготовки запроса']);
    exit;
}
$stmt->bind_param("i", $orderId);
$stmt->execute();
$res = $stmt->get_result();
$info = $res->fetch_assoc();
$stmt->close();
$conn->close();

if ($info && $info['payment_amount'] !== null) {
    echo json_encode([
        'success' => true,
        'payment_type' => null,
        'payment' => floatval($info['payment_amount'])
    ]);
} else {
    echo json_encode(['success' => false]);
}
