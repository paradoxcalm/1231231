<?php

function prepareExecute($conn, $sql, $types = "", $params = []) {
    $stmt = $conn->prepare($sql);
    if (!$stmt) {
        throw new Exception("Prepare failed: " . $conn->error);
    }
    if ($types) {
        $stmt->bind_param($types, ...$params);
    }
    for ($i = 0; $i < 2; $i++) {
        if ($stmt->execute()) {
            return $stmt;
        }
        if ($stmt->errno == 1615 && $i == 0) {
            $stmt->close();
            $stmt = $conn->prepare($sql);
            if (!$stmt) {
                throw new Exception("Reprepare failed: " . $conn->error);
            }
            if ($types) {
                $stmt->bind_param($types, ...$params);
            }
            continue;
        }
        $err = $stmt->error;
        $stmt->close();
        throw new Exception($err);
    }
    return $stmt;
}

function jsonResponse($data) {
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data);
}
