// ===== form.js =====

function resolveFormPath(relativePath) {
    if (typeof relativePath !== 'string' || !relativePath) {
        return relativePath;
    }

    // Не преобразуем уже абсолютные адреса и схемы data:
    if (/^(?:[a-z][a-z0-9+.-]*:)?\/\//i.test(relativePath) || relativePath.startsWith('data:')) {
        return relativePath;
    }

    // Если путь начинается с "/" — этого достаточно для fetch, возвращаем как есть.
    if (relativePath.startsWith('/')) {
        return relativePath;
    }

    const pickFormScriptSrc = () => {
        try {
            const current = document?.currentScript;
            if (current?.src && current.src.includes('form.js')) {
                return current.src;
            }
            const scripts = document?.querySelectorAll?.('script[src]');
            if (scripts) {
                for (const script of scripts) {
                    if (script.src?.includes('form.js')) {
                        return script.src;
                    }
                }
            }
        } catch (err) {
            console.warn('resolveFormPath: не удалось найти form.js в DOM', err);
        }
        return null;
    };

    const scriptSrc = pickFormScriptSrc();
    if (scriptSrc) {
        try {
            const scriptUrl = new URL(scriptSrc, window.location.href);
            return new URL(relativePath, scriptUrl).toString();
        } catch (err) {
            console.warn('resolveFormPath: ошибка при расчёте относительно form.js', err);
        }
    }

    try {
        return new URL(relativePath, window.location.href).toString();
    } catch (err) {
        console.warn('resolveFormPath: не удалось вычислить путь относительно страницы', err);
    }

    return relativePath;
}

