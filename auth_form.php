<?php
// ----------------------------------------------------------
// Страница лендинга перед авторизацией (PHP + HTML)
// ----------------------------------------------------------
require_once 'session_init.php';
session_start();
require_once 'db_connection.php';

// Подхватываем контент из БД (если используется)
$contentAbout    = '';
$contentServices = '';
if ($stmt = $conn->prepare("SELECT section, content FROM site_content WHERE section IN ('about','services')")) {
    $stmt->execute();
    $res = $stmt->get_result();
    while ($row = $res->fetch_assoc()) {
        if ($row['section'] === 'about')    $contentAbout    = $row['content'];
        if ($row['section'] === 'services') $contentServices = $row['content'];
    }
    $stmt->close();
}

// Попытка «Запомнить меня»
if (!isset($_SESSION['role']) && isset($_COOKIE['remember_token'], $_COOKIE['remember_user'])) {
    $userId = (int)$_COOKIE['remember_user'];
    $token  = $_COOKIE['remember_token'];
    if ($stmt = $conn->prepare("SELECT id, role, remember_token, token_expiry FROM usersff WHERE id = ? LIMIT 1")) {
        $stmt->bind_param('i', $userId);
        $stmt->execute();
        $res = $stmt->get_result();
        if ($u = $res->fetch_assoc()) {
            $ok = !empty($u['remember_token']) && !empty($u['token_expiry'])
                  && strtotime($u['token_expiry']) > time()
                  && password_verify($token, $u['remember_token']);
            if ($ok) {
                session_regenerate_id(true);
                $_SESSION['user_id'] = $u['id'];
                $_SESSION['role']    = $u['role'];
                $secure = !empty($_SERVER['HTTPS']);
                // Прежняя семантика сохранена
                setcookie(session_name(), session_id(), time()+60*24*60*60, "/", "", $secure, true);
            } else {
                setcookie('remember_token','',time()-3600,'/');
                setcookie('remember_user','',time()-3600,'/');
            }
        }
        $stmt->close();
    }
}

// Авторизованным пользователям – на главную
if (isset($_SESSION['role'])) {
    if ($_SESSION['role'] === 'client') {
        header('Location: client/');
    } else {
        header('Location: index.php');
    }
    exit();
}
?>
<!doctype html>
<html lang="ru" data-theme="auto">
<head>
<meta charset="utf-8">
<title>Компания — Вход / Регистрация</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<link rel="preconnect" href="https://fonts.googleapis.com" crossorigin>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css">
<link rel="stylesheet" href="styles/auth_form.css?v=<?php echo time(); ?>">
</head>

<body class="landing-page">
<header class="navbar" role="banner">
    <div class="nav-left">
        <a class="logo" href="#" aria-label="На главную">FF IDEAL</a>
        <nav class="nav-links" aria-label="Основная навигация">
            <a href="#about">О компании</a>
            <a href="#location">Где мы</a>
            <a href="#contact">Контакты</a>
        </nav>
    </div>
    <div class="nav-buttons">
        <button class="btn ghost" onclick="openModal('authModal','login')">Вход</button>
        <button class="btn ghost" onclick="openModal('authModal','register')">Регистрация</button>
    </div>

    <button class="burger" aria-label="Меню" aria-expanded="false" aria-controls="mobileMenu" onclick="toggleMenu(this)">
        <span></span><span></span><span></span>
    </button>

    <div id="mobileMenu" class="mobile-menu" hidden>
        <a href="#about" onclick="toggleMenuFromLink()">О компании</a>
        <a href="#location" onclick="toggleMenuFromLink()">Где мы</a>
        <a href="#contact" onclick="toggleMenuFromLink()">Контакты</a>
        <div class="mobile-actions">
            <button class="btn ghost" onclick="openModal('authModal','login');toggleMenuFromLink()">Вход</button>
            <button class="btn ghost" onclick="openModal('authModal','register');toggleMenuFromLink()">Регистрация</button>
        </div>
    </div>
</header>

