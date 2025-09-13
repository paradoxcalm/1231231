/*******************************************
 * Скрипты для Личного кабинета (заказы)
 *******************************************/

// Глобальная переменная, если нужна
let selectedScheduleId = null;

/**
 * ФУНКЦИЯ: рендерит все заказы в виде карточек.
 * ЗАМЕНА старого renderOrderCards() на новый (адаптивный .order-card).
 */
function renderOrderCards(orders, userRole) {
    let html = '';

    for (const order of orders) {
        html += createOrderCardHtml(order, userRole);
    }

    // Возвращаем готовый HTML для вставки в контейнер
    // После вставки вызовем создание мини-QR
    setTimeout(() => {
        for (const order of orders) {
            // Как и прежде, только клиенту показываем QR (если статус не "Завершено")
            if (userRole === 'client' && order.qr_code && order.status !== 'Завершено') {
                const qrElement = document.getElementById(`orderQr_${order.order_id}`);
                if (qrElement) {
                    new QRCode(qrElement, {
                        text: order.qr_code,
                        width: 80,
                        height: 80
                    });
                }
            }
        }
    }, 50);

    return html;
}

/**
 * Создаёт HTML для одной карточки заказа.
 * Включает адаптивную вёрстку, блок с информацией, кнопки статуса, QR-код, коллапсируемое редактирование.
 */
