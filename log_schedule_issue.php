<?php
declare(strict_types=1);

$rawInput = file_get_contents('php://input');
$data = null;

if ($rawInput !== false && $rawInput !== '') {
    $decoded = json_decode($rawInput, true);
    if (json_last_error() === JSON_ERROR_NONE) {
        $data = $decoded;
    } else {
        $data = ['raw' => $rawInput];
    }
}

if ($data === null) {
    $data = $_POST;
}

if (!is_array($data)) {
    $data = ['raw' => $rawInput];
}

$logDir = __DIR__ . '/logs';
$logFile = $logDir . '/mobile_schedule_debug.log';

if (!is_dir($logDir)) {
    mkdir($logDir, 0775, true);
}

$entry = [
    'timestamp' => date('c'),
    'ip' => $_SERVER['REMOTE_ADDR'] ?? '',
    'user_agent' => $_SERVER['HTTP_USER_AGENT'] ?? '',
    'payload' => $data
];

file_put_contents(
    $logFile,
    json_encode($entry, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . PHP_EOL,
    FILE_APPEND | LOCK_EX
);

http_response_code(204);
