<?php
// notify_user.php
// Универсальный модуль отправки уведомлений конкретному пользователю

function sendNotification($conn, int $userId, string $message): bool {
    $logFile = __DIR__ . '/logs/notify_debug.log';
    if (!is_dir(dirname($logFile))) {
        mkdir(dirname($logFile), 0777, true);
    }

    file_put_contents($logFile, date('c') . " 🔍 sendNotification(user=$userId, msg=$message)\n", FILE_APPEND);

    if (!($conn instanceof mysqli)) {
        file_put_contents($logFile, date('c') . " ❌ \$conn не mysqli\n", FILE_APPEND);
        return false;
    }

    if ($userId <= 0 || trim($message) === '') {
        file_put_contents($logFile, date('c') . " ❌ Некорректные данные: user=$userId msg=$message\n", FILE_APPEND);
        return false;
    }

    $conn->begin_transaction();
    try {
        // 1. Добавляем уведомление
        $stmt1 = $conn->prepare("INSERT INTO notifications (message, created_at) VALUES (?, NOW())");
        if (!$stmt1) throw new Exception("prepare notifications: " . $conn->error);
        $stmt1->bind_param("s", $message);
        $stmt1->execute();
        $notifId = $stmt1->insert_id;
        $stmt1->close();

        // 2. Привязка к пользователю
        $stmt2 = $conn->prepare("INSERT INTO user_notifications (user_id, notification_id) VALUES (?, ?)");
        if (!$stmt2) throw new Exception("prepare user_notifications: " . $conn->error);
        $stmt2->bind_param("ii", $userId, $notifId);
        $stmt2->execute();
        $stmt2->close();

        $conn->commit();
        file_put_contents($logFile, date('c') . " ✅ УСПЕХ: user=$userId, notifId=$notifId\n", FILE_APPEND);
        return true;
    } catch (Exception $e) {
        $conn->rollback();
        file_put_contents($logFile, date('c') . " ❌ ИСКЛЮЧЕНИЕ: " . $e->getMessage() . "\n", FILE_APPEND);
        return false;
    }
}