function createOrderCardHtml(order, userRole) {
    const orderId = order.order_id;
    const status = order.status || '—';
    const schedule = order.schedule || {};
    const warehouse = schedule.warehouses || '—';
    const deadline = schedule.accept_deadline || order.order_date || '—';
    const delivery = schedule.delivery_date || '—';
    const company = order.company_name || '—';
    const type = order.shipment_type || '—';
    const statusControlHtml = getStatusControlHtml(order, userRole);
    const canEdit = canEditOrder(order, userRole);
    const canDelete = (
        userRole === 'admin' ||
        userRole === 'manager' ||
        (userRole === 'client' && order.status === 'Выгрузите товар')
    );
    const showQr = (userRole === 'client' && order.qr_code && status !== 'Завершено');
    const photoPaths = order.reception?.photo_path || [];
    const hasPhotos = Array.isArray(photoPaths) && photoPaths.length > 0;
    const firstPhoto = hasPhotos ? photoPaths[0] : null;

    return `
    <div class="order-card" onclick="handleOrderCardClick(event, ${orderId});">
      <div class="order-card-header">
        <span class="order-id">Заказ #${orderId}</span>
        <div class="order-actions">
          ${canEdit ? `<button class="edit-btn" title="Редактировать" onclick="onEditClick(event, ${orderId})">&#9998;</button>` : ''}
          ${canDelete ? `<button class="delete-btn" title="Удалить" onclick="onDeleteClick(event, ${orderId})">&#128465;</button>` : ''}
        </div>
      </div>
      <div class="order-card-body">
        <div class="order-info-block">
          <div class="order-info-line"><strong>Статус:</strong> ${status}</div>
          <div class="order-info-line"><strong>Тип:</strong> ${type}</div>
          <div class="order-info-line"><strong>ИП:</strong> ${company}</div>
          <div class="order-info-line"><strong>Приёмка до:</strong> ${deadline}</div>
          <div class="order-info-line"><strong>Склад:</strong> ${warehouse}</div>
          <div class="order-info-line"><strong>Сдача:</strong> ${delivery}</div>
          <div class="order-status-block">${statusControlHtml}</div>
        </div>
        ${hasPhotos ? `
          <div class="order-photo-preview">
            <img src="${firstPhoto}" alt="Фото приёмки" style="max-width: 100px; max-height: 100px; margin-top: 10px; border: 1px solid #ccc; border-radius: 6px;">
          </div>
        ` : ''}
        ${showQr ? `
          <div class="order-qr-wrapper" style="text-align:center; margin-top:10px;">
            <div id="orderQr_${orderId}" class="order-qr" title="Нажмите, чтобы увеличить QR" onclick="showFullQr('${order.qr_code}')"></div>
            <button onclick="event.stopPropagation(); openQrPdfModal('${order.qr_code}', ${orderId})"
              style="
                margin-top:10px;
                font-size: 15px;
                font-weight: 600;
                padding: 6px 12px;
                max-width: 140px;
                white-space: normal;
                line-height: 1.3;
                word-break: break-word;
              ">
              📥 Скачать<br>QR (PDF)
            </button>
            <div style="
                margin-top:8px;
                font-size:14px;
                color:#B80000;
                font-weight:700;
                white-space: normal;
                max-width: 140px;
                text-align: center;
                margin-inline: auto;
            ">
              Приклейте<br>на ПЕРВЫЙ КОРОБ
            </div>
          </div>
        ` : ''}
      </div>
      <div id="editForm_${orderId}" class="edit-form-container">
        <h4>Редактирование заказа #${orderId}</h4>
        <label>Комментарий:</label>
        <textarea id="editComment_${orderId}" rows="3">${order.comment || ''}</textarea>
        <br>
        <button onclick="saveOrderEdits(${orderId})">Сохранить</button>
        <button onclick="cancelOrderEdits(${orderId})">Отмена</button>
      </div>
    </div>
    `;
}





function openQrPdfModal(qrText, orderId) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.style.cssText = `
        position: fixed; inset: 0;
        background: rgba(0, 0, 0, 0.5);
        display: flex; align-items: center; justify-content: center;
        z-index: 9999;
    `;

    const modalHTML = document.createElement('div');
    modalHTML.style.cssText = `
        position: relative;
        background: #fff;
        padding: 20px 24px;
        border-radius: 12px;
        box-shadow: 0 4px 16px rgba(0,0,0,0.2);
        width: 320px;
        text-align: center;
        font-family: sans-serif;
    `;
    modalHTML.innerHTML = `
        <button onclick="this.parentElement.parentElement.remove()" style="
            position: absolute;
            top: 10px; right: 12px;
            background: none;
            border: none;
            font-size: 20px;
            cursor: pointer;
            color: #666;
        ">✖</button>
        <h2 style="font-size: 18px; margin-bottom: 12px;">📦 Заказ #${orderId}</h2>
        <div id="modalQrCode" style="margin: 0 auto 12px auto;"></div>
        <button onclick="downloadQrAsPdf('${qrText}', ${orderId})" style="
            padding: 8px 16px;
            font-size: 14px;
            background: #3f51b5;
            color: #fff;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            margin-bottom: 10px;
        ">📥 Скачать PDF</button>
    `;

    overlay.appendChild(modalHTML);

    // Закрытие по клику вне модалки
    overlay.addEventListener('click', function (e) {
        if (!modalHTML.contains(e.target)) {
            overlay.remove();
        }
    });

    document.body.appendChild(overlay);
    new QRCode(document.getElementById('modalQrCode'), {
        text: qrText,
        width: 160,
        height: 160
    });
}



function downloadQrAsPdf(qrText, orderId) {
    const qrElement = document.querySelector('#modalQrCode canvas');
    if (!qrElement) return alert("QR не найден");

    const imgData = qrElement.toDataURL("image/png");
    const docDefinition = {
        pageSize: { width: 200, height: 200 },
        pageMargins: [10, 10, 10, 10],
        content: [
            { image: imgData, width: 180, alignment: 'center' }
        ]
    };
    pdfMake.createPdf(docDefinition).download(`QR_заказ_${orderId}.pdf`);
}



/**
 * Определяем, может ли пользователь редактировать заказ
 * (логика — пример: клиент, только если статус == "Выгрузите товар", иначе admin/manager всегда)
 */
function canEditOrder(order, userRole) {
    return (userRole === 'admin' || userRole === 'manager');
}


/**
 * Генерация HTML для смены статуса (admin/manager/client)
 */
function getStatusControlHtml(order, userRole) {
    const orderId = order.order_id;
    const status = order.status || '—';

    if (userRole === 'admin') {
        const allStatuses = [
            "Выгрузите товар",
            "Товар выгружен",
            "Готов к обработке",
            "В обработке",
            "Готов к отправке",
            "Товар отправлен",
            "Завершено"
        ];
        let options = '';
        for (const st of allStatuses) {
            const sel = (st === status) ? 'selected' : '';
            options += `<option value="${st}" ${sel}>${st}</option>`;
        }
        return `
          <span>Изм.статус:</span>
          <select class="order-status-select" onchange="adminChangeStatus(event, ${orderId})">
            ${options}
          </select>
        `;
    } else if (userRole === 'manager') {
        if (status === 'Товар отправлен' || status === 'Завершено') {
            return `<span>Заказ завершён или отправлен</span>`;
        } else {
            return `<button class="btn-status" onclick="managerNextStatus(event, ${orderId})">Следующий этап</button>`;
        }
    } else if (userRole === 'client') {
        return `<span>${status}</span>`; // ✅ Только отображение, без кнопки
    }

    return `<span>${status}</span>`; // fallback
}


/* ===========================
   ОБРАБОТЧИКИ КАРТОЧКИ
=========================== */

/**
 * Клик на карточку (не на кнопки)
 */
function handleOrderCardClick(e, orderId) {
    // Если клик по управлению — прерываем
    if (
        e.target.closest('.edit-btn') ||
        e.target.closest('.delete-btn') ||
        e.target.closest('.btn-status') ||
        e.target.closest('.order-status-select') ||
        e.target.closest('.order-qr')
    ) {
        return;
    }
    // Иначе открываем детали
    showOrderDetails(orderId);
}

/**
 * Нажатие "Редактировать"
 */
function onEditClick(e, orderId) {
    e.stopPropagation();
    const form = document.getElementById(`editForm_${orderId}`);
    if (!form) return;
    form.classList.toggle('active');
}

/**
 * Сохранение изменений (пример)
 */
function saveOrderEdits(orderId) {
    const commentEl = document.getElementById(`editComment_${orderId}`);
    const boxesEl = document.getElementById(`editBoxes_${orderId}`);
    if (!commentEl) return;

    const newComment = commentEl.value.trim();
    const payload = {
        order_id: orderId,
        comment: newComment
    };

    if (boxesEl) {
        const boxesValue = parseInt(boxesEl.value);
        if (!isNaN(boxesValue) && boxesValue > 0) {
            payload.boxes = boxesValue;
        }
    }

    fetch('edit_order.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    })
    .then(r => r.json())
    .then(data => {
        if (data.success) {
            alert("✅ Изменения сохранены");
            document.getElementById(`editForm_${orderId}`).classList.remove('active');
            loadOrders(); // обновить карточки
        } else {
            alert("❌ Ошибка: " + data.message);
        }
    })
    .catch(err => {
        alert("Ошибка сети: " + err.message);
    });
}




function downloadExistingQrImage(elementId, filename) {
    const img = document.querySelector(`#${elementId} img`);
    if (!img || !img.src.startsWith("data:image")) {
        alert("QR не найден или не готов");
        return;
    }

    const link = document.createElement('a');
    link.href = img.src;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

/**
 * Отмена редактирования
 */
function cancelOrderEdits(orderId) {
    const form = document.getElementById(`editForm_${orderId}`);
    if (form) form.classList.remove('active');
}

/**
 * Удаление заказа (кнопка корзины)
 */
function onDeleteClick(e, orderId) {
    e.stopPropagation();
    if (!confirm(`Удалить заказ #${orderId}?`)) return;
    deleteOrder(orderId);
}

/* ===========================
   УПРАВЛЕНИЕ СТАТУСАМИ ПО РОЛЯМ
=========================== */

/** Админ: смена статуса через select */
function adminChangeStatus(e, orderId) {
    const newStatus = e.target.value;
    updateOrderStatus(orderId, newStatus);
}

/** Менеджер: \"Следующий этап\" */
function managerNextStatus(e, orderId) {
    e.stopPropagation();
    nextOrderStatus(orderId);
}

/** Клиент: подтверждает \"Товар выгружен\" */
function clientConfirmUpload(e, orderId) {
    e.stopPropagation();
    updateOrderStatus(orderId, 'Товар выгружен');
}


/* =================================================================
   НИЖЕ ИДУТ ВСЕ ВАШИ СТАРЫЕ ФУНКЦИИ КАК ЕСТЬ
   (loadOrders, loadAllOrders, filterOrders, showOrderDetails, и т.д.)
   Мы лишь удалили/заменили старую реализацию renderOrderCards()
   ================================================================= */

/**
 * Загрузка заказов клиента (с вкладками Приёмка / Обработка)
 */
async function loadOrders(type = "reception") {
    const dynamicContent = document.getElementById("dynamicContent");
    if (!dynamicContent) return;

    dynamicContent.innerHTML = `
        <h2>Мои заказы</h2>
        <div class="tab-header">
            <button class="tab-button ${type === 'reception' ? 'active' : ''}" onclick="loadOrders('reception')">Приёмка</button>
            <button class="tab-button ${type === 'processing' ? 'active' : ''}" onclick="loadOrders('processing')">Обработка</button>
        </div>
        <p>Загрузка...</p>
    `;

    try {
        const url = `get_orders.php?shipment_type=${type}&all=${(userRole === 'admin' || userRole === 'manager') ? '1' : '0'}`;
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Ошибка HTTP: ${response.status}`);

        const result = await response.json();
        if (!result.success) {
            dynamicContent.innerHTML += `<p>Ошибка: ${result.message || 'Неизвестная ошибка'}</p>`;
            return;
        }

        const orders = result.orders || [];
        const activeOrders = orders.filter(o => o.status !== 'Товар отправлен');
        const archiveOrders = orders.filter(o => o.status === 'Товар отправлен');

        let html = '<h2>Мои заказы</h2>';
        html += `
            <div class="tab-header">
                <button class="tab-button ${type === 'reception' ? 'active' : ''}" onclick="loadOrders('reception')">Приёмка</button>
                <button class="tab-button ${type === 'processing' ? 'active' : ''}" onclick="loadOrders('processing')">Обработка</button>
            </div>
        `;

        if (activeOrders.length > 0) {
            html += '<h3>Активные</h3><div class="orders-cards-container">' +
                    renderOrderCards(activeOrders, userRole) +
                    '</div>';
        } else {
            html += '<p>Активных заказов нет.</p>';
        }

        if (archiveOrders.length > 0) {
            html += '<h3>Архив</h3><div class="orders-cards-container">' +
                    renderOrderCards(archiveOrders, userRole) +
                    '</div>';
        }

        dynamicContent.innerHTML = html;
    } catch (error) {
        console.error("Ошибка loadOrders:", error);
        dynamicContent.innerHTML = `<p>Ошибка при загрузке заказов: ${error.message}</p>`;
    }
}


/**
 * Загрузка всех заказов (для admin/manager)
 */
async function loadAllOrders() {
    console.log("loadAllOrders вызвана");
    const dynamicContent = document.getElementById("dynamicContent");
    dynamicContent.innerHTML = `
        <h2>Все заказы</h2>
        <select id="statusFilter" onchange="filterOrders()">
            <option value="">Все статусы</option>
            <option value="Выгрузите товар">Выгрузите товар</option>
            <option value="Товар выгружен">Товар выгружен</option>
            <option value="Готов к обработке">Готов к обработке</option>
            <option value="В обработке">В обработке</option>
            <option value="Готов к отправке">Готов к отправке</option>
            <option value="Товар отправлен">Товар отправлен</option>
        </select>
        <div id="ordersContainer"><p>Загрузка...</p></div>
    `;
    await filterOrders();
}

async function filterOrders() {
    const statusFilter = document.getElementById('statusFilter').value;
    const url = statusFilter === ""
        ? 'get_orders.php?all=1'
        : `get_orders.php?all=1&status=${encodeURIComponent(statusFilter)}`;

    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error('HTTP error: ' + response.status);
        const result = await response.json();
        console.log("Ответ get_orders.php (фильтр):", result);

        if (!result.success) {
            document.getElementById('ordersContainer').innerHTML =
                '<p>Ошибка: ' + (result.message || 'Неизвестная ошибка') + '</p>';
            return;
        }

        const orders = result.orders;
        if (!orders || orders.length === 0) {
            document.getElementById('ordersContainer').innerHTML = '<p>Заказов нет.</p>';
            return;
        }

        document.getElementById('ordersContainer').innerHTML =
            renderOrderCards(orders, userRole);

    } catch (error) {
        console.error("Ошибка filterOrders:", error);
        document.getElementById('ordersContainer').innerHTML =
            '<p>Ошибка при загрузке заказов: ' + error.message + '</p>';
    }
}


/**
 * Редактирование данных (пользователя) и т.д.
 */
function loadEditData() {
    const container = document.getElementById("dynamicContent");
    container.innerHTML = "<h2>Редактирование данных</h2><p>Загрузка...</p>";

    fetch("fetch_user_data.php")
        .then(r => r.json())
        .then(data => {
            if (!data.success) {
                container.innerHTML = "<p>Ошибка: " + data.message + "</p>";
                return;
            }
            const u = data.data;
            container.innerHTML = `
                <h2>Мои данные</h2>
                <div class="edit-block">
                    ${renderEditRow("Фамилия", "last_name", u.last_name || '')}
                    ${renderEditRow("Имя", "first_name", u.first_name || '')}
                    ${renderEditRow("Отчество", "middle_name", u.middle_name || '')}
                    ${renderEditRow("Телефон", "phone", u.phone || '')}
                    ${renderEditRow("Название ИП", "company_name", u.company_name || '')}
                    ${renderEditRow("Название магазина", "store_name", u.store_name || '')}
                    <button onclick="saveEditedUserData()">Сохранить все</button>
                    <p id="editStatus"></p>
                </div>
            `;
        })
        .catch(err => {
            container.innerHTML = "<p>Ошибка загрузки: " + err.message + "</p>";
        });
}

function renderEditRow(label, field, value) {
    return `
        <div class="edit-field">
            <label>${label}:</label>
            <div class="edit-field-row">
                <span id="${field}_view">${value}</span>
                <input type="text" id="${field}_input" value="${value}" style="display: none;">
                <button type="button" onclick="toggleEditField('${field}')">Редактировать</button>
            </div>
        </div>
    `;
}

function toggleEditField(field) {
    const view = document.getElementById(`${field}_view`);
    const input = document.getElementById(`${field}_input`);
    const button = input.nextElementSibling;

    if (view.style.display === 'none') {
        view.textContent = input.value;
        view.style.display = 'inline';
        input.style.display = 'none';
        button.textContent = 'Редактировать';
    } else {
        input.style.display = 'inline';
        view.style.display = 'none';
        input.focus();
        button.textContent = 'Сохранить';
    }
}

function saveEditedUserData() {
    const fields = ['first_name', 'last_name', 'middle_name', 'phone', 'company_name', 'store_name'];
    const payload = {};
    fields.forEach(f => {
        payload[f] = document.getElementById(`${f}_input`).value.trim();
    });

    fetch("update_user_data.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
    })
        .then(r => r.json())
        .then(data => {
            const status = document.getElementById("editStatus");
            if (data.success) {
                status.textContent = "✅ Данные успешно сохранены";
                status.style.color = "green";
            } else {
                status.textContent = "Ошибка: " + data.message;
                status.style.color = "red";
            }
        })
        .catch(err => {
            document.getElementById("editStatus").textContent = "Ошибка: " + err.message;
        });
}

function showFullQr(qrText) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
        <div class="modal-content" onclick="event.stopPropagation()">
            <div class="modal-header">
                <h2>📱 Покажите этот QR менеджеру</h2>
                <button class="close-button" onclick="this.closest('.modal-overlay').remove()">×</button>
            </div>
            <div class="modal-body" style="text-align:center;">
                <div id="fullQrCode"></div>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);

    new QRCode(document.getElementById('fullQrCode'), {
        text: qrText,
        width: 250,
        height: 250
    });

    overlay.addEventListener('click', function(event) {
        if (!event.target.closest('.modal-content')) {
            overlay.remove();
        }
    });
}

function submitEditUserData(e) {
    e.preventDefault();
    const form = e.target;
    const formData = new FormData(form);
    const payload = {};
    formData.forEach((val, key) => payload[key] = val);

    fetch("update_user_data.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
    })
        .then(r => r.json())
        .then(data => {
            const status = document.getElementById("editStatus");
            if (data.success) {
                status.textContent = "✅ Данные успешно сохранены";
                status.style.color = "green";
            } else {
                status.textContent = "Ошибка: " + data.message;
                status.style.color = "red";
            }
        })
        .catch(err => {
            document.getElementById("editStatus").textContent = "Ошибка: " + err.message;
        });
}

/**
 * Показ деталей заказа
 */
function showOrderDetails(orderId) {
    document.querySelectorAll('.modal-overlay').forEach(m => m.remove());
    fetch(`get_orders.php?order_id=${orderId}&all=${userRole === 'client' ? '0' : '1'}`)
        .then(res => res.json())
        .then(data => {
            if (!data.success || !data.orders?.length) {
                alert('Ошибка: ' + data.message);
                return;
            }
            const order = data.orders[0];
            const rec = order.reception || {};
            const s = order.schedule || {};
            const client = order.client_info || {};
            const typeMap = { reception: 'Приёмка', processing: 'Обработка' };
            const packMap = { Box: 'Коробка', Pallet: 'Паллета', Envelope: 'Конверт' };
            const photos = Array.isArray(rec.photo_path) ? rec.photo_path : [];

            const modal = document.createElement('div');
            modal.className = 'modal-overlay';
            modal.innerHTML = `
<div class="modal-content" onclick="event.stopPropagation()">
  <div class="modal-header" style="display: flex; justify-content: space-between; align-items: center;">
    <h2 style="margin: 0;">Заказ №${order.order_id}</h2>
    <button class="close-button" style="font-size: 24px; background: none; border: none; cursor: pointer; color: #888;"
      onclick="this.closest('.modal-overlay').remove()">×</button>
  </div>
  <div class="modal-body accordion-view">
    <details open>
      <summary>📦 Основное</summary>
      <div class="info-content">
        <div><strong>Тип заявки:</strong> ${typeMap[order.shipment_type] || order.shipment_type}</div>
        <div><strong>Дата:</strong> ${order.order_date || '—'}</div>
        <div><strong>Статус:</strong> ${order.status || '—'}</div>
        <div><strong>Комментарий:</strong> ${order.comment || '—'}</div>
      </div>
    </details>
    <details>
      <summary>🚚 Отправка</summary>
      <div class="info-content">
        <div><strong>Город:</strong> ${s.city || '—'}</div>
        <div><strong>Склады:</strong> ${s.warehouses || '—'}</div>
        <div><strong>Дата приёмки:</strong> ${s.accept_date || '—'}</div>
        <div><strong>Дата сдачи:</strong> ${s.delivery_date || '—'}</div>
        <div><strong>Водитель:</strong> ${s.driver_name || '—'}</div>
        <div><strong>Телефон:</strong> ${s.driver_phone || '—'}</div>
        <div><strong>Авто:</strong> ${s.car_brand || ''} ${s.car_number || ''}</div>
      </div>
    </details>
    <details>
      <summary>💳 Упаковка и оплата</summary>
      <div class="info-content">
        <div><strong>Тип упаковки:</strong> ${packMap[rec.packaging_type] || rec.packaging_type}</div>
        <div><strong>Количество:</strong> ${rec.boxes || 0} шт.</div>
        <div><strong>Оплата:</strong> ${rec.payment || 0} ₽ (${rec.payment_type || '—'})</div>
      </div>
    </details>
    <details>
      <summary>👤 Клиент</summary>
      <div class="info-content">
        <div><strong>ФИО:</strong> ${client.last_name || ''} ${client.first_name || ''}</div>
        <div><strong>Телефон:</strong> ${client.phone || '—'}</div>
        <div><strong>ИП:</strong> ${order.company_name || '—'}</div>
        <div><strong>Магазин:</strong> ${order.store_name || '—'}</div>
      </div>
    </details>
    <details>
      <summary>🖼 Фото приёмки</summary>
      <div class="info-content">
        <div class="thumbnails" id="galleryThumbs"></div>
        <div class="main-image" style="position: relative;">
          <button id="prevPhoto" class="photo-nav">◀</button>
          <img id="mainImage" src="" style="display:none;" alt="Фото приёмки">
          <button id="nextPhoto" class="photo-nav">▶</button>
        </div>
      </div>
    </details>
  </div>
</div>
            `;
            document.body.appendChild(modal);
            modal.addEventListener('click', e => {
                if (!e.target.closest('.modal-content')) modal.remove();
            });

            // Фото-галерея
            const thumbs = document.getElementById("galleryThumbs");
            const main = document.getElementById("mainImage");
            const prevBtn = document.getElementById("prevPhoto");
            const nextBtn = document.getElementById("nextPhoto");
            let currentIndex = -1;
            const updateArrowVisibility = () => {
                prevBtn.style.display = (currentIndex > 0) ? 'block' : 'none';
                nextBtn.style.display = (currentIndex < photos.length - 1) ? 'block' : 'none';
            };
            if (photos.length) {
                photos.forEach((src, index) => {
                    const thumb = document.createElement("img");
                    thumb.src = src;
                    thumb.className = "thumbnail-img";
                    thumb.onclick = () => {
                        currentIndex = index;
                        main.src = photos[currentIndex];
                        main.style.display = "block";
                        updateArrowVisibility();
                    };
                    thumbs.appendChild(thumb);
                });
                main.onclick = () => {
                    main.style.display = "none";
                    currentIndex = -1;
                    updateArrowVisibility();
                };
                prevBtn.onclick = (e) => {
                    e.stopPropagation();
                    if (currentIndex > 0) {
                        currentIndex--;
                        main.src = photos[currentIndex];
                        main.style.display = "block";
                        updateArrowVisibility();
                    }
                };
                nextBtn.onclick = (e) => {
                    e.stopPropagation();
                    if (currentIndex < photos.length - 1) {
                        currentIndex++;
                        main.src = photos[currentIndex];
                        main.style.display = "block";
                        updateArrowVisibility();
                    }
                };
            } else {
                thumbs.innerHTML = '<p style="color:#999;">Нет загруженных фото</p>';
            }
        })
        .catch(err => {
            console.error("Ошибка showOrderDetails:", err);
            alert("Ошибка загрузки: " + err.message);
        });
}






function toggleDetails(element) {
    const details = element.nextElementSibling;
    const arrow   = element.querySelector('.accordion-arrow');
    details.style.display = (details.style.display === 'block') ? 'none' : 'block';
    arrow.classList.toggle('open');
}

/**
 * Обновление статуса (общая функция)
 */
async function updateOrderStatus(orderId, newStatus) {
    if (!newStatus) return;
    try {
        const response = await fetch('update_order_status.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ order_id: orderId, status: newStatus })
        });
        const result = await response.json();
        if (result.success) {
            alert(`✅ Статус заказа #${orderId} обновлён на: ${newStatus}`);
            // Обновляем интерфейс
            if (document.getElementById('statusFilter')) {
                // Админка (loadAllOrders)
                filterOrders();
            } else {
                // ЛК клиента (loadOrders)
                loadOrders();
            }
        } else {
            alert(`⚠️ Ошибка: ${result.message}`);
        }
    } catch (error) {
        console.error('Ошибка updateOrderStatus:', error);
        alert('Ошибка при обновлении статуса: ' + error.message);
    }
}

