<?php
// ❗ Настройки ДО session_start()
ini_set('session.gc_maxlifetime', 1800); // 30 минут
session_set_cookie_params(1800);

session_start();
require_once 'db_connection.php';

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

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = trim($_POST['email_or_phone'] ?? '');
    $password = $_POST['password'] ?? '';

    if (empty($input) || empty($password)) {
        header('Location: auth_form.php?error=Заполните все поля');
        exit();
    }

    $normalizedPhone = normalizePhone($input);

    $query = $conn->prepare("SELECT * FROM usersff WHERE email = ? OR phone = ? LIMIT 1");
    if (!$query) {
        header('Location: auth_form.php?error=Ошибка базы данных');
        exit();
    }
    $query->bind_param("ss", $input, $normalizedPhone);
    $query->execute();
    $result = $query->get_result();
    $user = $result->fetch_assoc();
    $query->close();

    if ($user && password_verify($password, $user['password'])) {
        session_regenerate_id(true);
        $_SESSION['user_id'] = $user['id'];
        $_SESSION['role'] = $user['role'];

        if (!empty($_POST['remember'])) {
            $token = bin2hex(random_bytes(16));
            $tokenHash = password_hash($token, PASSWORD_DEFAULT);
            $expiry = time() + 7 * 24 * 60 * 60;
            $expiryDate = date('Y-m-d H:i:s', $expiry);

            $update = $conn->prepare("UPDATE usersff SET remember_token = ?, token_expiry = ? WHERE id = ?");
            if ($update) {
                $update->bind_param("ssi", $tokenHash, $expiryDate, $user['id']);
                $update->execute();
                $update->close();

                $secure = !empty($_SERVER['HTTPS']);
                setcookie('remember_token', $token, $expiry, "/", "", $secure, true);
                setcookie('remember_user', $user['id'], $expiry, "/", "", $secure, true);
            }
        }

        header("Location: index.php");
        exit();
    } else {
        header('Location: auth_form.php?error=Неправильный Email, номер телефона или пароль');
        exit();
    }
} else {
    header('Location: auth_form.php');
    exit();
}
?>
