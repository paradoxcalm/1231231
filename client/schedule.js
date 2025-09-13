/* ===== schedule.js (ES‑module) =====
 * Делает loadSchedule доступной в глобальном пространстве
 * и устраняет ReferenceError в index.php.
 */

import { loadSchedule as _loadSchedule } from './frontend/js/schedule/scheduleMain.js';

// 1) Делаем функцию доступной глобально
window.loadSchedule = _loadSchedule;

// 2) (Необязательно) Можно сразу отрисовать расписание после загрузки страницы
//    – если нужно автозапускать раздел для клиента.
// document.addEventListener('DOMContentLoaded', () => {
//     if (typeof window.userRole === 'string' && window.userRole === 'client') {
//         window.loadSchedule();
//     }
// });

/* ===== Дополнительно: полезные экспортные элементы ===== */

// Экспортируем по имени и по умолчанию (на случай импорта из других модулей)
export { _loadSchedule as loadSchedule };
export default _loadSchedule;
