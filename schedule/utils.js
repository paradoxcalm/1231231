export function getFullDate(year, month, day) {
    if (month < 0) {
        year--;
        month = 11;
    } else if (month > 11) {
        year++;
        month = 0;
    }
    return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function formatDeliveryDate(dateStr) {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return dateStr;
    const days = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];
    const dayName = days[d.getDay()];
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yyyy = d.getFullYear();
    return `${dd}.${mm}.${yyyy} ${dayName}`;
}

export function getStatusDotColor(status) {
    const s = (status || "").toLowerCase();
    if (s.includes("пути")) return "yellow";
    if (s.includes("ожидан")) return "green";
    if (s.includes("возврат")) return "red";
    return "gray";
}

export function showMassManageMessage(type, htmlText) {
    const msgBox = document.getElementById('massManageMessages');
    if (msgBox) {
        msgBox.innerHTML = `<div class="${type}">${htmlText}</div>`;
    }
}
