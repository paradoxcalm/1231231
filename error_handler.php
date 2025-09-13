<?php
// error_handler.php
// ------------------
// Глобальная обработка ошибок для логирования сообщений,
// параметров запроса и стека вызовов с ротацией логов.

$__logFile = __DIR__ . '/php-error.log';
$__maxLogSize = 5 * 1024 * 1024; // 5 MB

ini_set('display_errors', 0);
ini_set('log_errors', 1);
ini_set('error_log', $__logFile);

/**
 * Выполняет ротацию логов, если файл превысил допустимый размер.
 */
function __rotateLog(string $file, int $maxSize): void {
    if (file_exists($file) && filesize($file) >= $maxSize) {
        $timestamp = date('Ymd_His');
        @rename($file, $file . '.' . $timestamp);
    }
}

/**
 * Записывает сообщение в лог с ротацией.
 */
function __logError(string $message): void {
    global $__logFile, $__maxLogSize;
    __rotateLog($__logFile, $__maxLogSize);
    error_log($message);
}

/**
 * Формирует данные запроса для логирования.
 */
function __requestData(): array {
    return [
        'method' => $_SERVER['REQUEST_METHOD'] ?? '',
        'params' => $_REQUEST ?? []
    ];
}

set_error_handler(function ($severity, $message, $file, $line) {
    $entry = [
        'type'    => 'error',
        'severity'=> $severity,
        'message' => $message,
        'file'    => $file,
        'line'    => $line,
        'request' => __requestData(),
        'stack'   => debug_backtrace(DEBUG_BACKTRACE_IGNORE_ARGS)
    ];
    __logError(json_encode($entry, JSON_UNESCAPED_UNICODE));
    return false; // Передаем обработку стандартному обработчику
});

set_exception_handler(function ($e) {
    $entry = [
        'type'    => 'exception',
        'message' => $e->getMessage(),
        'file'    => $e->getFile(),
        'line'    => $e->getLine(),
        'request' => __requestData(),
        'stack'   => $e->getTrace()
    ];
    __logError(json_encode($entry, JSON_UNESCAPED_UNICODE));
});

register_shutdown_function(function () {
    $error = error_get_last();
    if ($error !== null) {
        $entry = [
            'type'    => 'shutdown',
            'error'   => $error,
            'request' => __requestData()
        ];
        __logError(json_encode($entry, JSON_UNESCAPED_UNICODE));
    }
});
