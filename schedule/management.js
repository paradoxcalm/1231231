import { fetchDataAndUpdateCalendar } from './calendar.js';
import { showMassManageMessage } from './utils.js';

let fetchScheduleDataCallback = null;

export function registerManagementCallbacks({ fetchScheduleData } = {}) {
    fetchScheduleDataCallback = typeof fetchScheduleData === 'function' ? fetchScheduleData : null;
}

export function openScheduleManagementModal() {
    const modal = document.getElementById('scheduleManagementModal');
    if (!modal) return;
    modal.style.display = 'block';
    loadManagementSchedules();
}

export function closeScheduleManagementModal() {
    const modal = document.getElementById('scheduleManagementModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

export function loadManagementSchedules() {
    const block = document.getElementById('managementScheduleList');
    if (!block) return;

    block.innerHTML = `
      <div class="filters-row">
        <label>Маркетплейс
          <select id="mgmtFilterMarketplace">
            <option value="">Все</option>
          </select>
        </label>
        <label>Город
          <select id="mgmtFilterCity">
            <option value="">Все</option>
          </select>
        </label>
        <label>Склад
          <select id="mgmtFilterWarehouse">
            <option value="">Все</option>
          </select>
        </label>
        <button id="mgmtFilterApplyBtn" class="primary-button">Применить</button>
      </div>
      <div style="margin-top:10px;">
            <label for="mgmtFilterDate">Дата выезда: </label>
            <input type="date" id="mgmtFilterDate">
            <label style="margin-left:10px;">
                <input type="checkbox" id="mgmtFilterNoOrders">
                Без заявок
            </label>
        </div>
      <div class="mass-actions">
        <label><input type="checkbox" id="selectAllSchedules"> Выбрать все</label>
        <button id="btnMassDelete">Удалить выбранные</button>
        <button id="btnMassArchive">Архивировать выбранные</button>
        <div id="massManageMessages"></div>
      </div>
      <div id="mgmtSchedulesTable"></div>
    `;

    const mpSelect = document.getElementById('mgmtFilterMarketplace');
    const citySelect = document.getElementById('mgmtFilterCity');
    const whSelect = document.getElementById('mgmtFilterWarehouse');

    fetch('filter_options.php?action=marketplaces')
      .then(r => r.json())
      .then(data => {
        if (!Array.isArray(data.marketplaces)) return;
        mpSelect.innerHTML = `<option value="">Все</option>` +
          data.marketplaces.map(mp => `<option value="${mp}">${mp}</option>`).join('');
      });

    function loadCities(mp) {
      if (mp) {
        fetch(`filter_options.php?action=cities&marketplace=${encodeURIComponent(mp)}`)
          .then(r => r.json())
          .then(data => {
            const cities = data.cities || [];
            citySelect.innerHTML = `<option value="">Все</option>` +
              cities.map(c => `<option value="${c}">${c}</option>`).join('');
            whSelect.innerHTML = `<option value="">Все</option>`;
          });
      } else {
        fetch('filter_options.php?action=all_cities')
          .then(r => r.json())
          .then(data => {
            const cities = data.cities || [];
            citySelect.innerHTML = `<option value="">Все</option>` +
              cities.map(c => `<option value="${c}">${c}</option>`).join('');
            whSelect.innerHTML = `<option value="">Все</option>`;
          });
      }
    }

    function loadWarehouses(mp, city) {
      let url = 'filter_options.php?action=all_warehouses';
      if (mp) url = `filter_options.php?action=warehouses&marketplace=${encodeURIComponent(mp)}`;
      if (city) url += `${url.includes('?') ? '&' : '?'}city=${encodeURIComponent(city)}`;
      fetch(url)
        .then(r => r.json())
        .then(data => {
          const warehouses = data.warehouses || [];
          whSelect.innerHTML = `<option value="">Все</option>` +
            warehouses.map(w => `<option value="${w}">${w}</option>`).join('');
        });
    }

    mpSelect.onchange = () => {
      const mp = mpSelect.value;
      loadCities(mp);
      whSelect.innerHTML = `<option value="">Все</option>`;
    };

    citySelect.onchange = () => {
      const mp = mpSelect.value;
      const ct = citySelect.value;
      loadWarehouses(mp, ct);
    };

    loadCities('');
    document.getElementById('mgmtFilterApplyBtn').onclick = reloadManagementSchedules;

    document.getElementById('btnMassDelete').onclick = () => massManageSchedules('delete');
    document.getElementById('btnMassArchive').onclick = () => massManageSchedules('archive');
    document.getElementById('selectAllSchedules').onchange = (e) => {
      const checked = e.target.checked;
      document.querySelectorAll('.schedule-checkbox').forEach(cb => { cb.checked = checked; });
    };

    reloadManagementSchedules();
}

function reloadManagementSchedules() {
    const mp   = document.getElementById('mgmtFilterMarketplace')?.value || '';
    const ct   = document.getElementById('mgmtFilterCity')?.value || '';
    const wh   = document.getElementById('mgmtFilterWarehouse')?.value || '';
    const date = document.getElementById('mgmtFilterDate')?.value || '';
    const noOrders = document.getElementById('mgmtFilterNoOrders')?.checked;

    let url = 'schedule.php?archived=0';
    if (mp)   url += '&marketplace=' + encodeURIComponent(mp);
    if (ct)   url += '&city=' + encodeURIComponent(ct);
    if (wh)   url += '&warehouse=' + encodeURIComponent(wh);
    if (date) url += '&date=' + encodeURIComponent(date);
    if (noOrders) url += '&no_orders=1';

    const tableBlock = document.getElementById('mgmtSchedulesTable');
    if (!tableBlock) return;
    tableBlock.innerHTML = 'Загрузка…';

    fetch(url)
      .then(r => r.json())
      .then(data => {
        if (!Array.isArray(data)) {
            tableBlock.innerHTML = '<p>Ошибка загрузки расписаний</p>';
            return;
        }

        data.sort((a, b) => {
            const dA = new Date(a.accept_deadline || a.acceptance_end || a.accept_date || 0);
            const dB = new Date(b.accept_deadline || b.acceptance_end || b.accept_date || 0);
            return dA - dB;
        });

        let html = `
            <table class="management-table">
              <thead>
                <tr>
                  <th><input type="checkbox" id="selectAllSchedules"></th>
                  <th>№</th>
                  <th>Откуда → Куда</th>
                  <th>Приёмка</th>
                  <th>Сдача</th>
                  <th>Заявок</th>
                  <th>Статус</th>
                  <th>Действия</th>
                </tr>
              </thead>
              <tbody>
        `;

        data.forEach(s => {
            const ordersCount = typeof s.orders_count !== 'undefined' ? s.orders_count : 0;

            let rowClass = '';
            if (s.status === 'Завершено' || s.status === 'Товар отправлен') {
                rowClass = 'finished';
            } else if (
                s.status === 'В пути' ||
                s.status === 'Готов к отправке' ||
                s.status === 'В обработке'
            ) {
                rowClass = 'blocked';
            }

            html += `
                <tr id="schedule_item_${s.id}" class="${rowClass}">
                  <td><input type="checkbox" class="schedule-checkbox" value="${s.id}"></td>
                  <td>${s.id}</td>
                  <td>${s.city} → ${s.warehouses || '—'}</td>
                  <td>${s.accept_date}${s.accept_time ? ' ' + s.accept_time : ''}</td>
                  <td>${s.delivery_date || ''}</td>
                  <td class="orders-col">${ordersCount}</td>
                  <td>
                    <select onchange="updateStatus(${s.id}, this.value)">
                      <option value="Ожидает отправки" ${s.status==='Ожидает отправки' ? 'selected' : ''}>Ожидает</option>
                      <option value="Готов к отправке" ${s.status==='Готов к отправке' ? 'selected' : ''}>Готов</option>
                      <option value="В пути" ${s.status==='В пути' ? 'selected' : ''}>В пути</option>
                      <option value="Завершено" ${s.status==='Завершено' ? 'selected' : ''}>Завершено</option>
                    </select>
                  </td>
                  <td>
                    <button class="action-button btn-move" data-id="${s.id}" ${ordersCount ? '' : 'disabled'} title="Перенести все заявки на другое отправление">🔄 Перенести</button>
                    <button class="action-button delete-btn" onclick="deleteSchedule(${s.id})">Удалить</button>
                    <button class="action-button archive-btn" onclick="archiveSchedule(${s.id})">Архивировать</button>
                  </td>
                </tr>
            `;
        });

        html += `
              </tbody>
            </table>
        `;

        tableBlock.innerHTML = html;

        const selectAll = document.getElementById('selectAllSchedules');
        if (selectAll) {
            selectAll.addEventListener('change', () => {
                const checked = selectAll.checked;
                document.querySelectorAll('.schedule-checkbox').forEach(cb => { cb.checked = checked; });
            });
        }

        document.querySelectorAll('.btn-move').forEach(btn => {
            btn.addEventListener('click', async () => {
                if (btn.disabled) return;
                const fromId = btn.dataset.id;
                const toId = prompt('Введите ID расписания, на которое перенести заявки:');
                if (!toId) return;
                if (String(toId).trim() === '' || Number(toId) === Number(fromId)) return;
                if (!confirm(`Перенести все заявки с #${fromId} на #${toId}?`)) return;

                btn.disabled = true;
                try {
                    const res = await fetch('move_orders.php', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json; charset=UTF-8' },
                        body: JSON.stringify({ from_id: Number(fromId), to_id: Number(toId) })
                    });
                    const resp = await res.json();
                    if (resp && resp.success) {
                        alert(resp.message || 'Заявки перенесены');
                        reloadManagementSchedules();
                    } else {
                        alert('Ошибка: ' + (resp?.message || 'не удалось перенести заявки'));
                    }
                } catch (e) {
                    console.error(e);
                    alert('Ошибка сети при переносе заявок');
                } finally {
                    btn.disabled = false;
                }
            });
        });
    })
    .catch(err => {
        tableBlock.innerHTML = '<p>Ошибка загрузки расписаний</p>';
        console.error('Ошибка reloadManagementSchedules:', err);
    });
}

export function updateStatus(id, status) {
    const realUserRole = typeof userRole !== 'undefined' ? userRole : 'client';
    const localCanUpdate = (realUserRole === 'admin' || realUserRole === 'manager');

    if (!localCanUpdate) {
        alert('Нет прав!');
        return;
    }

    fetch('schedule.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update_status', id, status })
    })
    .then(r => r.json())
    .then(d => {
        if (d.status === 'success') {
            if (fetchScheduleDataCallback) {
                fetchScheduleDataCallback();
            }
            fetchDataAndUpdateCalendar();
        } else {
            alert('Ошибка: ' + d.message);
        }
    })
    .catch(err => console.error('Ошибка updateStatus:', err));
}

