<?php
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

    if (preg_match('/^9[0-9]{9}$/', $phone)) {
        $phone = '+7' . $phone;
    }

    if ($password !== $confirm) {
        header('Location: auth_form.php?error=Пароли не совпадают');
        exit();
    }

    // Проверка уникальности
    $q1 = $conn->prepare("SELECT id FROM usersff WHERE email = ? LIMIT 1");
    $q1->bind_param("s", $email);
    $q1->execute();
    if ($q1->get_result()->num_rows > 0) {
        header('Location: auth_form.php?error=Этот Email уже зарегистрирован');
        exit();
    }

    $q2 = $conn->prepare("SELECT id FROM usersff WHERE phone = ? LIMIT 1");
    $q2->bind_param("s", $phone);
    $q2->execute();
    if ($q2->get_result()->num_rows > 0) {
        header('Location: auth_form.php?error=Этот номер уже зарегистрирован');
        exit();
    }

    $hashed = password_hash($password, PASSWORD_DEFAULT);

    $ins = $conn->prepare("
        INSERT INTO usersff 
        (email, phone, password, role, first_name, last_name, middle_name, company_name, store_name)
        VALUES (?, ?, ?, 'client', ?, ?, ?, ?, ?)
    ");
    $ins->bind_param("ssssssss", $email, $phone, $hashed, $first_name, $last_name, $middle_name, $company_name, $store_name);

    if ($ins->execute()) {
        header('Location: auth_form.php?success=Регистрация успешна');
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
