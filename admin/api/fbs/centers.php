<?php
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/../../../db_connection.php';

try {
    $method = $_SERVER['REQUEST_METHOD'];

    if ($method === 'POST') {
        $input  = json_decode(file_get_contents("php://input"), true);
        $action = $input['action'] ?? '';

        // Добавление нового сортировочного центра
        if ($action === 'add') {
            $name = trim($input['name'] ?? '');
            if ($name === '') {
                http_response_code(400);
                echo json_encode(['status' => 'error', 'message' => 'Пустое имя']);
                exit;
            }
            $stmt = $conn->prepare("INSERT INTO sorting_centers (name) VALUES (?)");
if (!$stmt) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Ошибка подготовки запроса']);
    exit;
}

            if (!$stmt) {
                http_response_code(500);
                echo json_encode(['status' => 'error', 'message' => 'Ошибка подготовки запроса']);
                exit;
            }
            $stmt->bind_param("s", $name);
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

        // Удаление сортировочного центра (опционально, по аналогии с городами)
        if ($action === 'delete') {
            $id = intval($input['id'] ?? 0);
            if ($id <= 0) {
                http_response_code(400);
                echo json_encode(['status' => 'error', 'message' => 'Некорректный ID']);
                exit;
            }
            $stmt = $conn->prepare("DELETE FROM sorting_centers WHERE id = ?");
if (!$stmt) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Ошибка подготовки запроса']);
    exit;
}

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

        // Если action не распознан
        http_response_code(400);
        echo json_encode(['status' => 'error', 'message' => 'Неизвестное действие']);
        exit;
    }

    // GET-запрос: получить список активных СЦ
    $res = $conn->query("SELECT id, name FROM sorting_centers WHERE is_active = 1 ORDER BY name ASC");
    $centers = [];
    while ($row = $res->fetch_assoc()) {
        $centers[] = $row;
    }
    echo json_encode($centers);

} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => 'Ошибка: ' . $e->getMessage()]);
} finally {
    if (isset($conn) && $conn instanceof mysqli) {
        $conn->close();
    }
}
