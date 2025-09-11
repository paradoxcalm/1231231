<?php
require_once 'session_init.php';
session_start();
require_once 'db_connection.php';

if ($_SERVER['REQUEST_METHOD'] == 'POST') {
    $email        = trim($_POST['email'] ?? '');
    $phone        = trim($_POST['phone'] ?? '');
    $password     = $_POST['password'] ?? '';
    $confirm      = $_POST['confirm_password'] ?? '';

    $first_name   = trim($_POST['first_name'] ?? '');
    $last_name    = trim($_POST['last_name'] ?? '');
    $middle_name  = trim($_POST['middle_name'] ?? '');
    $company_name = trim($_POST['company_name'] ?? '');
    $store_name   = trim($_POST['store_name'] ?? '');

    // Приведение телефона к формату +7XXXXXXXXXX
    if (preg_match('/^9\d{9}$/', $phone)) {
        $phone = '+7' . $phone;
    }

    // Проверка совпадения паролей
    if ($password !== $confirm) {
        header('Location: auth_form.php?reg_error=Пароли не совпадают');
        exit();
    }

    // Проверка уникальности email
    $q1 = $conn->prepare("SELECT id FROM usersff WHERE email = ? LIMIT 1");
    $q1->bind_param("s", $email);
    $q1->execute();
    if ($q1->get_result()->num_rows > 0) {
        $q1->close();
        header('Location: auth_form.php?reg_error=Этот Email уже зарегистрирован');
        exit();
    }
    $q1->close();

    // Проверка уникальности телефона
    $q2 = $conn->prepare("SELECT id FROM usersff WHERE phone = ? LIMIT 1");
    $q2->bind_param("s", $phone);
    $q2->execute();
    if ($q2->get_result()->num_rows > 0) {
        $q2->close();
        header('Location: auth_form.php?reg_error=Этот номер уже зарегистрирован');
        exit();
    }
    $q2->close();

    // Хеширование пароля
    $hashed = password_hash($password, PASSWORD_DEFAULT);

    // Генерация токена подтверждения и подготовка данных
    $token    = bin2hex(random_bytes(16));
    $verified = 0;

    // Вставка нового пользователя (по умолчанию не подтверждён)
    $ins = $conn->prepare("INSERT INTO usersff 
        (email, phone, password, role, first_name, last_name, middle_name, company_name, store_name, verify_token, is_verified) 
        VALUES (?, ?, ?, 'client', ?, ?, ?, ?, ?, ?, ?)");
    $ins->bind_param("sssssssssi", 
        $email, $phone, $hashed, 
        $first_name, $last_name, $middle_name, $company_name, $store_name, 
        $token, $verified
    );

    if ($ins->execute()) {
        // Отправка письма с подтверждением
        $scheme = (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on') ? 'https' : 'http';
        $host   = $_SERVER['HTTP_HOST'];
        $link   = $scheme . '://' . $host . '/verify_email.php?token=' . urlencode($token);
        $to      = $email;
        $subject = "Подтверждение регистрации";
        $message = "Здравствуйте!\nДля подтверждения регистрации перейдите по ссылке:\n$link\n\nЕсли вы не регистрировались на нашем сайте, просто проигнорируйте это письмо.";
        $headers  = "From: verify@ffideal.ru\r\n";
        $headers .= "Content-Type: text/plain; charset=UTF-8\r\n";
        mail($to, $subject, $message, $headers);

        // Перенаправление с сообщением об успехе (просим подтвердить email)
        header('Location: auth_form.php?success=Регистрация успешна. Проверьте почту для подтверждения.');
        exit();
    } else {
        header('Location: auth_form.php?error=Ошибка регистрации');
        exit();
    }
} else {
    header('Location: auth_form.php');
    exit();
}
?>