/**
 * Удалить заказ
 */
async function deleteOrder(orderId) {
    if (!confirm('Точно удалить заказ #' + orderId + '?')) return;
    try {
        const response = await fetch('delete_order.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ order_id: orderId })
        });
        const result = await response.json();
        if (result.success) {
            alert('Заказ удалён');
            if (document.getElementById('statusFilter')) {
                filterOrders();
            } else {
                loadOrders();
            }
        } else {
            alert('Ошибка при удалении: ' + result.message);
        }
    } catch (error) {
        console.error('Ошибка deleteOrder:', error);
        alert('Ошибка при удалении заказа');
    }
}

/**
 * Менеджер: nextOrderStatus
 */
async function nextOrderStatus(orderId) {
    const current = await getCurrentStatus(orderId);
    const next = getNextStatus(current);
    if (next) await updateOrderStatus(orderId, next);
    else alert('Следующего статуса нет');
}

/**
 * Получить текущий статус
 */
async function getCurrentStatus(orderId) {
    const response = await fetch(`get_orders.php?order_id=${orderId}&all=1`);
    const data = await response.json();
    if (data.success && data.orders.length > 0) {
        return data.orders[0].status;
    }
    throw new Error('Не удалось получить статус');
}

/**
 * Определить следующий статус (по цепочке)
 */
