<?php
/*  get_client_info.php — выдача расширенных сведений о клиенте
 *  © 2025, IDEAL TranSport
 *  v2.4 (2025‑06‑20)
 ****************************************************************/

ini_set('display_errors', 0);
error_reporting(E_ALL);

require_once 'session_init.php';
session_start();
header('Content-Type: application/json; charset=utf-8');

require_once __DIR__ . '/db_connection.php';

/* ---------- Логирование ---------- */
$logDir = __DIR__ . '/logs';
if (!is_dir($logDir) && !mkdir($logDir, 0777, true)) {
    $logFile = __DIR__ . '/client_info_debug.log';
} else {
    $logFile = $logDir . '/client_info_debug.log';
}
function clog(string $msg): void {
    global $logFile;
    $ts = date('Y-m-d H:i:s');
    $ip = $_SERVER['REMOTE_ADDR'] ?? '-';
    file_put_contents($logFile, "[$ts][$ip] $msg\n", FILE_APPEND);
}

clog("Старт get_client_info.php user_id=" . ($_GET['user_id'] ?? '—') .
     " role=" . ($_SESSION['role'] ?? '—'));

/* ---------- ACL ---------- */
// Разрешаем доступ только администраторам и менеджерам
$role = $_SESSION['role'] ?? '';
if (!in_array($role, ['admin','manager'])) {
    clog('ОШИБКА: доступ запрещён для роли ' . $role);
    echo json_encode(['success' => false, 'message' => 'Доступ запрещён']); exit;
}

/* ---------- Входные данные ---------- */
$userId = intval($_GET['user_id'] ?? 0);
if ($userId <= 0) {
    clog('ОШИБКА: некорректный user_id');
    echo json_encode(['success'=>false,'message'=>'Некорректный ID клиента']); exit;
}
// Для админа всегда включаем password_hash, для менеджера — только при ?with_pwd=1
$includePassHash = ($role === 'admin') || ($role === 'manager' && !empty($_GET['with_pwd']));

/* ---------- Определяем колонку даты регистрации ---------- */
$regCandidates = ['created_at','registration_date','reg_date','created','dt_create'];
$regCol = null;
foreach ($regCandidates as $c) {
    $cEsc = $conn->real_escape_string($c);
    $res = $conn->query("SHOW COLUMNS FROM usersff LIKE '$cEsc'");
    if ($res && $res->num_rows) { $regCol = $c; break; }
}
if (!$regCol) clog('ВНИМАНИЕ: колонка даты регистрации не найдена; будет NULL');

if ($regCol) {
    $regColEsc = $conn->real_escape_string($regCol);
    $regExpr = "DATE_FORMAT(`" . $regColEsc . "`, '%d.%m.%Y %H:%i') AS registration_date";
} else {
    $regExpr = "NULL AS registration_date";
}
    
/* ---------- Определяем колонку хэша пароля ---------- */
$passCol = null;
$passCandidates = ['password', 'password_hash'];
foreach ($passCandidates as $p) {
    $pEsc = $conn->real_escape_string($p);
    $res = $conn->query("SHOW COLUMNS FROM usersff LIKE '$pEsc'");
    if ($res && $res->num_rows) { $passCol = $p; break; }
}
if ($includePassHash && !$passCol) {
    clog('ВНИМАНИЕ: колонка хэша пароля не найдена');
    $includePassHash = false;
}    

/* ---------- 1. Основные данные клиента ---------- */
$selectPass = ($includePassHash && $passCol) ? ", `$passCol`" : "";
$sql1 = "SELECT id, email, phone, first_name, last_name" . $selectPass .
        ", " . $regExpr . ", last_login FROM usersff WHERE id = ? LIMIT 1";
if (!preg_match('/^[a-z0-9_]+$/i', $regCol ?? 'dummy')) {
    clog("FATAL: недопустимое имя столбца «{$regCol}»");
    echo json_encode(['success'=>false,'message'=>'Ошибка сервера']); exit;
}
$stmt = $conn->prepare($sql1);
if (!$stmt) { clog("SQL‑1 prepare: ".$conn->error); echo json_encode(['success'=>false,'message'=>'DB error']); exit; }
$stmt->bind_param('i',$userId);
if(!$stmt->execute()){ clog("SQL‑1 exec: ".$stmt->error); echo json_encode(['success'=>false,'message'=>'DB error']); exit; }
$u = $stmt->get_result()->fetch_assoc();
$stmt->close();
if(!$u){ clog("Клиент $userId не найден"); echo json_encode(['success'=>false,'message'=>'Клиент не найден']); exit; }
clog("Найден клиент id={$u['id']} email={$u['email']}");

