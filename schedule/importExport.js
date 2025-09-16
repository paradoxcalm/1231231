export function openImportModal() {
    const modal = document.getElementById('importScheduleModal');
    if (modal) {
        modal.style.display = 'block';
    } else {
        alert('❌ Модальное окно импорта не найдено.');
    }
}

export function showImportResultModal(inserted, errors) {
    let html = `<p>✅ Успешно добавлено: <strong>${inserted}</strong></p>`;
    if (errors.length > 0) {
        html += `<p>❌ Ошибки:</p><ul style="padding-left:16px;">`;
        for (const e of errors) {
            html += `<li>Строка ${e.row}: ${e.error}</li>`;
        }
        html += '</ul>';
    }
    document.getElementById('importResultModalContent').innerHTML = html;
    document.getElementById('importResultModal').style.display = 'block';
}

export function exportSchedule() {
    fetch('schedule.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'export' })
    })
        .then(r => {
            if (!r.ok) throw new Error('Ошибка экспорта: ' + r.status);
            return r.blob();
        })
        .then(blob => {
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'schedule.xls';
            a.click();
            window.URL.revokeObjectURL(url);
        })
        .catch(err => console.error('Ошибка exportSchedule:', err));
}
