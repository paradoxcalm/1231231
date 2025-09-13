// ===== form.js =====

// 1️⃣ Автозаполнение данных пользователя
function preloadUserDataIntoForm() {
    fetch('fetch_user_data.php')
        .then(r => r.json())
        .then(data => {
            if (!data.success) return;
            const u = data.data;
            const senderInput = document.getElementById('sender');
            if (senderInput && u.company_name) {
                senderInput.value = u.company_name;
            }
        })
        .catch(err => console.error("Ошибка автозаполнения профиля:", err));
}

// 2️⃣ Отрисовка формы (HTML) с блоком customBoxWarning
function renderFormHTML(scheduleData = {}) {
    const {
        city = '', warehouses = '', accept_time = '',
        delivery_date = '', driver_name = '', driver_phone = '',
        car_number = '', car_brand = ''
    } = scheduleData;

    // выставляем tabindex и фокус
    setTimeout(() => {
        const fields = document.querySelectorAll('.form-group input, .form-group select, .form-group textarea');
        fields.forEach((f, i) => f.setAttribute('tabindex', i + 1));
        if (fields.length) fields[0].focus();
    }, 100);

    return `
<div class="section-container">
  <form id="dataForm" enctype="multipart/form-data">
    <h1 class="section-title">ПРИЁМКА</h1>
    <input type="hidden" name="schedule_id" id="formScheduleId" value="${scheduleData.id||''}">
    <input type="hidden" name="accept_time" value="${accept_time}">

    ${['city','warehouses','direction','delivery_date','driver_name','driver_phone','car_number','car_brand','sender']
      .map(id => {
        const labels = {
          city: 'Город отправления',
          warehouses: 'Склады',
          direction: 'Направление (склад)',
          delivery_date: 'Дата сдачи',
          driver_name: 'ФИО водителя',
          driver_phone: 'Телефон водителя',
          car_number: 'Номер автомобиля',
          car_brand: 'Марка автомобиля',
          sender: 'ИП отправителя'
        };
        const val = id === 'direction' ? warehouses : (scheduleData[id]||'');
        const extra = id === 'sender' ? ' name="sender" required autofocus' : '';
        return `
    <div class="form-group">
      <label>${labels[id]}:</label>
      <input type="text" id="${id}" name="${id}" value="${val}" readonly${extra}>
    </div>`;
      }).join('')}

    <div class="form-group">
      <label class="section-label">Тип упаковки:</label>
      <div style="display:flex;gap:40px;justify-content:center;">
        <label><input type="radio" name="packaging_type" value="Box" checked> Коробка</label>
        <label><input type="radio" name="packaging_type" value="Pallet"> Паллета</label>
      </div>
    </div>

    <div class="form-group">
      <label for="boxes">Количество:</label>
      <input type="number" id="boxes" name="boxes" min="1" required>
    </div>

    <div id="palletInputBlock" class="form-group" style="display:none;">
      <label>Параметры палет:</label>
      <div id="palletFields"></div>
      <p id="palletWarning" style="color:red; display:none;">Максимум 20 палет</p>
    </div>

    <div class="form-group" id="boxTypeBlock">
      <label class="section-label">Тип коробки:</label>
      <div style="display:flex;gap:40px;justify-content:center;">
        <label><input type="radio" name="box_type" value="standard" checked> Стандарт (60×40×40)</label>
        <label><input type="radio" name="box_type" value="custom"> Свои размеры</label>
      </div>
    </div>

    <div class="form-group" id="boxSizeBlock">
      <label>Габариты одной коробки (см):</label>
      <div style="display:flex;gap:10px;justify-content:center;">
        <input type="number" id="box_length" name="box_length" placeholder="Длина" style="width:70px;">
        <input type="number" id="box_width"  name="box_width"  placeholder="Ширина" style="width:70px;">
        <input type="number" id="box_height" name="box_height" placeholder="Высота" style="width:70px;">
      </div>
    </div>

    <div class="form-group" id="customBoxFieldsBlock" style="display:none;">
      <label>Свои группы коробов:</label>
      <input type="number" id="customBoxGroupCount" min="1" max="10" placeholder="Кол-во групп" style="width:100px;">
      <div id="customBoxFields" style="margin-top:10px;"></div>
      <p id="customBoxWarning" style="color:red; display:none;">
        Сумма количеств в группах не должна превышать общее количество коробов
      </p>
    </div>

    <div class="form-group"><label>Общий объём:</label><span id="box_volume">—</span></div>
    <div class="form-group"><label>Тариф:</label><span id="tariff_rate">—</span></div>
    <div class="form-group"><label for="payment">Сумма оплаты:</label>
      <input type="number" id="payment" name="payment" readonly>
    </div>
    <div class="form-group"><label for="comment">Комментарий:</label>
      <textarea id="comment" name="comment" rows="3" placeholder="Введите комментарий"></textarea>
    </div>
    <button type="submit">Отправить</button>
  </form>
  <p id="status"></p>
</div>`;
}