function getNextStatus(currentStatus) {
    const seq = [
        "Выгрузите товар",
        "Товар выгружен",
        "Готов к обработке",
        "В обработке",
        "Готов к отправке",
        "Товар отправлен"
    ];
    const i = seq.indexOf(currentStatus);
    if (i >= 0 && i < seq.length - 1) {
        return seq[i+1];
    }
    return null;
}

/**
 * Настройки расписания (admin)
 */
function loadScheduleSettings() {
    if (userRole !== 'admin') {
        alert('Доступ только для администратора');
        return;
    }
    const dynamicContent = document.getElementById('dynamicContent');
    dynamicContent.innerHTML = `
        <h2>Настройки расписания</h2>
        <div class="settings-container">
            <p>Удаление старых записей:</p>
            <button class="btn" onclick="deleteOldSchedules()">Удалить сейчас</button>
            <p>Автоматическое удаление через <input type="number" id="autoDeleteDays" value="60" min="1"> дней.</p>
            <button class="btn" onclick="saveAutoDeleteSettings()">Сохранить настройки</button>
        </div>
    `;
    if (userRole === 'admin') {
        loadDeliveryPricingSettings();
    }
}

function deleteOldSchedules() {
    if (confirm('Удалить записи старше указанного количества дней?')) {
        const days = document.getElementById('autoDeleteDays').value;
        fetch('delete_old_schedules.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ days })
        })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                alert('Старые записи успешно удалены.');
            } else {
                alert('Ошибка: ' + data.message);
            }
        })
        .catch(err => alert('Ошибка подключения: ' + err));
    }
}

