<?php
header('Content-Type: application/json; charset=utf-8');
require_once 'db_connection.php';

try {
    $result = $conn->query("
        SELECT DISTINCT warehouses AS name
        FROM schedules
        WHERE warehouses IS NOT NULL AND TRIM(warehouses) != '' AND status != 'Удалено'
        ORDER BY warehouses ASC
    ");

    $warehouses = [];

    if ($result) {
        while ($row = $result->fetch_assoc()) {
            $warehouses[] = ['name' => $row['name']];
        }
        $result->free();
    }

    echo json_encode($warehouses);

} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => 'Ошибка: ' . $e->getMessage()]);
} finally {
    if (isset($conn) && $conn instanceof mysqli) {
        $conn->close();
    }
}
