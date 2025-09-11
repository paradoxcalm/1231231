/ deliver/scan.js

/*
 * QR‑code scanner for courier pick‑up confirmation.
 *
 * This script reuses the camera and decoding logic from the existing scan.js used
 * for warehouse reception.  When the courier clicks the "Сканировать" button on
 * a pick‑up task, the openCourierScanner() function is called with the
 * corresponding pickupId.  A modal window containing a camera preview is shown.
 * The camera stream is scanned continuously using jsQR.  Once a QR code is
 * decoded, the code and pickup identifier are sent via AJAX to
 * deliver/scan_confirm.php.  That endpoint updates the pick‑up record and
 * returns a JSON response.  On success, the modal is closed and the task card
 * is updated in place to reflect its new status.
 *
 * Dependencies: This file expects jsQR and html5-qrcode libraries to be loaded
 * in the page prior to execution.  Include them via script tags:
 *
 *   <script src="https://unpkg.com/html5-qrcode"></script>
 *   <script src="js/jsQR.js"></script>
 *   <script src="deliver/scan.js"></script>
 *
 * Styling for .modal-overlay and .modal-content can be reused from the existing
 * reception scanner implementation.
 */

let currentStream = null;
let scanning = false;
let videoElem, canvasElem, ctx;
let requestId;
let flashBtn;
let isFlashOn = false;

// Holds the ID of the pickup currently being scanned.  It is set when the
// scanner is opened via openCourierScanner().
let currentPickupId = null;

/**
 * Open the scanning modal for the specified pick‑up task.
 * Creates a modal overlay with a camera preview and starts scanning.
 *
 * @param {number|string} pickupId The ID of the pickup to confirm.
 */
function openCourierScanner(pickupId) {
    currentPickupId = pickupId;
    // Build overlay markup lazily.  If an overlay already exists, remove it.
    closeCourierScanner();
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay active';
    overlay.innerHTML = `
        <div class="modal-content" style="padding:20px; max-width:600px; background:#fff; border-radius:8px;">
            <h3 style="margin-top:0;">Сканирование QR‑кода для заявки #${pickupId}</h3>
            <div id="reader" style="position:relative;"></div>
            <button id="closeScan" style="margin-top:10px;">Закрыть</button>
        </div>
    `;
    document.body.appendChild(overlay);
    overlay.querySelector('#closeScan').addEventListener('click', () => {
        closeCourierScanner();
    });
    initScanner();
}

/**
 * Close the scanning modal and stop the camera stream.
 */
function closeCourierScanner() {
    stopScan();
    const overlay = document.querySelector('.modal-overlay.active');
    if (overlay) {
        overlay.remove();
    }
}

/**
 * Initialize camera elements and start scanning.
 * Reuses logic from the warehouse scanner (scan.js) to setup the video and canvas.
 */
async function initScanner() {
    // Reset previous scanning session if active.
    stopScan();
    scanning = false;
    // Prepare container for video and canvas.
    const readerContainer = document.getElementById('reader');
    if (!readerContainer) return;
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
    // Start scanning.
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'environment' }
        });
        currentStream = stream;
        videoElem.srcObject = stream;
        videoElem.setAttribute('playsinline', true);
        await videoElem.play();
        checkTorchSupport(stream);
        scanning = true;
        requestId = requestAnimationFrame(scanLoop);
    } catch (err) {
        alert('Ошибка доступа к камере: ' + err.message);
        console.error('QR scanner: getUserMedia error:', err);
    }
}

/**
 * Stop scanning and release the camera.
 */
function stopScan() {
    scanning = false;
    if (requestId) cancelAnimationFrame(requestId);
    if (currentStream) {
        currentStream.getTracks().forEach(t => t.stop());
        currentStream = null;
    }
}

/**
 * Main loop: capture frame, attempt to decode QR code, and send result.
 */
function scanLoop() {
    if (!scanning) return;
    ctx.drawImage(videoElem, 0, 0, canvasElem.width, canvasElem.height);
    const imageData = ctx.getImageData(0, 0, canvasElem.width, canvasElem.height);
    try {
        const code = jsQR(imageData.data, canvasElem.width, canvasElem.height, {
            inversionAttempts: 'dontInvert'
        });
        if (code) {
            // QR code detected – send for confirmation.
            stopScan();
            handleQrResult(code.data);
        } else {
            requestId = requestAnimationFrame(scanLoop);
        }
    } catch (err) {
        console.error('QR scanner: jsQR error:', err);
        requestId = requestAnimationFrame(scanLoop);
    }
}

/**
 * Toggle device flashlight if available.
 */
async function toggleFlash() {
    if (!currentStream) return;
    const track = currentStream.getVideoTracks()[0];
    const capabilities = track.getCapabilities?.();
    if (capabilities?.torch) {
        await track.applyConstraints({ advanced: [{ torch: !isFlashOn }] });
        isFlashOn = !isFlashOn;
    }
}

/**
 * Show flash button when the device supports a torch.
 */
function checkTorchSupport(stream) {
    const track = stream.getVideoTracks()[0];
    const caps = track.getCapabilities?.();
    if (caps?.torch) flashBtn.style.display = 'flex';
}

/**
 * Send decoded QR code to server for confirmation.
 * Сервер возвращает лишь информацию о совпадении QR‑кода без
 * изменения статуса задания.
 *
 * @param {string} qrText The string content of the scanned QR code.
 */
async function handleQrResult(qrText) {
    if (!currentPickupId) {
        alert('Не указан идентификатор заявки.');
        return;
    }
    try {
        const response = await fetch('scan_confirm.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                pickup_id: currentPickupId,
                qr_code: qrText
            })
        });
        const result = await response.json();
        if (result && result.success) {
            alert(result.message || 'Код подтверждён.');
            // Только уведомляем пользователя; статус заявки не меняем и UI не обновляем.
            closeCourierScanner();
        } else {
            // If not successful, show error and restart scanning.
            alert((result && result.message) || 'Код не совпадает. Попробуйте ещё раз.');
            // restart scanning
            initScanner();
        }
    } catch (err) {
        console.error('QR scanner: fetch error:', err);
        alert('Ошибка отправки на сервер.');
        // restart scanning
        initScanner();
    }
}

// Attach click handlers for scan buttons once DOM is loaded.
document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.btn.scan').forEach(btn => {
        btn.addEventListener('click', event => {
            const pid = btn.dataset.pickupId;
            openCourierScanner(pid);
        });
    });
});