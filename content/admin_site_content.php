<?php
session_start();
require_once __DIR__ . '/../db_connection.php';

// Проверяем права доступа
if (!isset($_SESSION['role']) || $_SESSION['role'] !== 'admin') {
    header('Location: /admin/index.php');
    exit();
}

// Загружаем текущие значения
$aboutContent = '';
$servicesContent = '';
if ($stmt = $conn->prepare("SELECT section, content FROM site_content WHERE section IN ('about','services')")) {
    $stmt->execute();
    $result = $stmt->get_result();
    while ($row = $result->fetch_assoc()) {
        if ($row['section'] === 'about')   $aboutContent   = $row['content'];
        if ($row['section'] === 'services') $servicesContent = $row['content'];
    }
    $stmt->close();
}

// Сохраняем изменения
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $about    = $_POST['about']    ?? '';
    $services = $_POST['services'] ?? '';

    // "upsert" для about
    $stmt = $conn->prepare("
        INSERT INTO site_content (section, content) VALUES ('about', ?)
        ON DUPLICATE KEY UPDATE content = VALUES(content)
    ");
    $stmt->bind_param('s', $about);
    $stmt->execute();
    $stmt->close();

    // "upsert" для services
    $stmt = $conn->prepare("
        INSERT INTO site_content (section, content) VALUES ('services', ?)
        ON DUPLICATE KEY UPDATE content = VALUES(content)
    ");
    $stmt->bind_param('s', $services);
    $stmt->execute();
    $stmt->close();

    $aboutContent    = $about;
    $servicesContent = $services;
    $message = 'Изменения сохранены.';
}
?>
<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<title>Редактирование информации о компании</title>
<style>
body { font-family: Arial, sans-serif; background:#f7f7f7; padding:20px; }
.container { max-width:700px; margin:auto; background:#fff; padding:20px; border-radius:8px; box-shadow:0 2px 6px rgba(0,0,0,.1); }
.container h1 { margin-top:0; }
label { display:block; margin-top:15px; font-weight:bold; }
textarea { width:100%; height:160px; padding:10px; border:1px solid #ccc; border-radius:4px; font-size:14px; }
button { margin-top:15px; background:#00c853; color:#fff; border:none; padding:10px 20px; border-radius:4px; font-size:16px; cursor:pointer; }
button:hover { background:#64dd17; }
.message { margin-top:15px; color:green; }
</style>
</head>
<body>
<div class="container">
    <h1>Редактирование информации на странице авторизации</h1>
    <?php if (!empty($message)): ?>
    <div class="message"><?php echo $message; ?></div>
    <?php endif; ?>
    <form method="post">
        <label for="about">Блок «О нас»</label>
        <textarea id="about" name="about"><?php echo htmlspecialchars($aboutContent, ENT_QUOTES, 'UTF-8'); ?></textarea>

        <label for="services">Блок «Услуги»</label>
        <textarea id="services" name="services"><?php echo htmlspecialchars($servicesContent, ENT_QUOTES, 'UTF-8'); ?></textarea>

        <button type="submit">Сохранить</button>
    </form>
</div>
</body>
</html>
