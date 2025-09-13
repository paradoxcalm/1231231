<?php
header('Content-Type: application/json; charset=utf-8');
require_once 'db_connection.php';

$id = intval($_GET['id'] ?? 0);
$photos = [];

if ($id > 0) {
    $stmt = $conn->prepare("SELECT photo_path FROM shipments WHERE id = ?");
    $stmt->bind_param('i', $id);
    $stmt->execute();
    $res = $stmt->get_result();
    while ($row = $res->fetch_assoc()) {
        // декодируем и добавляем каждый путь
        $paths = json_decode($row['photo_path'] ?? '[]', true);
        if (!is_array($paths)) continue;
        foreach ($paths as $p) {
            $photos[] = '/' . ltrim($p, '/');
        }
    }
    $stmt->close();
}

$conn->close();
echo json_encode(['photos' => $photos]);
