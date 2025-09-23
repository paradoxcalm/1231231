<?php
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/../../db_connection.php';

try {
    $method = $_SERVER['REQUEST_METHOD'];

    // POST: обработка действий (add, delete, batch_edit)
    if ($method === 'POST') {
        // Для JSON-запросов: читаем из php://input
        $input = json_decode(file_get_contents("php://input"), true);

        $action = $input['action'] ?? '';

        // Добавление склада
        if ($action === 'add') {
            $name = trim($input['name'] ?? '');
            if ($name === '') {
                http_response_code(400);
                echo json_encode(['status' => 'error', 'message' => 'Пустое имя']);
                exit;
            }

            $stmt = $conn->prepare("INSERT INTO warehouses (name) VALUES (?)");
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

        // Удаление складов (списком)
        if ($action === 'delete' && isset($input['names']) && is_array($input['names'])) {
            $names = array_map('trim', $input['names']);
            $names = array_filter($names); // удалить пустые значения
            if (count($names) === 0) {
                http_response_code(400);
                echo json_encode(['status' => 'error', 'message' => 'Пустой список для удаления']);
                exit;
            }
            // Динамические плейсхолдеры
            $placeholders = implode(',', array_fill(0, count($names), '?'));
            $types = str_repeat('s', count($names));
            $stmt = $conn->prepare("DELETE FROM warehouses WHERE name IN ($placeholders)");
            if (!$stmt) {
                http_response_code(500);
                echo json_encode(['status' => 'error', 'message' => 'Ошибка подготовки запроса']);
                exit;
            }
            $stmt->bind_param($types, ...$names);
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

        // Групповое редактирование (переименование) складов
        if ($action === 'batch_edit' && isset($input['edits']) && is_array($input['edits'])) {
            $anyChanged = false;
            foreach ($input['edits'] as $e) {
                $old = trim($e['old_name'] ?? '');
                $new = trim($e['new_name'] ?? '');
                if ($old !== '' && $new !== '' && $old !== $new) {
                    $stmt = $conn->prepare("UPDATE warehouses SET name = ? WHERE name = ?");
                    if ($stmt) {
                        $stmt->bind_param("ss", $new, $old);
                        $stmt->execute();
                        $stmt->close();
                        $anyChanged = true;
                    }
                }
            }
            echo json_encode(['status' => 'success', 'changed' => $anyChanged]);
            exit;
        }

        // Неизвестное действие
        http_response_code(400);
        echo json_encode(['status' => 'error', 'message' => 'Неизвестное действие']);
        exit;
    }

    // GET: вернуть список складов
    $result = $conn->query("SELECT name FROM warehouses ORDER BY name ASC");
    $list = [];
    if ($result) {
        while ($row = $result->fetch_assoc()) {
            $list[] = $row;
        }
        $result->free();
    }
    echo json_encode($list);

} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => 'Внутренняя ошибка: ' . $e->getMessage()]);
} finally {
    if (isset($conn) && $conn instanceof mysqli) {
        $conn->close();
    }
}