function saveAutoDeleteSettings() {
    const days = document.getElementById('autoDeleteDays').value;
    alert(`Настройки сохранены: автоматическое удаление через ${days} дней.`);
    // Здесь можно сохранить в БД при необходимости
}

/**
 * Уведомления (admin)
 */
function loadNotifications() {
    const container = document.getElementById('dynamicContent');
    container.innerHTML = '<h2>🔔 Уведомления</h2>';

    fetch('fetch_notifications.php')
        .then(res => res.json())
        .then(data => {
            if (!Array.isArray(data) || data.length === 0) {
                container.innerHTML += '<p>Нет уведомлений.</p>';
                return;
            }

            const unread = [];
            const read = [];

            data.forEach(n => {
                const div = document.createElement('div');
                div.className = 'notification-card';
                if (!n.read) div.classList.add('unread');

                div.innerHTML = `
                    <div class="notif-message">${n.message}</div>
                    <div class="notif-date">📅 ${n.created_at}</div>
                `;
                if (n.read) {
                    read.push(div);
                } else {
                    unread.push(div);
                }
            });

            if (unread.length > 0) {
                const d1 = document.createElement("details");
                d1.open = true;
                d1.innerHTML = `<summary>🆕 Новые (${unread.length})</summary>`;
                unread.forEach(el => d1.appendChild(el));
                container.appendChild(d1);
            }

            if (read.length > 0) {
                const d2 = document.createElement("details");
                d2.innerHTML = `<summary>📁 Прочитанные (${read.length})</summary>`;
                read.forEach(el => d2.appendChild(el));
                container.appendChild(d2);
            }

            if (unread.length > 0) {
                const btn = document.createElement("button");
                btn.textContent = "✓ Отметить все как прочитанные";
                btn.className = "mark-read-btn";
                btn.onclick = () => {
                    markAllNotificationsAsRead();
                };
                container.appendChild(btn);
            }
        })
        .catch(err => {
            console.error("Ошибка при загрузке уведомлений:", err);
            container.innerHTML += '<p>Ошибка загрузки.</p>';
        });
}


