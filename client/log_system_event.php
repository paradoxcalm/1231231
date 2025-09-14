<?php
// 📄 log_system_event.php
require_once 'db_connection.php';

function log_system_event($type, $message, $conn) {
    $stmt = $conn->prepare("INSERT INTO system_logs (type, message) VALUES (?, ?)");
    $stmt->bind_param("ss", $type, $message);
    $stmt->execute();
    $stmt->close();

    if ($type === 'error') {
        // Получаем всех админов
        $admins = $conn->query("SELECT id FROM usersff WHERE role = 'admin'");
        while ($row = $admins->fetch_assoc()) {
            $adminId = (int)$row['id'];
            $msg = "🚨 Ошибка: " . mb_substr($message, 0, 255);

            $notify = curl_init(__DIR__ . '/notify_user.php');
            curl_setopt_array($notify, [
                CURLOPT_POST => true,
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
                CURLOPT_POSTFIELDS => json_encode([
                    'user_id' => $adminId,
                    'message' => $msg
                ])
            ]);
            curl_exec($notify);
            curl_close($notify);
        }
    }
}
