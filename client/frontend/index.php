<?php
$version = time();
?>
<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <title>Личный кабинет клиента</title>
    <link rel="stylesheet" href="/styles/layout.css?v=<?= $version ?>">
</head>
<body>
<script>
    window.userRole = '<?= $_SESSION['role'] ?? 'client' ?>';
    const currentClientId = '<?= $_SESSION['user_id'] ?? 0 ?>';
</script>
<div id="dynamicContent"></div>
<script type="module" src="/client/schedule.js?v=<?= $version ?>"></script>
</body>
</html>
