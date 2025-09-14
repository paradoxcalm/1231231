// Управление заказами
class OrdersManager {
    constructor() {
        this.orders = [];
        this.filteredOrders = [];
        this.currentTab = 'active';
        this.init();
    }

    init() {
        this.setupTabs();
        this.loadOrders();
    }

    setupTabs() {
        const tabBtns = document.querySelectorAll('#ordersSection .tab-btn');
        tabBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const tab = btn.dataset.tab;
                this.switchTab(tab);
                
                tabBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            });
        });
    }

    switchTab(tab) {
        this.currentTab = tab;
        this.filterOrders();
        this.renderOrders();
    }

    async loadOrders() {
        try {
            // Симуляция загрузки заказов
            const mockOrders = [
                {
                    id: 1234,
                    date: '2025-01-10',
                    companyName: 'ИП Иванов А.П.',
                    storeName: 'АлексМаркет',
                    status: 'В обработке',
                    packaging: 'Коробка',
                    quantity: 5,
                    cost: 3250,
                    city: 'Махачкала',
                    warehouse: 'Коледино',
                    acceptDate: '2025-01-15',
                    deliveryDate: '2025-01-18',
                    marketplaces: ['Wildberries'],
                    comment: 'Хрупкий товар, аккуратно',
                    qrCode: 'ORDER_1234_abc123',
                    trackingNumber: 'TR1234567890'
                },
                {
                    id: 1233,
                    date: '2025-01-08',
                    companyName: 'ИП Иванов А.П.',
                    storeName: 'АлексМаркет',
                    status: 'Доставлен',
                    packaging: 'Паллета',
                    quantity: 2,
                    cost: 14000,
                    city: 'Хасавюрт',
                    warehouse: 'Невинномысск',
                    acceptDate: '2025-01-12',
                    deliveryDate: '2025-01-15',
                    marketplaces: ['Ozon'],
                    comment: '',
                    qrCode: 'ORDER_1233_def456',
                    trackingNumber: 'TR0987654321'
                },
                {
                    id: 1232,
                    date: '2025-01-06',
                    companyName: 'ИП Иванов А.П.',
                    storeName: 'АлексМаркет',
                    status: 'Ожидает выгрузки',
                    packaging: 'Коробка',
                    quantity: 8,
                    cost: 5200,
                    city: 'Каспийск',
                    warehouse: 'Коледино',
                    acceptDate: '2025-01-14',
                    deliveryDate: '2025-01-17',
                    marketplaces: ['Wildberries', 'Ozon'],
                    comment: 'Срочная доставка',
                    qrCode: 'ORDER_1232_ghi789',
                    trackingNumber: 'TR1122334455'
                }
            ];

            this.orders = mockOrders;
            this.filterOrders();
            this.renderOrders();
        } catch (error) {
            console.error('Ошибка загрузки заказов:', error);
            window.app.showError('Не удалось загрузить заказы');
        }
    }

    filterOrders() {
        this.filteredOrders = this.orders.filter(order => {
            if (this.currentTab === 'active') {
                return !['Доставлен', 'Отменен', 'Возвращен'].includes(order.status);
            } else if (this.currentTab === 'archive') {
                return ['Доставлен', 'Отменен', 'Возвращен'].includes(order.status);
            }
            return true;
        });
    }

    renderOrders() {
        const grid = document.getElementById('ordersGrid');
        if (!grid) return;

        if (this.filteredOrders.length === 0) {
            grid.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-box-open"></i>
                    <h3>Нет заказов</h3>
                    <p>${this.currentTab === 'active' ? 'У вас нет активных заказов' : 'Архив заказов пуст'}</p>
                </div>
            `;
            return;
        }

        grid.innerHTML = this.filteredOrders.map(order => {
            const statusClass = this.getStatusClass(order.status);
            
            return `
                <div class="order-card" data-id="${order.id}">
                    <div class="order-header">
                        <div class="order-id">Заказ #${order.id}</div>
                        <div class="order-status ${statusClass}">${order.status}</div>
                    </div>

                    <div class="order-info">
                        <div class="info-item">
                            <div class="info-label">Дата создания</div>
                            <div class="info-value">${window.utils.formatDate(order.date)}</div>
                        </div>
                        <div class="info-item">
                            <div class="info-label">Упаковка</div>
                            <div class="info-value">${order.packaging}</div>
                        </div>
                        <div class="info-item">
                            <div class="info-label">Количество</div>
                            <div class="info-value">${order.quantity} шт.</div>
                        </div>
                        <div class="info-item">
                            <div class="info-label">Стоимость</div>
                            <div class="info-value">${window.utils.formatCurrency(order.cost)}</div>
                        </div>
                        <div class="info-item">
                            <div class="info-label">Маршрут</div>
                            <div class="info-value">${order.city} → ${order.warehouse}</div>
                        </div>
                        <div class="info-item">
                            <div class="info-label">Маркетплейсы</div>
                            <div class="info-value">${order.marketplaces.join(', ')}</div>
                        </div>
                    </div>

                    ${this.renderOrderActions(order)}
                </div>
            `;
        }).join('');

        // Добавляем обработчики кликов
        grid.querySelectorAll('.order-card').forEach(card => {
            card.addEventListener('click', (e) => {
                if (!e.target.closest('.action-btn')) {
                    const orderId = parseInt(card.dataset.id);
                    this.showOrderDetails(orderId);
                }
            });
        });

        // Добавляем стили
        if (!document.getElementById('emptyStateStyles')) {
            const styles = document.createElement('style');
            styles.id = 'emptyStateStyles';
            styles.textContent = `
                .empty-state {
                    text-align: center;
                    padding: 60px 20px;
                    color: var(--text-secondary);
                }
                .empty-state i {
                    font-size: 3rem;
                    margin-bottom: 16px;
                    color: var(--text-light);
                }
                .empty-state h3 {
                    font-size: 1.3rem;
                    margin-bottom: 8px;
                    color: var(--text-primary);
                }
                .empty-state p {
                    font-size: 1rem;
                }
            `;
            document.head.appendChild(styles);
        }
    }

    getStatusClass(status) {
        const statusMap = {
            'Ожидает выгрузки': 'status-pending',
            'В обработке': 'status-processing',
            'Готов к отправке': 'status-ready',
            'В пути': 'status-transit',
            'Доставлен': 'status-delivered',
            'Отменен': 'status-cancelled'
        };
        
        return statusMap[status] || 'status-unknown';
    }

    renderOrderActions(order) {
        const actions = [];

        // QR код для активных заказов
        if (!['Доставлен', 'Отменен'].includes(order.status)) {
            actions.push(`
                <button class="action-btn action-btn-secondary" onclick="window.OrdersManager.showQR('${order.qrCode}', ${order.id})">
                    <i class="fas fa-qrcode"></i>
                    QR-код
                </button>
            `);
        }

        // Отслеживание
        if (order.trackingNumber) {
            actions.push(`
                <button class="action-btn action-btn-secondary" onclick="window.OrdersManager.trackOrder('${order.trackingNumber}')">
                    <i class="fas fa-map-marker-alt"></i>
                    Отследить
                </button>
            `);
        }

        // Отмена для заказов в начальной стадии
        if (order.status === 'Ожидает выгрузки') {
            actions.push(`
                <button class="action-btn action-btn-secondary" onclick="window.OrdersManager.cancelOrder(${order.id})">
                    <i class="fas fa-times"></i>
                    Отменить
                </button>
            `);
        }

        return actions.length > 0 ? `
            <div class="order-actions">
                ${actions.join('')}
            </div>
        ` : '';
    }

    showOrderDetails(orderId) {
        const order = this.orders.find(o => o.id === orderId);
        if (!order) return;

        const modal = document.getElementById('orderDetailsModal');
        const content = document.getElementById('orderDetailsContent');
        
        if (!content) return;

        content.innerHTML = `
            <div class="order-details">
                <div class="details-header">
                    <h4>Заказ #${order.id}</h4>
                    <span class="order-status ${this.getStatusClass(order.status)}">${order.status}</span>
                </div>

                <div class="details-sections">
                    <div class="details-section">
                        <h5>Основная информация</h5>
                        <div class="details-grid">
                            <div class="detail-item">
                                <span class="detail-label">Дата создания:</span>
                                <span class="detail-value">${window.utils.formatDate(order.date)}</span>
                            </div>
                            <div class="detail-item">
                                <span class="detail-label">Компания:</span>
                                <span class="detail-value">${order.companyName}</span>
                            </div>
                            <div class="detail-item">
                                <span class="detail-label">Магазин:</span>
                                <span class="detail-value">${order.storeName}</span>
                            </div>
                            <div class="detail-item">
                                <span class="detail-label">Тип упаковки:</span>
                                <span class="detail-value">${order.packaging}</span>
                            </div>
                            <div class="detail-item">
                                <span class="detail-label">Количество:</span>
                                <span class="detail-value">${order.quantity} шт.</span>
                            </div>
                            <div class="detail-item">
                                <span class="detail-label">Стоимость:</span>
                                <span class="detail-value">${window.utils.formatCurrency(order.cost)}</span>
                            </div>
                        </div>
                    </div>

                    <div class="details-section">
                        <h5>Доставка</h5>
                        <div class="details-grid">
                            <div class="detail-item">
                                <span class="detail-label">Маршрут:</span>
                                <span class="detail-value">${order.city} → ${order.warehouse}</span>
                            </div>
                            <div class="detail-item">
                                <span class="detail-label">Дата приёмки:</span>
                                <span class="detail-value">${window.utils.formatDate(order.acceptDate)}</span>
                            </div>
                            <div class="detail-item">
                                <span class="detail-label">Дата сдачи:</span>
                                <span class="detail-value">${window.utils.formatDate(order.deliveryDate)}</span>
                            </div>
                            <div class="detail-item">
                                <span class="detail-label">Маркетплейсы:</span>
                                <span class="detail-value">${order.marketplaces.join(', ')}</span>
                            </div>
                            ${order.trackingNumber ? `
                                <div class="detail-item">
                                    <span class="detail-label">Трек-номер:</span>
                                    <span class="detail-value">${order.trackingNumber}</span>
                                </div>
                            ` : ''}
                        </div>
                    </div>

                    ${order.comment ? `
                        <div class="details-section">
                            <h5>Комментарий</h5>
                            <p class="comment-text">${order.comment}</p>
                        </div>
                    ` : ''}

                    ${!['Доставлен', 'Отменен'].includes(order.status) ? `
                        <div class="details-section">
                            <h5>QR-код для приёмки</h5>
                            <div class="qr-container" id="orderQR">
                                <div class="qr-code" id="qrCode_${order.id}"></div>
                                <div class="qr-instructions">
                                    Покажите этот QR-код менеджеру при сдаче товара
                                </div>
                            </div>
                        </div>
                    ` : ''}
                </div>

                <div class="modal-actions">
                    ${this.renderDetailActions(order)}
                </div>
            </div>
        `;

        // Генерируем QR-код если нужно
        if (!['Доставлен', 'Отменен'].includes(order.status)) {
            setTimeout(() => {
                const qrContainer = document.getElementById(`qrCode_${order.id}`);
                if (qrContainer && window.QRCode) {
                    new QRCode(qrContainer, {
                        text: order.qrCode,
                        width: 200,
                        height: 200,
                        colorDark: '#000000',
                        colorLight: '#ffffff'
                    });
                }
            }, 100);
        }

        // Добавляем стили
        if (!document.getElementById('orderDetailsStyles')) {
            const styles = document.createElement('style');
            styles.id = 'orderDetailsStyles';
            styles.textContent = `
                .order-details {
                    display: flex;
                    flex-direction: column;
                    gap: 20px;
                }
                .details-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding-bottom: 16px;
                    border-bottom: 1px solid var(--border-light);
                }
                .details-header h4 {
                    font-size: 1.3rem;
                    font-weight: 700;
                    color: var(--text-primary);
                }
                .details-sections {
                    display: flex;
                    flex-direction: column;
                    gap: 20px;
                }
                .details-section h5 {
                    font-size: 1rem;
                    font-weight: 600;
                    color: var(--text-primary);
                    margin-bottom: 12px;
                    padding-bottom: 6px;
                    border-bottom: 1px solid var(--border-light);
                }
                .comment-text {
                    background: var(--bg-secondary);
                    padding: 12px;
                    border-radius: var(--radius);
                    font-style: italic;
                    color: var(--text-secondary);
                }
                .status-pending { background: #fef3c7; color: #92400e; }
                .status-processing { background: #dbeafe; color: #1e40af; }
                .status-ready { background: #dcfce7; color: #166534; }
                .status-transit { background: #e0e7ff; color: #3730a3; }
                .status-delivered { background: #f0fdf4; color: #15803d; }
                .status-cancelled { background: #fef2f2; color: #991b1b; }
            `;
            document.head.appendChild(styles);
        }

        window.app.openModal(modal);
    }

    renderDetailActions(order) {
        const actions = [];

        if (order.trackingNumber) {
            actions.push(`
                <button class="action-btn action-btn-secondary" onclick="window.OrdersManager.trackOrder('${order.trackingNumber}')">
                    <i class="fas fa-map-marker-alt"></i>
                    Отследить
                </button>
            `);
        }

        if (order.status === 'Ожидает выгрузки') {
            actions.push(`
                <button class="action-btn action-btn-secondary" onclick="window.OrdersManager.cancelOrder(${order.id})">
                    <i class="fas fa-times"></i>
                    Отменить заказ
                </button>
            `);
        }

        return actions.join('');
    }

    showQR(qrCode, orderId) {
        // Создаем модальное окно для QR
        const qrModal = document.createElement('div');
        qrModal.className = 'modal active';
        qrModal.innerHTML = `
            <div class="modal-content" style="max-width: 400px;">
                <div class="modal-header">
                    <h3>QR-код заказа #${orderId}</h3>
                    <button class="modal-close" onclick="this.closest('.modal').remove()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body">
                    <div class="qr-container">
                        <div class="qr-code" id="qrCodeModal"></div>
                        <div class="qr-instructions">
                            Покажите этот QR-код менеджеру при сдаче товара
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(qrModal);

        // Генерируем QR-код
        setTimeout(() => {
            const qrContainer = document.getElementById('qrCodeModal');
            if (qrContainer && window.QRCode) {
                new QRCode(qrContainer, {
                    text: qrCode,
                    width: 250,
                    height: 250,
                    colorDark: '#000000',
                    colorLight: '#ffffff'
                });
            }
        }, 100);

        // Закрытие по клику на оверлей
        qrModal.addEventListener('click', (e) => {
            if (e.target === qrModal) {
                qrModal.remove();
            }
        });
    }

    trackOrder(trackingNumber) {
        // Симуляция отслеживания
        const trackingInfo = {
            number: trackingNumber,
            status: 'В пути',
            location: 'Сортировочный центр Ростов-на-Дону',
            lastUpdate: new Date(),
            events: [
                { date: '2025-01-10 09:00', event: 'Заказ принят к обработке', location: 'Махачкала' },
                { date: '2025-01-10 14:30', event: 'Товар упакован', location: 'Махачкала' },
                { date: '2025-01-11 08:15', event: 'Отправлен с сортировочного центра', location: 'Махачкала' },
                { date: '2025-01-12 16:45', event: 'Прибыл в сортировочный центр', location: 'Ростов-на-Дону' },
                { date: '2025-01-13 10:20', event: 'В пути на склад назначения', location: 'Москва' }
            ]
        };

        this.showTrackingModal(trackingInfo);
    }

    showTrackingModal(tracking) {
        const trackingModal = document.createElement('div');
        trackingModal.className = 'modal active';
        trackingModal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>Отслеживание заказа</h3>
                    <button class="modal-close" onclick="this.closest('.modal').remove()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body">
                    <div class="tracking-info">
                        <div class="tracking-header">
                            <div class="tracking-number">Трек-номер: ${tracking.number}</div>
                            <div class="tracking-status">${tracking.status}</div>
                        </div>
                        <div class="tracking-location">
                            <i class="fas fa-map-marker-alt"></i>
                            Текущее местоположение: ${tracking.location}
                        </div>
                        <div class="tracking-updated">
                            Обновлено: ${window.utils.formatDateTime(tracking.lastUpdate)}
                        </div>
                    </div>

                    <div class="tracking-timeline">
                        <h4>История перемещений</h4>
                        <div class="timeline">
                            ${tracking.events.map((event, index) => `
                                <div class="timeline-item ${index === 0 ? 'active' : ''}">
                                    <div class="timeline-dot"></div>
                                    <div class="timeline-content">
                                        <div class="timeline-date">${event.date}</div>
                                        <div class="timeline-event">${event.event}</div>
                                        <div class="timeline-location">${event.location}</div>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(trackingModal);

        // Добавляем стили для отслеживания
        if (!document.getElementById('trackingStyles')) {
            const styles = document.createElement('style');
            styles.id = 'trackingStyles';
            styles.textContent = `
                .tracking-info {
                    background: var(--bg-secondary);
                    padding: 16px;
                    border-radius: var(--radius);
                    margin-bottom: 20px;
                }
                .tracking-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 8px;
                }
                .tracking-number {
                    font-weight: 600;
                    color: var(--text-primary);
                }
                .tracking-status {
                    background: var(--primary);
                    color: white;
                    padding: 4px 12px;
                    border-radius: 12px;
                    font-size: 0.8rem;
                    font-weight: 600;
                }
                .tracking-location {
                    color: var(--text-secondary);
                    margin-bottom: 4px;
                }
                .tracking-location i {
                    margin-right: 6px;
                    color: var(--primary);
                }
                .tracking-updated {
                    font-size: 0.8rem;
                    color: var(--text-light);
                }
                .tracking-timeline h4 {
                    font-size: 1rem;
                    font-weight: 600;
                    margin-bottom: 16px;
                    color: var(--text-primary);
                }
                .timeline {
                    position: relative;
                }
                .timeline::before {
                    content: '';
                    position: absolute;
                    left: 15px;
                    top: 0;
                    bottom: 0;
                    width: 2px;
                    background: var(--border);
                }
                .timeline-item {
                    position: relative;
                    padding-left: 40px;
                    margin-bottom: 20px;
                }
                .timeline-dot {
                    position: absolute;
                    left: 8px;
                    top: 4px;
                    width: 14px;
                    height: 14px;
                    border-radius: 50%;
                    background: var(--border);
                    border: 3px solid white;
                }
                .timeline-item.active .timeline-dot {
                    background: var(--primary);
                }
                .timeline-date {
                    font-size: 0.8rem;
                    color: var(--text-secondary);
                    margin-bottom: 2px;
                }
                .timeline-event {
                    font-weight: 500;
                    color: var(--text-primary);
                    margin-bottom: 2px;
                }
                .timeline-location {
                    font-size: 0.8rem;
                    color: var(--text-light);
                }
            `;
            document.head.appendChild(styles);
        }

        // Закрытие по клику на оверлей
        trackingModal.addEventListener('click', (e) => {
            if (e.target === trackingModal) {
                trackingModal.remove();
            }
        });
    }

    async cancelOrder(orderId) {
        const confirmed = confirm('Вы уверены, что хотите отменить этот заказ?');
        if (!confirmed) return;

        try {
            // Симуляция отмены заказа
            const order = this.orders.find(o => o.id === orderId);
            if (order) {
                order.status = 'Отменен';
                this.filterOrders();
                this.renderOrders();
                window.app.showSuccess('Заказ успешно отменен');
            }
        } catch (error) {
            console.error('Ошибка отмены заказа:', error);
            window.app.showError('Не удалось отменить заказ');
        }
    }
}

// Инициализация после загрузки DOM
document.addEventListener('DOMContentLoaded', () => {
    window.OrdersManager = new OrdersManager();
});