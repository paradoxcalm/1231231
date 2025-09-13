<?php
header('Content-Type: application/json; charset=utf-8');
require_once 'db_connection.php';

try {
    $method = $_SERVER['REQUEST_METHOD'];

    if ($method === 'POST') {
        $input = json_decode(file_get_contents("php://input"), true);
        $action = $input['action'] ?? '';

        // Добавление города
        if ($action === 'add') {
            $name = trim($input['name'] ?? '');
            $region = trim($input['region'] ?? null);

            if ($name === '') {
                http_response_code(400);
                echo json_encode(['status' => 'error', 'message' => 'Пустое имя']);
                exit;
            }

            $stmt = $conn->prepare("INSERT INTO cities (name, region) VALUES (?, ?)");
            if (!$stmt) {
                http_response_code(500);
                echo json_encode(['status' => 'error', 'message' => 'Ошибка подготовки запроса']);
                exit;
            }

            $stmt->bind_param("ss", $name, $region);
            if (!$stmt->execute()) {
                http_response_code(500);
                echo json_encode(['status' => 'error', 'message' => 'Ошибка выполнения запроса']);
                $stmt->close();
                exit;
            }

            $stmt->close();
            echo json_encode(['status' => 'success']);
            exit;
        }

        // Удаление города
        if ($action === 'delete') {
            $id = intval($input['id'] ?? 0);
            if ($id <= 0) {
                http_response_code(400);
                echo json_encode(['status' => 'error', 'message' => 'Некорректный ID']);
                exit;
            }

            $stmt = $conn->prepare("DELETE FROM cities WHERE id = ?");
            if (!$stmt) {
                http_response_code(500);
                echo json_encode(['status' => 'error', 'message' => 'Ошибка подготовки запроса']);
                exit;
            }

            $stmt->bind_param("i", $id);
            if (!$stmt->execute()) {
                http_response_code(500);
                echo json_encode(['status' => 'error', 'message' => 'Ошибка удаления']);
                $stmt->close();
                exit;
            }

            $stmt->close();
            echo json_encode(['status' => 'success']);
            exit;
        }

        http_response_code(400);
        echo json_encode(['status' => 'error', 'message' => 'Неизвестное действие']);
        exit;
    }

    // GET: список активных городов
    $res = $conn->query("SELECT id, name FROM cities WHERE is_active = 1 ORDER BY name ASC");
    $cities = [];

    while ($row = $res->fetch_assoc()) {
        $cities[] = $row;
    }

    echo json_encode($cities);

} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => 'Ошибка: ' . $e->getMessage()]);
} finally {
    if (isset($conn) && $conn instanceof mysqli) {
        $conn->close();
    }
}