// 3️⃣ Показ/скрытие блоков по типу упаковки
function updatePackaging() {
    const pack = document.querySelector('input[name="packaging_type"]:checked').value;
    document.getElementById('boxTypeBlock').style.display = pack === 'Box' ? '' : 'none';
    document.getElementById('boxSizeBlock').style.display = pack === 'Box' ? '' : 'none';
    document.getElementById('customBoxFieldsBlock').style.display = 'none';
    document.getElementById('palletInputBlock').style.display = pack === 'Pallet' ? '' : 'none';
    if (pack === 'Box') updateBoxType();
}

// 4️⃣ Тип коробки: стандарт или свои
function updateBoxType() {
    const type = document.querySelector('input[name="box_type"]:checked').value;
    const sizeBlock = document.getElementById('boxSizeBlock');
    const customBlock = document.getElementById('customBoxFieldsBlock');
    if (type === 'standard') {
        sizeBlock.style.display = 'none';
        customBlock.style.display = 'none';
        ['box_length','box_width','box_height','customBoxGroupCount'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = '';
        });
        document.getElementById('customBoxFields').innerHTML = '';
    } else {
        sizeBlock.style.display = 'none';
        customBlock.style.display = '';
    }
}

// 5️⃣ Обработчики переключения
function setupPackagingToggle() {
    document.getElementsByName('packaging_type')
        .forEach(r => r.addEventListener('change', updatePackaging));
    document.getElementsByName('box_type')
        .forEach(r => r.addEventListener('change', updateBoxType));
    updatePackaging();
}

// 6️⃣ Генерация полей для своих коробов + привязка recalcBox
function generateBoxFields(count) {
    const block = document.getElementById("customBoxFields");
    if (count < 1 || count > 10) {
        block.innerHTML = '<p style="color:red;">Укажите от 1 до 10 групп</p>';
        return;
    }
    const html = Array.from({ length: count }, (_, i) => `
      <div class="box-group-item" style="margin-bottom:10px;border:1px solid #ccc;padding:8px;border-radius:4px;">
        <strong>Группа ${i+1}:</strong>
        <div style="display:flex;gap:8px;margin-top:4px;">
          <input type="number" name="box_length[]" placeholder="Длина, см" required style="width:70px;">
          <input type="number" name="box_width[]"  placeholder="Ширина, см" required style="width:70px;">
          <input type="number" name="box_height[]" placeholder="Высота, см" required style="width:70px;">
          <input type="number" name="box_count[]"  placeholder="Кол-во"    required style="width:70px;">
        </div>
      </div>
    `).join('');
    block.innerHTML = html;
    // привязываем recalcBox ко всем новым полям
    if (typeof window.recalcBox === 'function') {
        block.querySelectorAll('input').forEach(i => i.addEventListener('input', window.recalcBox));
    }
}

// 7️⃣ Триггер генерации своих коробов
function setupBoxFieldsTrigger() {
    const qtyInput = document.getElementById("customBoxGroupCount");
    qtyInput?.addEventListener("input", () => {
        const cnt = parseInt(qtyInput.value) || 0;
        generateBoxFields(cnt);
        if (typeof window.recalcBox === 'function') window.recalcBox();
    });
}

