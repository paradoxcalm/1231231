// === processing.js (обновлённый) ===

// Переменные
let submittedArticles = [];
let savedProcessingData = null;

function loadProcessing() {
    const container = document.getElementById("dynamicContent");
    container.innerHTML = renderProcessingHTML();
    initializeProcessingModal();
}

function skipStoreName() {
    document.getElementById("storeName").value = "Не указано";
}

function autoSaveComment() {
    const commentText = document.getElementById("comment").value;
    localStorage.setItem("comment", commentText);
}

function addArticle() {
    // 🔒 Проверка: клиент не может добавлять после выгрузки
    if (userRole === 'client') {
        const statusElement = document.getElementById("processingStatus");
        if (statusElement && statusElement.textContent !== "Выгрузите товар") {
            alert("Вы не можете добавлять товары после выгрузки.");
            return;
        }
    }

    document.getElementById("addArticleButton").style.display = "none";
    const articleDiv = document.createElement("div");
    articleDiv.classList.add("article-entry");
    articleDiv.innerHTML = `
        <input type="text" placeholder="Введите Баркод" class="articleInput" oninput="checkBarcode(this)">
        <input type="number" placeholder="Общее количество" class="articleQty" oninput="calculateTotal(this)">
        <h4 class="warehouse-title">Распределение по складам:</h4>
        <div class="warehouses-container">
            <div class="warehouse-column">
                <label><input type="checkbox" class="warehouse-checkbox" onchange="toggleWarehouse(this, 'koledino')"> Коледино</label>
                <input type="number" name="koledino" placeholder="Кол-во" class="warehouse-input" style="display:none;" oninput="updateRemaining(this)">
            </div>
            <div class="warehouse-column">
                <label><input type="checkbox" class="warehouse-checkbox" onchange="toggleWarehouse(this, 'nevinnomyssk')"> Невинномысск</label>
                <input type="number" name="nevinnomyssk" placeholder="Кол-во" class="warehouse-input" style="display:none;" oninput="updateRemaining(this)">
            </div>
        </div>
        <p class="remaining-qty">Осталось распределить: <span class="remainingCount">0</span></p>
        <p class="error-message" style="color:red; display:none;">Ошибка: Введено больше, чем общее количество!</p>
        <button class="confirm-button" onclick="confirmArticle(this)">✅ Подтвердить</button>
        <button class="remove-button" onclick="removeArticle(this)">❌ Удалить</button>
    `;
    document.getElementById("articlesContainer").appendChild(articleDiv);
}


function toggleWarehouse(checkbox, warehouse) {
    const input = checkbox.parentElement.nextElementSibling;
    input.style.display = checkbox.checked ? "inline-block" : "none";
    if (!checkbox.checked) input.value = "";
    updateRemaining(input);
}

function checkBarcode(input) {
    console.log("checkBarcode:", input.value);
}

function calculateTotal(input) {
    updateRemaining(input);
}

function updateRemaining(input) {
    const articleEntry = input.closest(".article-entry");
    const total = parseInt(articleEntry.querySelector(".articleQty").value) || 0;
    let distributed = 0;
    articleEntry.querySelectorAll(".warehouse-input").forEach(whInput => {
        distributed += parseInt(whInput.value) || 0;
    });
    const remaining = total - distributed;
    articleEntry.querySelector(".remainingCount").textContent = remaining;
    const error = articleEntry.querySelector(".error-message");
    const confirmBtn = articleEntry.querySelector(".confirm-button");
    if (remaining < 0) {
        error.style.display = "block";
        confirmBtn.disabled = true;
    } else {
        error.style.display = "none";
        confirmBtn.disabled = false;
    }
}

function confirmArticle(button) {
    const articleDiv = button.parentElement;
    const barcode = articleDiv.querySelector(".articleInput").value;
    const totalQty = parseInt(articleDiv.querySelector(".articleQty").value) || 0;
    const warehouses = {};
    articleDiv.querySelectorAll(".warehouse-input").forEach(input => {
        const val = parseInt(input.value) || 0;
        if (val > 0) {
            warehouses[input.name] = val;
        }
    });
    const totalDistributed = Object.values(warehouses).reduce((sum, qty) => sum + qty, 0);
    if (totalDistributed !== totalQty) {
        alert("Ошибка: Общее количество не совпадает с распределением!");
        return;
    }
    submittedArticles.push({ barcode, totalQty, warehouses });
    updateArticleCount();
    const submittedContainer = document.getElementById("submittedArticles");
    const entry = document.createElement("div");
    entry.classList.add("submitted-entry");
    entry.innerHTML = `<p><strong>Артикул:</strong> ${barcode} | Кол-во: ${totalQty} | Склады: ${Object.keys(warehouses).length}</p>`;
    submittedContainer.appendChild(entry);
    articleDiv.remove();
    document.getElementById("addArticleButton").style.display = "block";
}

