<?php
session_start();
header('Content-Type: application/json; charset=utf-8');
require_once 'db_connection.php';

$userId = $_SESSION['user_id'] ?? 0;
$markAsRead = isset($_GET['mark_as_read']) && $_GET['mark_as_read'] === '1';

if (!$userId) {
    echo json_encode([]);
    exit;
}

// Получаем только свои уведомления
$notifications = [];
$stmt = $conn->prepare("
    SELECT n.id, n.message, n.created_at, ur.read_at
    FROM notifications n
    INNER JOIN user_notifications ur
        ON n.id = ur.notification_id AND ur.user_id = ?
    ORDER BY n.created_at DESC
    LIMIT 50
");
$stmt->bind_param("i", $userId);
$stmt->execute();
$res = $stmt->get_result();

while ($row = $res->fetch_assoc()) {
    $notifications[] = [
        'id'         => (int)$row['id'],
        'message'    => $row['message'],
        'created_at' => $row['created_at'],
        'read'       => $row['read_at'] !== null
    ];
}
$stmt->close();

// Отмечаем как прочитанные
if ($markAsRead && count($notifications) > 0) {
    $ids = [];
    foreach ($notifications as $n) {
        if (!$n['read']) {
            $ids[] = $n['id'];
        }
    }
    if (!empty($ids)) {
        foreach ($ids as $nid) {
            $stmt = $conn->prepare("
                INSERT INTO user_notifications (user_id, notification_id, read_at)
                VALUES (?, ?, NOW())
                ON DUPLICATE KEY UPDATE read_at = NOW()
            ");
            $stmt->bind_param("ii", $userId, $nid);
            $stmt->execute();
            $stmt->close();
        }
    }
}

$conn->close();
echo json_encode($notifications);