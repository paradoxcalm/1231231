<?php
// driver_bot.php
// -------------------------------------------------------------
// Telegram Driver Bot Webhook — driver registration and route selection (with route execution enhancements)
// -------------------------------------------------------------
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/db_connection.php';
require_once __DIR__ . '/notify_user.php';

// Bot token and API URL
$botToken = TG_DRIVER_TOKEN;
$apiUrl   = "https://api.telegram.org/bot{$botToken}/";

// === INITIALIZATION: Ensure required DB schema ===
// Ensure driver_route_sequence table exists (for selecting routes and storing route sequences)
$conn->query("
    CREATE TABLE IF NOT EXISTS driver_route_sequence (
      chat_id INT NOT NULL,
      schedule_id INT NOT NULL,
      sequence TEXT,
      PRIMARY KEY(chat_id, schedule_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
");
// Ensure driver_registration table exists (for multi-step registration flow)
$conn->query("
    CREATE TABLE IF NOT EXISTS driver_registration (
      chat_id BIGINT NOT NULL,
      step TINYINT NOT NULL,
      fio VARCHAR(255) DEFAULT NULL,
      phone VARCHAR(50) DEFAULT NULL,
      car_number VARCHAR(50) DEFAULT NULL,
      car_brand VARCHAR(50) DEFAULT NULL,
      PRIMARY KEY (chat_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
");
// Ensure telegram_drivers table has new columns driver_phone and car_brand (for storing registration info)
$colCheck = $conn->query("SHOW COLUMNS FROM telegram_drivers LIKE 'driver_phone'");
if ($colCheck && $colCheck->num_rows === 0) {
    $conn->query("ALTER TABLE telegram_drivers ADD COLUMN driver_phone VARCHAR(255) DEFAULT NULL");
}
$colCheck = $conn->query("SHOW COLUMNS FROM telegram_drivers LIKE 'car_brand'");
if ($colCheck && $colCheck->num_rows === 0) {
    $conn->query("ALTER TABLE telegram_drivers ADD COLUMN car_brand VARCHAR(255) DEFAULT NULL");
}

// === HELPERS ===

// Logging function to file
function logMsg(string $txt): void {
    file_put_contents(__DIR__ . '/driver_bot.log',
        date('Y-m-d H:i:s') . " | {$txt}\n",
        FILE_APPEND
    );
}

// Make a Telegram API call via cURL (with logging of request/response)
function callTelegram(string $method, array $params): void {
    global $apiUrl;
    $ch = curl_init("{$apiUrl}{$method}");
    curl_setopt_array($ch, [
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => $params,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HEADER         => true,
        CURLOPT_CONNECTTIMEOUT => 5,
        CURLOPT_TIMEOUT        => 10,
        CURLOPT_SSL_VERIFYPEER => true,
        CURLINFO_HEADER_OUT    => true,
    ]);
    $fullResponse = curl_exec($ch);
    if (curl_errno($ch)) {
        logMsg("cURL error on {$method}: " . curl_error($ch));
    } else {
        $info       = curl_getinfo($ch);
        $headerSize = $info['header_size'];
        $requestHdr = $info['request_header'] ?? '';
        $responseHdr= substr($fullResponse, 0, $headerSize);
        $body       = substr($fullResponse, $headerSize);

        logMsg("→ {$method} HTTP status: {$info['http_code']}");
        logMsg("→ {$method} REQUEST headers:\n" . trim($requestHdr));
        logMsg("→ {$method} RESPONSE headers:\n" . trim($responseHdr));
        logMsg("→ {$method} RESPONSE body: " . trim($body));
    }
    curl_close($ch);
}

// Send a message to the chat (optionally with reply_markup)
function sendMsg(int $chatId, string $text, array $markup = null): void {
    logMsg("→ sendMessage REQUEST: chat_id={$chatId}, text=" . str_replace("\n", "\\n", $text)
           . ($markup ? ", markup=" . json_encode($markup, JSON_UNESCAPED_UNICODE) : ""));
    $data = [
        'chat_id'    => $chatId,
        'text'       => $text,
        'parse_mode' => 'HTML',
    ];
    if ($markup !== null) {
        $data['reply_markup'] = json_encode($markup, JSON_UNESCAPED_UNICODE);
    }
    callTelegram('sendMessage', $data);
}

// Edit an existing message (update text and/or markup)
function editMessage(int $chatId, int $messageId, string $text, array $markup = null): void {
    logMsg("→ editMessageText REQUEST: chat_id={$chatId}, message_id={$messageId}, text=" . str_replace("\n", "\\n", $text));
    $data = [
        'chat_id'    => $chatId,
        'message_id' => $messageId,
        'text'       => $text,
        'parse_mode' => 'HTML',
    ];
    if ($markup !== null) {
        $data['reply_markup'] = json_encode($markup, JSON_UNESCAPED_UNICODE);
    }
    callTelegram('editMessageText', $data);
}

// Fetch driver info (if registered) from telegram_drivers by chat_id
function getDriver(int $chatId): ?array {
    global $conn;
    $st = $conn->prepare("
        SELECT driver_name, driver_phone, car_number, car_brand
        FROM telegram_drivers
        WHERE chat_id = ?
    ");
    if (!$st) {
        logMsg("DB ERROR (getDriver prepare failed): " . $conn->error);
        return null;
    }
    $st->bind_param('i', $chatId);
    $st->execute();
    $drv = $st->get_result()->fetch_assoc();
    $st->close();
    return $drv ?: null;
}

// Fetch multi-step registration progress for this chat_id (from driver_registration)
function getRegistration(int $chatId): ?array {
    global $conn;
    $st = $conn->prepare("
        SELECT step, fio, phone, car_number, car_brand
        FROM driver_registration
        WHERE chat_id = ?
    ");
    if (!$st) {
        logMsg("DB ERROR (getRegistration prepare failed): " . $conn->error);
        return null;
    }
    $st->bind_param('i', $chatId);
    $st->execute();
    $reg = $st->get_result()->fetch_assoc();
    $st->close();
    return $reg ?: null;
}

// Show menu of available delivery dates for shipments (inline keyboard of dates)
function showDatesMenu(int $chatId): void {
    global $conn;
    $res = $conn->query("
        SELECT DISTINCT DATE(accept_date) AS dt
        FROM schedules
        WHERE accept_date >= CURDATE()
        ORDER BY dt
    ");
    $kb = [];
    while ($r = $res->fetch_assoc()) {
        $date = $r['dt'];
        $kb[][] = [
            'text'          => date('d.m.Y', strtotime($date)),
            'callback_data' => "date_{$date}"
        ];
    }
    sendMsg(
        $chatId,
        empty($kb) ? "ℹ️ Нет запланированных отправлений." : "📅 Выберите дату отправления:",
        ['inline_keyboard' => $kb]
    );
}

// Show list of shipments (schedules) for a chosen date, with selection toggles (inline)
function showDatesMenuCallback(int $chatId, int $messageId, string $date): void {
    global $conn;
    // Fetch all shipments on that date
    $st = $conn->prepare("
        SELECT id, warehouses
        FROM schedules
        WHERE DATE(delivery_date) = ?
    ");
    $st->bind_param('s', $date);
    $st->execute();
    $rows = $st->get_result()->fetch_all(MYSQLI_ASSOC);
    $st->close();
    // Fetch any already selected shipments (for toggling state) for this driver
    $selRes = $conn->prepare("
        SELECT schedule_id FROM driver_route_sequence
        WHERE chat_id = ?
    ");
    $selRes->bind_param('i', $chatId);
    $selRes->execute();
    $selRows = $selRes->get_result()->fetch_all(MYSQLI_ASSOC);
    $selRes->close();
    $selected = array_column($selRows, 'schedule_id');
    // Build inline keyboard: each shipment as a button (⭕ or ✅ + warehouses names)
    $kb = [];
    foreach ($rows as $r) {
        $mark = in_array($r['id'], $selected) ? '✅' : '⭕';
        $kb[][] = [
            'text' => "{$mark} " . $r['warehouses'],
            'callback_data' => "toggle_{$date};{$r['id']}"
        ];
    }
    // Add confirmation button at the end
    $kb[][] = [
        'text' => '✅ Подтвердить',
        'callback_data' => "confirm_{$date}"
    ];
    editMessage(
        $chatId,
        $messageId,
        "🚚 Отправления на <b>" . date('d.m.Y', strtotime($date)) . "</b>:\n(выберите одно или несколько)",
        ['inline_keyboard' => $kb]
    );
}

// === MAIN LOGIC ===

// Read incoming update and decode JSON
$raw = file_get_contents('php://input');
logMsg("RAW: {$raw}");
$update = json_decode($raw, true);
logMsg("UPDATE: " . json_encode($update, JSON_UNESCAPED_UNICODE));
if (!$update) {
    $conn->close();
    exit;
}

// --- Handle callback queries (button presses) ---
if (!empty($update['callback_query'])) {
    $cb    = $update['callback_query'];
    $cId   = (int)$cb['message']['chat']['id'];
    $msgId = $cb['message']['message_id'];
    $data  = $cb['data'];
    logMsg("CB {$cId}: {$data}");

    // Date selected from calendar
    if (preg_match('/^date_(\d{4}-\d{2}-\d{2})$/', $data, $m)) {
        $date = $m[1];
        // Reset any previous selection data for this chat (start fresh for this date)
        $conn->query("DELETE FROM driver_route_sequence WHERE chat_id={$cId}");
        // Show shipments on that date
        showDatesMenuCallback($cId, $msgId, $date);
        $conn->close();
        exit;
    }

    // Toggle selection of a specific shipment (add or remove)
    if (preg_match('/^toggle_(\d{4}-\d{2}-\d{2});(\d+)$/', $data, $m)) {
        $date = $m[1];
        $sid  = (int)$m[2];
        // Check if already selected
        $st = $conn->prepare("
            SELECT 1 FROM driver_route_sequence
            WHERE chat_id = ? AND schedule_id = ?
        ");
        $st->bind_param('ii', $cId, $sid);
        $st->execute();
        $exists = (bool)$st->get_result()->fetch_assoc();
        $st->close();
        if ($exists) {
            // Already selected: remove it
            $conn->query("DELETE FROM driver_route_sequence WHERE chat_id={$cId} AND schedule_id={$sid}");
        } else {
            // Not selected yet: add it
            $conn->query("INSERT INTO driver_route_sequence(chat_id, schedule_id) VALUES({$cId}, {$sid})");
        }
        // Update the list (refresh inline keyboard to reflect changes)
        showDatesMenuCallback($cId, $msgId, $date);
        $conn->close();
        exit;
    }

    // Confirmation of selected shipments for a date
    if (preg_match('/^confirm_(\d{4}-\d{2}-\d{2})$/', $data, $m)) {
        $date = $m[1];
        // Get all selected schedule IDs for this driver
        $sel = $conn->prepare("
            SELECT schedule_id FROM driver_route_sequence
            WHERE chat_id = ?
        ");
        $sel->bind_param('i', $cId);
        $sel->execute();
        $ids = array_column($sel->get_result()->fetch_all(MYSQLI_ASSOC), 'schedule_id');
        $sel->close();
        $drv = getDriver($cId);
        if (!$drv) {
            // No driver info (should not happen if already registered)
            $conn->close();
            exit;
        }
        if (count($ids) === 0) {
            // No shipments were selected -> inform and reset to date menu
            editMessage($cId, $msgId, "⚠️ Вы не выбрали ни одного отправления.", []);
            showDatesMenu($cId);
            $conn->close();
            exit;
        }
        // Assign driver info to all selected schedules (driver takes these shipments)
        if (count($ids) > 0) {
            $upd = $conn->prepare("
                UPDATE schedules
                SET driver_name = ?, driver_phone = ?, car_number = ?, car_brand = ?
                WHERE id = ?
            ");
            foreach ($ids as $sid) {
                $upd->bind_param('ssssi',
                    $drv['driver_name'], $drv['driver_phone'],
                    $drv['car_number'], $drv['car_brand'], $sid
                );
                $upd->execute();
            }
            $upd->close();
        }
        // Retrieve warehouses list for each selected schedule to present to driver
        $idListStr = implode(',', array_map('intval', $ids));
        $res = $conn->query("SELECT id, warehouses FROM schedules WHERE id IN ($idListStr) ORDER BY FIELD(id, $idListStr)");
        $schedList = $res->fetch_all(MYSQLI_ASSOC);
        $shipmentsLines = [];  // list of selected shipments (warehouses) for confirmation message
        $stops = [];           // aggregated list of all stops (warehouses) across selected shipments
        foreach ($schedList as $row) {
            $wh = $row['warehouses'];
            $shipmentsLines[] = "- " . $wh;
            // Split the warehouses string by comma/semicolon/slash into individual stops
            $parts = preg_split('/[\/;,]+/', $wh);
            foreach ($parts as $p) {
                $p = trim($p);
                if ($p !== "") {
                    $stops[] = $p;
                }
            }
        }
        // Prepare route data structure for this driver (to store sequence and progress)
        $routeInfo = [
            "schedules" => $ids,
            "shipments" => $shipmentsLines
        ];
        if (count($stops) > 1) {
            // Multiple stops: will need to pick sequence
            $routeInfo["remaining"] = $stops;
            $routeInfo["ordered"] = [];
        } else {
            // Single stop: sequence is trivial (itself)
            $routeInfo["ordered"] = $stops;
        }
        // Store initial route info in DB (schedule_id=0 entry for this chat)
        $routeJson = $conn->real_escape_string(json_encode($routeInfo, JSON_UNESCAPED_UNICODE));
        $conn->query("INSERT INTO driver_route_sequence(chat_id, schedule_id, sequence) 
                      VALUES({$cId}, 0, '{$routeJson}') 
                      ON DUPLICATE KEY UPDATE sequence='{$routeJson}'");
        if (count($stops) > 1) {
            // More than one stop: ask driver to choose order of warehouses
            $kb = [];
            foreach ($stops as $idx => $stopName) {
                $kb[][] = ['text' => $stopName, 'callback_data' => "seq_{$idx}"];
            }
            $text = "✅ Вы выбрали отправления:\n" . implode("\n", $shipmentsLines) . "\nВыберите первый склад для посещения:";
            editMessage($cId, $msgId, $text, ['inline_keyboard' => $kb]);
            // Update routeInfo with message_id now (for reference in later steps)
            $routeInfo["message_id"] = $msgId;
            $routeJson = $conn->real_escape_string(json_encode($routeInfo, JSON_UNESCAPED_UNICODE));
            $conn->query("UPDATE driver_route_sequence SET sequence='{$routeJson}' WHERE chat_id={$cId} AND schedule_id=0");
            $conn->close();
            exit;
        } else {
            // Only one stop in route: skip sequence selection, go straight to route start
            $singleStop = $stops[0];
            $kb = [
                [ ['text' => 'В пути', 'callback_data' => 'start'] ],
                [ ['text' => 'Нажал случайно', 'callback_data' => 'cancel'] ]
            ];
            $text = "✅ Вы выбрали отправление:\n" . implode("\n", $shipmentsLines) . "\nТеперь нажмите <b>«В пути»</b>, чтобы начать маршрут.";
            editMessage($cId, $msgId, $text, ['inline_keyboard' => $kb]);
            // Update routeInfo with message_id and initialize route progress fields
            $routeInfo["message_id"] = $msgId;
            $routeInfo["current_index"] = 0;
            $routeInfo["gates"] = [];
            $routeInfo["expecting_gate"] = false;
            $routeJson = $conn->real_escape_string(json_encode($routeInfo, JSON_UNESCAPED_UNICODE));
            $conn->query("UPDATE driver_route_sequence SET sequence='{$routeJson}' WHERE chat_id={$cId} AND schedule_id=0");
            $conn->close();
            exit;
        }
    }

    // Handle selection of a warehouse in route sequence (driver picked next stop order)
    if (preg_match('/^seq_(\d+)$/', $data, $m)) {
        $choice = (int)$m[1];
        // Retrieve current route data
        $res = $conn->query("SELECT sequence FROM driver_route_sequence WHERE chat_id={$cId} AND schedule_id=0");
        $route = $res ? $res->fetch_assoc() : null;
        if (!$route) { $conn->close(); exit; }
        $routeData = json_decode($route['sequence'], true);
        $remaining = $routeData['remaining'] ?? [];
        $ordered = $routeData['ordered'] ?? [];
        if (!isset($remaining[$choice])) {
            // Invalid choice (should not happen normally)
            $conn->close();
            exit;
        }
        // Choose the stop and remove it from remaining
        $chosenStop = $remaining[$choice];
        array_splice($remaining, $choice, 1);
        $ordered[] = $chosenStop;
        if (count($remaining) > 1) {
            // More stops still remaining, continue sequence selection
            $routeData['remaining'] = $remaining;
            $routeData['ordered'] = $ordered;
            $seqJson = $conn->real_escape_string(json_encode($routeData, JSON_UNESCAPED_UNICODE));
            $conn->query("UPDATE driver_route_sequence SET sequence='{$seqJson}' WHERE chat_id={$cId} AND schedule_id=0");
            // Build inline keyboard for next choice
            $kb = [];
            foreach ($remaining as $idx => $stopName) {
                $kb[][] = ['text' => $stopName, 'callback_data' => "seq_{$idx}"];
            }
            $prompt = "Выберите следующий склад для посещения:";
            $shipmentsLines = $routeData['shipments'] ?? [];
            $text = "✅ Вы выбрали отправления:\n" . implode("\n", $shipmentsLines) . "\n{$prompt}";
            editMessage($cId, $msgId, $text, ['inline_keyboard' => $kb]);
            $conn->close();
            exit;
        } else {
            // Sequence selection complete (0 or 1 remaining stops left)
            if (count($remaining) === 1) {
                // Append last remaining stop
                $ordered[] = $remaining[0];
            }
            // Finalize route order
            $routeData['ordered'] = $ordered;
            $routeData['remaining'] = [];
            $routeData['current_index'] = 0;
            $routeData['gates'] = [];
            $routeData['expecting_gate'] = false;
            $seqJson = $conn->real_escape_string(json_encode($routeData, JSON_UNESCAPED_UNICODE));
            $conn->query("UPDATE driver_route_sequence SET sequence='{$seqJson}' WHERE chat_id={$cId} AND schedule_id=0");
            // Show start route option
            $kb = [
                [ ['text' => 'В пути', 'callback_data' => 'start'] ],
                [ ['text' => 'Нажал случайно', 'callback_data' => 'cancel'] ]
            ];
            $orderStr = implode(" -> ", $ordered);
            $text = "✅ Последовательность складов задана: {$orderStr}.\nНажмите «В пути», когда будете готовы начать маршрут.";
            editMessage($cId, $msgId, $text, ['inline_keyboard' => $kb]);
            $conn->close();
            exit;
        }
    }

    // "В пути" pressed – start the route
    if ($data === 'start') {
        // Get route data
        $res = $conn->query("SELECT sequence FROM driver_route_sequence WHERE chat_id={$cId} AND schedule_id=0");
        $route = $res ? $res->fetch_assoc() : null;
        if (!$route) { $conn->close(); exit; }
        $routeData = json_decode($route['sequence'], true);
        // Update statuses of all involved schedules to "В пути"
        $ids = $routeData['schedules'] ?? [];
        if (!empty($ids)) {
            $idList = implode(',', array_map('intval', $ids));
            $conn->query("UPDATE schedules SET status='В пути' WHERE id IN ({$idList})");
            // Log event in order history for each order of these schedules
            foreach ($ids as $sid) {
                $ordersRes = $conn->query("SELECT order_id FROM orders WHERE schedule_id={$sid} AND is_deleted=0 AND status<>'Удалён клиентом'");
                while ($ord = $ordersRes->fetch_assoc()) {
                    $oid = (int)$ord['order_id'];
                    $msg = "Отправка началась. Ваш заказ в пути.";
                    $conn->query("INSERT INTO order_history (order_id, status_change, changed_by) VALUES ({$oid}, '{$conn->real_escape_string($msg)}', 'system')");
                }
            }
        }
        // Initialize route progress tracking
        $routeData['current_index'] = 0;
        $routeData['gates'] = [];
        $routeData['expecting_gate'] = false;
        $seqJson = $conn->real_escape_string(json_encode($routeData, JSON_UNESCAPED_UNICODE));
        $conn->query("UPDATE driver_route_sequence SET sequence='{$seqJson}' WHERE chat_id={$cId} AND schedule_id=0");
        // Show first stop with "На складе" and cancel options
        $stops = $routeData['ordered'] ?? [];
        $currentStop = $stops[0] ?? '';
        $kb = [
            [ ['text' => 'На складе', 'callback_data' => 'arrive'] ],
            [ ['text' => 'Нажал случайно', 'callback_data' => 'cancel'] ]
        ];
        $text = "🚚 Вы выехали.\n📍 {$currentStop}";
        editMessage($cId, $msgId, $text, ['inline_keyboard' => $kb]);
        $conn->close();
        exit;
    }

    // "На складе" pressed – arrived at current warehouse
    if ($data === 'arrive') {
        // Retrieve route data
        $res = $conn->query("SELECT sequence FROM driver_route_sequence WHERE chat_id={$cId} AND schedule_id=0");
        $route = $res ? $res->fetch_assoc() : null;
        if (!$route) { $conn->close(); exit; }
        $routeData = json_decode($route['sequence'], true);
        $currentIndex = $routeData['current_index'] ?? 0;
        $stops = $routeData['ordered'] ?? [];
        if (!isset($stops[$currentIndex])) {
            // Safety check
            $conn->close();
            exit;
        }
        // Set flag expecting gate number input
        $routeData['expecting_gate'] = true;
        $seqJson = $conn->real_escape_string(json_encode($routeData, JSON_UNESCAPED_UNICODE));
        $conn->query("UPDATE driver_route_sequence SET sequence='{$seqJson}' WHERE chat_id={$cId} AND schedule_id=0");
        // Remove inline buttons (to prevent duplicate presses) and prompt for gate
        editMessage($cId, $msgId, "📍 {$stops[$currentIndex]}\n⌛ Ожидается номер ворот...", []);
        sendMsg($cId, "↳ Введите номер ворот на складе <b>{$stops[$currentIndex]}</b>:");
        $conn->close();
        exit;
    }

    // "Нажал случайно" pressed – cancel route and revert statuses
    if ($data === 'cancel') {
        // Load route data if exists
        $res = $conn->query("SELECT sequence FROM driver_route_sequence WHERE chat_id={$cId} AND schedule_id=0");
        $route = $res ? $res->fetch_assoc() : null;
        $schedules = [];
        if ($route) {
            $routeData = json_decode($route['sequence'], true);
            $schedules = $routeData['schedules'] ?? [];
        }
        // Revert schedules status back to "Ожидает отправки"
        if (!empty($schedules)) {
            $idList = implode(',', array_map('intval', $schedules));
            $conn->query("UPDATE schedules SET status='Ожидает отправки' WHERE id IN ({$idList})");
        }
        // Clear route sequence data for this driver (cancel the route)
        $conn->query("DELETE FROM driver_route_sequence WHERE chat_id={$cId} AND schedule_id=0");
        // Inform driver and return to date selection
        editMessage($cId, $msgId, "🚫 Маршрут отменён. Статусы отправлений сброшены в «ожидание».", []);
        showDatesMenu($cId);
        $conn->close();
        exit;
    }
} // end if callback_query

// --- Handle text messages (user input) ---
if (!empty($update['message'])) {
    $cId = (int)$update['message']['chat']['id'];
    $text = trim($update['message']['text'] ?? '');
    $txtLower = mb_strtolower($text, 'UTF-8');

    // Check if driver is already registered
    $drv = getDriver($cId);
    if (!$drv) {
        // Driver not registered: handle registration flow as before
        $reg = getRegistration($cId);
        if (!$reg) {
            // Start registration
            $conn->query("
                INSERT INTO driver_registration(chat_id, step)
                VALUES({$cId}, 1)
                ON DUPLICATE KEY UPDATE step = 1
            ");
            sendMsg($cId, '👋 Добро пожаловать! Введите ваше <b>ФИО</b>:');
            $conn->close();
            exit;
        }
        // Continue registration steps
        switch ($reg['step']) {
            case 1:
                // Save full name, ask for phone
                $fio = $conn->real_escape_string($text);
                $conn->query("
                    UPDATE driver_registration
                    SET fio = '{$fio}', step = 2
                    WHERE chat_id = {$cId}
                ");
                sendMsg($cId, '📱 Введите ваш <b>номер телефона</b>:');
                break;
            case 2:
                // Save phone, ask for car number
                $phone = $conn->real_escape_string($text);
                $conn->query("
                    UPDATE driver_registration
                    SET phone = '{$phone}', step = 3
                    WHERE chat_id = {$cId}
                ");
                sendMsg($cId, '🚗 Введите <b>номер машины</b>:');
                break;
            case 3:
                // Save car number, ask for car brand
                $car = $conn->real_escape_string($text);
                $conn->query("
                    UPDATE driver_registration
                    SET car_number = '{$car}', step = 4
                    WHERE chat_id = {$cId}
                ");
                sendMsg($cId, '🏷 Введите <b>марку машины</b>:');
                break;
            case 4:
                // Save car brand and complete registration
                $brand = $conn->real_escape_string($text);
                // Retrieve all collected info
                $row = getRegistration($cId);
                // Insert the new driver record
                $conn->query("
                    INSERT INTO telegram_drivers (chat_id, driver_name, driver_phone, car_number, car_brand)
                    VALUES (
                        {$cId},
                        '{$conn->real_escape_string($row['fio'])}',
                        '{$conn->real_escape_string($row['phone'])}',
                        '{$conn->real_escape_string($row['car_number'])}',
                        '{$conn->real_escape_string($brand)}'
                    )
                ");
                // Remove temporary registration data
                $conn->query("DELETE FROM driver_registration WHERE chat_id = {$cId}");
                // Confirm registration and show date menu
                sendMsg(
                    $cId,
                    "✅ Регистрация завершена, <b>{$row['fio']}</b>!\nТеперь выберите дату отправления:",
                    ['remove_keyboard' => true]
                );
                showDatesMenu($cId);
                break;
        }
        $conn->close();
        exit;
    }

    // Driver is registered - first, check if we are expecting a gate number input
    $routeRes = $conn->query("SELECT sequence FROM driver_route_sequence WHERE chat_id={$cId} AND schedule_id=0");
    if ($routeRes && $routeRow = $routeRes->fetch_assoc()) {
        $routeData = json_decode($routeRow['sequence'], true);
        if (!empty($routeData['expecting_gate'])) {
            // This text message is considered a gate number for the current warehouse
            $gate = trim($text);
            $currentIndex = $routeData['current_index'] ?? 0;
            $stopsList = $routeData['ordered'] ?? [];
            if (isset($stopsList[$currentIndex])) {
                // Record the gate number and mark this stop as completed
                $routeData['gates'][$currentIndex] = $gate;
                $routeData['current_index'] = $currentIndex + 1;
                $routeData['expecting_gate'] = false;
                // Update route data in DB
                $seqJson = $conn->real_escape_string(json_encode($routeData, JSON_UNESCAPED_UNICODE));
                $conn->query("UPDATE driver_route_sequence SET sequence='{$seqJson}' WHERE chat_id={$cId} AND schedule_id=0");
                // Prepare updated status message text for the route
                $doneCount = $routeData['current_index'];       // number of stops completed
                $totalCount = count($stopsList);               // total number of stops
                $lines = [];
                if ($doneCount < $totalCount) {
                    // Route still ongoing
                    $lines[] = "🚚 Маршрут в пути:";
                }
                // List all completed stops with check mark and gate info
                for ($i = 0; $i < $doneCount; $i++) {
                    $stopName = $stopsList[$i];
                    $gateNum = $routeData['gates'][$i] ?? '';
                    $gateInfo = $gateNum !== '' ? " (ворота {$gateNum})" : "";
                    $lines[] = "✅ {$stopName}{$gateInfo}";
                }
                if ($doneCount < $totalCount) {
                    // Next stop is upcoming
                    $nextStop = $stopsList[$doneCount];
                    $lines[] = "📍 {$nextStop}";
                } else {
                    // All stops done
                    $lines[] = "🏁 Маршрут завершён.";
                }
                $newText = implode("\n", $lines);
                // Determine the appropriate inline keyboard for the updated message
                $markup = null;
                if ($doneCount < $totalCount) {
                    // There are stops left - show "На складе" button for next stop
                    $markup = ['inline_keyboard' => [ [ ['text' => 'На складе', 'callback_data' => 'arrive'] ] ]];
                } else {
                    // Route completed - remove inline buttons
                    $markup = ['inline_keyboard' => []];
                    // Clean up route data (no longer needed after completion)
                    $conn->query("DELETE FROM driver_route_sequence WHERE chat_id={$cId} AND schedule_id=0");
                }
                // Edit the original message (route status panel) with the updated text and markup
                $mainMsgId = $routeData['message_id'] ?? 0;
                if ($mainMsgId) {
                    editMessage($cId, $mainMsgId, $newText, $markup);
                }
            }
            $conn->close();
            exit;
        }
    }

    // If not expecting gate and no special case, handle standard commands:
    if (mb_stripos($text, '/start') === 0 || $txtLower === 'старт') {
        // Welcome back message with driver info and prompt for date
        sendMsg(
            $cId,
            "👋 Вы: <b>{$drv['driver_name']}</b>\n🚗 <b>{$drv['car_brand']} {$drv['car_number']}</b>\n\nВыберите дату отправления:",
            ['remove_keyboard' => true]
        );
        showDatesMenu($cId);
        $conn->close();
        exit;
    }

    if ($txtLower === 'сменить водителя') {
        // Unlink current driver and reset registration
        $conn->query("DELETE FROM telegram_drivers WHERE chat_id = {$cId}");
        sendMsg(
            $cId,
            "🔄 Привязка сброшена. Отправьте /start для новой регистрации.",
            ['remove_keyboard' => true]
        );
        $conn->close();
        exit;
    }

    // Any other input that is not recognized as a command
    sendMsg($cId, "❓ Неизвестная команда. Введите /start для начала.");
    $conn->close();
    exit;
}

// Close DB connection and exit (for any unhandled cases)
$conn->close();
?>
