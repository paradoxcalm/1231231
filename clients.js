// clients.js

// Безопасный вывод текста (XSS‑защита)
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Глобальные переменные для хранения и отображения списка клиентов
let allClients = [];       // исходный список клиентов
let currentPage = 1;       // текущая страница
let currentSort = {        // параметры сортировки
    key: 'id',
    asc: true
};
let searchQuery = '';      // текст поиска
let contactFilter = 'all'; // фильтр по наличию email/телефона
const rowsPerPage = 20;    // количество записей на странице

// Загрузка списка клиентов с последующим отображением
async function loadClients() {
    const container = document.getElementById('dynamicContent');
    if (!container) return;
    container.innerHTML = "<h2>Клиенты</h2><p>Загрузка...</p>";

    try {
        const response = await fetch('get_clients.php');
        const data = await response.json();
        if (!data.success) {
            container.innerHTML = "<p>Ошибка: " + (data.message || "Не удалось загрузить список") + "</p>";
            return;
        }

        allClients = data.clients; // сохраняем в памяти

        if (!allClients.length) {
            container.innerHTML = "<h2>Клиенты</h2><p>Нет зарегистрированных клиентов.</p>";
            return;
        }

        // Формирование базовой структуры страницы
        container.innerHTML = `
            <h2>Список клиентов</h2>
            <div class="clients-controls">
                <input type="text" id="clientSearch" placeholder="Поиск...">
                <select id="clientFilter">
                    <option value="all">Все</option>
                    <option value="email">Только с email</option>
                    <option value="phone">Только с телефоном</option>
                </select>
            </div>
            <div class="table-responsive">
              <table class="clients-table">
                <thead>
                    <tr>
                        <th data-sort="id">ID</th>
                        <th data-sort="login">Логин</th>
                        <th data-sort="name">Имя</th>
                        <th data-sort="email">Email</th>
                        <th data-sort="phone">Телефон</th>
                        <th></th>
                    </tr>
                </thead>
                <tbody id="clientsTbody"></tbody>
              </table>
            </div>
            <div id="clientsPagination" class="clients-pagination"></div>
        `;

        // События поиска и фильтра
        document.getElementById('clientSearch').addEventListener('input', e => {
            searchQuery = e.target.value.toLowerCase();
            currentPage = 1;
            renderClientsTable();
        });
        document.getElementById('clientFilter').addEventListener('change', e => {
            contactFilter = e.target.value;
            currentPage = 1;
            renderClientsTable();
        });

        // События сортировки
        document.querySelectorAll('.clients-table th[data-sort]').forEach(th => {
            th.addEventListener('click', () => sortClients(th.dataset.sort));
        });

        renderClientsTable(); // первоначальное отображение
    } catch (err) {
        container.innerHTML = "<p>Ошибка: " + err.message + "</p>";
    }
}

// Сортировка по колонке
function sortClients(key) {
    if (currentSort.key === key) {
        currentSort.asc = !currentSort.asc;
    } else {
        currentSort.key = key;
        currentSort.asc = true;
    }
    renderClientsTable();
}

// Изменение страницы
function changeClientPage(page) {
    currentPage = page;
    renderClientsTable();
}

