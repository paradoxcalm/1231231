<?php
// db_connection.php
// -------------------------
$host     = 'localhost';
$username = 'u3026869_default';
$password = '0xPhRRg36paM38In';
$dbname   = 'u3026869_default';

// Создаем подключение
$conn = new mysqli($host, $username, $password, $dbname);

// Проверяем соединение
if ($conn->connect_error) {
    die("Ошибка подключения: " . $conn->connect_error);
}

// Устанавливаем кодировку
$conn->set_charset("utf8mb4");
?>
