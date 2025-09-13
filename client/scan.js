// scan.js
let currentStream = null;
let useFrontCamera = false;
let scanning = false;
let requestId;
let videoElem, canvasElem, ctx;
let flashBtn;
let isFlashOn = false;
let scannerBusy = false;

function logQrEvent(event, details = {}) {
    try {
        fetch('log_qr_scan.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                event,
                details: {
                    ...details,
                    timestamp: new Date().toISOString(),
                    userAgent: navigator.userAgent
                }
            })
        });
    } catch (err) {
        console.warn("Не удалось записать лог:", err);
    }
}

async function initScanner() {
    if (scannerBusy) {
        logQrEvent('SKIP_INIT_BUSY');
        return;
    }
    scannerBusy = true;
    const readerContainer = document.getElementById('reader');
    readerContainer.innerHTML = '';
    videoElem = document.createElement('video');
    canvasElem = document.createElement('canvas');
    canvasElem.width = 400;
    canvasElem.height = 300;
    canvasElem.style.display = 'none';
    ctx = canvasElem.getContext('2d');

    flashBtn = document.createElement('button');
    flashBtn.className = 'flash-btn';
    flashBtn.innerText = '🔦';
    flashBtn.onclick = toggleFlash;
    flashBtn.style.display = 'none';

    readerContainer.appendChild(videoElem);
    readerContainer.appendChild(canvasElem);
    readerContainer.appendChild(flashBtn);

    useFrontCamera = false;
    logQrEvent('INIT_SCANNER');
    await startScan();
    scannerBusy = false;
}

async function startScan() {
    stopScan();
    scanning = true;
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: useFrontCamera ? 'user' : 'environment' }
        });
        currentStream = stream;
        videoElem.srcObject = stream;
        videoElem.setAttribute('playsinline', true);
        await videoElem.play();
        checkTorchSupport(stream);
        requestId = requestAnimationFrame(scanLoop);
        logQrEvent('CAMERA_STARTED', { facingMode: useFrontCamera ? 'user' : 'environment' });
    } catch (err) {
        alert('Ошибка доступа к камере: ' + err.message);
        console.error("❌ Ошибка getUserMedia:", err);
        logQrEvent('CAMERA_ERROR', { error: err.message });
        scanning = false;
        scannerBusy = false;
    }
}

function stopScan() {
    scanning = false;
    scannerBusy = false;
    if (requestId) cancelAnimationFrame(requestId);
    if (currentStream) {
        currentStream.getTracks().forEach(t => t.stop());
        currentStream = null;
    }
}

function scanLoop() {
    if (!scanning) return;
    ctx.drawImage(videoElem, 0, 0, canvasElem.width, canvasElem.height);
    const imageData = ctx.getImageData(0, 0, canvasElem.width, canvasElem.height);

    try {
        const code = jsQR(imageData.data, canvasElem.width, canvasElem.height, {
            inversionAttempts: 'dontInvert'
        });

        if (code) {
            console.log("✅ QR найден:", code.data);
            logQrEvent('QR_FOUND', { value: code.data });
            stopScan();
            fetchReceptionInfo(code.data);
        } else {
            logQrEvent('QR_NOT_FOUND');
            requestId = requestAnimationFrame(scanLoop);
        }
    } catch (err) {
        console.error("❌ Ошибка jsQR:", err);
        logQrEvent('JSQR_ERROR', { error: err.message });
    }
}

async function toggleFlash() {
    if (!currentStream) return;
    const track = currentStream.getVideoTracks()[0];
    const capabilities = track.getCapabilities?.();
    if (capabilities?.torch) {
        await track.applyConstraints({ advanced: [{ torch: !isFlashOn }] });
        isFlashOn = !isFlashOn;
    }
}

function checkTorchSupport(stream) {
    const track = stream.getVideoTracks()[0];
    const caps  = track.getCapabilities?.();
    if (caps?.torch) flashBtn.style.display = 'flex';
}

async function fetchReceptionInfo(qrText) {
    logQrEvent('FETCH_RECEPTION_START', { qrText });
    try {
        const res = await fetch('qr_lookup.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ qr_code: qrText })
        });
        const result = await res.json();
        logQrEvent('FETCH_RECEPTION_RESULT', { response: result });

        if (!result.success) {
            alert(result.message || "Ошибка QR");
            return;
        }
        showReceptionModal(result.data, qrText);
    } catch (e) {
        console.error("❌ Ошибка fetchReceptionInfo:", e);
        logQrEvent('FETCH_RECEPTION_ERROR', { error: e.message });
        alert("Ошибка при подключении");
    }
}

