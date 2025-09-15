/**
 * scheduleUtils.js
 * Общие вспомогательные функции для модулей расписания.
 */

async function parseJSONResponse(response) {
    const contentType = response.headers.get('content-type') || '';
    if (!response.ok || !contentType.includes('application/json')) {
        const errorText = await response.text();
        console.error('Ошибка ответа сервера:', errorText);
        alert(`Ошибка ответа сервера: ${errorText}`);
        throw new Error(errorText);
    }
    try {
        return await response.json();
    } catch (err) {
        console.error('Ошибка парсинга JSON:', err);
        alert('Ошибка парсинга ответа сервера');
        throw err;
    }
}

function handleError(err, context = 'Ошибка') {
    console.error(`${context}:`, err);
    alert(`${context}: ${err.message || err}`);
}

function formatDeliveryDate(dateStr) {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const days = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];
    const dayName = days[d.getDay()];
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yyyy = d.getFullYear();
    return `${dd}.${mm}.${yyyy} ${dayName}`;
}

function getFullDate(year, month, day) {
    if (month < 0) {
        year--;
        month = 11;
    } else if (month > 11) {
        year++;
        month = 0;
    }
    return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function isDateToday(dateStr) {
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    return dateStr === todayStr;
}

window.scheduleUtils = {
    parseJSONResponse,
    handleError,
    formatDeliveryDate,
    getFullDate,
    isDateToday,
};

window.parseJSONResponse = parseJSONResponse;
window.handleError = handleError;
window.formatDeliveryDate = formatDeliveryDate;
window.getFullDate = getFullDate;
window.isDateToday = isDateToday;

export {}; // убеждаемся, что файл трактуется как модуль
