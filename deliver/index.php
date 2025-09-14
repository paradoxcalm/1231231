<?php
// deliver/index.php: Dashboard page for the delivery role
//
// This page displays a list of all pending pick‑up requests so that the
// courier (доставщик) can see where and when to collect the goods. The
// courier does not update statuses manually; instead they will scan a QR
// code associated with a specific pick‑up and confirm that they have
// collected the correct order. Once the scan is confirmed, the system
// updates the record and marks the pick‑up as completed.

// Include your database connection here. The file db_connection.php
// should create a variable `$conn` with an active MySQLi or PDO
// connection. If you store connection logic elsewhere, update the
// require path accordingly.
require_once __DIR__ . '/../db_connection.php';

// Запускаем сессию и проверяем, что роль пользователя — доставщик. Иначе перенаправляем.
require_once '../session_init.php';
session_start();
// Убедимся, что только доставщики могут просматривать эту страницу
if (!isset($_SESSION['role']) || $_SESSION['role'] !== 'deliverer') {
    header('Location: /index.php');
    exit();
}

// ID текущего доставщика (используем для фильтрации своих заявок)
$delivererId = (int)($_SESSION['user_id'] ?? 0);

// Определяем фильтр: active|own|archive
$filter = isset($_GET['filter']) ? $_GET['filter'] : 'active';

// Построим условие WHERE в зависимости от выбранного фильтра.
$where = '';
switch ($filter) {
    case 'own':
        // Заявки, принятые текущим доставщиком и ещё не завершённые
        $where = "p.status = 'accepted' AND p.assigned_to = " . $delivererId;
        break;
    case 'archive':
        // Выполненные (забранные или доставленные)
        $where = "p.status IN ('picked_up','delivered')";
        break;
    case 'active':
    default:
        // Свободные + принятые кем‑то (для отображения), но не завершённые
        $where = "p.status IN ('new','accepted')";
        break;
}

// Составляем запрос. Выводим координаты, чтобы строить маршруты.
$query = "SELECT p.id, p.order_id, p.address, p.contact_name, p.contact_phone, "
        . "p.goods_list, p.latitude, p.longitude, p.status, p.assigned_to, p.task_number, p.accepted_at, "
        . "p.requested_at, s.accept_time "
        . "FROM pickups p "
        . "LEFT JOIN shipments s ON s.order_id = p.order_id "
        . ( $where ? "WHERE " . $where . " " : "" )
        . "ORDER BY p.status ASC, p.accepted_at ASC, p.requested_at ASC";

$result = $conn->query($query);
if (!$result) {
    $errorMessage = $conn->error;
    error_log('Ошибка выполнения запроса: ' . $errorMessage);
    if (defined('DEBUG') && DEBUG) {
        die('Ошибка базы данных: ' . htmlspecialchars($errorMessage));
    } else {
        die('Ошибка базы данных. Пожалуйста, попробуйте позже.');
    }
}

?>
<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Задания на забор</title>
    <style>
        /* Общие стили */
        * {
            box-sizing: border-box;
        }
        body {
            margin: 0;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            background-color: #f0f2f5;
            color: #222;
        }
        /* Шапка */
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
        /* Контейнер */
        .container {
            max-width: 900px;
            margin: 20px auto;
            padding: 0 16px;
        }
        /* Карточка */
        .card {
            background: #fff;
            border-radius: 12px;
            padding: 20px 24px;
            margin-bottom: 18px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.05);
            cursor: pointer;
        }
        /* Состояния карточек */
        .card.card-new {
            /* свободная заявка */
            border-left: 6px solid #0ea5e9; /* голубой */
        }
        .card.card-own {
            /* заявка, принятая текущим доставщиком */
            border-left: 6px solid #14b8a6; /* зеленый */
            background: #f0fdf4;
        }
        .card.card-taken {
            /* заявка, занятая другим доставщиком */
            border-left: 6px solid #fbbf24; /* желтый */
            background: #fffbeb;
            opacity: 0.7;
        }
        .card.card-completed {
            /* заявка завершена (архив) */
            border-left: 6px solid #a3a3a3; /* серый */
            background: #f5f5f5;
            opacity: 0.6;
        }
        .card h2 {
            margin: 0 0 10px 0;
            font-size: 19px;
            font-weight: 700;
        }
        .card .info {
            margin-bottom: 6px;
            font-size: 15px;
            color: #555;
        }
        .card .info strong {
            color: #333;
        }
        .card .actions {
            margin-top: 14px;
            display: flex;
            flex-wrap: wrap;
            gap: 10px;
        }
        .btn {
            display: inline-block;
            padding: 10px 14px;
            border-radius: 8px;
            color: #fff;
            font-weight: 600;
            text-decoration: none;
            transition: background 0.2s;
        }
        .btn.yandex {
            background: #007acc;
        }
        .btn.yandex:hover {
            background: #005fa3;
        }
        .btn.google {
            background: #10b981;
        }
        .btn.google:hover {
            background: #0e9d69;
        }
        .btn.confirm {
            background: #f97316;
        }
        .btn.confirm:hover {
            background: #ea580c;
        }
        .no-tasks {
            text-align: center;
            padding: 30px;
            background: #fff;
            border-radius: 12px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.05);
            font-size: 16px;
            color: #666;
        }  /* Стили модального окна */
        .modal-overlay {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 1000;
        }
        .modal-content {
            background: #fff;
            border-radius: 8px;
            padding: 20px;
            max-width: 500px;
            width: 90%;
            max-height: 90%;
            overflow-y: auto;
            position: relative;
        }
        .modal-close {
            position: absolute;
            top: 8px;
            right: 12px;
            background: none;
            border: none;
            font-size: 24px;
            cursor: pointer;
        }
    </style>