// Перерисовка таблицы с учётом сортировки, фильтров и пагинации
function renderClientsTable() {
    const tbody = document.getElementById('clientsTbody');
    if (!tbody) return;

    let data = allClients.slice();

    // Фильтрация по поисковому запросу
    if (searchQuery) {
        data = data.filter(c => {
            const name = `${c.first_name} ${c.last_name}`.toLowerCase();
            const email = (c.email || '').toLowerCase();
            const phone = (c.phone || '').toLowerCase();
            return name.includes(searchQuery) || email.includes(searchQuery) || phone.includes(searchQuery);
        });
    }

    // Фильтр по наличию email/телефона
    if (contactFilter === 'email') {
        data = data.filter(c => c.email);
    } else if (contactFilter === 'phone') {
        data = data.filter(c => c.phone);
    }

    // Сортировка
    data.sort((a, b) => {
        let aVal, bVal;
        switch (currentSort.key) {
            case 'login':
                aVal = (a.phone || a.email || '').toLowerCase();
                bVal = (b.phone || b.email || '').toLowerCase();
                break;
            case 'name':
                aVal = `${a.first_name} ${a.last_name}`.toLowerCase();
                bVal = `${b.first_name} ${b.last_name}`.toLowerCase();
                break;
            case 'email':
                aVal = (a.email || '').toLowerCase();
                bVal = (b.email || '').toLowerCase();
                break;
            case 'phone':
                aVal = (a.phone || '').toLowerCase();
                bVal = (b.phone || '').toLowerCase();
                break;
            default: // id
                aVal = Number(a.id);
                bVal = Number(b.id);
        }

        if (aVal < bVal) return currentSort.asc ? -1 : 1;
        if (aVal > bVal) return currentSort.asc ? 1 : -1;
        return 0;
    });

    // Пагинация
    const totalPages = Math.max(1, Math.ceil(data.length / rowsPerPage));
    if (currentPage > totalPages) currentPage = totalPages;
    const start = (currentPage - 1) * rowsPerPage;
    const pageData = data.slice(start, start + rowsPerPage);

    // Построение строк таблицы
    let rows = '';
    for (const c of pageData) {
        const safeLogin = escapeHtml(c.phone || c.email || "");
        const safeName  = escapeHtml(c.first_name) + " " + escapeHtml(c.last_name);
        const safeEmail = c.email ? escapeHtml(c.email) : '—';
        const safePhone = c.phone ? escapeHtml(c.phone) : '—';
        rows += `
            <tr>
                <td>${c.id}</td>
                <td>${safeLogin}</td>
                <td>${safeName}</td>
                <td>${safeEmail}</td>
                <td>${safePhone}</td>
                <td><button onclick="showClientDetails(${c.id})">Подробнее</button></td>
            </tr>
        `;
    }

    if (!rows) {
        rows = '<tr><td colspan="6">Нет данных для отображения</td></tr>';
    }

    tbody.innerHTML = rows;

    // Построение пагинации
    const pagContainer = document.getElementById('clientsPagination');
    if (pagContainer) {
        let pagHtml = '';
        for (let i = 1; i <= totalPages; i++) {
            if (i === currentPage) {
                pagHtml += `<span class="active">${i}</span>`;
            } else {
                pagHtml += `<button onclick="changeClientPage(${i})">${i}</button>`;
            }
        }
        pagContainer.innerHTML = pagHtml;
    }
}

