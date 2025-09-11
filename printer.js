// printer.js
// Отображение и обработка раздела "Принтер"
async function loadPrinter() {
    const container = document.getElementById('dynamicContent');
    if (!container) return;
    container.style.display = 'block';
    container.innerHTML = `
        <h2>Принтер</h2>
        <div class="printer-forms">
            <form id="printFileForm">
                <input type="file" id="printFileInput" accept="application/pdf" required>
                <button type="submit" class="icon-button"><i class="fas fa-print"></i> Отправить файл на печать</button>
            </form>
            <form id="printTextForm" style="margin-top:20px;">
                <textarea id="printTextInput" rows="6" placeholder="Введите текст для печати..."></textarea>
                <button type="submit" class="icon-button" style="margin-top:10px;"><i class="fas fa-print"></i> Распечатать текст</button>
            </form>
            <div id="printStatus" style="margin-top:15px;"></div>
        </div>
    `;

    const status = document.getElementById('printStatus');
    const fileForm = document.getElementById('printFileForm');
    const textForm = document.getElementById('printTextForm');

    fileForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const fileInput = document.getElementById('printFileInput');
        if (!fileInput.files.length) {
            status.textContent = 'Выберите файл для печати.';
            return;
        }
        status.textContent = 'Отправка файла...';
        const formData = new FormData();
        formData.append('type', 'file');
        formData.append('file', fileInput.files[0]);
        try {
            const resp = await fetch('printer.php', { method: 'POST', body: formData });
            const data = await resp.json();
            status.textContent = data.success ? 'Печать началась.' : `Ошибка: ${data.message || 'Не удалось отправить файл.'}`;
        } catch (err) {
            status.textContent = `Ошибка: ${err.message}`;
        }
    });

    textForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const text = document.getElementById('printTextInput').value;
        if (!text.trim()) {
            status.textContent = 'Введите текст для печати.';
            return;
        }
        status.textContent = 'Отправка текста...';
        const formData = new FormData();
        formData.append('type', 'text');
        formData.append('text', text);
        try {
            const resp = await fetch('printer.php', { method: 'POST', body: formData });
            const data = await resp.json();
            status.textContent = data.success ? 'Печать началась.' : `Ошибка: ${data.message || 'Не удалось отправить текст.'}`;
        } catch (err) {
            status.textContent = `Ошибка: ${err.message}`;
        }
    });
}