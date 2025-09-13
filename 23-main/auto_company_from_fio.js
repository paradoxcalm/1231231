
function autoGenerateCompanyName() {
    const last = document.getElementById('last_name_input')?.value.trim();
    const first = document.getElementById('first_name_input')?.value.trim();
    const middle = document.getElementById('middle_name_input')?.value.trim();
    const companyInput = document.getElementById('company_name_input');
    const companySpan = document.getElementById('company_name_view');

    if (!companyInput || companyInput.style.display === 'inline') return;

    if (last && (first || middle)) {
        const initials = (first ? first[0] + '.' : '') + (middle ? middle[0] + '.' : '');
        const generated = last + (initials ? ' ' + initials : '');
        companyInput.value = generated;
        companySpan.textContent = generated;
    }
}

// Навешиваем на ФИО
['last_name_input', 'first_name_input', 'middle_name_input'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
        el.addEventListener('input', autoGenerateCompanyName);
    }
});
