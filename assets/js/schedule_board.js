document.getElementById('scheduleBoardContainer').innerHTML = `
  <div class="container">
    <div class="card" data-aos="fade-up" data-aos-duration="800">
      <div class="header">
        <h1>Расписание отправлений</h1>
        <p class="description">Ниже представлены вкладки…</p>
      </div>
      <div class="section-title">Маркетплейсы</div>
      <div class="tabs" id="marketTabs"></div>
      <div class="section-title">Города</div>
      <div class="tabs" id="cityTabs"></div>
      <div class="nav-buttons">
        <button id="prevWeek" class="pulse"><span>←</span> Неделя назад</button>
        <button id="nextWeek" class="pulse">Неделя вперёд <span>→</span></button>
      </div>
      <div class="table-wrapper">
        <table id="scheduleTable"></table>
      </div>
      <div id="stats"></div>
    </div>
  </div>
`;

// Инициализация AOS
AOS.init({
  duration: 800,
  easing: 'ease-out-quart',
  once: true,
  offset: 50
});

const daysToShow = 14;
const step = 7;
let startDate = new Date();
let selectedMarketplaceId = null;
let selectedCityId = null;

// Загрузка маркетплейсов
async function loadMarketplaces() {
  try {
    const res = await fetch('/api/schedule_board.php?action=marketplaces');
    if (!res.ok) {
      const text = await res.text();
      throw new Error(text);
    }
    const data = await res.json();
    createTabs('marketTabs', data, id => {
      selectedMarketplaceId = id;
      loadCities(id);
    });
  } catch (err) {
    console.error('Ошибка загрузки маркетплейсов:', err);
    alert(err.message || 'Ошибка загрузки маркетплейсов');
  }
}

// Загрузка городов
async function loadCities(marketplaceId) {
  try {
    const res = await fetch(`/api/schedule_board.php?action=cities&marketplace_id=${marketplaceId}`);
    if (!res.ok) {
      const text = await res.text();
      throw new Error(text);
    }
    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      const text = await res.text();
      throw new Error(text || 'Сервер вернул ответ в неожиданном формате');
    }
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) {
      alert('Города не найдены');
      document.getElementById('cityTabs').innerHTML = '';
      document.getElementById('scheduleTable').innerHTML = '';
      return;
    }
    createTabs('cityTabs', data, id => {
      selectedCityId = id;
      loadGrid();
    });
  } catch (err) {
    console.error('Ошибка загрузки городов:', err);
    alert(err.message || 'Ошибка загрузки городов');
  }
}

// Создание вкладок с анимацией
function createTabs(containerId, items, onSelect) {
  const container = document.getElementById(containerId);
  container.innerHTML = '';
  items.forEach((item, idx) => {
    const tab = document.createElement('div');
    tab.className = 'tab';
    if (idx === 0) tab.classList.add('active');
    tab.textContent = item.name;
    tab.dataset.id = item.id;
    tab.setAttribute('data-aos', 'fade-up');
    tab.setAttribute('data-aos-delay', idx * 100);
    container.appendChild(tab);

    tab.addEventListener('click', () => {
      document.querySelectorAll(`#${containerId} .tab`).forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      anime({ targets: tab, scale: [1, 0.9, 1], duration: 300, easing: 'easeInOutQuad' });
      if (onSelect) onSelect(item.id);
    });
  });
  if (items[0] && onSelect) onSelect(items[0].id);
}

function formatDisplayDate(dateStr) {
  const [y, m, d] = dateStr.split('-');
  return `${d}.${m}.${y}`;
}

function generateDateStrings() {
  const arr = [];
  const d = new Date(startDate);
  for (let i = 0; i < daysToShow; i++) {
    const cur = new Date(d);
    arr.push(cur.toISOString().split('T')[0]);
    d.setDate(d.getDate() + 1);
  }
  return arr;
}

async function loadGrid() {
  if (!selectedMarketplaceId || !selectedCityId) return;
  const dateFrom = startDate.toISOString().split('T')[0];
  try {
    const res = await fetch(`/api/schedule_board.php?action=grid&marketplace_id=${selectedMarketplaceId}&origin_city_id=${encodeURIComponent(selectedCityId)}&date_from=${dateFrom}&days=${daysToShow}`);
    if (!res.ok) {
      const text = await res.text();
      throw new Error(text);
    }
    const data = await res.json();
    if (!Array.isArray(data.warehouses) || data.warehouses.length === 0) {
      alert('Склады не найдены');
      document.getElementById('scheduleTable').innerHTML = '';
      return;
    }
    renderTable(data);
    loadStats();
  } catch (err) {
    console.error('Ошибка загрузки расписания:', err);
    alert(err.message || 'Ошибка загрузки расписания');
  }
}

