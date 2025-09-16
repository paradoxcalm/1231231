import { state, resetFiltersState, syncWindowFilters } from './state.js';
import { fetchAndDisplayUpcoming } from './upcoming.js';

function showFilterNotice(filterBlock, msg) {
    let n = document.getElementById('filterNotice');
    if (!n) {
        n = document.createElement('div');
        n.id = 'filterNotice';
        n.style = 'color:#b70000;font-size:1em;padding:7px 0 3px 0;';
        filterBlock.appendChild(n);
    }
    n.textContent = msg;
    setTimeout(() => {
        if (n) {
            n.textContent = '';
        }
    }, 3000);
}

function loadAllCities(citySelect, selectedCity) {
    return fetch('filter_options.php?action=all_cities')
        .then(r => r.json())
        .then(data => {
            if (data.success) {
                citySelect.innerHTML = `<option value="">Все</option>` +
                    data.cities.map(c => `<option value="${c}"${selectedCity === c ? ' selected' : ''}>${c}</option>`).join('');
            }
        });
}

function loadAllWarehouses(warehouseSelect, selectedCity, selectedWarehouse) {
    let url = 'filter_options.php?action=all_warehouses';
    if (selectedCity) {
        url += '&city=' + encodeURIComponent(selectedCity);
    }
    return fetch(url)
        .then(r => r.json())
        .then(data => {
            if (data.success) {
                warehouseSelect.innerHTML = `<option value="">Все</option>` +
                    data.warehouses.map(w => `<option value="${w}"${selectedWarehouse === w ? ' selected' : ''}>${w}</option>`).join('');
            }
        });
}

export function initializeFilters() {
    const filterBlock = document.getElementById('filterBlock');
    if (!filterBlock) {
        return;
    }

    filterBlock.innerHTML = `
        <div class="filters-row">
            <div class="filter-group">
                <label for="marketplaceFilter"><i class="fas fa-store"></i> Маркетплейс</label>
                <select id="marketplaceFilter" class="styled-filter"></select>
            </div>
            <div class="filter-group">
                <label for="cityDropdown"><i class="fas fa-city"></i> Город</label>
                <select id="cityDropdown" class="styled-filter"></select>
            </div>
            <div class="filter-group">
                <label for="destinationWarehouseFilter"><i class="fas fa-warehouse"></i> Склад</label>
                <select id="destinationWarehouseFilter" class="styled-filter"></select>
            </div>
        </div>
    `;

    resetFiltersState();
    syncWindowFilters();

    const marketplaceSelect = document.getElementById('marketplaceFilter');
    const citySelect = document.getElementById('cityDropdown');
    const warehouseSelect = document.getElementById('destinationWarehouseFilter');

    if (!marketplaceSelect || !citySelect || !warehouseSelect) {
        return;
    }

    fetch('filter_options.php?action=marketplaces')
        .then(r => r.json())
        .then(data => {
            if (data.success) {
                marketplaceSelect.innerHTML = `<option value="">Все</option>` +
                    data.marketplaces.map(mp => `<option value="${mp}">${mp}</option>`).join('');
            }
        });

    loadAllCities(citySelect);
    loadAllWarehouses(warehouseSelect);

    marketplaceSelect.onchange = function () {
        state.activeMarketplaceFilter = this.value;
        const prevCity = state.activeCityFilter;
        const prevWarehouse = state.activeDestinationWarehouseFilter;
        syncWindowFilters();

        let cityPromise;
        if (!state.activeMarketplaceFilter) {
            cityPromise = fetch('filter_options.php?action=all_cities')
                .then(r => r.json())
                .then(data => data.cities || []);
        } else {
            cityPromise = fetch(`filter_options.php?action=cities&marketplace=${encodeURIComponent(state.activeMarketplaceFilter)}`)
                .then(r => r.json())
                .then(data => data.cities || []);
        }

        cityPromise.then(cities => {
            const cityValid = !prevCity || cities.includes(prevCity);
            if (!cityValid) {
                showFilterNotice(filterBlock, 'Нет отправлений по выбранному маркетплейсу и городу.');
                state.activeCityFilter = '';
                state.activeDestinationWarehouseFilter = '';
            } else {
                state.activeCityFilter = prevCity;
            }
            syncWindowFilters();

            citySelect.innerHTML = `<option value="">Все</option>` +
                cities.map(c => `<option value="${c}"${state.activeCityFilter === c ? ' selected' : ''}>${c}</option>`).join('');
            citySelect.disabled = false;

            let whPromise;
            if (!state.activeMarketplaceFilter && !state.activeCityFilter) {
                whPromise = fetch('filter_options.php?action=all_warehouses')
                    .then(r => r.json())
                    .then(data => data.warehouses || []);
            } else if (!state.activeMarketplaceFilter && state.activeCityFilter) {
                whPromise = fetch(`filter_options.php?action=all_warehouses&city=${encodeURIComponent(state.activeCityFilter)}`)
                    .then(r => r.json())
                    .then(data => data.warehouses || []);
            } else if (state.activeMarketplaceFilter && state.activeCityFilter) {
                whPromise = fetch(`filter_options.php?action=warehouses&marketplace=${encodeURIComponent(state.activeMarketplaceFilter)}&city=${encodeURIComponent(state.activeCityFilter)}`)
                    .then(r => r.json())
                    .then(data => data.warehouses || []);
            } else {
                whPromise = Promise.resolve([]);
            }

            whPromise.then(warehouses => {
                const whValid = !prevWarehouse || warehouses.includes(prevWarehouse);
                if (!whValid && prevWarehouse) {
                    showFilterNotice(filterBlock, 'Нет отправлений по выбранному складу для текущих фильтров.');
                    state.activeDestinationWarehouseFilter = '';
                } else {
                    state.activeDestinationWarehouseFilter = prevWarehouse;
                }
                syncWindowFilters();

                warehouseSelect.innerHTML = `<option value="">Все</option>` +
                    warehouses.map(w => `<option value="${w}"${state.activeDestinationWarehouseFilter === w ? ' selected' : ''}>${w}</option>`).join('');
                warehouseSelect.disabled = false;

                fetchAndDisplayUpcoming(state.archiveView);
            });
        });
    };

    citySelect.onchange = function () {
        state.activeCityFilter = this.value;
        const prevWarehouse = state.activeDestinationWarehouseFilter;
        syncWindowFilters();

        let whPromise;
        if (!state.activeMarketplaceFilter && !state.activeCityFilter) {
            whPromise = fetch('filter_options.php?action=all_warehouses')
                .then(r => r.json())
                .then(data => data.warehouses || []);
        } else if (!state.activeMarketplaceFilter && state.activeCityFilter) {
            whPromise = fetch(`filter_options.php?action=all_warehouses&city=${encodeURIComponent(state.activeCityFilter)}`)
                .then(r => r.json())
                .then(data => data.warehouses || []);
        } else if (state.activeMarketplaceFilter && state.activeCityFilter) {
            whPromise = fetch(`filter_options.php?action=warehouses&marketplace=${encodeURIComponent(state.activeMarketplaceFilter)}&city=${encodeURIComponent(state.activeCityFilter)}`)
                .then(r => r.json())
                .then(data => data.warehouses || []);
        } else {
            whPromise = Promise.resolve([]);
        }

        whPromise.then(warehouses => {
            const whValid = !prevWarehouse || warehouses.includes(prevWarehouse);
            if (!whValid && prevWarehouse) {
                showFilterNotice(filterBlock, 'Нет отправлений по выбранному складу для текущих фильтров.');
                state.activeDestinationWarehouseFilter = '';
            } else {
                state.activeDestinationWarehouseFilter = prevWarehouse;
            }
            syncWindowFilters();

            warehouseSelect.innerHTML = `<option value="">Все</option>` +
                warehouses.map(w => `<option value="${w}"${state.activeDestinationWarehouseFilter === w ? ' selected' : ''}>${w}</option>`).join('');
            warehouseSelect.disabled = false;

            fetchAndDisplayUpcoming(state.archiveView);
        });
    };

    warehouseSelect.onchange = function () {
        state.activeDestinationWarehouseFilter = this.value;
        syncWindowFilters();
        fetchAndDisplayUpcoming(state.archiveView);
    };
}