function markAllNotificationsAsRead() {
    fetch('fetch_notifications.php?mark_as_read=1')
        .then(res => res.json())
        .then(() => {
            loadNotifications();
            fetchLiveNotifications();
        });
}




// ⏱️ Автоматическое обновление уведомлений каждые 60 сек
//document.addEventListener('DOMContentLoaded', () => {
//    if (typeof loadNotifications === 'function') {
//        loadNotifications();
//        setInterval(loadNotifications, 50000);
//    }
//});

function toggleNotificationsDropdown() {
    document.getElementById("notificationsDropdown").classList.toggle("hidden");
}

function updateNotificationBadge(count) {
    const badge = document.getElementById("notificationBadge");
    if (count > 0) {
        badge.textContent = count;
        badge.classList.remove("hidden");
    } else {
        badge.classList.add("hidden");
    }
}

function fetchLiveNotifications() {
    fetch('fetch_notifications.php')
        .then(r => r.json())
        .then(data => {
            if (!Array.isArray(data)) return;

            // Подсчет только непрочитанных уведомлений!
            const unreadCount = data.filter(n => !n.read).length;
            updateNotificationBadge(unreadCount);

            const ul = document.getElementById("notificationsList");
            if (!ul) return;
            ul.innerHTML = '';
            if (data.length === 0) {
                ul.innerHTML = '<li>Нет уведомлений</li>';
                return;
            }
            data.forEach(n => {
                const li = document.createElement('li');
                li.textContent = n.message;
                ul.appendChild(li);
            });
        });
}