/* ---------- 2. Сводная статистика заказов ---------- */
$sql2 = "SELECT COUNT(*) AS cnt, COALESCE(SUM(payment),0) AS sum_pay,
         MAX(order_date) AS last_ord
         FROM orders WHERE user_id = ? AND is_deleted = 0 AND status <> 'Удалён клиентом'";
$stmt = $conn->prepare($sql2);
if (!$stmt) { clog("SQL‑2 prepare: " . $conn->error); echo json_encode(['success'=>false,'message'=>'DB error']); exit; }
$stmt->bind_param('i', $userId);
if (!$stmt->execute()) { clog("SQL‑2 exec: " . $stmt->error); echo json_encode(['success'=>false,'message'=>'DB error']); exit; }
$stat = $stmt->get_result()->fetch_assoc();
$stmt->close();

/* ---------- 3. Статусы ---------- */
$stmt=$conn->prepare("SELECT status, COUNT(*) AS c FROM orders WHERE user_id=? AND is_deleted = 0 AND status <> 'Удалён клиентом' GROUP BY status");
if(!$stmt){ clog("SQL‑3 prepare: ".$conn->error); echo json_encode(['success'=>false,'message'=>'DB error']); exit; }
$stmt->bind_param('i',$userId);
if(!$stmt->execute()){ clog("SQL‑3 exec: ".$stmt->error); echo json_encode(['success'=>false,'message'=>'DB error']); exit; }
$res=$stmt->get_result();
$statusMap=['Завершено'=>0,'Отклонён'=>0,'Активные'=>0];
while($row=$res->fetch_assoc()){
    $s=mb_strtolower($row['status'],'UTF-8');
    if(in_array($row['status'],['Выполнено','Завершено']))              $statusMap['Завершено'] += $row['c'];
    elseif(strpos($s,'отказ')!==false||strpos($s,'отклон')!==false)     $statusMap['Отклонён']  += $row['c'];
    else                                                                $statusMap['Активные']  += $row['c'];
}
$stmt->close();

/* ---------- 4. История входов (5 последних) ---------- */
$logins=[];
if(($tbl=$conn->query("SHOW TABLES LIKE 'user_logins'")) && $tbl->num_rows){
    $s=$conn->prepare("SELECT login_time FROM user_logins WHERE user_id=? ORDER BY login_time DESC LIMIT 5");
        if(!$s){ clog("SQL‑4 prepare: ".$conn->error); echo json_encode(['success'=>false,'message'=>'DB error']); exit; }
    $s->bind_param("i",$userId);
    if(!$s->execute()){ clog("SQL‑4 exec: ".$s->error); echo json_encode(['success'=>false,'message'=>'DB error']); exit; }
    $r=$s->get_result(); while($row=$r->fetch_assoc()) $logins[]=$row['login_time']; $s->close();
}elseif(!empty($u['last_login'])){ $logins[]=$u['last_login']; }

/* ---------- 5. Последняя активность ---------- */
$lastAct = max(
    $u['last_login']    ? strtotime($u['last_login'])      : 0,
    $stat['last_ord']   ? strtotime($stat['last_ord'])     : 0
);
$lastActStr = $lastAct ? date('d.m.Y H:i', $lastAct) : '—';

/* ---------- 6. Формирование ответа ---------- */
$out = [
    'id'              => (int)$u['id'],
    'email'           => $u['email'],
    'phone'           => $u['phone'],
    'first_name'      => $u['first_name'],
    'last_name'       => $u['last_name'],
    'registration_date'=> $u['registration_date'],
    'total_orders'    => (int)$stat['cnt'],
    'total_sum'       => (float)$stat['sum_pay'],
    'last_activity'   => $lastActStr,
    'login_history'   => $logins,
    'statuses'        => $statusMap
];
if($includePassHash && $passCol && isset($u[$passCol])) {
    $out['password_hash'] = $u[$passCol];
}

clog("УСПЕХ: данные сформированы для user_id=$userId");
echo json_encode(['success'=>true,'client'=>$out], JSON_UNESCAPED_UNICODE);

$conn->close();