export async function updateDestinationWarehouses() {
    const warehouseSelect = document.getElementById('destinationWarehouseFilter');
    if (!warehouseSelect) {
        return;
    }

    if (!state.activeCityFilter) {
        warehouseSelect.innerHTML = '';
        warehouseSelect.style.display = 'none';
        state.activeDestinationWarehouseFilter = '';
        syncWindowFilters();
        return;
    }

    try {
        const res = await fetch(`schedule.php?archived=0&city=${encodeURIComponent(state.activeCityFilter)}`);
        const data = await res.json();
        const list = data.schedules || data;
        const set = new Set();
        list.forEach(s => {
            if (s.warehouses && typeof s.warehouses === 'string') {
                set.add(s.warehouses.trim());
            }
        });
        const options = Array.from(set);
        if (options.length === 0) {
            warehouseSelect.innerHTML = '';
            warehouseSelect.style.display = 'none';
            state.activeDestinationWarehouseFilter = '';
            syncWindowFilters();
            return;
        }
        warehouseSelect.innerHTML = `<option value="">Все направления</option>` +
            options.map(w => `<option value="${w}">${w}</option>`).join('');
        warehouseSelect.style.display = '';
        warehouseSelect.value = '';
        state.activeDestinationWarehouseFilter = '';
        syncWindowFilters();
    } catch (err) {
        warehouseSelect.innerHTML = '';
        warehouseSelect.style.display = 'none';
        state.activeDestinationWarehouseFilter = '';
        syncWindowFilters();
        console.error('Ошибка загрузки направлений:', err);
    }
}

export function filterByCity(cityName) {
    state.activeCityFilter = cityName;
    syncWindowFilters();
    document.querySelectorAll('.city-tab-header .tab-button').forEach(btn => {
        btn.classList.toggle('active', btn.textContent === cityName || (cityName === '' && btn.textContent === 'Все'));
    });
    fetchAndDisplayUpcoming(state.archiveView);
}