</head>
<body>
    <header class="header">
        <div class="title">Задания на забор</div>
        <a class="exit" href="../logout.php">Выйти</a>
    </header>
    <main class="container">
  <!-- Фильтры -->
  <nav style="margin-bottom: 16px; font-size: 14px;">
    <a href="?filter=active" style="margin-right:12px; text-decoration:none; font-weight:<?= $filter==='active' ? '700' : '500'; ?>; color:<?= $filter==='active' ? '#0d47a1' : '#4b5563'; ?>;">Активные</a>
    <a href="?filter=own" style="margin-right:12px; text-decoration:none; font-weight:<?= $filter==='own' ? '700' : '500'; ?>; color:<?= $filter==='own' ? '#0d47a1' : '#4b5563'; ?>;">Выполняются</a>
    <a href="?filter=archive" style="text-decoration:none; font-weight:<?= $filter==='archive' ? '700' : '500'; ?>; color:<?= $filter==='archive' ? '#0d47a1' : '#4b5563'; ?>;">Архив</a>
  </nav>
  <?php if ($result && $result->num_rows > 0): ?>
  <?php while ($row = $result->fetch_assoc()): ?>
    <?php
      $taskId   = (int)$row['id'];
      $status   = $row['status'];
      $assigned = (int)($row['assigned_to'] ?? 0);
      $isOwn    = ($status === 'accepted' && $assigned === $delivererId);

      // Класс карточки по статусу (минимальные стили подсветки)
      $cardClass = 'card';
      if ($status === 'new') {
          $cardClass .= ' card-new';
      } elseif ($status === 'accepted') {
          $cardClass .= $isOwn ? ' card-own' : ' card-taken';
      } elseif (in_array($status, ['picked_up','delivered'], true)) {
          $cardClass .= ' card-completed';
      }

      // Заголовок: Задание №N или fallback на ID
      $title = !empty($row['task_number'])
        ? ('Задание №' . (int)$row['task_number'])
        : ('Задание #' . $taskId);

      $contactPhone = trim((string)($row['contact_phone'] ?? ''));
      $acceptedAt   = $row['accepted_at'] ?? '';
      $requestedAt  = $row['requested_at'] ?? '';
      $acceptTime   = $row['accept_time'] ?? '';
      $lat = $row['latitude']  ?? null;
      $lng = $row['longitude'] ?? null;

      // Ссылки на навигатор (если есть координаты)
      $yurl = $gurl = '';
      if ($lat && $lng) {
          $yurl = 'https://yandex.ru/maps/?from=api-maps'
                . '&ll=' . rawurlencode($lng) . '%2C' . rawurlencode($lat)
                . '&mode=routes&rtext=%7E' . rawurlencode($lat) . '%2C' . rawurlencode($lng)
                . '&rtt=auto&z=14';
          $gurl = 'https://www.google.com/maps/dir/?api=1'
                . '&destination=' . rawurlencode($lat) . ',' . rawurlencode($lng)
                . '&travelmode=driving';
      }
    ?>
    <article id="pickup_<?= $taskId ?>" class="<?= $cardClass ?>" data-order-id="<?= (int)$row['order_id'] ?>" data-goods-list="<?= htmlspecialchars($row['goods_list'] ?? '', ENT_QUOTES) ?>" data-requested-at="<?= htmlspecialchars($requestedAt) ?>" data-accept-time="<?= htmlspecialchars($acceptTime) ?>">
      <h2><?= htmlspecialchars($title) ?></h2>

      <div class="info"><strong>Контакт:</strong> <?= htmlspecialchars($contactPhone ?: '—') ?></div>
      <div class="info"><strong>Запрос:</strong> <?= htmlspecialchars($requestedAt ?: '—') ?></div>
      <div class="info"><strong>Приёмка:</strong> <?= htmlspecialchars($acceptTime ?: '—') ?></div>

      <?php if ($isOwn && !empty($acceptedAt)): ?>
        <div class="info"><strong>Принято:</strong> <?= htmlspecialchars($acceptedAt) ?></div>
      <?php elseif ($status === 'accepted' && !$isOwn): ?>
        <div class="info pickup-status"><strong>Статус:</strong> Занято</div>
      <?php else: ?>
        <div class="info pickup-status"><strong>Статус:</strong> Свободно</div>
      <?php endif; ?>

      <div class="actions">
        <?php if ($yurl): ?>
          <a class="btn yandex" href="<?= $yurl ?>" target="_blank">Яндекс Маршрут</a>
        <?php endif; ?>
        <?php if ($gurl): ?>
          <a class="btn google" href="<?= $gurl ?>" target="_blank">Google Маршрут</a>
        <?php endif; ?>

        <?php if ($status === 'new'): ?>
          <!-- Принять задание -->
          <a class="btn confirm" href="accept_task.php?pickup_id=<?= $taskId ?>&filter=<?= htmlspecialchars($filter) ?>">Принять</a>

        <?php elseif ($isOwn): ?>
          <!-- Отказаться (вернуть в пул) -->
          <a class="btn" style="background:#9ca3af" href="reject_task.php?pickup_id=<?= $taskId ?>&filter=<?= htmlspecialchars($filter) ?>">Отказаться</a>
          <!-- Сканировать QR для подтверждения -->
          <a class="btn confirm scan" data-pickup-id="<?= $taskId ?>" href="javascript:void(0)">Сканировать</a>

        <?php else: ?>
          <!-- Занято другим или завершено — без кнопок -->
        <?php endif; ?>
      </div>
    </article>
  <?php endwhile; ?>
