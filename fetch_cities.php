<?php
require_once 'db_connection.php';
header('Content-Type: application/json; charset=utf-8');

$sql = "
    SELECT DISTINCT
        CASE
            WHEN city REGEXP '^[0-9]+$' THEN (
                SELECT name FROM cities WHERE id = schedules.city LIMIT 1
            )
            ELSE city
        END AS city_name
    FROM schedules
    WHERE city IS NOT NULL AND city <> ''
    ORDER BY city_name
";
$res = $conn->query($sql);

$cities = [];
while ($row = $res->fetch_assoc()) {
    $name = trim($row['city_name']);
    if ($name !== '') $cities[] = $name;
}

echo json_encode($cities);
$conn->close();
?>