<main class="info-container">
    <section id="about" class="info-section" aria-labelledby="aboutTitle">
        <div class="about-content">
    <!-- Первая секция: текст + фото -->
    <div class="about-row">
        <div class="glass">
        <div class="about-image">
            <img src="images/about1.png" alt="Забор и доставка товаров">
        </div>
        <div class="about-text">
            <h3>Мы — FF IDEAL</h3>
            <p>
                Наша компания занимается перевозкой товаров на маркетплейсы и предоставляет полный цикл фулфилмента. Забираем продукцию у клиента, бережно упаковываем и доставляем на площадки Wildberries, Ozon, Yandex Market и другие.
            </p>
        </div>
        </div>
    </div>

    <!-- Вторая секция: фото + текст (чередуем порядок) -->
    <div class="about-row reverse">
        <div class="glass">
        <div class="about-image">
            <img src="images/about2.png" alt="Упаковка и фулфилмент">
        </div>
        <div class="about-text">
            
            <h3>Фулфилмент</h3>
            <p>
                Мы берём на себя хранение, упаковку, маркировку и отправку товаров. Вы освобождаетесь от забот о логистике и можете сосредоточиться на развитии бизнеса.
            </p>
            </div>
        </div>
    </div>

    <!-- Третья секция: текст + фото -->
    <div class="about-row">
        <div class="glass">
            <div class="about-image">
                <img src="images/about3.png" alt="Ведение кабинетов">
            </div>
            <div class="about-text">
                
                <h3>Ведение кабинетов</h3>
                <p>
                    Управляем вашими кабинетами на маркетплейсах, следим за остатками, оформляем документы и контролируем отгрузки.
                </p>
        
            <p class="summary">
                На сегодняшний день мы работаем с Wildberries, Ozon, Yandex Market и постоянно расширяемся. Главный офис находится в Хасавюрте, филиалы — в Махачкале, Кизляре, Кизилюрте и Астрахани. Мы всегда открыты к новым партнёрам и готовы обеспечить надёжную логистику для вашего бизнеса.
            </p>
            </div>
        </div>
</div>

    </section>

    <section id="location" class="info-section" aria-labelledby="locationTitle">
        <div class="glass">
            <h2 id="locationTitle">Где мы находимся</h2>
            <p>Наш офис: <strong>2-я Совхозная улица, Республика Дагестан, г.&nbsp;Хасавюрт</strong></p>
            <div class="map-embed">
                <iframe
                    src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d993.893814413909!2d46.57073221736964!3d43.256824482677075!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x404e6d565f272eb9%3A0xa41e187a9062b1b5!2z0KTRg9C70YTQuNC70LzQtdC90YIgSURFQUw!5e0!3m2!1sru!2sru!4v1756068671610!5m2!1sru!2sru"
                    width="100%" height="320" frameborder="0" style="border:0;" allowfullscreen="" loading="lazy" referrerpolicy="no-referrer-when-downgrade"
                    aria-label="Карта расположения офиса"></iframe>
            </div>
        </div>
    </section>

    <section id="contact" class="info-section" aria-labelledby="contactTitle">
        <div class="glass">
            <h2 id="contactTitle">Контакты</h2>
            <?php echo !empty($contentServices)
                ? $contentServices
                : '<p>Телефон: <a class="link" href="tel:+71234567890">+7 (123) 456-78-90</a><br>Email: <a class="link" href="mailto:info@example.com">info@example.com</a></p>'; ?>
        </div>
    </section>
</main>

