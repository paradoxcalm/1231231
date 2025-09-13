<?php
require_once 'db_connection.php';
require_once 'session_init.php';

// Функция нормализации телефона (без изменений)
function normalizePhone($phone) {
    $phone = preg_replace('/\D+/', '', $phone);
    if (strlen($phone) === 10 && $phone[0] === '9') {
        return '+7' . $phone;
    }
    if (strlen($phone) === 11 && $phone[0] === '8') {
        return '+7' . substr($phone, 1);
    }
    if (strlen($phone) === 11 && $phone[0] === '7') {
        return '+7' . substr($phone, 1);
    }
    if (strlen($phone) === 12 && $phone[0] === '7') {
        return '+' . $phone;
    }
    return $phone; // неизвестный формат
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $phone    = trim($_POST['phone'] ?? '');
    $password = $_POST['password'] ?? '';

    // Проверка заполненности
    if (empty($phone) || empty($password)) {
        header('Location: auth_form.php?error=Заполните все поля');
        exit();
    }

    $normalizedPhone = normalizePhone($phone);
    if (!preg_match('/^\\+7\\d{10}$/', $normalizedPhone)) {
        header('Location: auth_form.php?error=Некорректный формат номера телефона');
        exit();
    }

    // Поиск пользователя в базе по телефону
    $query = $conn->prepare("SELECT * FROM usersff WHERE phone = ? LIMIT 1");
    if (!$query) {
        header('Location: auth_form.php?error=Ошибка базы данных');
        exit();
    }
    $query->bind_param("s", $normalizedPhone);
    $query->execute();
    $result = $query->get_result();
    $user   = $result->fetch_assoc();
    $query->close();

    // Проверка пароля
    if ($user && password_verify($password, $user['password'])) {
        // Если требуется подтверждение почты и аккаунт не подтверждён
        if (isset($user['is_verified']) && $user['is_verified'] == 0) {
            header('Location: auth_form.php?error=Аккаунт не подтверждён. Проверьте почту.');
            exit();
        }

        // Определяем, выбрал ли пользователь "Запомнить меня"
        $remember = !empty($_POST['remember']);

        $secure = !empty($_SERVER['HTTPS']);  // true, если используется HTTPS

        session_start();

        // Генерация нового ID сессии и сохранение данных авторизации
        session_regenerate_id(true);
        $_SESSION['user_id'] = $user['id'];
        $role                = $user['role'];
        $_SESSION['role']    = $role;

        if ($remember) {
            // Генерация токена для "Запомнить меня" на 60 дней
            $token     = bin2hex(random_bytes(16));
            $tokenHash = password_hash($token, PASSWORD_DEFAULT);
            $tokenExpiry    = time() + 60 * 24 * 60 * 60;  // токен действует 60 дней
            $tokenExpiryStr = date('Y-m-d H:i:s', $tokenExpiry);

            // Сохраняем токен и срок действия в базе данных
            $update = $conn->prepare("UPDATE usersff SET remember_token = ?, token_expiry = ? WHERE id = ?");
            if ($update) {
                $update->bind_param("ssi", $tokenHash, $tokenExpiryStr, $user['id']);
                $update->execute();
                $update->close();
                // Устанавливаем cookie с токеном и ID пользователя на 60 дней (Secure, HttpOnly)
                setcookie('remember_token', $token, $tokenExpiry, "/", "", $secure, true);
                setcookie('remember_user', (string)$user['id'], $tokenExpiry, "/", "", $secure, true);
            }
        } else {
            // Если пользователь не хочет "запомнить", очищаем предыдущие токены
            $conn->query("UPDATE usersff SET remember_token = NULL, token_expiry = NULL WHERE id = " . (int)$user['id']);
        }

        // Перенаправление на соответствующую главную страницу после успешного входа
        if ($role === 'client') {
            header('Location: /client/index.php');
        } else {
            header('Location: index.php');
        }
        exit();
    } else {
        // Неверные учетные данные
        header('Location: auth_form.php?error=Неправильный номер телефона или пароль');
        exit();
    }
} else {
    // Если скрипт открыт без отправки формы, перенаправляем на страницу входа
    header('Location: auth_form.php');
    exit();
}
?>