// 8️⃣ Расчёт объёма и оплаты для коробок + валидация по сумме
function setupVolumeCalculator(basePrice = 500, coef = 1, palletPrice = 1000, boxCoef = 1.15) {
    window._pricePerCm = palletPrice;
    const L = document.getElementById('box_length'),
          W = document.getElementById('box_width'),
          H = document.getElementById('box_height'),
          Cnt = document.getElementById('boxes'),
          Vol = document.getElementById('box_volume'),
          Pay = document.getElementById('payment'),
          warning = document.getElementById('customBoxWarning'),
          getPack = () => document.querySelector('input[name="packaging_type"]:checked').value,
          getBoxType = () => document.querySelector('input[name="box_type"]:checked').value;
    window.recalcBox = function() {
        if (getBoxType() === 'custom') {
            const totalBoxes = parseInt(Cnt.value) || 0;
            const sumGroups = Array.from(document.getElementsByName('box_count[]'))
                .reduce((sum, el) => sum + (parseInt(el.value)||0), 0);
            if (sumGroups > totalBoxes) {
                warning.style.display = '';
                Vol.textContent = '—';
                Pay.value = '';
                return;
            } else {
                warning.style.display = 'none';
            }
        }
        let totalVol = 0;
        let totalCost = 0;
        const count = parseInt(Cnt.value) || 0;
        if (getPack() !== 'Box') return;
        if (getBoxType() === 'standard') {
            // ✅ Просто умножаем на цену за коробку
            totalCost = basePrice * count;
            totalVol = (60 * 40 * 40 / 1000) * count; // объём стандартных коробок
        } else {
            // 🧮 Нестандарт: считаем объём в литрах и применяем коэффициент
            document.querySelectorAll('#customBoxFields .box-group-item').forEach(g => {
                const l = parseFloat(g.querySelector('[name="box_length[]"]').value) || 0;
                const w = parseFloat(g.querySelector('[name="box_width[]"]').value)  || 0;
                const h = parseFloat(g.querySelector('[name="box_height[]"]').value) || 0;
                const c = parseInt(g.querySelector('[name="box_count[]"]').value)     || 0;
                if (l && w && h && c) {
                    const dims = [l, w, h].sort((a, b) => a - b);
                    const volumeLiters = (l * w * h) / 1000;
                    totalVol += volumeLiters * c;
                    const pricePerLiter = basePrice / (60 * 40 * 40 / 1000);
                    // ——— Проверка на 60/40/40 в любом порядке (без наценки!)
                    const isStandardDims = dims[0] === 40 && dims[1] === 40 && dims[2] === 60;
                    const multiplier = isStandardDims ? 1 : (1 + boxCoef);
                    totalCost += volumeLiters * pricePerLiter * multiplier * c;
                }
            });
        }
        Vol.textContent = totalVol ? `${totalVol.toFixed(2)} м³` : '—';
        Pay.value = Math.ceil(totalCost);
    };
    [L, W, H, Cnt,
     ...document.getElementsByName('packaging_type'),
     ...document.getElementsByName('box_type')]
    .forEach(el => {
        if (!el) return;
        const ev = el.type === 'radio' ? 'change' : 'input';
        el.addEventListener(ev, window.recalcBox);
    });
    window.recalcBox();
}








// 9️⃣ Плавная наценка для палет
function getHeightMarkup(h) {
    const maxH = 200;
    const pct = Math.min(h / maxH * 0.15, 0.15);
    return 1 + pct;
}
function getWeightMarkup(w) {
    const maxW = 700;
    const pct = Math.min(w / maxW * 0.15, 0.15);
    return 1 + pct;
}
function calculatePalletCost() {
    let total = 0;
    document.querySelectorAll("#palletFields .pallet-item").forEach(row => {
        const h = parseFloat(row.querySelector(".pallet-height").value)||0;
        const w = parseFloat(row.querySelector(".pallet-weight").value)||0;
        if (h > 0 && w > 0) {
            const base = h * (window._pricePerCm || 39.5);
            total += base * getHeightMarkup(h) * getWeightMarkup(w);
        }
    });
    const pay = document.getElementById("payment");
    if (pay) pay.value = Math.ceil(total);
}

// 10️⃣ Генерация полей для палет
function generatePalletFields(count) {
    const block = document.getElementById("palletFields");
    block.innerHTML = Array.from({ length: count }, (_, i) => `
      <div class="pallet-item">
        <strong>Палета ${i+1}</strong>
        <input type="number" class="pallet-height" name="pallet_height[]" min="1" max="240" placeholder="Высота, см" onchange="calculatePalletCost()">
        <input type="number" class="pallet-weight" name="pallet_weight[]" min="1" placeholder="Вес, кг" onchange="calculatePalletCost()">
      </div>
    `).join('');
}

// 11️⃣ Триггер палет
function setupPalletFieldsTrigger() {
    const packInputs = document.getElementsByName("packaging_type");
    const qtyInput   = document.getElementById("boxes");
    const palletBlock= document.getElementById("palletInputBlock");
    const warn       = document.getElementById("palletWarning");

    function update() {
        const selected = [...packInputs].find(i => i.checked).value;
        const qty      = parseInt(qtyInput.value)||0;
        if (selected === "Pallet" && qty > 0 && qty <= 20) {
            palletBlock.style.display = '';
            warn.style.display = 'none';
            generatePalletFields(qty);
            calculatePalletCost();
        } else {
            palletBlock.style.display = 'none';
            warn.style.display = (selected==="Pallet" && qty>20) ? '' : 'none';
        }
    }
    qtyInput?.addEventListener("input", update);
    packInputs.forEach(i => i.addEventListener("change", update));
}