<!-- Модальное окно для входа/регистрации -->
<div id="authModal"
     class="auth-modal <?php if (isset($_GET['error']) || isset($_GET['reg_error']) || isset($_GET['success'])) echo 'active'; ?>"
     role="dialog" aria-modal="true" aria-labelledby="authTitle" data-modal>
    <div class="auth-content" tabindex="-1">
        <button class="close" aria-label="Закрыть" onclick="closeModal('authModal')">&times;</button>
        <h2 id="authTitle" class="visually-hidden">Аутентификация</h2>

        <div class="tabs" role="tablist" aria-label="Переключение форм">
            <button id="loginTab"
                    class="<?php echo isset($_GET['reg_error']) ? '' : 'active'; ?>"
                    role="tab" aria-selected="<?php echo isset($_GET['reg_error']) ? 'false' : 'true'; ?>"
                    onclick="showLogin()">Вход</button>
            <button id="registerTab"
                    class="<?php echo isset($_GET['reg_error']) ? 'active' : ''; ?>"
                    role="tab" aria-selected="<?php echo isset($_GET['reg_error']) ? 'true' : 'false'; ?>"
                    onclick="showRegister()">Регистрация</button>
        </div>

        <form id="loginForm" class="<?php echo isset($_GET['reg_error']) ? '' : 'active'; ?>"
              action="auth.php" method="post" onsubmit="formatPhone('login_phone')" aria-labelledby="loginTab">
            <?php if (isset($_GET['error'])): ?>
                <div class="error-message" role="alert"><?= htmlspecialchars($_GET['error'], ENT_QUOTES, 'UTF-8') ?></div>
            <?php elseif (isset($_GET['success'])): ?>
                <div class="success-message" role="status"><?= htmlspecialchars(urldecode($_GET['success']), ENT_QUOTES, 'UTF-8') ?></div>
            <?php endif; ?>

            <label class="field">
                <i class="fa fa-phone" aria-hidden="true"></i>
                <input id="login_phone" name="phone" type="tel" value="+7" pattern="^\+7\d{10}$" required
                       inputmode="numeric" autocomplete="tel" aria-label="Телефон">
            </label>

            <label class="field">
                <i class="fa fa-lock" aria-hidden="true"></i>
                <input id="login_password" name="password" type="password" placeholder="Пароль" required
                       autocomplete="current-password" aria-label="Пароль">
                <i class="fa fa-eye toggle-password" onclick="togglePassword('login_password', this)" aria-hidden="true"></i>
            </label>

            <label class="remember-me">
                <input type="checkbox" id="remember" name="remember" checked>
                <span>Запомнить меня</span>
            </label>

            <button type="submit" class="submit btn">Войти</button>
            <p class="t-center m-top-12">
                <a href="#" class="link" onclick="closeModal('authModal'); openModal('forgotModal'); return false;">Забыли пароль?</a>
            </p>
        </form>

        <form id="registerForm" class="<?php echo isset($_GET['reg_error']) ? 'active' : ''; ?>"
              action="register_action.php" method="post" onsubmit="formatPhone('reg_phone')" aria-labelledby="registerTab">
            <?php if (isset($_GET['reg_error'])): ?>
                <div class="error-message" role="alert"><?= htmlspecialchars($_GET['reg_error'], ENT_QUOTES, 'UTF-8') ?></div>
            <?php endif; ?>

            <label class="field"><i class="fa fa-user" aria-hidden="true"></i><input type="text" name="last_name" placeholder="Фамилия" required autocomplete="family-name"></label>
            <label class="field"><i class="fa fa-user" aria-hidden="true"></i><input type="text" name="first_name" placeholder="Имя" required autocomplete="given-name"></label>
            <label class="field"><i class="fa fa-user" aria-hidden="true"></i><input type="text" name="middle_name" placeholder="Отчество (если имеется)" autocomplete="additional-name"></label>
            <label class="field"><i class="fa fa-envelope" aria-hidden="true"></i><input type="email" name="email" placeholder="Email" required autocomplete="email"></label>
            <label class="field"><i class="fa fa-phone" aria-hidden="true"></i><input id="reg_phone" name="phone" type="tel" value="+7" pattern="^\+7\d{10}$" required inputmode="numeric" autocomplete="tel"></label>
            <label class="field"><i class="fa fa-building" aria-hidden="true"></i><input type="text" name="company_name" placeholder="Компания" required autocomplete="organization"></label>
            <label class="field"><i class="fa fa-store" aria-hidden="true"></i><input type="text" name="store_name" placeholder="Магазин" required></label>
            <label class="field"><i class="fa fa-lock" aria-hidden="true"></i><input id="reg_password" name="password" type="password" placeholder="Пароль" required autocomplete="new-password"><i class="fa fa-eye toggle-password" onclick="togglePassword('reg_password', this)" aria-hidden="true"></i></label>
            <label class="field"><i class="fa fa-lock" aria-hidden="true"></i><input id="reg_confirm_password" name="confirm_password" type="password" placeholder="Подтверждение пароля" required autocomplete="new-password"><i class="fa fa-eye toggle-password" onclick="togglePassword('reg_confirm_password', this)" aria-hidden="true"></i></label>
            <button type="submit" class="submit btn">Зарегистрироваться</button>
        </form>
    </div>
</div>

<!-- Модальное окно восстановления пароля -->
<div id="forgotModal" class="auth-modal" role="dialog" aria-modal="true" aria-labelledby="forgotTitle" data-modal>
    <div class="auth-content" tabindex="-1">
        <button class="close" aria-label="Закрыть" onclick="closeModal('forgotModal')">&times;</button>
        <h2 id="forgotTitle" class="h-reset">Восстановление пароля</h2>
        <form class="active" action="forgot_password.php" method="post">
            <label class="field">
                <i class="fa fa-envelope" aria-hidden="true"></i>
                <input type="text" name="email_or_phone" placeholder="Email или телефон" required aria-label="Email или телефон">
            </label>
            <button type="submit" class="submit btn">Отправить код</button>
        </form>
    </div>
</div>

<script>
// ---------- Бургер-меню ----------
function toggleMenu(btn){
  const menu = document.getElementById('mobileMenu');
  const expanded = btn.getAttribute('aria-expanded') === 'true';
  btn.setAttribute('aria-expanded', String(!expanded));
  menu.hidden = expanded;
  btn.classList.toggle('open', !expanded);
  // Блокируем скролл фона
  document.body.classList.toggle('menu-open', !expanded);
  // Если открываем меню — закрываем активные модалки
  if (!expanded) {
    document.querySelectorAll('.auth-modal.active').forEach(m => handleModalClose(m));
  }
}
function closeMobileMenu(){
  const burger = document.querySelector('.burger');
  const menu = document.getElementById('mobileMenu');
  if (burger) { burger.classList.remove('open'); burger.setAttribute('aria-expanded','false'); }
  if (menu)   { menu.hidden = true; }
  document.body.classList.remove('menu-open');
}
function toggleMenuFromLink(){ closeMobileMenu(); }

