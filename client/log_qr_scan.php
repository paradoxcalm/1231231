<?php
// log_qr_scan.php
$logDir = __DIR__ . '/logs';
$logFile = $logDir . '/qr_scan_log.txt';

if (!is_dir($logDir)) {
    mkdir($logDir, 0777, true);
}

$data = json_decode(file_get_contents("php://input"), true);
$event = $data['event'] ?? 'UNKNOWN';
$details = $data['details'] ?? [];

$line = "[" . date("Y-m-d H:i:s") . "] $event | " . json_encode($details, JSON_UNESCAPED_UNICODE) . PHP_EOL;
file_put_contents($logFile, $line, FILE_APPEND);
http_response_code(204);
