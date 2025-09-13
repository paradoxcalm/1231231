function openRequestFormModal(scheduleId, city = "", warehouses = "") {
    const modal = document.getElementById("requestModal");
    const content = document.getElementById("requestModalContent");

    if (!modal || !content) {
        console.error("❌ Модальное окно или его содержимое не найдены в DOM");
        return;
    }

    console.log("📦 Открываем модалку с расписанием ID:", scheduleId);

    fetch(`schedule.php?id=${scheduleId}`)
        .then(response => {
            if (!response.ok) throw new Error("Ошибка загрузки расписания");
            return response.json();
        })
        .then(data => {
            if (!data.success || !data.schedule) {
                throw new Error("Расписание не найдено");
            }

            const scheduleData = data.schedule;
            console.log("📋 Получено расписание:", scheduleData);

            modal.classList.add("show");
            modal.style.display = "block";

            content.innerHTML = `
                <div class="modal-tabs">
                    <div class="modal-header-with-close">
                        <div class="tabs">
                            <button class="tab-button active" onclick="switchModalTab('formTab')">Приёмка</button>
                            <button class="tab-button" id="processingTabBtn">Обработка</button>
                        </div>
                        <span class="modal-close-btn" onclick="closeRequestModal()">×</span>
                    </div>
                    <div id="formTab" class="tab-content active">${renderFormHTML(scheduleData)}</div>
                    <div id="processingTab" class="tab-content" style="display:none;">${renderProcessingHTML(scheduleId)}</div>
                </div>
            `;

            // 🔒 Если клиент — блокируем вкладку "Обработка"
            if (userRole === 'client') {
                const procBtn = document.getElementById("processingTabBtn");
                if (procBtn) {
                    procBtn.classList.add("disabled");
                    procBtn.onclick = () => alert("Функция в доработке. Скоро будет доступна.");
                }
            } else {
                const procBtn = document.getElementById("processingTabBtn");
                if (procBtn) {
                    procBtn.setAttribute("onclick", "switchModalTab('processingTab')");
                }
            }

            // Установка ID и инициализация формы
            setTimeout(() => {
                const hiddenInput = document.querySelector("#formTab #formScheduleId");
                if (hiddenInput) {
                    hiddenInput.value = scheduleId;
                    console.log("✅ Установлен formScheduleId =", scheduleId);
                } else {
                    console.warn("⚠️ Не найден input #formScheduleId для вставки ID");
                }

                console.log("⚙️ Запускаем initializeForm()...");
                initializeForm();
            }, 50);

            initializeProcessingModal(scheduleId);
        })
        .catch(error => {
            console.error("❌ Ошибка получения расписания:", error);
            alert("Ошибка загрузки расписания");
        });
}

function switchModalTab(tabName) {
    document.querySelectorAll('.tab-content').forEach(div => div.style.display = 'none');
    document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
    document.getElementById(tabName).style.display = 'block';
    document.querySelector(`.tab-button[onclick*="${tabName}"]`).classList.add('active');
}

function closeRequestModal() {
    const modal = document.getElementById("requestModal");
    const content = document.getElementById("requestModalContent");
    if (modal) {
        modal.classList.remove("show");
        modal.style.display = "none";
    }
    if (content) {
        content.innerHTML = "";
    }
}