function removeArticle(button) {
    button.parentElement.remove();
    document.getElementById("addArticleButton").style.display = "block";
}

function updateArticleCount() {
    const totalElement = document.getElementById("totalArticles");
    if (totalElement) {
        totalElement.textContent = submittedArticles.length;
    }
}

function initializeFormProcessing() {
    preloadUserDataIntoProcessing(); // 🟢 Автозаполнение ИП/магазина

    const commentField = document.getElementById("comment");
    if (commentField) {
        commentField.addEventListener("input", autoSaveComment);
    }
    const addBtn = document.getElementById("addArticleButton");
    if (addBtn) {
        addBtn.addEventListener("click", addArticle);
    }
}


function initializeProcessingModal(scheduleId = 0, status = "Выгрузите товар") {
    submittedArticles = [];
    updateArticleCount();
    initializeFormProcessing();

    const scheduleInput = document.getElementById("schedule_id_input");
    if (scheduleInput) {
        scheduleInput.value = scheduleId;
    }

    // 🔒 Блокируем добавление товаров, если статус не "Выгрузите товар"
    if (status !== "Выгрузите товар") {
        const addBtn = document.getElementById("addArticleButton");
        if (addBtn) addBtn.style.display = "none";

        // 🔒 Удаляем возможность добавлять новые
        const articlesContainer = document.getElementById("articlesContainer");
        if (articlesContainer) {
            articlesContainer.innerHTML = '<p><em>Редактирование товаров недоступно после выгрузки.</em></p>';
        }
    }
}



// Новый этап: форма приёмки после обработки
function renderPostProcessingReceptionForm(data) {
    const schedule = data.schedule || {
        city: "—",
        accept_date: "—",
        accept_time: "—",
        driver_name: "—",
        driver_phone: "—",
        car_brand: "—",
        car_number: "—"
    };

    return `
        <div class="form-container">
            <h2 class="form-title">Завершение обработки: приёмка</h2>
            <form id="postProcessingForm" enctype="multipart/form-data">
                <p><strong>Компания:</strong> ${data.company_name}</p>
                <p><strong>Магазин:</strong> ${data.store_name}</p>
                <p><strong>Город отправки:</strong> ${schedule.city}</p>
                <p><strong>Дата приёма:</strong> ${schedule.accept_date}</p>
                <p><strong>Время приёма:</strong> ${schedule.accept_time}</p>
                <p><strong>Водитель:</strong> ${schedule.driver_name}</p>
                <p><strong>Телефон водителя:</strong> ${schedule.driver_phone}</p>
                <p><strong>Марка автомобиля:</strong> ${schedule.car_brand}</p>
                <p><strong>Номер автомобиля:</strong> ${schedule.car_number}</p>

                <label>Количество коробок / паллет:</label>
                <input type="number" name="boxes" required>

                <label>Сумма оплаты:</label>
                <input type="number" name="payment" step="0.01" required>

                <label>Тип упаковки:</label>
                <select name="packaging_type" required>
                    <option value="Box">Коробка</option>
                    <option value="Pallet">Паллета</option>
                    <option value="Envelope">Конверт</option>
                </select>

                <label>Способ оплаты:</label>
                <select name="paymentType" required>
                    <option value="Наличные">Наличные</option>
                    <option value="ТБанк">Т-Банк</option>
                    <option value="Долг">Долг</option>
                </select>

                <label>Комментарий:</label>
                <textarea name="comment"></textarea>

                <label>Фото (опционально):</label>
                <input type="file" name="photo" accept="image/*">

                <button type="submit" class="submit-button">Сохранить приёмку</button>
            </form>
        </div>
    `;
}