setInterval(fetchLiveNotifications, 30000);


/**
 * Настройки складов (admin)
 */
function loadWarehouseSettings() {
    if (userRole !== 'admin') {
        alert('Доступ только для администраторов!');
        return;
    }
    const dynamicContent = document.getElementById('dynamicContent');
    dynamicContent.innerHTML = `
        <h2>Настройки складов</h2>
        <div class="warehouse-settings">
            <div class="add-warehouse">
                <input type="text" id="newWarehouseName" placeholder="Введите название склада">
                <button class="btn" onclick="addWarehouse()">Добавить</button>
            </div>
            <ul id="warehouseList"></ul>
        </div>
    `;
    fetchWarehouses();
}

function fetchWarehouses() {
    fetch('warehouses.php')
        .then(r => r.json())
        .then(data => {
            const list = document.getElementById('warehouseList');
            list.innerHTML = data.map(wh => `
                <li class="warehouse-item">
                    ${wh.name}
                    <button class="btn edit-btn" onclick="editWarehouse('${wh.name}')">Редактировать</button>
                    <button class="btn delete-btn" onclick="deleteWarehouse('${wh.name}')">Удалить</button>
                </li>
            `).join('');
        });
}

function addWarehouse() {
    const name = document.getElementById('newWarehouseName').value.trim();
    if (!name) {
        alert('Введите название склада!');
        return;
    }
    fetch('warehouses.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'add', name })
    })
    .then(res => res.json())
    .then(data => {
        if (data.status === 'success') {
            fetchWarehouses();
            document.getElementById('newWarehouseName').value = '';
        } else {
            alert('Ошибка: ' + data.message);
        }
    });
}

function editWarehouse(name) {
    const newName = prompt('Введите новое название склада:', name);
    if (newName && newName.trim() !== name) {
        fetch('warehouses.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'edit', oldName: name, newName: newName.trim() })
        })
        .then(res => res.json())
        .then(data => {
            if (data.status === 'success') {
                fetchWarehouses();
            } else {
                alert('Ошибка: ' + data.message);
            }
        });
    }
}

function deleteWarehouse(name) {
    if (confirm('Удалить склад ' + name + '?')) {
        fetch('warehouses.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'delete', name })
        })
        .then(res => res.json())
        .then(data => {
            if (data.status === 'success') {
                fetchWarehouses();
            } else {
                alert('Ошибка: ' + data.message);
            }
        });
    }
}

/**
 * Настройки стоимости доставки
 */