// Модальное окно с аналитикой по клиенту
// clients.js (фрагмент)
function showClientDetails(userId) {
    // Удалить старые модальные окна
    document.querySelectorAll('.modal-overlay').forEach(m => m.remove());

    // Определяем роль пользователя из глобальной переменной
    const role = window.userRole || 'client';
    let url = `/get_client_info.php?user_id=${userId}`;
    if (role === 'admin') {
        url += '&with_pwd=1';
    }

    // Запрос данных с учётом сессионных cookie по корневому пути
    fetch(url, { credentials: 'same-origin' })
        .then(res => res.text())                    // читаем ответ как текст
        .then(text => {
            if (!text) {
                throw new Error('Пустой ответ сервера');
            }
            let data;
            try {
                data = JSON.parse(text);            // пытаемся распарсить JSON
            } catch (e) {
                throw new Error('Некорректный ответ сервера: ' + text);
            }
            if (!data.success) {
                throw new Error(data.message || 'не удалось получить данные клиента');
            }
            const info = data.client;

            // Строим HTML модального окна
            let modalHtml = `
<div class="modal-content" onclick="event.stopPropagation()">
  <div class="modal-header" style="display:flex; justify-content: space-between; align-items:center;">
    <h2 style="margin:0;">Информация о клиенте</h2>
    <button class="close-button" style="font-size:24px; background:none; border:none; cursor:pointer; color:#888;"
            onclick="this.closest('.modal-overlay').remove()">×</button>
  </div>
  <div class="modal-body" style="max-width:440px;">
    <p><strong>ID клиента:</strong> ${escapeHtml(info.id)}</p>
    <p><strong>Логин (email):</strong> ${escapeHtml(info.email || "—")}</p>
    <p><strong>Телефон:</strong> ${escapeHtml(info.phone || "—")}</p>
    <p><strong>Имя:</strong> ${escapeHtml(info.first_name)} ${escapeHtml(info.last_name)}</p>
    <p id="passwordHashRow" style="${info.password_hash ? '' : 'display:none'}">
        <strong>Пароль (хэш):</strong> <code id="passwordHash" style="font-size:10px;">${info.password_hash ? escapeHtml(info.password_hash) : ''}</code>
    </p>
    ${role === 'manager' && !info.password_hash ? '<button id="loadPwdHashBtn">Показать хэш</button>' : ''}
    <p><strong>Дата регистрации:</strong> ${escapeHtml(info.registration_date || "—")}</p>
    <p><strong>Общее число заказов:</strong> ${info.total_orders}</p>
    <p><strong>Общая сумма заказов:</strong> ${info.total_sum} ₽</p>
    <p><strong>Последняя активность:</strong> ${escapeHtml(info.last_activity)}</p>
    <p><strong>История входов:</strong></p>
    <ul style="margin-top:0;">
        ${info.login_history.map(dt => `<li>${escapeHtml(dt)}</li>`).join('')}
    </ul>
    <p><strong>Заказы по статусам:</strong></p>
    <ul>
        <li>Завершено: ${info.statuses['Завершено'] || 0}</li>
        <li>Отклонён: ${info.statuses['Отклонён'] || 0}</li>
        <li>Активные: ${info.statuses['Активные'] || 0}</li>
    </ul>
  </div>
</div>
`;
            // Вставка модалки
            const modalOverlay = document.createElement('div');
            modalOverlay.className = 'modal-overlay';
            modalOverlay.style = "position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:9999;background:rgba(0,0,0,0.25);display:flex;align-items:center;justify-content:center;";
            modalOverlay.innerHTML = modalHtml;
            document.body.appendChild(modalOverlay);
            // Закрытие по клику вне окна
            modalOverlay.addEventListener('click', () => modalOverlay.remove());

            // Если менеджер запросил пароль позже
            if (role === 'manager') {
                const btn = modalOverlay.querySelector('#loadPwdHashBtn');
                if (btn) {
                    btn.addEventListener('click', () => {
                        fetch(`/get_client_info.php?user_id=${userId}&with_pwd=1`, { credentials: 'same-origin' })
                            .then(r => r.json())
                            .then(d => {
                                if (!d.success) {
                                    throw new Error(d.message || 'не удалось получить данные клиента');
                                }
                                const hash = d.client.password_hash;
                                if (hash) {
                                    const row = modalOverlay.querySelector('#passwordHashRow');
                                    const codeEl = modalOverlay.querySelector('#passwordHash');
                                    codeEl.textContent = hash;
                                    row.style.display = '';
                                    btn.remove();
                                }
                            })
                            .catch(e => alert('Ошибка загрузки хэша: ' + e.message));
                    });
                }
            }
        })
        .catch(err => {
            alert("Ошибка загрузки данных клиента: " + err.message);
        });
}

function editClient(id) {
    window.location.href = `edit_client.php?id=${id}`;
}

function viewClientOrders(id) {
    window.location.href = `orders.php?user_id=${id}`;
}

async function deleteClient(id) {
    if (!confirm('Удалить клиента?')) return;
    try {
        const res = await fetch('delete_client.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: id })
        });
        const data = await res.json();
        if (data.success) {
            alert('Клиент удалён');
            document.querySelectorAll('.modal-overlay').forEach(m => m.remove());
            loadClients();
        } else {
            alert('Ошибка удаления: ' + (data.message || ''));
        }
    } catch (err) {
        alert('Ошибка удаления: ' + err.message);
    }
}