// 12️⃣ Модальное окно успешной заявки
function showSuccessModal(qrText, paymentAmount) {
    const modal = document.getElementById('requestModal');
    if (modal) {
        modal.classList.remove('show');
        modal.style.display = 'none';
        const content = modal.querySelector('#requestModalContent');
        if (content) content.innerHTML = '';
    }

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.insertAdjacentHTML('beforeend', `
<style>
.modal-overlay {
  position: fixed; top: 0; left: 0; width: 100%; height: 100%;
  background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center;
  z-index: 9999;
}
.modal-content {
    max-width: 500px; width: 95%; padding: 24px;
    box-sizing: border-box; background: #fff; border-radius: 8px; position: relative;
}
.modal-header.success-header h2 { margin: 0; }
.modal-body {
    display: flex !important; flex-direction: column !important; gap: 24px;
    align-items: center; overflow-x: hidden !important; overflow-y: visible;
    width: 100%; box-sizing: border-box;
}
.close-button {
    background: none; border: none; cursor: pointer;
}
@media (max-width: 480px) {
    .modal-content { width: 94% !important; padding: 20px 16px !important; }
    .modal-body { gap: 16px; padding: 0; }
    .modal-body img { width: 180px !important; height: auto !important; }
    .modal-body p, .modal-body div { font-size: 14px !important; text-align: center; }
    .modal-body button { font-size: 14px !important; width: 100%; }
}
</style>`);
    overlay.innerHTML += `
<div class="modal-content" onclick="event.stopPropagation()">
  <div class="modal-header success-header" style="margin-bottom:20px;">
    <h2 style="font-size:20px; color:#2e7d32;">✅ Заявка успешно создана!</h2>
    <button class="close-button" style="position:absolute;top:16px;right:16px;font-size:22px;" onclick="this.closest('.modal-overlay').remove(); loadOrders();">×</button>
  </div>
  <div class="modal-body">
    <div><p style="font-weight:500;">📱 Покажите этот QR менеджеру:</p><div id="qrCodeSuccess" class="qr-success-box" style="margin:auto;"></div></div>
    <hr style="width:100%;border-top:1px solid #ccc;">
    <div>
      <p style="font-weight:500;">💳 Отсканируйте QR для оплаты:</p>
      <img src="QR/1IP.jpg" alt="QR для оплаты" style="width:200px;height:200px;border:1px solid #ccc;border-radius:8px;">
      <p style="margin-top:10px;font-size:16px;"><strong>Сумма к оплате:</strong> <span id="modalPaymentSum">${paymentAmount}</span> ₽</p>
    </div>
    <p style="color:#444;font-size:14px;">⚠️ Покажите чек оплаты менеджеру приёмки для подтверждения</p>
  </div>
</div>`;
    document.body.appendChild(overlay);
    new QRCode(document.getElementById('qrCodeSuccess'), { text: qrText, width:200, height:200 });
    overlay.addEventListener('click', ev => {
        if (!ev.target.closest('.modal-content')) {
            overlay.remove();
            loadOrders();
        }
    });
}

// 13️⃣ Инициализация формы
function initializeForm() {
    const form = document.getElementById('dataForm');
    if (!form) {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', initializeForm);
        }
        return;
    }

    preloadUserDataIntoForm();
    setupPackagingToggle();
    setupPalletFieldsTrigger();
    setupBoxFieldsTrigger();

    const city = document.getElementById('city')?.value.trim();
    const wh   = document.getElementById('warehouses')?.value.trim();

    (async () => {
        if (city && wh) {
            try {
                const res = await fetch(`get_tariff.php?city=${encodeURIComponent(city)}&warehouse=${encodeURIComponent(wh)}`);
                const d = await res.json();

                setupVolumeCalculator(
                    d.success && typeof d.base_price === 'number'   ? d.base_price   : 800,
                    d.success && typeof d.coefficient === 'number'  ? d.coefficient  : 1,
                    d.success && typeof d.pallet_price === 'number' ? d.pallet_price : 1000,
                    d.success && typeof d.box_coef === 'number'     ? d.box_coef     : 0,
                    d.success && typeof d.per_liter === 'number'    ? d.per_liter    : (d.base_price ? d.base_price / 96 : 8.33)
                );
            } catch (err) {
                console.error("Ошибка загрузки тарифа:", err);
                setupVolumeCalculator();
            }
        } else {
            console.warn("Нет города или склада — тариф не загружается");
        }
    })();

    form.addEventListener('submit', async e => {
        e.preventDefault();
        const btn = form.querySelector('button[type="submit"]');
        if (!document.getElementById('sender').value.trim()) {
            return alert("⚠️ заполните ИП перед созданием заявки");
        }
        btn.disabled = true;
        btn.textContent = 'Отправка...';
        const status = document.getElementById('status');
        try {
            const res = await fetch('log_data.php', { method: 'POST', body: new FormData(form) });
            const result = await res.json();
            if (result.status === 'success') {
                showSuccessModal(result.qr_code, document.getElementById('payment').value);
            } else {
                status.textContent = `⚠️ Ошибка: ${result.message}`;
                status.style.color = 'red';
            }
        } catch (err) {
            status.textContent = 'Ошибка подключения: ' + err.message;
            status.style.color = 'red';
        } finally {
            btn.disabled = false;
            btn.textContent = 'Отправить';
        }
    });
}

initializeForm();


// старт
initializeForm();
