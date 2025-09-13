<?php
require_once '../session_init.php';
session_start();
require_once '../db_connection.php';

// Доступ только для admin/manager
if ($_SESSION['role'] !== 'admin' && $_SESSION['role'] !== 'manager') {
    http_response_code(403);
    echo json_encode(['success' => false, 'message' => 'Доступ запрещён']);
    exit;
}

try {
    // Читаем входные данные POST
    $city      = trim($_POST['city'] ?? '');
    $company   = trim($_POST['company'] ?? '');
    $phone     = trim($_POST['phone'] ?? '');
    $quantity  = isset($_POST['quantity']) ? intval($_POST['quantity']) : 1;
    $amount    = isset($_POST['amount']) ? floatval($_POST['amount']) : 0.0;
    $comment   = trim($_POST['comment'] ?? '');
    $cashPaid  = isset($_POST['cash_paid']) ? intval($_POST['cash_paid']) : 0;

    // Простая валидация
    if ($city === '' || $company === '' || $phone === '' || $quantity <= 0 || $amount < 0) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Некорректные данные']);
        exit;
    }

    // Подготовка запроса вставки
    $stmt = $conn->prepare(
        "INSERT INTO fbs (city, company, phone, quantity, amount, comment, cash_paid, photo_path, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())"
    );
    if (!$stmt) {
        throw new Exception('Ошибка подготовки запроса: ' . $conn->error);
    }

    // Обработка фото (если есть)
    $photoPath = null;
    if (isset($_FILES['photo']) && $_FILES['photo']['error'] === UPLOAD_ERR_OK) {
        $uploadDir = '../uploads/fbs/'; // путь к каталогу загрузок
        if (!file_exists($uploadDir) && !mkdir($uploadDir, 0777, true)) {
            throw new Exception('Не удалось создать каталог для загрузки фото');
        }
        $ext = pathinfo($_FILES['photo']['name'], PATHINFO_EXTENSION);
        $fileName = time() . '_' . uniqid() . '.' . $ext;
        $targetPath = $uploadDir . $fileName;
        if (!move_uploaded_file($_FILES['photo']['tmp_name'], $targetPath)) {
            throw new Exception('Ошибка загрузки файла');
        }
        $photoPath = $fileName;
    }

    // Привязка параметров и выполнение запроса
    $stmt->bind_param(
        "sssidsis",
        $city,
        $company,
        $phone,
        $quantity,
        $amount,
        $comment,
        $cashPaid,
        $photoPath
    );
    if (!$stmt->execute()) {
        throw new Exception('Ошибка выполнения запроса: ' . $stmt->error);
    }
    $stmt->close();
    $conn->close();

    // Возвращаем успешный ответ
    echo json_encode(['success' => true]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
}