function submitProcessing() {
    const companyName = document.getElementById("companyName").value;
    const storeName = document.getElementById("storeName").value;
    const shipmentType = document.querySelector("input[name='shipmentType']:checked").value;
    const packagingType = document.getElementById("packagingType").value;
    const scheduleId = document.getElementById("schedule_id_input").value;
    const marketplace_wb = document.getElementById("marketplaceWildberries").checked;
    const marketplace_ozon = document.getElementById("marketplaceOzon").checked;
    const comment = document.getElementById("comment").value;

    if (!companyName || submittedArticles.length === 0) {
        alert("Заполните ИП и добавьте хотя бы один товар.");
        return;
    }

    savedProcessingData = {
        schedule_id: scheduleId,
        company_name: companyName,
        store_name: storeName,
        shipment_type: shipmentType,
        packaging_type: packagingType,
        marketplace_wildberries: marketplace_wb,
        marketplace_ozon: marketplace_ozon,
        comment,
        items: submittedArticles,
        user_id: currentClientId,
        schedule: {
            city: document.querySelector("#schedule_city")?.textContent || '—',
            accept_date: document.querySelector("#schedule_date")?.textContent || '—',
            accept_time: document.querySelector("#schedule_time")?.textContent || '—',
            driver_name: document.querySelector("#driver_name")?.textContent || '—',
            driver_phone: document.querySelector("#driver_phone")?.textContent || '—',
            car_brand: document.querySelector("#car_brand")?.textContent || '—',
            car_number: document.querySelector("#car_number")?.textContent || '—'
        }
    };

    // ✅ Менеджер/админ → открывает форму приёмки
    if (userRole === 'manager' || userRole === 'admin') {
        const container = document.getElementById("dynamicContent");
        container.innerHTML = renderPostProcessingReceptionForm(savedProcessingData);
        document.getElementById("postProcessingForm").addEventListener("submit", handleReceptionSubmit);
    } else {
        // 👤 Клиент → просто создаёт заявку
        sendProcessingData(savedProcessingData);
    }
}







async function handleReceptionSubmit(event) {
    event.preventDefault();
    const form = event.target;
    const formData = new FormData(form);

    // Вставляем из savedProcessingData
    for (const key in savedProcessingData) {
        if (key !== "items") {
            formData.append(key, savedProcessingData[key]);
        }
    }
    formData.append("items", JSON.stringify(savedProcessingData.items));
    formData.append("processing", 1); // флаг: это приёмка после обработки

    try {
        const response = await fetch("log_data.php", {
            method: "POST",
            body: formData
        });
        const result = await response.json();
        if (result.status === "success") {
            alert("Обработка и приёмка успешно сохранены!");
            loadProcessing();
        } else {
            alert("Ошибка: " + result.message);
        }
    } catch (error) {
        console.error("Ошибка отправки:", error);
        alert("Ошибка подключения: " + error.message);
    }
}

function renderProcessingHTML(scheduleId = 0) {
    return `
        <div id="processingFormContainer" class="processing-container">
            <h2 class="form-title">Заявка на Обработку</h2>
            <input type="hidden" id="schedule_id_input" value="${scheduleId}">
            <label for="companyName" class="form-label">Введите ИП:</label>
            <input type="text" id="companyName" placeholder="Введите ИП" class="input-field" required>
            <label for="storeName" class="form-label">Название Магазина:</label>
            <input type="text" id="storeName" placeholder="Введите название магазина" class="input-field">
            <button type="button" class="skip-button" onclick="skipStoreName()">Пропустить</button>
            <div class="shipment-packaging-row">
                <div class="shipment-toggle">
                    <label class="form-label">Тип обработки:</label>
                    <label><input type="radio" name="shipmentType" value="FBO" checked> FBO</label>
                    <label><input type="radio" name="shipmentType" value="FBS"> FBS</label>
                </div>
                <div class="packaging-select">
                    <label for="packagingType" class="form-label">Тип упаковки:</label>
                    <select id="packagingType" class="input-field">
                        <option value="Box">Коробка</option>
                        <option value="Envelope">Конверт</option>
                        <option value="Pallet">Паллета</option>
                    </select>
                </div>
            </div>
            <div class="marketplace-options">
                <label class="form-label">Маркетплейсы:</label>
                <label><input type="checkbox" id="marketplaceWildberries" checked> Wildberries</label>
                <label><input type="checkbox" id="marketplaceOzon"> Ozon</label>
            </div>
            <h3 class="form-subtitle">Добавление товаров:</h3>
            <div id="articlesContainer"></div>
            <button id="addArticleButton" class="add-button" onclick="addArticle()">➕ Добавить Баркод</button>
            <h3 class="summary-title">Итог:</h3>
            <div id="submittedArticles"></div>
            <p class="total-articles">Всего подтверждённых позиций: <span id="totalArticles">0</span></p>
            <h3 class="form-subtitle">Комментарий:</h3>
            <textarea id="comment" class="input-field" placeholder="Ваши пожелания по упаковке и коробам" oninput="autoSaveComment()"></textarea>
            <button class="submit-button" onclick="submitProcessing()">Завершить добавление</button>
        </div>
    `;
}


async function sendProcessingData(data) {
    try {
        const response = await fetch("create_order.php", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(data)
        });

        const result = await response.json();

        if (result.success) {
            alert("Заявка на обработку успешно создана!");
            loadProcessing(); // перезагрузка интерфейса
        } else {
            alert("Ошибка создания: " + result.message);
        }

    } catch (error) {
        console.error("Ошибка при отправке заявки на обработку:", error);
        alert("Ошибка сети или сервера: " + error.message);
    }
}