
// 🔄 Автоматическое формирование поля "ИП"
function autoUpdateIP() {
    const last = document.querySelector('[name="last_name"]').value.trim();
    const first = document.querySelector('[name="first_name"]').value.trim();
    const middle = document.querySelector('[name="middle_name"]').value.trim();
    const companyInput = document.querySelector('[name="company_name"]');

    if (!companyInput.dataset.manual) {
        const initials = (first ? first[0] + '.' : '') + (middle ? middle[0] + '.' : '');
        companyInput.value = last + (initials ? ' ' + initials : '');
    }
}

function makeCompanyEditable() {
    const companyInput = document.querySelector('[name="company_name"]');
    companyInput.dataset.manual = "true"; // отключаем автообновление
    companyInput.removeAttribute("readonly");
    companyInput.focus();
}
