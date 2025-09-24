<?php
require_once 'auth_helper.php';
require_once 'print_config.php';

requireLogin();
requireRole(['admin', 'manager']);

header('Content-Type: application/json; charset=utf-8');

$serviceUrl = rtrim(PRINT_SERVICE_URL, '/');
$type = $_POST['type'] ?? '';

try {
    if ($type === 'file') {
        if (!isset($_FILES['file']) || $_FILES['file']['error'] !== UPLOAD_ERR_OK) {
            throw new Exception('Файл не загружен');
        }
        $ch = curl_init($serviceUrl . '/print/file');
        $cfile = new CURLFile($_FILES['file']['tmp_name'], 'application/pdf', $_FILES['file']['name']);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, ['file' => $cfile]);
    } elseif ($type === 'text') {
        $text = trim($_POST['text'] ?? '');
        if ($text === '') {
            throw new Exception('Текст пустой');
        }
        $payload = [
            'text' => $text,
        ];
        if (isset($_POST['encoding']) && $_POST['encoding'] !== '') {
            $payload['encoding'] = $_POST['encoding'];
        }
        if (isset($_POST['cut']) && $_POST['cut'] !== '') {
            $payload['cut'] = $_POST['cut'];
        }
        $ch = curl_init($serviceUrl . '/print/text');
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, $payload);
    } else {
        throw new Exception('Некорректный тип запроса');
    }

    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, PRINT_SERVICE_TIMEOUT);
    curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 5);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'X-Auth-Token: ' . PRINT_SERVICE_TOKEN,
    ]);
    $response = curl_exec($ch);
    if ($response === false) {
        throw new Exception(curl_error($ch));
    }
    $statusCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($statusCode < 200 || $statusCode >= 300) {
        $message = "Сервер печати вернул код {$statusCode}";
        if ($statusCode === 401 || $statusCode === 403) {
            $message = 'Не удалось авторизоваться на сервере печати';
        }
        throw new Exception($message);
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