function showReceptionModal(data, qrText) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay active';
    overlay.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h2>Приёмка заказа #${data.order_id}</h2>
                <button class="close-button" onclick="closeReceptionModal()">×</button>
            </div>
            <div class="modal-body">
                <div class="form-section">
                    <h3>Информация</h3>
                    <p><strong>Город:</strong> ${data.city || '—'}</p>
                    <p><strong>Склады:</strong> ${data.warehouses || '—'}</p>
                    <p><strong>Водитель:</strong> ${data.driver_name || '—'}</p>
                    <p><strong>Телефон:</strong> ${data.driver_phone || '—'}</p>
                    <p><strong>Авто:</strong> ${data.car_brand || '—'} ${data.car_number || ''}</p>
                </div>
                <div class="form-section">
                    <h3>Фото</h3>
                    <input type="file" id="receptionPhotos" accept="image/*" multiple>
                </div>
            </div>
            <div class="modal-actions">
                <button class="icon-button" onclick="generateLabelsPdf({
                    orderId: ${data.order_id},
                    receiverName: 'Менеджер',
                    sender: '${data.sender || '—'}',
                    phone: '${data.sender_phone || '—'}',
                    deliveryDate: '${data.delivery_date || '—'}',
                    boxCount: ${data.boxes || 1},
                    qrCode: '${qrText}',
                    city: '${data.city || '—'}',
                    warehouses: '${data.warehouses || '—'}'
                })">🖨 Распечатать ярлыки</button>
                <button class="confirm-btn" onclick="submitReception(${data.order_id}, '${qrText}', 'confirm')">✅ Подтвердить</button>
                <button class="reject-btn" onclick="submitReception(${data.order_id}, '${qrText}', 'reject')">❌ Отклонить</button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);
    overlay.onclick = e => {
        if (!e.target.closest('.modal-content')) closeReceptionModal();
    };
}


function closeReceptionModal() {
    const el = document.querySelector('.modal-overlay.active');
    if (el) el.remove();
}

async function submitReception(orderId, qrText, action) {
    const formData = new FormData();
    formData.append('order_id', orderId);
    formData.append('action', action);

    const photos = document.getElementById('receptionPhotos')?.files || [];
    for (let i = 0; i < photos.length; i++) {
        formData.append('photos[]', photos[i]);
    }

    logQrEvent('SUBMIT_RECEPTION', { orderId, action, photosCount: photos.length });

    try {
        const res = await fetch('confirm_reception.php', { method: 'POST', body: formData });
        const result = await res.json();
        logQrEvent('SUBMIT_RECEPTION_RESULT', result);

        if (result.success) {
            alert('Успешно!');
            closeReceptionModal();
        } else {
            alert('Ошибка: ' + result.message);
        }
    } catch (e) {
        console.error("Ошибка submitReception:", e);
        logQrEvent('SUBMIT_RECEPTION_ERROR', { error: e.message });
        alert("Ошибка при отправке данных");
    }
}

function generateLabelsPdf({ orderId, receiverName, sender, phone, deliveryDate, boxCount, qrCode, city, warehouses }) {
    const content = [];

    for (let i = 1; i <= boxCount; i++) {
        if (i > 1) content.push({ text: '', pageBreak: 'after' });

        content.push({
            columns: [
                {
                    width: '*',
                    stack: [
                        { text: `Приемщик: ${receiverName}`, fontSize: 18, bold: true, margin: [0, 0, 0, 2] },
                        { text: `ИП: ${sender}`, fontSize: 18, margin: [0, 0, 0, 2] },
                        { text: `Телефон: ${phone}`, fontSize: 18, margin: [0, 0, 0, 2] },
                        { text: `Отправление №${orderId}: ${city} — ${warehouses}`, fontSize: 18, margin: [0, 0, 0, 2] },
                        { text: `Дата сдачи: ${deliveryDate}`, fontSize: 18, margin: [0, 10, 0, 10] },
                        { text: `Короб ${i} из ${boxCount}`, fontSize: 22, bold: true }
                    ]
                },
                {
                    width: 100,
                    qr: qrCode,
                    fit: 90,
                    alignment: 'right'
                }
            ],
            margin: [15, 10, 15, 10]
        });
    }

    const docDefinition = {
        pageSize: { width: 340, height: 212 }, // 120×75 мм в pt
        pageMargins: [0, 0, 0, 0],
        content: content,
        defaultStyle: {
            font: 'Roboto'
        }
    };

    pdfMake.createPdf(docDefinition).download(`labels_order_${orderId}.pdf`);
}





