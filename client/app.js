function showHome() {
  const container = document.getElementById('dynamicContent');
  container.innerHTML = `
    <h1 class="text-2xl font-bold mb-4">Добро пожаловать!</h1>
    <p>Это клиентская панель IDEAL TranSport.</p>
  `;
}

document.getElementById('navHome').addEventListener('click', e => { e.preventDefault(); showHome(); });
document.getElementById('navSchedule').addEventListener('click', e => { e.preventDefault(); loadSchedule(); });
document.getElementById('navTariffs').addEventListener('click', e => { e.preventDefault(); loadTariffs(); });
document.getElementById('navOrders').addEventListener('click', e => { e.preventDefault(); loadOrders(); });
document.getElementById('profileLink').addEventListener('click', e => {
  e.preventDefault();
  loadEditData();
  toggleProfileDropdown(false);
});
document.getElementById('notificationsBtn').addEventListener('click', e => { e.preventDefault(); loadNotifications(); });

document.getElementById('profileBtn').addEventListener('click', e => { e.preventDefault(); toggleProfileDropdown(); });

function toggleProfileDropdown(force) {
  const dd = document.getElementById('profileDropdown');
  const show = typeof force === 'boolean' ? force : dd.classList.contains('hidden');
  if (show) dd.classList.remove('hidden'); else dd.classList.add('hidden');
}

function updateNotificationBadge(count) {
  const badge = document.getElementById('notificationBadge');
  if (count > 0) {
    badge.textContent = count;
    badge.classList.remove('hidden');
  } else {
    badge.classList.add('hidden');
  }
}

function fetchNotificationCount() {
  fetch('/fetch_notifications.php')
    .then(r => r.json())
    .then(data => {
      updateNotificationBadge(Array.isArray(data) ? data.length : 0);
    })
    .catch(() => {});
}

setInterval(fetchNotificationCount, 30000);
fetchNotificationCount();

showHome();
