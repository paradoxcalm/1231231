export function createOrder(scheduleId, city = '', warehouse = '') {
    if (typeof window.openRequestFormModal === 'function') {
        window.openRequestFormModal(scheduleId, city, warehouse);
    } else {
        console.error('Функция openRequestFormModal не найдена');
    }
}

// Делаем функцию доступной глобально для обработчиков onclick
window.createOrder = createOrder;