function loadDeliveryPricingSettings() {
    const container = document.getElementById('dynamicContent');
    container.innerHTML += `<h3>Настройки стоимости доставки</h3><div id="pricingLoader">Загрузка цен...</div>`;

    fetch('fetch_price_settings.php')
        .then(res => res.json())
        .then(data => {
            if (!data.success) {
                container.innerHTML += '<p>Ошибка загрузки: ' + data.message + '</p>';
                return;
            }

            const settings = data.data;
            const cityList = Object.keys(settings);
            if (cityList.length === 0) {
                container.innerHTML += '<p>Нет настроек стоимости доставки.</p>';
                return;
            }

            const tabs = cityList.map(city =>
                `<button class="city-tab" onclick="showCityPricing('${city}')">${city}</button>`
            ).join('');

            const content = `
                <div class="pricing-tabs">${tabs}</div>
                <div id="pricingContent"></div>
                <button onclick="saveCityPricing()" class="btn">Сохранить изменения</button>
            `;

            document.getElementById("pricingLoader").remove();
            container.innerHTML += content;
            window.deliverySettingsData = settings;
            window.currentPricingCity = cityList[0];
            showCityPricing(cityList[0]);
        });
}

// ===== Исправленная showCityPricing =====
function showCityPricing(city) {
    const data = window.deliverySettingsData[city];
    if (!data) {
        document.getElementById("pricingContent").innerHTML = `<p>Нет данных для города ${city}</p>`;
        return;
    }
    const pallet     = data.pallet_price || '';
    // Всегда показываем в процентах!
    const boxCoef    = (typeof data.box_coef === "number" && !isNaN(data.box_coef)) ? (data.box_coef * 100) : '';
    const list = Object.entries(data.warehouses).map(
        ([wh, price]) => {
            const perLiter = price ? (price / 96).toFixed(4) : '—';
            return `
            <tr>
              <td>${wh}</td>
              <td><input type="number" step="1" data-wh="${wh}" value="${price}" class="box-price"></td>
              <td><span class="per-liter" data-wh="${wh}">${perLiter}</span></td>
            </tr>`;
        }
    ).join("");
    document.getElementById("pricingContent").innerHTML = `
      <h4>Город отправления: ${city}</h4>
      <div class="form-group">
        <label>Цена за паллету:
          <input type="number" step="0.01" id="palletPriceInput" value="${pallet}"> ₽
        </label>
      </div>
      <div class="form-group">
        <label>КФ за нестандартную коробку (%):
          <input type="number" step="1" id="boxCoefInput" value="${boxCoef}">
        </label>
      </div>
      <table class="price-table">
        <thead>
          <tr><th>Склад</th><th>Цена за короб (₽)</th><th>₽ за литр</th></tr>
        </thead>
        <tbody>
          ${list}
        </tbody>
      </table>
    `;
    document.querySelectorAll('.box-price').forEach(input => {
        input.addEventListener('input', () => {
            const val = parseFloat(input.value);
            const span = document.querySelector(`.per-liter[data-wh="${input.dataset.wh}"]`);
            span.textContent = val > 0 ? (val / 96).toFixed(4) : '—';
        });
    });
    window.currentPricingCity = city;
    document.querySelectorAll(".city-tab").forEach(tab =>
        tab.classList.toggle("active", tab.textContent === city)
    );
}


// ===== Исправленная saveCityPricing =====
function saveCityPricing() {
    const city = window.currentPricingCity;
    const pallet  = parseFloat(document.getElementById("palletPriceInput").value || 0);
    // Всегда делим на 100 — но в поле теперь проценты!
    const boxCoefRaw = parseFloat(document.getElementById("boxCoefInput").value || 0);
    const boxCoef = boxCoefRaw / 100;
    const rows = document.querySelectorAll("#pricingContent tbody tr");
    const warehouses = {};
    rows.forEach(row => {
        const input = row.querySelector("input[data-wh]");
        const wh = input.dataset.wh;
        const price = parseFloat(input.value || 0);
        warehouses[wh] = price;
    });
    const payload = {
        [city]: {
            standard_box_price: null, // глобально не используется
            pallet_price: pallet,
            box_coef: boxCoef,
            warehouses: warehouses
        }
    };
    const saveBtn = document.querySelector("button[onclick='saveCityPricing()']");
    const statusText = document.getElementById("pricingStatus");
    if (statusText) statusText.textContent = "Сохранение...";
    fetch("update_price_settings.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
    })
    .then(r => r.json())
    .then(resp => {
        if (resp.success) {
            if (statusText) {
                statusText.textContent = "✅ Сохранено успешно";
                statusText.style.color = "green";
            }
            saveBtn.textContent = "✅ Сохранено";
            saveBtn.disabled = true;
            setTimeout(() => {
                saveBtn.textContent = "Сохранить изменения";
                saveBtn.disabled = false;
                if (statusText) statusText.textContent = "";
            }, 2000);
        } else {
            if (statusText) {
                statusText.textContent = "Ошибка: " + (resp.message || "Неизвестная ошибка");
                statusText.style.color = "red";
            }
            console.error("Ошибка при сохранении тарифа:", resp);
        }
    })
    .catch(err => {
        if (statusText) {
            statusText.textContent = "Ошибка соединения: " + err.message;
            statusText.style.color = "red";
        }
        console.error("Ошибка сети:", err);
    });
}


