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

    async loadTariffs() {
        try {
            // Симуляция загрузки тарифов
            const mockTariffs = {
                'Махачкала': {
                    'Коледино': { box: 650, pallet: 7000 },
                    'Невинномысск': { box: 580, pallet: 6500 },
                    'Тула': { box: 720, pallet: 7500 },
                    'Казань': { box: 690, pallet: 7200 },
                    'Рязань': { box: 670, pallet: 7100 }
                },
                'Хасавюрт': {
                    'Коледино': { box: 680, pallet: 7200 },
                    'Невинномысск': { box: 600, pallet: 6700 },
                    'Тула': { box: 750, pallet: 7700 },
                    'Казань': { box: 720, pallet: 7400 },
                    'Рязань': { box: 700, pallet: 7300 }
                },
                'Каспийск': {
                    'Коледино': { box: 660, pallet: 7100 },
                    'Невинномысск': { box: 590, pallet: 6600 },
                    'Тула': { box: 730, pallet: 7600 },
                    'Казань': { box: 710, pallet: 7300 },
                    'Рязань': { box: 690, pallet: 7200 }
                },
                'Дербент': {
                    'Коледино': { box: 670, pallet: 7150 },
                    'Невинномысск': { box: 595, pallet: 6650 },
                    'Тула': { box: 740, pallet: 7650 },
                    'Казань': { box: 715, pallet: 7350 },
                    'Рязань': { box: 695, pallet: 7250 }
                }
            };

            this.tariffs = mockTariffs;
            this.renderTariffs();
        } catch (error) {
            console.error('Ошибка загрузки тарифов:', error);
            window.app.showError('Не удалось загрузить тарифы');
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