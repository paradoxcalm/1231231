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

window.scheduleUtils = {
    parseJSONResponse,
    handleError,
};

export {}; // убеждаемся, что файл трактуется как модуль