function renderTable(data) {
  const tableWrapper = document.querySelector('.table-wrapper');
  const table = document.getElementById('scheduleTable');
  const dates = data.dates;
  const warehouses = data.warehouses;

  anime({
    targets: tableWrapper,
    opacity: 0,
    scale: 0.95,
    duration: 300,
    easing: 'easeInOutQuad',
    complete: () => {
      table.innerHTML = '';
      const headerRow = document.createElement('tr');
      const corner = document.createElement('th');
      corner.className = 'sticky';
      corner.textContent = 'Город / Дата';
      headerRow.appendChild(corner);

      dates.forEach(date => {
        const th = document.createElement('th');
        th.className = 'sticky';
        th.textContent = formatDisplayDate(date);
        const summary = data.column_summary[date];
        if (summary && summary.status) {
          th.classList.add('status-' + summary.status);
        }
        headerRow.appendChild(th);
      });
      table.appendChild(headerRow);

      warehouses.forEach((wh, idx) => {
        const tr = document.createElement('tr');
        tr.style.opacity = 0;
        const tdCity = document.createElement('td');
        tdCity.textContent = wh.name;
        tr.appendChild(tdCity);

        dates.forEach(date => {
          const td = document.createElement('td');
          const checkbox = document.createElement('input');
          checkbox.type = 'checkbox';
          const cell = data.cells[date] && data.cells[date][wh.id];
          if (cell) {
            checkbox.checked = cell.checked;
            if (cell.schedule_id) checkbox.dataset.scheduleId = cell.schedule_id;
          }
          const today = new Date();
          today.setHours(0,0,0,0);
          const cellDate = new Date(date);
          if (cellDate < today) checkbox.disabled = true;

          checkbox.addEventListener('change', async () => {
            const body = {
              marketplace_id: selectedMarketplaceId,
              origin_city_id: selectedCityId,
              warehouse_id: wh.id,
              date: date,
              checked: checkbox.checked
            };
            const resp = await fetch('/api/schedule_board.php?action=toggle', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(body)
            });
            if (!resp.ok) {
              const err = await resp.json();
              alert(err.message || 'Ошибка');
              checkbox.checked = !checkbox.checked;
            } else {
              const resData = await resp.json();
              if (resData.schedule_id) checkbox.dataset.scheduleId = resData.schedule_id;
              loadStats();
            }
          });

          td.appendChild(checkbox);
          tr.appendChild(td);
        });

        table.appendChild(tr);
        setTimeout(() => {
          anime({
            targets: tr,
            opacity: 1,
            translateY: [20, 0],
            duration: 400,
            easing: 'easeOutQuad'
          });
        }, idx * 30);
      });

      anime({
        targets: tableWrapper,
        opacity: 1,
        scale: 1,
        duration: 500,
        easing: 'easeOutQuad'
      });
    }
  });
}

document.getElementById('prevWeek').onclick = () => {
  startDate.setDate(startDate.getDate() - step);
  anime({ targets: '#prevWeek', scale: [1, 0.9, 1], duration: 300, easing: 'easeInOutQuad' });
  loadGrid();
};

document.getElementById('nextWeek').onclick = () => {
  startDate.setDate(startDate.getDate() + step);
  anime({ targets: '#nextWeek', scale: [1, 0.9, 1], duration: 300, easing: 'easeInOutQuad' });
  loadGrid();
};

async function loadStats() {
  if (!selectedMarketplaceId || !selectedCityId) return;
  const dateFrom = startDate.toISOString().split('T')[0];
  const res = await fetch(`/api/schedule_board.php?action=stats&marketplace_id=${selectedMarketplaceId}&origin_city_id=${encodeURIComponent(selectedCityId)}&date_from=${dateFrom}&days=${daysToShow}`);
  const data = await res.json();
  const statsDiv = document.getElementById('stats');
  statsDiv.textContent = `Рейсов: ${data.trips}, Заказов: ${data.orders}, Активных: ${data.active}, Закрытых: ${data.closed}, Выполненных: ${data.done}, Сред. заказов/рейс: ${data.avg_per_trip}`;
}

setInterval(() => {
  anime({
    targets: '.pulse',
    boxShadow: [
      { value: '0 0 0 0 rgba(67, 97, 238, 0.4)', duration: 0 },
      { value: '0 0 0 10px rgba(67, 97, 238, 0)', duration: 1000 }
    ],
    easing: 'easeOutQuad',
    loop: true
  });
}, 4000);

loadMarketplaces();
