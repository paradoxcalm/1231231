// Управление тарифами
class TariffsManager {
    constructor() {
        this.tariffs = {};
        this.currentCity = '';
        this.init();
    }

    init() {
        this.loadTariffs();
    }

    async loadTariffs(city, warehouse) {
        try {
            // Определяем, какой эндпоинт использовать
            const url = (city && warehouse)
                ? `get_tariff.php?city=${encodeURIComponent(city)}&warehouse=${encodeURIComponent(warehouse)}`
                : 'tariffs/fetch_tariffs.php';

            const response = await fetch(url);
            const data = await response.json();

            if (!data.success) {
                throw new Error(data.message || 'Сервер вернул ошибку');
            }

            // Формируем структуру тарифов
            if (city && warehouse) {
                this.tariffs = {
                    [city]: {
                        [warehouse]: {
                            box: data.base_price,
                            pallet: data.pallet_price
                        }
                    }
                };
            } else {
                const tariffs = {};
                for (const [cityName, warehouses] of Object.entries(data.data)) {
                    tariffs[cityName] = {};
                    for (const [whName, prices] of Object.entries(warehouses)) {
                        tariffs[cityName][whName] = {
                            box: prices.box_price,
                            pallet: prices.pallet_price
                        };
                    }
                }
                this.tariffs = tariffs;
            }

            // Отрисовываем таблицу тарифов
            this.renderTariffs();
        } catch (error) {
            console.error('Ошибка загрузки тарифов:', error);
            if (window.app && typeof window.app.showError === 'function') {
                window.app.showError('Не удалось загрузить тарифы');
            }
        }
    }

    renderTariffs() {
        this.renderCityTabs();
        
        const cities = Object.keys(this.tariffs);
        if (cities.length > 0) {
            this.currentCity = cities[0];
            this.renderTariffsTable(this.currentCity);
        }
    }

    renderCityTabs() {
        const cityTabs = document.getElementById('cityTabs');
        if (!cityTabs) return;

        const cities = Object.keys(this.tariffs);
        
        cityTabs.innerHTML = cities.map((city, index) => `
            <button class="city-tab ${index === 0 ? 'active' : ''}" data-city="${city}">
                ${city}
            </button>
        `).join('');

        // Добавляем обработчики
        cityTabs.querySelectorAll('.city-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                const city = tab.dataset.city;
                this.switchCity(city);
                
                cityTabs.querySelectorAll('.city-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
            });
        });
    }

    switchCity(city) {
        this.currentCity = city;
        this.renderTariffsTable(city);
    }

    renderTariffsTable(city) {
        const container = document.getElementById('tariffsTable');
        if (!container) return;

        const cityTariffs = this.tariffs[city];
        if (!cityTariffs) {
            container.innerHTML = '<p class="text-center text-muted">Нет данных по тарифам для выбранного города</p>';
            return;
        }

        const warehouses = Object.keys(cityTariffs);
        
        container.innerHTML = `
            <table class="tariffs-table">
                <thead>
                    <tr>
                        <th>Склад назначения</th>
                        <th>Стоимость за коробку</th>
                        <th>Стоимость за паллету</th>
                        <th>Объём (примерный)</th>
                    </tr>
                </thead>
                <tbody>
                    ${warehouses.map(warehouse => {
                        const tariff = cityTariffs[warehouse];
                        const boxVolume = (60 * 40 * 40) / 1000000; // м³
                        const pricePerCubicMeter = Math.round(tariff.box / boxVolume);
                        
                        return `
                            <tr>
                                <td>
                                    <div class="warehouse-name">${warehouse}</div>
                                    <div class="warehouse-location text-muted">Московская область</div>
                                </td>
                                <td>
                                    <span class="price-value">${window.utils.formatCurrency(tariff.box)}</span>
                                    <div class="price-note text-muted">за стандартную коробку</div>
                                </td>
                                <td>
                                    <span class="price-value">${window.utils.formatCurrency(tariff.pallet)}</span>
                                    <div class="price-note text-muted">за паллету</div>
                                </td>
                                <td>
                                    <span class="price-value">≈${window.utils.formatCurrency(pricePerCubicMeter)}</span>
                                    <div class="price-note text-muted">за м³</div>
                                </td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
            
            <div class="tariffs-note">
                <h4>Дополнительная информация</h4>
                <ul>
                    <li>Стандартная коробка: 60×40×40 см</li>
                    <li>Максимальный вес коробки: 15 кг</li>
                    <li>Паллета: до 220 см высота, до 600 кг</li>
                    <li>Цены указаны без учета дополнительных услуг</li>
                    <li>Нестандартные размеры рассчитываются индивидуально</li>
                </ul>
            </div>
        `;

        // Добавляем стили
        if (!document.getElementById('tariffsTableStyles')) {
            const styles = document.createElement('style');
            styles.id = 'tariffsTableStyles';
            styles.textContent = `
                .warehouse-name {
                    font-weight: 600;
                    color: var(--text-primary);
                }
                .warehouse-location {
                    font-size: 0.8rem;
                    margin-top: 2px;
                }
                .price-note {
                    font-size: 0.8rem;
                    margin-top: 2px;
                }
                .tariffs-note {
                    margin-top: 24px;
                    padding: 20px;
                    background: var(--bg-secondary);
                    border-radius: var(--radius);
                }
                .tariffs-note h4 {
                    font-size: 1rem;
                    font-weight: 600;
                    margin-bottom: 12px;
                    color: var(--text-primary);
                }
                .tariffs-note ul {
                    list-style: none;
                    padding: 0;
                    margin: 0;
                }
                .tariffs-note li {
                    padding: 6px 0;
                    color: var(--text-secondary);
                    font-size: 0.9rem;
                    position: relative;
                    padding-left: 20px;
                }
                .tariffs-note li::before {
                    content: "•";
                    color: var(--primary);
                    position: absolute;
                    left: 0;
                    font-weight: bold;
                }
            `;
            document.head.appendChild(styles);
        }
    }

    getTariff(city, warehouse, type = 'box') {
        if (!this.tariffs[city] || !this.tariffs[city][warehouse]) {
            return null;
        }
        return this.tariffs[city][warehouse][type];
    }

    calculateShippingCost(city, warehouse, quantity, type = 'box') {
        const unitPrice = this.getTariff(city, warehouse, type);
        if (!unitPrice) return null;
        
        return unitPrice * quantity;
    }
}

// Инициализация после загрузки DOM
document.addEventListener('DOMContentLoaded', () => {
    window.TariffsManager = new TariffsManager();
});