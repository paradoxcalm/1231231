<?php
// fetch_photos.php — стабильная версия для возврата {"photos":[...]}.
// Поддерживает photo_path как JSON-массив или одиночную строку.
// Формирует абсолютные URL для относительных путей.

header('Content-Type: application/json; charset=utf-8');
require_once 'db_connection.php';

$id = isset($_GET['id']) ? (int)$_GET['id'] : 0;
$photos = [];

if ($id > 0) {
    $stmt = $conn->prepare("SELECT photo_path FROM shipments WHERE id = ?");
    $stmt->bind_param('i', $id);
    $stmt->execute();
    $res = $stmt->get_result();

    $https   = !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off';
    $scheme  = $https ? 'https' : 'http';
    $host    = $_SERVER['HTTP_HOST'];
    $baseDir = rtrim(dirname($_SERVER['SCRIPT_NAME']), '/');
    $baseUrl = $scheme . '://' . $host . ($baseDir ? $baseDir . '/' : '/');

    while ($row = $res->fetch_assoc()) {
        $raw = $row['photo_path'] ?? '';

        // Пытаемся распарсить JSON, иначе используем как одиночную строку
        $arr = json_decode($raw, true);
        if (!is_array($arr)) {
            if (is_string($raw) && trim($raw) !== '') {
                $arr = [$raw];
            } else {
                $arr = [];
            }
        }

        foreach ($arr as $p) {
            if (!is_string($p) || $p === '') continue;

            // Абсолютный путь на диске → web-путь
            if (!empty($_SERVER['DOCUMENT_ROOT']) && strpos($p, $_SERVER['DOCUMENT_ROOT']) === 0) {
                $p = ltrim(substr($p, strlen($_SERVER['DOCUMENT_ROOT'])), '/');
            }

            // Если абсолютный URL или data:
            if (preg_match('~^(?:https?:)?//|^data:~i', $p)) {
                $photos[] = $p;
            } else {
                // Относительный путь -> абсолютный URL
                $photos[] = $baseUrl . ltrim($p, '/');
            }
        }
    }
    $stmt->close();
}

$conn->close();
echo json_encode(['photos' => $photos], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
