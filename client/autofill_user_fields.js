
// 🔄 form.js — автозаполнение ИП и Магазина
function preloadUserDataIntoForm() {
    fetch('fetch_user_data.php')
        .then(r => r.json())
        .then(data => {
            if (!data.success) return;
            const u = data.data;
            const senderInput = document.getElementById('sender');
            const storeInput = document.getElementById('store_name') || document.getElementById('storeName');
            if (senderInput && u.company_name) {
                senderInput.value = u.company_name;
            }
            if (storeInput && u.store_name) {
                storeInput.value = u.store_name;
            }
        })
        .catch(err => console.error("Ошибка автозаполнения:", err));
}

// 🔄 processing.js — автозаполнение ИП и Магазина
function preloadUserDataIntoProcessing() {
    fetch('fetch_user_data.php')
        .then(r => r.json())
        .then(data => {
            if (!data.success) return;
            const u = data.data;
            const companyInput = document.getElementById('companyName');
            const storeInput = document.getElementById('storeName');
            if (companyInput && u.company_name) {
                companyInput.value = u.company_name;
            }
            if (storeInput && u.store_name) {
                storeInput.value = u.store_name;
            }
        })
        .catch(err => console.error("Ошибка автозаполнения:", err));
}
