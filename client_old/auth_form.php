<?php
session_start();
require_once 'db_connection.php';

if (!isset($_SESSION['role']) && isset($_COOKIE['remember_token'], $_COOKIE['remember_user'])) {
    $userId = (int)$_COOKIE['remember_user'];
    $token  = $_COOKIE['remember_token'];

    $stmt = $conn->prepare("SELECT id, role, remember_token, token_expiry FROM usersff WHERE id = ? LIMIT 1");
    $stmt->bind_param("i", $userId);
    $stmt->execute();
    $result = $stmt->get_result();
    if ($user = $result->fetch_assoc()) {
        if (
            !empty($user['remember_token']) &&
            !empty($user['token_expiry']) &&
            strtotime($user['token_expiry']) > time() &&
            password_verify($token, $user['remember_token'])
        ) {
            session_regenerate_id(true);
            $_SESSION['user_id'] = $user['id'];
            $_SESSION['role']    = $user['role'];
        } else {
            setcookie('remember_token', '', time() - 3600, "/");
            setcookie('remember_user', '', time() - 3600, "/");
        }
    }
    $stmt->close();
}

if (isset($_SESSION['role'])) {
    header('Location: index.php');
    exit();
}
?>
<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <title>Авторизация и Регистрация</title>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;500&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <style>
body {
    font-family: 'Roboto', sans-serif;
    background: linear-gradient(135deg, #f2f6fc, #ffffff);
    margin: 0;
    height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
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
    margin-bottom: 30px;
}

.auth-buttons button {
    background: #00c853;
    color: white;
    border: none;
    padding: 14px 20px;
    border-radius: 30px;
    cursor: pointer;
    font-size: 16px;
    width: 100%;
    margin-bottom: 15px;
    transition: background 0.3s;
}

.auth-buttons button:hover {
    background: #64dd17;
}

.modal {
    display: none;
    position: fixed;
    z-index: 999;
    left: 0;
    top: 0;
    width: 100%;
    height: 100%;
    background: rgba(200, 200, 200, 0.6);
    backdrop-filter: blur(2px);
}

.modal-content {
    margin: 3% auto;
    background: #ffffff;
    border-radius: 18px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
    padding: 32px 32px;
    width: 90%;
    max-width: 460px;
    color: #333;
    position: relative;
}

.modal-header {
    margin-bottom: 24px;
}

.modal-header h2 {
    font-size: 24px;
    font-weight: 600;
    margin: 0;
}

.modal-close {
    position: absolute;
    right: 20px;
    top: 20px;
    font-size: 24px;
    color: #888;
    cursor: pointer;
}

.modal-body {
    margin-top: 10px;
}

.modal-body .field {
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

.modal-body .field:focus-within {
    border-color: #00c853;
}

.modal-body .field i {
    font-size: 16px;
    color: #888;
    flex-shrink: 0;
}

.modal-body input {
    border: none;
    background: transparent;
    outline: none;
    color: #333;
    width: 100%;
    font-size: 15px;
    padding: 0;
}

.modal-body input::placeholder {
    color: #aaa;
}

.modal-body button {
    width: 100%;
    height: 50px;
    padding: 0 16px;
    border: none;
    background: linear-gradient(45deg, #00c853, #64dd17);
    border-radius: 30px;
    color: white;
    font-weight: 600;
    font-size: 16px;
    cursor: pointer;
    transition: background 0.3s, transform 0.2s;
}

.modal-body button:hover {
    background: linear-gradient(45deg, #64dd17, #00c853);
    transform: translateY(-1px);
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

@media (max-width: 480px) {
    .auth-buttons {
        width: 90%;
        padding: 30px 20px;
    }

    .modal-content {
        width: 94%;
        padding: 24px 16px;
    }

    .modal-body .field {
        height: auto;
        flex-direction: row;
        padding: 10px;
    }

    .modal-body input {
        font-size: 14px;
    }

    .modal-body button {
        padding: 12px;
        font-size: 15px;
    }

    .modal-header h2 {
        font-size: 22px;
    }

    .modal-close {
        font-size: 20px;
    }
}


    </style>
</head>
<body>
<div class="auth-buttons">
    <h2>Добро пожаловать</h2>
    <button onclick="openModal('loginModal')">Вход</button>
    <button onclick="openModal('registerModal')">Регистрация</button>
</div>

<!-- Вход -->
<div id="loginModal" class="modal">
  <div class="modal-content">
    <span class="modal-close" onclick="closeModal('loginModal')">&times;</span>
    <div class="modal-header"><h2>Вход</h2></div>
    <div class="modal-body">
      <?php if (isset($_GET['error'])): ?>
          <p style="color: #ff8a80; text-align: center;"><?php echo htmlspecialchars($_GET['error']); ?></p>
      <?php endif; ?>
      <form action="../auth.php" method="post" onsubmit="formatPhone('loginPhone')">
        <div class="field"><i class="fas fa-user"></i>
          <input type="tel" name="phone" id="loginPhone" value="+7" placeholder="Телефон" pattern="^\+7\d{10}$" required>
        </div>
        <div class="field"><i class="fas fa-lock"></i>
          <input type="password" name="password" id="loginPassword" placeholder="Пароль" required autocomplete="off">
          <i class="fas fa-eye toggle-password" onclick="togglePassword('loginPassword', this)"></i>
        </div>
        <label style="color: #ccc;"><input type="checkbox" name="remember" value="1"> Запомнить меня</label>
        <button type="submit">Войти</button>
      </form>
    </div>
  </div>
</div>

<!-- Регистрация -->
<div id="registerModal" class="modal">
  <div class="modal-content">
    <span class="modal-close" onclick="closeModal('registerModal')">&times;</span>
    <div class="modal-header"><h2>Регистрация</h2></div>
    <div class="modal-body">
      <form action="register_action.php" method="post" onsubmit="formatPhone('registerPhone')">
        <div class="field"><i class="fas fa-envelope"></i>
          <input type="email" name="email" placeholder="Email" required>
        </div>
        <div class="field"><i class="fas fa-phone"></i>
          <input type="text" name="phone" id="registerPhone" placeholder="Номер телефона (начиная с 9)" pattern="[9][0-9]{9}" required>
        </div>
        <div class="field"><i class="fas fa-user"></i>
          <input type="text" name="last_name" placeholder="Фамилия" required>
        </div>
        <div class="field"><i class="fas fa-user"></i>
          <input type="text" name="first_name" placeholder="Имя" required>
        </div>
        <div class="field"><i class="fas fa-user"></i>
          <input type="text" name="middle_name" placeholder="Отчество">
        </div>
        <div class="field"><i class="fas fa-building"></i>
          <input type="text" name="company_name" placeholder="Название ИП" required>
        </div>
        <div class="field"><i class="fas fa-store"></i>
          <input type="text" name="store_name" placeholder="Название магазина" required>
        </div>
        <div class="field"><i class="fas fa-lock"></i>
          <input type="password" name="password" id="registerPassword" placeholder="Пароль" required autocomplete="off">
          <i class="fas fa-eye toggle-password" onclick="togglePassword('registerPassword', this)"></i>
        </div>
        <div class="field"><i class="fas fa-lock"></i>
          <input type="password" name="confirm_password" id="confirmPassword" placeholder="Повторите пароль" required autocomplete="off">
          <i class="fas fa-eye toggle-password" onclick="togglePassword('confirmPassword', this)"></i>
        </div>
        <button type="submit">Зарегистрироваться</button>
      </form>
    </div>
  </div>
</div>

<script>
function openModal(id) {
    document.getElementById(id).style.display = 'block';
}
function closeModal(id) {
    document.getElementById(id).style.display = 'none';
}
window.onclick = function(e) {
    if (e.target.classList.contains('modal')) {
        e.target.style.display = 'none';
    }
}
function formatPhone(id) {
    var el = document.getElementById(id);
    if (!el) return;
    var p = el.value.trim().replace(/\D+/g, '');
    if (p.length === 11 && p[0] === '8') p = '+7' + p.slice(1);
    else if (p.length === 10 && p[0] === '9') p = '+7' + p;
    else if (p.length === 11 && p[0] === '7') p = '+7' + p.slice(1);
    else if (p.length === 12 && p.startsWith('79')) p = '+' + p;
    el.value = p;
}
function togglePassword(inputId, icon) {
    const input = document.getElementById(inputId);
    const isVisible = input.type === 'text';
    input.type = isVisible ? 'password' : 'text';
    icon.classList.toggle('fa-eye');
    icon.classList.toggle('fa-eye-slash');
}
<?php if (isset($_GET['error'])): ?>
openModal('loginModal');
<?php endif; ?>
</script>
</body>
</html>
