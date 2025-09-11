<?php
// auth_bot.php
// -----------------------------
// Вебхук «авторизационного» бота: привязка аккаунта по токену
// -----------------------------

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/db_connection.php';

$botToken = TG_AUTH_TOKEN;
$apiUrl   = "https://api.telegram.org/bot{$botToken}/";

// Чтение «сырых» данных и логирование
$rawInput = file_get_contents('php://input');
file_put_contents(
    __DIR__ . '/auth_bot.log',
    date('Y-m-d H:i:s') . " RAW: " . $rawInput . PHP_EOL,
    FILE_APPEND
);

$update = json_decode($rawInput, true);
file_put_contents(
    __DIR__ . '/auth_bot.log',
    date('Y-m-d H:i:s') . " UPDATE: " . json_encode($update) . PHP_EOL,
    FILE_APPEND
);

if (json_last_error() !== JSON_ERROR_NONE) {
    file_put_contents(
        __DIR__ . '/auth_bot.log',
        date('Y-m-d H:i:s') . " JSON ERROR: " . json_last_error_msg() . PHP_EOL,
        FILE_APPEND
    );
    exit;
}
if (empty($update['message'])) {
    exit;
}

function logMessage(string $msg): void {
    file_put_contents(
        __DIR__ . '/auth_bot.log',
        date('Y-m-d H:i:s') . " LOG: " . $msg . PHP_EOL,
        FILE_APPEND
    );
}

function sendMessage(int $chatId, string $text): void {
    global $apiUrl;
    $data = [
        'chat_id'    => $chatId,
        'text'       => $text,
        'parse_mode' => 'HTML'
    ];
    file_get_contents($apiUrl . 'sendMessage?' . http_build_query($data));
    logMessage("→ {$chatId}: {$text}");
}

$chatId = (int)$update['message']['chat']['id'];
$text   = trim($update['message']['text'] ?? '');

// Обработка только /start <token>
if (preg_match('/^\/start\s+(.+)$/', $text, $m)) {
    $token = $m[1];
    logMessage("start-token: {$chatId} → {$token}");

    $stmt = $conn->prepare("
        SELECT user_id
          FROM telegram_link_tokens
         WHERE token = ?
         LIMIT 1
    ");
    $stmt->bind_param("s", $token);
    $stmt->execute();
    $link = $stmt->get_result()->fetch_assoc();
    $stmt->close();

    if ($link) {
        // Привязываем Telegram к пользователю
        $upd = $conn->prepare("
            UPDATE usersff
               SET telegram_id = ?
             WHERE id = ?
        ");
        $upd->bind_param("ii", $chatId, $link['user_id']);
        $upd->execute();
        $upd->close();

        // Удаляем токен
        $del = $conn->prepare("
            DELETE
              FROM telegram_link_tokens
             WHERE token = ?
        ");
        $del->bind_param("s", $token);
        $del->execute();
        $del->close();

        sendMessage($chatId, "✅ Ваш аккаунт успешно привязан.");
    } else {
        sendMessage($chatId, "❌ Неверный или просроченный токен.");
    }
}

$conn->close();