// Закрыть мобильное меню при ресайзе на десктоп
window.addEventListener('resize', () => {
  if (window.innerWidth > 920) closeMobileMenu();
});

// ---------- Модалки ----------
function handleModalOpen(m){
  if (!m) return;
  // На мобиле меню не должно перекрываться с модалкой
  closeMobileMenu();
  document.body.classList.add('modal-open');
  const focusTarget = m.querySelector('input, button, [tabindex]:not([tabindex="-1"])');
  m.classList.add('active');
  if (focusTarget) focusTarget.focus();
  trapFocus(m);
}
function handleModalClose(m){
  if (!m) return;
  m.classList.remove('active');
  document.body.classList.remove('modal-open');
  releaseTrapFocus();
}

function openModal(id, tab){
  const m = document.getElementById(id);
  if (!m) return;
  if (id === 'authModal') (tab === 'register') ? showRegister() : showLogin();
  handleModalOpen(m);
}
function closeModal(id){
  const m = document.getElementById(id);
  handleModalClose(m);
}
window.addEventListener('click', (e)=>{
  if (e.target.classList && e.target.classList.contains('auth-modal')) {
    handleModalClose(e.target);
  }
});
window.addEventListener('keydown', (e)=>{
  if (e.key === 'Escape'){
    document.querySelectorAll('.auth-modal.active').forEach(m => handleModalClose(m));
    closeMobileMenu();
  }
});

// ---------- Переключение вкладок ----------
function showLogin(){
  document.getElementById('loginForm').classList.add('active');
  document.getElementById('registerForm').classList.remove('active');
  document.getElementById('loginTab').classList.add('active');
  document.getElementById('registerTab').classList.remove('active');
}
function showRegister(){
  document.getElementById('loginForm').classList.remove('active');
  document.getElementById('registerForm').classList.add('active');
  document.getElementById('loginTab').classList.remove('active');
  document.getElementById('registerTab').classList.add('active');
}

// ---------- Показ/скрытие пароля ----------
function togglePassword(inputId, icon){
  const input = document.getElementById(inputId);
  if (!input) return;
  const isPass = input.type === 'password';
  input.type = isPass ? 'text' : 'password';
  if (icon){
    icon.classList.toggle('fa-eye');
    icon.classList.toggle('fa-eye-slash');
  }
}

// ---------- Формат телефона ----------
function formatPhone(id){
  const input = document.getElementById(id);
  if (!input) return;
  let d = input.value.replace(/\D/g, '');
  if (d.charAt(0) === '7') d = d.slice(1);
  d = d.slice(0, 10);
  input.value = '+7' + d;
}

document.addEventListener('DOMContentLoaded', ()=>{
  // Инициализация телефонных полей
  ['login_phone','reg_phone'].forEach(id=>{
    const input = document.getElementById(id);
    if (!input) return;
    if (!input.value) input.value = '+7';
    input.addEventListener('focus', ()=>{
      if (input.value === '') input.value = '+7';
      setTimeout(()=> input.setSelectionRange(input.value.length,input.value.length), 0);
    });
    input.addEventListener('input', ()=>{
      let d = input.value.replace(/\D/g,'');
      if (d.charAt(0)==='7') d=d.slice(1);
      d = d.slice(0,10);
      input.value = '+7' + d;
    });
    input.addEventListener('click', ()=>{
      if (input.selectionStart < 2) input.setSelectionRange(2,2);
    });
  });

  // Если модалка активна по GET-параметрам — корректно её «открываем»
  const preActive = document.querySelector('#authModal.active');
  if (preActive) handleModalOpen(preActive);
});

// ---------- Трап фокуса в модалке ----------
let trapHandler = null;
function trapFocus(container){
  releaseTrapFocus();
  const selectors = [
    'a[href]', 'button:not([disabled])', 'input:not([disabled])',
    'textarea:not([disabled])', 'select:not([disabled])',
    '[tabindex]:not([tabindex="-1"])'
  ].join(',');
  const focusables = Array.from(container.querySelectorAll(selectors)).filter(el=>el.offsetParent !== null);
  if (focusables.length === 0) return;
  const first = focusables[0], last = focusables[focusables.length-1];
  trapHandler = function(e){
    if (e.key !== 'Tab') return;
    if (e.shiftKey && document.activeElement === first){
      e.preventDefault(); last.focus();
    } else if (!e.shiftKey && document.activeElement === last){
      e.preventDefault(); first.focus();
    }
  };
  container.addEventListener('keydown', trapHandler);
}
function releaseTrapFocus(){
  document.querySelectorAll('[data-modal]').forEach(m=>{
    if (trapHandler) m.removeEventListener('keydown', trapHandler);
  });
  trapHandler = null;
}
</script>

</body>
</html>