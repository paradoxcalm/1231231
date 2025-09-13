<?php
// fbs/list_fbs.php – выдача списка FBS‑записей с пагинацией и фильтрами
header('Content-Type: application/json; charset=utf-8');

require_once '../db_connection.php'; // подключение mysqli $conn

try {
    // Получение параметров
    $city        = $_GET['city']        ?? '';
    $page        = max((int)($_GET['page'] ?? 1), 1);
    $perPage     = max((int)($_GET['per_page'] ?? 10), 1);
    $sortField   = $_GET['sort']        ?? 'created_at';
    $sortOrder   = strtolower($_GET['order'] ?? 'desc') === 'asc' ? 'asc' : 'desc';
    $filterPhone = trim($_GET['filterPhone'] ?? '');
    $filterStart = $_GET['filterStart'] ?? '';
    $filterEnd   = $_GET['filterEnd']   ?? '';

    // Разрешённые поля сортировки
    $allowedSorts = ['created_at','company','phone','quantity','amount','comment'];
    if (!in_array($sortField, $allowedSorts, true)) {
        $sortField = 'created_at';
    }

    // Сбор условий и параметров для WHERE
    $conditions = [];
    $types      = '';
    $params     = [];

    if ($city !== '') {
        $conditions[] = 'city = ?';
        $types       .= 's';
        $params[]     = $city;
    }
    if ($filterPhone !== '') {
        $conditions[] = 'phone LIKE ?';
        $types       .= 's';
        $params[]     = '%' . $filterPhone . '%';
    }
    if ($filterStart !== '') {
        $conditions[] = 'created_at >= ?';
        $types       .= 's';
        $params[]     = $filterStart . ' 00:00:00';
    }
    if ($filterEnd !== '') {
        $conditions[] = 'created_at <= ?';
        $types       .= 's';
        $params[]     = $filterEnd . ' 23:59:59';
    }

    $whereSql = '';
    if ($conditions) {
        $whereSql = ' WHERE ' . implode(' AND ', $conditions);
    }

    // Подсчёт общего количества записей
    $countSql = 'SELECT COUNT(*) AS total FROM fbs' . $whereSql;
    $stmt = $conn->prepare($countSql);
    if ($types !== '') {
        $stmt->bind_param($types, ...$params);
    }
    $stmt->execute();
    $resCount = $stmt->get_result();
    $totalRow = $resCount->fetch_assoc();
    $total    = (int)($totalRow['total'] ?? 0);
    $stmt->close();

    // Получение записей с учётом пагинации
    $offset = ($page - 1) * $perPage;
    $dataSql = 'SELECT id, city, company, phone, quantity, amount, comment, photo_path, created_at
                FROM fbs' . $whereSql . " ORDER BY $sortField $sortOrder LIMIT ?, ?";
    $stmt = $conn->prepare($dataSql);
    $bindTypes  = $types . 'ii';
    $bindParams = $params;
    $bindParams[] = $offset;
    $bindParams[] = $perPage;
    $stmt->bind_param($bindTypes, ...$bindParams);
    $stmt->execute();
    $resData = $stmt->get_result();
    $records = [];
    while ($row = $resData->fetch_assoc()) {
        $records[] = $row;
    }
    $stmt->close();

    echo json_encode([
        'success'  => true,
        'data'     => $records,
        'total'    => $total,
        'page'     => $page,
        'per_page' => $perPage
    ]);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Ошибка: ' . $e->getMessage()
    ]);
} finally {
    if (isset($conn) && $conn instanceof mysqli) {
        $conn->close();
    }
}
