<?php
require_once __DIR__ . '/../db_connection.php';
require_once __DIR__ . '/../session_init.php';
require_once __DIR__ . '/../auth_helper.php';

session_start();
if (!isset($_SESSION['role']) || $_SESSION['role'] !== 'accountant') {
    header('Location: /index.php');
    exit();
}
requireRole(['accountant']);
?>
<!DOCTYPE html>
<html lang='ru'>
<head>
    <meta charset='utf-8'>
    <meta name='viewport' content='width=device-width, initial-scale=1.0'>
    <title>Кабинет бухгалтера</title>
    <style>
        * { box-sizing: border-box; }
        body {
            margin: 0;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            background-color: #f0f2f5;
            color: #222;
        }
        .header {
            position: sticky;
            top: 0;
            z-index: 100;
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 16px 20px;
            background: #0d47a1;
            color: #fff;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
        .header .title {
            font-size: 22px;
            font-weight: 600;
        }
        .header .exit {
            color: #fff;
            text-decoration: none;
            font-weight: 600;
            font-size: 14px;
        }
        .container {
            max-width: 900px;
            margin: 20px auto;
            padding: 0 16px;
        }
    </style>
    <script src='../main.js' defer></script>
</head>
<body>
    <header class='header'>
        <div class='title'>Кабинет бухгалтера</div>
        <a class='exit' href='../logout.php'>Выйти</a>
    </header>
    <main class='container'>
        <!-- Контент бухгалтера будет здесь -->
    </main>
</body>
</html>
