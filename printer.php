<?php
require_once 'auth_helper.php';
requireLogin();
requireRole(['admin', 'manager']);

header('Content-Type: application/json; charset=utf-8');

$serviceUrl = 'http://localhost:5000/print';
$type = $_POST['type'] ?? '';

try {
    if ($type === 'file') {
        if (!isset($_FILES['file']) || $_FILES['file']['error'] !== UPLOAD_ERR_OK) {
            throw new Exception('Файл не загружен');
        }
        $ch = curl_init($serviceUrl . '/file');
        $cfile = new CURLFile($_FILES['file']['tmp_name'], 'application/pdf', $_FILES['file']['name']);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, ['file' => $cfile]);
    } elseif ($type === 'text') {
        $text = trim($_POST['text'] ?? '');
        if ($text === '') {
            throw new Exception('Текст пустой');
        }
        $ch = curl_init($serviceUrl . '/text');
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, ['text' => $text]);
    } else {
        throw new Exception('Некорректный тип запроса');
    }

    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    $response = curl_exec($ch);
    if ($response === false) {
        throw new Exception(curl_error($ch));
    }
    $statusCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($statusCode !== 200) {
        throw new Exception('Сервер печати вернул ошибку');
    }

    $data = json_decode($response, true);
    if (!$data) {
        throw new Exception('Некорректный ответ сервера печати');
    }

    echo json_encode([
        'success' => !empty($data['success']),
        'message' => $data['message'] ?? ''
    ]);
} catch (Exception $e) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'message' => $e->getMessage()
    ]);
}