<?php else: ?>
  <div class="no-tasks">Новых заявок на забор нет.</div>
<?php endif; ?>

<!-- Подключение скриптов для сканирования -->
<script src="https://unpkg.com/html5-qrcode"></script>
<script src="https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js"></script>
<script src="/deliver/scan.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></script>
<script>
document.querySelectorAll('.card').forEach(card => {
    card.addEventListener('click', e => {
        if (e.target.closest('.btn')) return;
        const orderId = card.dataset.orderId;
        const goods = card.dataset.goodsList || '';
        const requestedAt = card.dataset.requestedAt || '';
        const acceptTime = card.dataset.acceptTime || '';
        openOrderModal(orderId, goods, requestedAt, acceptTime);
    });
});

function openOrderModal(orderId, goodsList, requestedAt, acceptTime) {
    fetch(`../get_orders.php?order_id=${orderId}&all=1`)
        .then(r => r.json())
        .then(data => {
            if (!data.success || !data.orders || !data.orders.length) return;
            const order = data.orders[0];
            const rec = order.reception || {};
            const boxes = Array.isArray(order.custom_boxes) ? order.custom_boxes : [];

            const overlay = document.createElement('div');
            overlay.className = 'modal-overlay';

            const boxHtml = boxes.length
                ? boxes.map(b => `${b.box_length}×${b.box_width}×${b.box_height} — ${b.box_count} шт.`).join('<br>')
                : '—';

            overlay.innerHTML = `
                <div class="modal-content">
                    <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">×</button>
                    <h3>Заявка №${order.order_id}</h3>
                    <div><strong>Список товаров:</strong> ${goodsList || order.goods_list || '—'}</div>
                    <div><strong>Упаковка:</strong> ${rec.packaging_type || order.packaging_type || '—'}</div>
                    <div><strong>Размеры:</strong> ${boxHtml}</div>
                    <div><strong>Запрос:</strong> ${requestedAt || '—'}</div>
                    <div><strong>Приёмка:</strong> ${acceptTime || '—'}</div>
                    <div><strong>QR‑код:</strong></div>
                    <div id="qrContainer"></div>
                </div>`;

            document.body.appendChild(overlay);

            if (order.qr_code) {
                new QRCode(overlay.querySelector('#qrContainer'), {
                    text: order.qr_code,
                    width: 128,
                    height: 128
                });
            }

            overlay.addEventListener('click', ev => {
                if (!ev.target.closest('.modal-content')) overlay.remove();
            });
        })
        .catch(err => console.error(err));
}
</script>

</main>

</body>
</html>