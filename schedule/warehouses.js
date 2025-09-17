let showCreateFormCallback = null;

export function registerWarehouseCallbacks({ showCreateForm } = {}) {
    showCreateFormCallback = typeof showCreateForm === 'function' ? showCreateForm : null;
}

export function addNewWarehouseAndRefresh() {
    const name = prompt('Введите название склада:');
    if (!name || !name.trim()) return;
    fetch('warehouses.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'add', name: name.trim() })
    })
    .then(res => res.json())
    .then(data => {
        if (data.status === 'success') {
            if (showCreateFormCallback) {
                showCreateFormCallback();
            }
        } else {
            alert('Ошибка: ' + data.message);
        }
    });
}

export function enterWarehouseEditMode() {
    const checkboxes = document.querySelectorAll('input[name="warehouses[]"]:checked');
    if (checkboxes.length === 0) {
        alert('Сначала выберите склады для редактирования.');
        return;
    }

    checkboxes.forEach(cb => {
        const label = cb.nextElementSibling;
        const currentName = label.textContent;
        const input = document.createElement('input');
        input.type = 'text';
        input.value = currentName;
        input.className = 'edit-input';
        input.dataset.oldName = currentName;
        label.replaceWith(input);
    });

    const controls = document.getElementById('warehouseEditControls');
    if (controls) {
        controls.classList.add('is-visible');
    }
}

export function cancelWarehouseEdits() {
    const inputs = document.querySelectorAll('.edit-input');
    inputs.forEach(input => {
        const name = input.dataset.oldName;
        const label = document.createElement('label');
        label.htmlFor = `warehouse-${name}`;
        label.className = 'warehouse-label';
        label.textContent = name;
        input.replaceWith(label);
    });

    const controls = document.getElementById('warehouseEditControls');
    if (controls) {
        controls.classList.remove('is-visible');
    }
}

export function saveWarehouseEdits() {
    const inputs = document.querySelectorAll('.edit-input');
    const edits = [];

    inputs.forEach(input => {
        const oldName = input.dataset.oldName;
        const newName = input.value.trim();
        if (newName && newName !== oldName) {
            edits.push({ old_name: oldName, new_name: newName });
        }
    });

    if (edits.length === 0) {
        alert('Нет изменений.');
        return;
    }

    fetch('warehouses.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'batch_edit', edits })
    })
    .then(r => r.json())
    .then(data => {
        if (data.status === 'success') {
            alert('Склады обновлены.');
            if (showCreateFormCallback) {
                showCreateFormCallback();
            }
        } else {
            alert('Ошибка: ' + data.message);
        }
    })
    .catch(err => alert('Ошибка: ' + err.message));
}

export function confirmWarehouseDelete() {
    const selected = Array.from(document.querySelectorAll('input[name="warehouses[]"]:checked'))
        .map(cb => cb.value);

    if (selected.length === 0) {
        alert('Выберите склады для удаления.');
        return;
    }

    if (!confirm(`Удалить ${selected.length} склад(ов)?`)) return;

    fetch('warehouses.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', names: selected })
    })
    .then(r => r.json())
    .then(data => {
        if (data.status === 'success') {
            alert('Удалено.');
            if (showCreateFormCallback) {
                showCreateFormCallback();
            }
        } else {
            alert('Ошибка: ' + data.message);
        }
    })
    .catch(err => alert('Ошибка: ' + err.message));
}

export function loadWarehousesForFilter() {
    const select = document.getElementById('warehouseFilter');
    if (!select) {
        console.warn('Элемент #warehouseFilter не найден в DOM');
        return;
    }

    fetch('warehouse_filter.php', { cache: 'no-store' })
        .then(r => r.json())
        .then(data => {
            if (!Array.isArray(data)) {
                console.error('warehouse_filter.php вернул некорректный формат:', data);
                return;
            }

            select.innerHTML = '<option value="">Все склады</option>';
            data.forEach(w => {
                if (w.name && typeof w.name === 'string') {
                    const opt = document.createElement('option');
                    opt.value = w.name;
                    opt.textContent = w.name;
                    select.appendChild(opt);
                }
            });
        })
        .catch(err => console.error('Ошибка загрузки складов:', err));
}

export function addNewWarehouse(formId) {
    const name = prompt('Введите название склада:');
    if (!name || !name.trim()) return;
    fetch('warehouses.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'add', name: name.trim() })
    })
        .then(r => r.json())
        .then(d => {
            if (d.status === 'success') {
                loadWarehousesForFilter();
                fetch('warehouses.php')
                    .then(r2 => r2.json())
                    .then(warehouses => {
                        const container = document.querySelector(`#${formId} .warehouse-checkboxes`);
                        if (container) {
                            container.innerHTML = warehouses.map(wh => `
                                <div class="warehouse-checkbox-item">
                                    <input type="checkbox" name="warehouses[]" value="${wh.name}" id="warehouse-${wh.name}">
                                    <label for="warehouse-${wh.name}">${wh.name}</label>
                                </div>
                            `).join('');
                        }
                    })
                    .catch(err2 => console.error('Ошибка обновления списков складов:', err2));
            } else {
                alert('Ошибка: ' + d.message);
            }
        })
        .catch(err => console.error('Ошибка addNewWarehouse:', err));
}
