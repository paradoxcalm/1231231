<?php
require_once 'db_connection.php';

$result = $conn->query("SELECT DISTINCT city FROM schedules");
$cities = [];
while ($row = $result->fetch_assoc()) {
    $cities[] = $row['city'];
}

header('Content-Type: application/json');
echo json_encode($cities);
?>