// 1️⃣ Автозаполнение данных пользователя
function preloadUserDataIntoForm() {
    fetch(resolveFormPath('fetch_user_data.php'))
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
// form.js (загружается до requestForm.js)

// Объявляем функцию как раньше
function renderFormHTML(scheduleData = {}) {
    const {
        id = '',
        city = '',
        warehouses = '',
        accept_date = '',
        delivery_date = '',
        driver_name = '',
        driver_phone = '',
        car_number = '',
        car_brand = '',
        sender = ''
    } = scheduleData;

    // Склеиваем две даты в одну строку «выезд → сдача»
    const combinedDates = accept_date && delivery_date
        ? `${accept_date} → ${delivery_date}`
        : accept_date || delivery_date;

    // назначаем tabindex и фокус для удобного перехода по форме
    setTimeout(() => {
        const fields = document.querySelectorAll('.form-group input, .form-group select, .form-group textarea');
        fields.forEach((f, i) => f.setAttribute('tabindex', i + 1));
        if (fields.length) fields[0].focus();
    }, 100);

    return `
<div class="section-container">
  <style>
    /* стиль для статичных элементов направления и дат */
    .static-field {
      display: block;
      width: 100%;
      padding: 8px 12px;
      margin-top: 4px;
      margin-bottom: 16px;
      border: 1px solid #ccc;
      border-radius: 4px;
      background-color: #f5f5f5;
      text-align: center;
      font-weight: bold;
    }
  </style>
  <form id="dataForm" enctype="multipart/form-data">
    <h1 class="section-title">ПРИЁМКА</h1>

    <!-- Скрытые поля для ID и дат для отправки на сервер -->
    <input type="hidden" name="schedule_id" id="formScheduleId" value="${id}">
    <input type="hidden" name="accept_date" value="${accept_date}">
    <input type="hidden" name="delivery_date" value="${delivery_date}">

    <!-- Направление: отображаем в виде статичного блока -->
    <div class="form-group">
      <label>Направление:</label>
      <div class="static-field">${city} → ${warehouses}</div>
    </div>

    <!-- Выезд → Сдача: объединённая строка -->
    <div class="form-group">
      <label>Выезд → Сдача:</label>
      <div class="static-field">${combinedDates}</div>
    </div>

    <!-- Скрытые поля для остальных данных (чтобы не потерялись при отправке) -->
    <input type="hidden" id="city" name="city" value="${city}">
    <input type="hidden" id="warehouses" name="warehouses" value="${warehouses}">
    <input type="hidden" id="driver_name" name="driver_name" value="${driver_name}">
    <input type="hidden" id="driver_phone" name="driver_phone" value="${driver_phone}">
    <input type="hidden" id="car_number" name="car_number" value="${car_number}">
    <input type="hidden" id="car_brand" name="car_brand" value="${car_brand}">
    <input type="hidden" id="sender" name="sender" value="${sender}">

    <!-- Тип упаковки -->
    <div class="form-group">
      <label class="section-label">Тип упаковки:</label>
      <div style="display:flex;gap:40px;justify-content:center;">
        <label><input type="radio" name="packaging_type" value="Box" checked> Коробка</label>
        <label><input type="radio" name="packaging_type" value="Pallet"> Паллета</label>
      </div>
    </div>

    <!-- Количество -->
    <div class="form-group">
      <label for="boxes">Количество:</label>
      <input type="number" id="boxes" name="boxes" min="1" required>
    </div>

    <!-- Параметры палет -->
    <div id="palletInputBlock" class="form-group" style="display:none;">
      <label>Параметры палет:</label>
      <div id="palletFields"></div>
      <p id="palletWarning" style="color:red; display:none;">Максимум 20 палет</p>
    </div>

    <!-- Тип коробки -->
    <div class="form-group" id="boxTypeBlock">
      <label class="section-label">Тип коробки:</label>
      <div style="display:flex;gap:40px;justify-content:center;">
        <label><input type="radio" name="box_type" value="standard" checked> Стандарт (60×40×40)</label>
        <label><input type="radio" name="box_type" value="custom"> Свои размеры</label>
      </div>
    </div>

    <!-- Габариты одной коробки -->
    <div class="form-group" id="boxSizeBlock">
      <label>Габариты одной коробки (см):</label>
      <div style="display:flex;gap:10px;justify-content:center;">
        <input type="number" id="box_length" name="box_length" placeholder="Длина" style="width:70px;">
        <input type="number" id="box_width"  name="box_width"  placeholder="Ширина" style="width:70px;">
        <input type="number" id="box_height" name="box_height" placeholder="Высота" style="width:70px;">
      </div>
    </div>

    <!-- Свои группы коробов -->
    <div class="form-group" id="customBoxFieldsBlock" style="display:none;">
      <label>Свои группы коробов:</label>
      <input type="number" id="customBoxGroupCount" min="1" max="10"
             placeholder="Кол-во групп" style="width:100px;">
      <div id="customBoxFields" style="margin-top:10px;"></div>
      <p id="customBoxWarning" style="color:red; display:none;">
        Сумма количеств в группах не должна превышать общее количество коробов
      </p>
    </div>

    <!-- Итоги -->
    <div class="form-group"><label>Общий объём:</label><span id="box_volume">—</span></div>
    <div class="form-group"><label>Тариф:</label><span id="tariff_rate">—</span></div>
    <div class="form-group"><label for="payment">Сумма оплаты:</label>
      <input type="number" id="payment" name="payment" readonly>
    </div>
     <!-- Галочка «Забрать груз» -->
        <div class="form-group">
          <label>
            <input type="checkbox" id="pickupCheckbox" name="pickup_checkbox">
            Забрать груз с адреса отправителя
          </label>
        </div>

<!-- Блок выбора точки на карте (изначально скрыт) -->
<div id="pickupAddressFields" style="display:none; padding:10px; border:1px solid #ddd; border-radius:4px;">

  <!-- Карта -->
  <div id="pickupMap" style="width:100%; height:300px; border:1px solid #ccc; margin-bottom:8px;"></div>

  <!-- Скрытые координаты -->
  <input type="hidden" id="pickupLat" name="pickup_lat">
  <input type="hidden" id="pickupLng" name="pickup_lng">

  <!-- Телефон для связи -->
  <label for="clientPhone">Номер для связи:</label>
  <input type="tel" id="clientPhone" name="client_phone"
         placeholder="+7 (999) 123-45-67"
         style="width:100%; margin-bottom:8px;">

  <!-- Блок ссылки для проверки -->
  <div id="routeBlock" style="display:none; margin-top:10px;">
    <label>Ссылка для навигатора:</label><br>
    <a id="routeLinkYandex" href="#" target="_blank" style="margin-right:10px;"></a>
    <a id="routeLinkGoogle" href="#" target="_blank"></a>
    <button type="button" id="routeCopyBtn" style="margin-left:10px;">Копировать</button>
  </div>
</div>




    <!-- Комментарий -->
    <div class="form-group">
      <label for="comment">Комментарий:</label>
      <textarea id="comment" name="comment" rows="3"
                placeholder="Введите комментарий"></textarea>
    </div>
    <button type="submit">Отправить</button>
  </form>
  <p id="status"></p>
</div>`;
}

// При необходимости, чтобы функция была доступна глобально:
window.renderFormHTML = renderFormHTML;






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
// 8️⃣ Расчёт объёма и оплаты для коробок + установка цены паллет
function setupVolumeCalculator(basePrice = 500, coef = 1, palletPrice = 1000, boxCoef = 1.15) {
    // 👇 Теперь записываем корректную глобальную переменную для калькулятора паллет
    window._pricePerPallet = palletPrice;

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
                    const volumeLiters = (l * w * h) / 1000;
                    totalVol += volumeLiters * c;
                    const pricePerLiter = basePrice / (60 * 40 * 40 / 1000); // пересчёт в литры от стандартной
                    totalCost += volumeLiters * pricePerLiter * boxCoef * c;
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
    if (h >= 160 && h <= 200) {
        return 1;
    }
    if (h < 160 && h >= 50) {
        // при 50 см: pct = 0.30; при 160 см: pct = 0
        const pct = ((160 - h) / 110) * 0.30;
        return 1 + pct;
    }
    if (h < 50) {
        return 1 + 0.30;
    }
    // h > 200
    if (h <= 220) {
        // при 200 см: pct = 0; при 220 см: pct = 0.30
        const pct = ((h - 200) / 20) * 0.30;
        return 1 + pct;
    }
    return 1 + 0.30;
}

function getWeightMarkup(w) {
    if (w <= 400) {
        return 1;
    }
    if (w <= 600) {
        // при 400 кг: pct = 0; при 600 кг: pct = 0.30
        const pct = ((w - 400) / 200) * 0.30;
        return 1 + pct;
    }
    return 1 + 0.30;
}
function calculatePalletCost() {
    let total = 0;
    const basePrice = window._pricePerPallet || 7000;
    document.querySelectorAll("#palletFields .pallet-item").forEach(row => {
        let h = parseFloat(row.querySelector(".pallet-height").value) || 0;
        let w = parseFloat(row.querySelector(".pallet-weight").value) || 0;
        // Ограничения
        if (h > 220) h = 220;
        if (w > 600) w = 600;
        if (h > 0 && w > 0) {
            total += basePrice * getHeightMarkup(h) * getWeightMarkup(w);
        }
    });
    document.getElementById("payment").value = Math.ceil(total);
}




// 10️⃣ Генерация полей для палет — обновлённая версия с автокоррекцией значений
function generatePalletFields(count) {
    const block = document.getElementById("palletFields");
    block.innerHTML = Array.from({ length: count }, (_, i) => `
      <div class="pallet-item">
        <strong>Палета ${i+1}</strong>
        <input
          type="number"
          class="pallet-height"
          name="pallet_height[]"
          min="1"
          max="220"
          placeholder="Высота, см"
          oninput="if (this.value > 220) this.value = 220; if (this.value < 1) this.value = 1;"
          onchange="calculatePalletCost()"
        >
        <input
          type="number"
          class="pallet-weight"
          name="pallet_weight[]"
          min="1"
          max="600"
          placeholder="Вес, кг"
          oninput="if (this.value > 600) this.value = 600; if (this.value < 1) this.value = 1;"
          onchange="calculatePalletCost()"
        >
      </div>
    `).join('');
}


// 11️⃣ Триггер палет
function setupPalletFieldsTrigger() {
    const packInputs   = document.getElementsByName("packaging_type");
    const qtyInput     = document.getElementById("boxes");
    const palletBlock  = document.getElementById("palletInputBlock");
    const warn         = document.getElementById("palletWarning");

    function update() {
        // Правильно получаем выбранный тип упаковки
        const selected = Array.from(packInputs).find(i => i.checked)?.value;
        const qty      = parseInt(qtyInput.value, 10) || 0;

        if (selected === "Pallet" && qty > 0 && qty <= 20) {
            palletBlock.style.display = "";
            warn.style.display        = "none";
            generatePalletFields(qty);
            calculatePalletCost();
        } else {
            palletBlock.style.display = "none";
            warn.style.display        = (selected === "Pallet" && qty > 20) ? "" : "none";
        }
    }

    qtyInput?.addEventListener("input", update);
    Array.from(packInputs).forEach(i => i.addEventListener("change", update));

    // Обрабатываем начальное состояние сразу
    update();
}
// 12️⃣ Модальное окно успешной заявки
function showSuccessModal(qrText, paymentAmount, modalIdOverride) {
    const lastModalId = typeof modalIdOverride === 'string' && modalIdOverride
        ? modalIdOverride
        : (typeof window !== 'undefined' && window.__lastRequestFormModalId) || 'requestModal';
    const modal = lastModalId ? document.getElementById(lastModalId) : null;

    if (modal) {
        if (typeof modal._legacyCleanup === 'function') {
            try {
                modal._legacyCleanup();
            } catch (cleanupError) {
                console.warn('showSuccessModal: ошибка при выполнении _legacyCleanup', cleanupError);
            }
        }

        modal.classList.remove('active', 'show', 'open', 'modal-open');
        modal.style.display = 'none';

        const { requestFormContentId } = modal.dataset || {};
        let content = null;
        if (requestFormContentId) {
            const datasetContent = document.getElementById(requestFormContentId);
            if (datasetContent && modal.contains(datasetContent)) {
                content = datasetContent;
            }
        }
        if (!content) {
            content = modal.querySelector('#requestModalContent');
        }
        if (content) {
            content.innerHTML = '';
        }
    }

    document.body.classList.remove('modal-open');

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

    const qrImageUrl = resolveFormPath('QR/1IP.jpg');
    overlay.insertAdjacentHTML('beforeend', `
<div class="modal-content" onclick="event.stopPropagation()">
  <div class="modal-header success-header" style="margin-bottom:20px;">
    <h2 style="font-size:20px; color:#2e7d32;">✅ Заявка успешно создана!</h2>
    <button type="button" class="close-button legacy-success-close" style="position:absolute;top:16px;right:16px;font-size:22px;">×</button>
  </div>
  <div class="modal-body">
    <div><p style="font-weight:500;">📱 Покажите этот QR менеджеру:</p><div id="qrCodeSuccess" class="qr-success-box" style="margin:auto;"></div></div>
    <hr style="width:100%;border-top:1px solid #ccc;">
    <div>
      <p style="font-weight:500;">💳 Отсканируйте QR для оплаты:</p>
      <img src="${qrImageUrl}" alt="QR для оплаты" style="width:200px;border:1px solid #ccc;border-radius:8px;">
      <p style="margin-top:10px;font-size:16px;"><strong>Сумма к оплате:</strong> <span id="modalPaymentSum">${paymentAmount}</span> ₽</p>
    </div>
    <p style="color:#444;font-size:14px;">⚠️ Покажите чек оплаты менеджеру приёмки для подтверждения</p>
  </div>
</div>`);

    document.body.appendChild(overlay);

    const cleanup = () => {
        overlay.remove();
        if (typeof window.loadOrders === 'function') {
            try {
                window.loadOrders();
            } catch (err) {
                console.warn('loadOrders() завершился с ошибкой:', err);
            }
        }
    };

    const closeBtn = overlay.querySelector('.legacy-success-close');
    if (closeBtn) {
        closeBtn.addEventListener('click', cleanup, { once: true });
    }

    overlay.addEventListener('click', (ev) => {
        if (!ev.target.closest('.modal-content')) {
            cleanup();
        }
    });

    const qrContainer = overlay.querySelector('#qrCodeSuccess');
    if (qrContainer) {
        new QRCode(qrContainer, { text: qrText, width: 200, height: 200 });
    }
}

let pickupMapInstance;
let pickupPlacemark;

function initPickupMap() {
  if (pickupMapInstance) return;

  ymaps.ready(() => {
    const latEl      = document.getElementById('pickupLat');
    const lngEl      = document.getElementById('pickupLng');
    const routeBlock = document.getElementById('routeBlock');
    const yLink      = document.getElementById('routeLinkYandex');
    const gLink      = document.getElementById('routeLinkGoogle');
    const copyBtn    = document.getElementById('routeCopyBtn');

    pickupMapInstance = new ymaps.Map('pickupMap', {
      center: [43.251900, 46.603400], // центр по умолчанию
      zoom: 12,
      controls: ['zoomControl']
    });
    setTimeout(() => pickupMapInstance.container.fitToViewport(), 0);

    // Поставить/переместить метку
    function setPlacemark(coords) {
      if (pickupPlacemark) {
        pickupPlacemark.geometry.setCoordinates(coords);
      } else {
        pickupPlacemark = new ymaps.Placemark(coords, {}, { preset: 'islands#redIcon' });
        pickupMapInstance.geoObjects.add(pickupPlacemark);
      }
    }

    // Обновить скрытые поля и ссылки
    function updateLinks(coords) {
      const lat = Number(coords[0]).toFixed(6);
      const lon = Number(coords[1]).toFixed(6);

      latEl.value = lat;
      lngEl.value = lon;

      const yUrl = `https://yandex.ru/maps/?from=api-maps`
        + `&ll=${encodeURIComponent(lon)},${encodeURIComponent(lat)}`
        + `&mode=routes&rtext=~${encodeURIComponent(lat)},${encodeURIComponent(lon)}`
        + `&rtt=auto&z=14`;

      const gUrl = `https://www.google.com/maps/dir/?api=1`
        + `&destination=${encodeURIComponent(lat)},${encodeURIComponent(lon)}`
        + `&travelmode=driving`;

      yLink.href = yUrl;
      yLink.textContent = 'Открыть в Яндекс.Картах';
      gLink.href = gUrl;
      gLink.textContent = 'Открыть в Google Maps';
      routeBlock.style.display = '';

      copyBtn.onclick = () => {
        navigator.clipboard.writeText(yUrl).then(() => {
          copyBtn.textContent = 'Скопировано!';
          setTimeout(() => copyBtn.textContent = 'Копировать', 1200);
        });
      };
    }

    // Клик по карте
    pickupMapInstance.events.add('click', (e) => {
      const coords = e.get('coords'); // [lat, lon]
      setPlacemark(coords);
      updateLinks(coords);
    });
  });
}






function initializeForm() {
    const form = document.getElementById('dataForm');
    if (!form) {
        // Если форма ещё не загружена — повторим после DOMContentLoaded
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', initializeForm);
        }
        return;
    }

    if (form.dataset?.initialized === 'true') {
        return;
    }

    // 1) Предзаполнение и настройка переключателей
    preloadUserDataIntoForm();
    setupPackagingToggle();
    setupPalletFieldsTrigger();
    setupBoxFieldsTrigger();

    // 2) Считываем город и склад из скрытых полей формы
    const cityEl = document.getElementById('city');
    const whEl   = document.getElementById('warehouses');
    const city   = cityEl ? cityEl.value.trim() : '';
    let   wh     = whEl   ? whEl.value.trim()   : '';

    // Если указано несколько складов через запятую — используем первый
    if (wh.includes(',')) wh = wh.split(',')[0].trim();

    // 3) Запрашиваем тариф и инициализируем калькулятор объёма
    (async () => {
        if (!city || !wh) {
            console.warn('Нет города или склада — тариф не загружается');
            return;
        }
        const setDefaults = () => {
            setupVolumeCalculator(650, 1, 7000, 1);
            const t = document.getElementById('tariff_rate');
            if (t) t.textContent = '650 ₽ (по умолчанию)';
            const pkg = document.querySelector('input[name="packaging_type"]:checked');
            if (pkg && pkg.value === 'Pallet') calculatePalletCost();
        };
        try {
            const tariffUrl = resolveFormPath(`get_tariff.php?city=${encodeURIComponent(city)}&warehouse=${encodeURIComponent(wh)}`);
            const res = await fetch(tariffUrl);
            const d = await res.json();
            if (d && d.success) {
                setupVolumeCalculator(
                    Number(d.base_price),
                    Number(d.box_coef),
                    Number(d.pallet_price),
                    Number(d.box_coef)
                );
                const t = document.getElementById('tariff_rate');
                if (t) t.textContent = `${d.base_price} ₽`;
                const pkg = document.querySelector('input[name="packaging_type"]:checked');
                if (pkg && pkg.value === 'Pallet') calculatePalletCost();
            } else {
                console.warn('Тариф не найден:', d && d.message);
                setDefaults();
            }
        } catch (err) {
            console.error('Ошибка загрузки тарифа:', err);
            setDefaults();
        }
    })();

    // 4) Обработка отправки формы
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const status = document.getElementById('status');

        // Проверка координат, если выбран забор груза
        const pickCb   = document.getElementById('pickupCheckbox');
        const latInput = document.getElementById('pickupLat');
        const lngInput = document.getElementById('pickupLng');

        if (pickCb && pickCb.checked) {
            // гарантируем, что карта инициализирована
            if (!window.__pickupMapInited) {
                window.__pickupMapInited = true;
                initPickupMap();
            }
            const lat = latInput ? latInput.value.trim() : '';
            const lng = lngInput ? lngInput.value.trim() : '';
            if (!lat || !lng) {
                if (status) {
                    status.textContent = 'Пожалуйста, выберите точку на карте';
                    status.style.color = 'red';
                }
                return;
            }
        }

        const btn = form.querySelector('button[type="submit"]');
        if (btn) { btn.disabled = true; btn.textContent = 'Отправка...'; }
        try {
            const submitUrl = resolveFormPath('log_data.php');
            const res    = await fetch(submitUrl, { method: 'POST', body: new FormData(form) });
            const result = await res.json();
            if (result && result.status === 'success') {
                const pay = document.getElementById('payment');
                showSuccessModal(result.qr_code, pay ? pay.value : '');
            } else {
                if (status) {
                    status.textContent = `⚠️ Ошибка: ${result && result.message ? result.message : 'Неизвестная ошибка'}`;
                    status.style.color = 'red';
                }
            }
        } catch (err) {
            if (status) {
                status.textContent = 'Ошибка подключения: ' + err.message;
                status.style.color = 'red';
            }
        } finally {
            if (btn) { btn.disabled = false; btn.textContent = 'Отправить'; }
        }
    });

    // 5) Логика «Забрать груз» (карта + номер телефона)
    const pickupCheckbox = document.getElementById('pickupCheckbox');
    const addressFields  = document.getElementById('pickupAddressFields');
    const phoneInput     = document.getElementById('clientPhone');
    const latInput       = document.getElementById('pickupLat');
    const lngInput       = document.getElementById('pickupLng');
    if (phoneInput) phoneInput.required = pickupCheckbox && pickupCheckbox.checked;

    // безопасный сброс полей карты
    const resetMapFields = () => {
        if (latInput) latInput.value = '';
        if (lngInput) lngInput.value = '';
        // routeBlock просто скрываем — ссылки пересчитаются при следующем клике по карте
        const rb = document.getElementById('routeBlock');
        if (rb) rb.style.display = 'none';
    };

    if (pickupCheckbox) {
        pickupCheckbox.addEventListener('change', () => {
            if (pickupCheckbox.checked) {
                if (addressFields) addressFields.style.display = '';
                if (phoneInput) phoneInput.required = true;
                // инициализация карты — только один раз
                if (!window.__pickupMapInited) {
                    window.__pickupMapInited = true;
                    initPickupMap();
                    setTimeout(() => {
                        if (pickupMapInstance) {
                            pickupMapInstance.container.fitToViewport();
                        }
                    }, 0);
                }
            } else {
                if (addressFields) addressFields.style.display = 'none';
                if (phoneInput) phoneInput.required = false;
                resetMapFields();
            }
        });

        // если галочка уже была выставлена при рендере — сразу покажем блок и инициализируем карту
        if (pickupCheckbox.checked) {
            if (addressFields) addressFields.style.display = '';
            if (phoneInput) phoneInput.required = true;
            if (!window.__pickupMapInited) {
                window.__pickupMapInited = true;
                initPickupMap();
                setTimeout(() => {
                    if (pickupMapInstance) {
                        pickupMapInstance.container.fitToViewport();
                    }
                }, 0);
            }
        }
    }

    form.dataset.initialized = 'true';
}






window.initializeForm = initializeForm;

initializeForm();