export function massManageSchedules(action) {
    const checkboxes = Array.from(document.querySelectorAll('.schedule-checkbox:checked'));
    if (checkboxes.length === 0) {
        alert('Не выбрано расписаний.');
        return;
    }

    if (!confirm('Вы уверены, что хотите выполнить действие для выбранных расписаний?')) {
        return;
    }

    const ids = checkboxes.map(cb => parseInt(cb.value, 10));
    const payload = { action, schedule_ids: ids };

    const btnDelete  = document.getElementById('btnMassDelete');
    const btnArchive = document.getElementById('btnMassArchive');
    const msgBox     = document.getElementById('massManageMessages');

    btnDelete.disabled = btnArchive.disabled = true;
    if (msgBox) {
        msgBox.innerHTML = '';
    }

    fetch('mass_update_schedule.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`Сервер вернул ${response.status}: ${response.statusText}`);
        }
        return response.json();
    })
    .then(data => {
        if (!data.success) {
            showMassManageMessage('error', `Ошибка: ${data.message || 'Неизвестная ошибка'}`);
            return;
        }

        const results = data.results || {};
        const blocked = [];

        ids.forEach(id => {
            const result = results[id];
            const row    = document.getElementById('schedule_item_' + id);
            if (!result || !row) return;

            if (result.status === 'deleted' || result.status === 'archived') {
                row.style.opacity = '0.4';
                row.style.textDecoration = 'line-through';
            } else if (result.status === 'blocked') {
                row.style.backgroundColor = '#ffe6e6';
                blocked.push(`Расписание #${id}: ${result.message}`);
            }
        });

        if (blocked.length) {
            showMassManageMessage('warning',
                'Некоторые расписания не обработаны:<ul>'
                + blocked.map(msg => `<li>${msg}</li>`).join('')
                + '</ul>'
            );
        } else {
            showMassManageMessage('success', 'Все выбранные расписания успешно обработаны');
        }

        loadManagementSchedules();
        fetchDataAndUpdateCalendar();
    })
    .catch(err => {
        showMassManageMessage('error', `Ошибка запроса: ${err.message}`);
    })
    .finally(() => {
        btnDelete.disabled = btnArchive.disabled = false;
    });
}
