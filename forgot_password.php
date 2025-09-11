<?php
require_once 'session_init.php';
session_start();
require_once 'db_connection.php';

// Функция для нормализации телефона (как в auth.php)
function normalizePhone($phone) {
    $phone = preg_replace('/\D+/', '', $phone);
    if (strlen($phone) === 11 && $phone[0] === '8') {
        return '+7' . substr($phone, 1);
    } elseif (strlen($phone) === 10 && $phone[0] === '9') {
        return '+7' . $phone;
    } elseif (strlen($phone) === 11 && $phone[0] === '7') {
        return '+7' . substr($phone, 1);
    } elseif (strlen($phone) === 12 && str_starts_with($phone, '79')) {
        return '+' . $phone;
    }
    return $phone;
}

// Переменные для сообщений
$error = null;
$info  = null;
$showCodeForm = false;

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    // Если код еще не отправлен (первый шаг)
    if (empty($_POST['code'])) {
        $input = trim($_POST['email_or_phone'] ?? '');
        if (empty($input)) {
            $error = "Укажите Email или номер телефона.";
        } else {
            // Приводим телефон к единому формату, если введён номер
            $normalizedPhone = normalizePhone($input);
            // Ищем пользователя по email или телефону
            $stmt = $conn->prepare("SELECT * FROM usersff WHERE email = ? OR phone = ? LIMIT 1");
            $stmt->bind_param("ss", $input, $normalizedPhone);
            $stmt->execute();
            $user = $stmt->get_result()->fetch_assoc();
            $stmt->close();
            if (!$user) {
                // Не уточняем детали (безопасность) – сообщаем об отсутствии пользователя
                $error = "Пользователь с такими данными не найден.";
            } else {
                // Пользователь найден
                // Генерируем случайный 6-значный код
                $resetCode = random_int(100000, 999999);
                // Устанавливаем время истечения (через 15 минут от текущего)
                $expiresAt = date('Y-m-d H:i:s', time() + 15 * 60);
                // Сохраняем код и время истечения в базе
                $upd = $conn->prepare("UPDATE usersff SET reset_code = ?, reset_expires = ? WHERE id = ?");
                $upd->bind_param("ssi", $resetCode, $expiresAt, $user['id']);
                $upd->execute();
                $upd->close();
                // Отправляем код на Email
                $to      = $user['email'];
                $subject = "Восстановление пароля";
                $message = "Код для сброса пароля: $resetCode";
                $headers  = "From: recovery@ffideal.ru\r\n";
                $headers .= "Content-Type: text/plain; charset=UTF-8\r\n";
                mail($to, $subject, $message, $headers);
                // Показываем форму ввода кода
                $showCodeForm = true;
                $info = "Код отправлен на вашу почту. Введите полученный код и новый пароль.";
            }
        }
    } 
    // Если уже был отправлен код (второй шаг)
    else {
        $showCodeForm = true;
        $code     = trim($_POST['code'] ?? '');
        $newPass  = $_POST['password'] ?? '';
        $confPass = $_POST['confirm_password'] ?? '';
        if ($code === '' || $newPass === '' || $confPass === '') {
            $error = "Пожалуйста, заполните все поля.";
        } elseif ($newPass !== $confPass) {
            $error = "Пароли не совпадают.";
        } else {
            // Проверяем корректность и актуальность кода
            $stmt = $conn->prepare("SELECT id, reset_expires FROM usersff WHERE reset_code = ? LIMIT 1");
            $stmt->bind_param("s", $code);
            $stmt->execute();
            $result = $stmt->get_result();
            $user = $result->fetch_assoc();
            $stmt->close();
            if (!$user) {
                $error = "Неверный код. Проверьте и попробуйте ещё раз.";
            } elseif (strtotime($user['reset_expires']) < time()) {
                $error = "Код просрочен. Запросите новый код.";
            } else {
                // Код верен и не просрочен – сохраняем новый пароль
                $newHash = password_hash($newPass, PASSWORD_DEFAULT);
                $upd = $conn->prepare("UPDATE usersff 
                                       SET password = ?, reset_code = NULL, reset_expires = NULL, 
                                           remember_token = NULL, token_expiry = NULL 
                                       WHERE id = ?");
                $upd->bind_param("si", $newHash, $user['id']);
                $upd->execute();
                $upd->close();
                // Перенаправляем на страницу входа с сообщением об успехе
                header("Location: auth_form.php?success=Пароль успешно изменён");
                exit();
            }
        }
    }
}
?>
<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <title>Восстановление пароля</title>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <!-- Подключаем шрифт и иконки, как на странице auth_form.php -->
    <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;500&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <style>
        body {
            font-family: 'Roboto', sans-serif;
            background: linear-gradient(135deg, #f2f6fc, #ffffff);
            margin: 0;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .auth-buttons {
            text-align: center;
            padding: 40px;
            background: #fff;
            border-radius: 16px;
            box-shadow: 0 4px 24px rgba(0, 0, 0, 0.1);
            color: #333;
            width: 360px;
        }
        .auth-buttons h2 {
            font-weight: 500;
            margin-bottom: 20px;
        }
        .field {
            display: flex;
            align-items: center;
            gap: 10px;
            margin-bottom: 16px;
            padding: 12px 16px;
            border: 1px solid #ddd;
            border-radius: 8px;
            background: #f9f9f9;
            transition: border 0.2s;
            height: 48px;
            box-sizing: border-box;
            position: relative;
        }
        .field:focus-within {
            border-color: #00c853;
        }
        .field i {
            font-size: 16px;
            color: #888;
            flex-shrink: 0;
        }
        .field input {
            border: none;
            background: transparent;
            outline: none;
            color: #333;
            width: 100%;
            font-size: 15px;
            padding: 0;
        }
        .field input::placeholder {
            color: #aaa;
        }
        .auth-buttons button {
            width: 100%;
            height: 50px;
            border: none;
            background: linear-gradient(45deg, #00c853, #64dd17);
            border-radius: 30px;
            color: white;
            font-weight: 600;
            font-size: 16px;
            cursor: pointer;
            margin-top: 10px;
        }
        .auth-buttons button:hover {
            background: linear-gradient(45deg, #64dd17, #00c853);
        }
        .toggle-password {
            position: absolute;
            right: 14px;
            top: 50%;
            transform: translateY(-50%);
            font-size: 16px;
            color: #aaa;
            cursor: pointer;
        }
        .toggle-password:hover {
            color: #000;
        }
        p.message {
            margin: 10px 0;
            font-size: 14px;
        }
        p.message.error { color: #ff8a80; }
        p.message.info  { color: #4caf50; }
    </style>
</head>
<body>
<div class="auth-buttons">
    <h2>Восстановление пароля</h2>
    <?php 
    // Выводим сообщение об ошибке или информации, если есть
    if ($error): ?>
        <p class="message error"><?= htmlspecialchars($error) ?></p>
    <?php elseif ($info): ?>
        <p class="message info"><?= htmlspecialchars($info) ?></p>
    <?php endif; ?>
    
    <?php if (!$showCodeForm): ?>
        <!-- Форма запроса кода восстановления (Шаг 1) -->
        <form method="post">
            <div class="field"><i class="fas fa-user"></i>
                <input type="text" name="email_or_phone" placeholder="Email или телефон" required>
            </div>
            <button type="submit">Отправить код</button>
        </form>
    <?php else: ?>
        <!-- Форма ввода кода и нового пароля (Шаг 2) -->
        <form method="post">
            <div class="field"><i class="fas fa-key"></i>
                <input type="text" name="code" placeholder="Код из письма" required>
            </div>
            <div class="field"><i class="fas fa-lock"></i>
                <input type="password" name="password" id="newPass" placeholder="Новый пароль" required autocomplete="off">
                <i class="fas fa-eye toggle-password" onclick="togglePassword('newPass', this)"></i>
            </div>
            <div class="field"><i class="fas fa-lock"></i>
                <input type="password" name="confirm_password" id="confirmPass" placeholder="Повторите пароль" required autocomplete="off">
                <i class="fas fa-eye toggle-password" onclick="togglePassword('confirmPass', this)"></i>
            </div>
            <button type="submit">Сбросить пароль</button>
        </form>
    <?php endif; ?>
</div>
<script>
// Скрипт для переключения видимости пароля
function togglePassword(inputId, icon) {
    const input = document.getElementById(inputId);
    if (!input) return;
    const isVisible = input.type === 'text';
    input.type = isVisible ? 'password' : 'text';
    icon.classList.toggle('fa-eye');
    icon.classList.toggle('fa-eye-slash');
}
</script>
</body>
</html>