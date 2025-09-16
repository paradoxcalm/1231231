// Управление профилем пользователя
class ProfileManager {
    constructor() {
        this.userStats = {};
        this.init();
    }

    async init() {
        const hasUserData = await this.fetchUserData();
        if (!hasUserData) {
            return;
        }
        this.setupForm();
        this.loadProfile();
        this.loadStats();
    }

    async fetchUserData() {
        try {
            const response = await fetch('../fetch_user_data.php', { credentials: 'include' });
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const data = await response.json();
            if (!data.success || !data.data) {
                window.location.href = '../auth_form.php';
                return false;
            }

            const u = data.data;
            const user = {
                lastName: u.last_name || '',
                firstName: u.first_name || '',
                middleName: u.middle_name || '',
                phone: u.phone || '',
                email: u.email || '',
                companyName: u.company_name || '',
                storeName: u.store_name || ''
            };

            if (window.app) {
                window.app.currentUser = user;
            }

            this.updateProfileDisplay(user);
            return true;
        } catch (error) {
            console.error('Ошибка загрузки данных пользователя:', error);
            window.location.href = '../auth_form.php';
            return false;
        }
    }

    setupForm() {
        const form = document.getElementById('profileForm');
        if (form) {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                this.saveProfile(form);
            });

            // Автосохранение при изменении
            const inputs = form.querySelectorAll('input, textarea');
            inputs.forEach(input => {
                input.addEventListener('change', 
                    window.utils.debounce(() => this.autoSave(input), 1000)
                );
            });
        }
    }

    loadProfile() {
        const appInstance = window.app || {};
        const user = appInstance.currentUser || {};
        const form = document.getElementById('profileForm');

        if (form) {
            const setValue = (selector, value) => {
                const input = form.querySelector(selector);
                if (input) {
                    input.value = value || '';
                }
            };

            setValue('input[name="lastName"]', user.lastName);
            setValue('input[name="firstName"]', user.firstName);
            setValue('input[name="middleName"]', user.middleName);
            setValue('input[name="phone"]', user.phone);
            setValue('input[name="email"]', user.email);
            setValue('input[name="companyName"]', user.companyName);
            setValue('input[name="storeName"]', user.storeName);
        }

        // Обновляем отображение в шапке
        this.updateProfileDisplay(user);
    }

    updateProfileDisplay(user = {}) {
        const firstName = typeof user.firstName === 'string' ? user.firstName.trim() : '';
        const lastName = typeof user.lastName === 'string' ? user.lastName.trim() : '';
        const fullName = [firstName, lastName].filter(Boolean).join(' ').trim();
        const initials = [firstName.charAt(0), lastName.charAt(0)]
            .filter(Boolean)
            .map(letter => letter.toUpperCase())
            .join('');

        const profileName = document.querySelector('.profile-btn .profile-name');
        if (profileName) {
            profileName.textContent = fullName;
        }

        const headerAvatar = document.querySelector('.profile-btn .avatar');
        if (headerAvatar) {
            headerAvatar.textContent = initials;
        }

        const profileHeaderAvatar = document.querySelector('.profile-header .profile-avatar');
        if (profileHeaderAvatar) {
            profileHeaderAvatar.textContent = initials;
        }

        const profileInfoName = document.querySelector('.profile-info .profile-full-name');
        if (profileInfoName) {
            profileInfoName.textContent = fullName;
        }
    }

    async loadStats() {
        try {
            const response = await fetch('../get_orders.php', { credentials: 'include' });
            const data = await response.json();
            const orders = data.orders || [];
            const totalOrders = orders.length;
            const completedOrders = orders.filter(o => o.status === 'Доставлен').length;
            const totalAmount = orders.reduce((sum, o) => sum + (o.reception?.payment ?? 0), 0);
            const successRate = totalOrders ? Math.round((completedOrders / totalOrders) * 100) : 0;

            this.userStats = { totalOrders, completedOrders, totalAmount, successRate };
            this.renderStats();
        } catch (error) {
            console.error('Ошибка загрузки статистики:', error);
        }
    }

    renderStats() {
        const statsItems = document.querySelectorAll('.stat-item');
        
        if (statsItems.length >= 4) {
            statsItems[0].querySelector('.stat-value').textContent = this.userStats.totalOrders;
            statsItems[1].querySelector('.stat-value').textContent = this.userStats.completedOrders;
            statsItems[2].querySelector('.stat-value').textContent = window.utils.formatCurrency(this.userStats.totalAmount);
            statsItems[3].querySelector('.stat-value').textContent = `${this.userStats.successRate}%`;
        }
    }

    async saveProfile(form) {
        const submitBtn = form.querySelector('.save-btn');
        const originalText = submitBtn.innerHTML;

        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Сохранение...';
        submitBtn.disabled = true;

        try {
            const formData = new FormData(form);
            const response = await fetch('../update_user_data.php', {
                method: 'POST',
                body: formData,
                credentials: 'include'
            });
            const data = await response.json();
            if (!data.success) {
                throw new Error(data.message || 'Ошибка сохранения');
            }

            const u = data.data || {};
            window.app.currentUser = {
                lastName: u.last_name || '',
                firstName: u.first_name || '',
                middleName: u.middle_name || '',
                phone: u.phone || '',
                email: u.email || '',
                companyName: u.company_name || '',
                storeName: u.store_name || ''
            };

            this.loadProfile();
            window.app.showSuccess('Профиль успешно сохранен');

        } catch (error) {
            console.error('Ошибка сохранения профиля:', error);
            window.app.showError('Не удалось сохранить профиль');
        } finally {
            submitBtn.innerHTML = originalText;
            submitBtn.disabled = false;
        }
    }

    autoSave(input) {
        // Показываем индикатор автосохранения
        const indicator = document.createElement('div');
        indicator.className = 'autosave-indicator';
        indicator.innerHTML = '<i class="fas fa-check"></i> Сохранено';
        
        // Добавляем стили для индикатора
        if (!document.getElementById('autosaveStyles')) {
            const styles = document.createElement('style');
            styles.id = 'autosaveStyles';
            styles.textContent = `
                .autosave-indicator {
                    position: fixed;
                    bottom: 20px;
                    right: 20px;
                    background: var(--success);
                    color: white;
                    padding: 8px 16px;
                    border-radius: var(--radius);
                    font-size: 0.9rem;
                    font-weight: 500;
                    box-shadow: var(--shadow-lg);
                    z-index: 3000;
                    animation: slideInUp 0.3s ease;
                }
                @keyframes slideInUp {
                    from {
                        transform: translateY(100px);
                        opacity: 0;
                    }
                    to {
                        transform: translateY(0);
                        opacity: 1;
                    }
                }
            `;
            document.head.appendChild(styles);
        }

        document.body.appendChild(indicator);

        // Автоматически убираем индикатор
        setTimeout(() => {
            indicator.style.animation = 'slideInUp 0.3s ease reverse';
            setTimeout(() => indicator.remove(), 300);
        }, 2000);

        // Логика автосохранения
        console.log('Автосохранение поля:', input.name, '=', input.value);
    }

    // Методы для работы с настройками
    openSettings() {
        // Создаем модальное окно настроек
        const settingsModal = document.createElement('div');
        settingsModal.className = 'modal active';
        settingsModal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>Настройки</h3>
                    <button class="modal-close" onclick="this.closest('.modal').remove()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body">
                    <div class="settings-section">
                        <h4>Уведомления</h4>
                        <div class="setting-item">
                            <label class="setting-label">
                                <input type="checkbox" checked>
                                <span>Email уведомления о статусе заказов</span>
                            </label>
                        </div>
                        <div class="setting-item">
                            <label class="setting-label">
                                <input type="checkbox" checked>
                                <span>SMS уведомления о готовности к отправке</span>
                            </label>
                        </div>
                        <div class="setting-item">
                            <label class="setting-label">
                                <input type="checkbox">
                                <span>Push-уведомления в браузере</span>
                            </label>
                        </div>
                    </div>

                    <div class="settings-section">
                        <h4>Предпочтения</h4>
                        <div class="setting-item">
                            <label>Предпочитаемый маркетплейс:</label>
                            <select class="setting-select">
                                <option value="">Нет предпочтений</option>
                                <option value="wildberries">Wildberries</option>
                                <option value="ozon">Ozon</option>
                                <option value="yandex">Яндекс Маркет</option>
                            </select>
                        </div>
                        <div class="setting-item">
                            <label>Автозаполнение данных:</label>
                            <select class="setting-select">
                                <option value="enabled">Включено</option>
                                <option value="disabled">Отключено</option>
                            </select>
                        </div>
                    </div>

                    <div class="settings-section">
                        <h4>Безопасность</h4>
                        <button class="action-btn action-btn-secondary" onclick="window.ProfileManager.changePassword()">
                            <i class="fas fa-key"></i>
                            Изменить пароль
                        </button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(settingsModal);

        // Добавляем стили для настроек
        if (!document.getElementById('settingsStyles')) {
            const styles = document.createElement('style');
            styles.id = 'settingsStyles';
            styles.textContent = `
                .settings-section {
                    margin-bottom: 24px;
                    padding-bottom: 20px;
                    border-bottom: 1px solid var(--border-light);
                }
                .settings-section:last-child {
                    border-bottom: none;
                    margin-bottom: 0;
                }
                .settings-section h4 {
                    font-size: 1.1rem;
                    font-weight: 600;
                    color: var(--text-primary);
                    margin-bottom: 16px;
                }
                .setting-item {
                    margin-bottom: 12px;
                }
                .setting-label {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    cursor: pointer;
                    font-size: 0.9rem;
                    color: var(--text-primary);
                }
                .setting-select {
                    width: 100%;
                    padding: 8px 12px;
                    border: 1px solid var(--border);
                    border-radius: var(--radius);
                    margin-top: 4px;
                }
            `;
            document.head.appendChild(styles);
        }

        // Закрытие по клику на оверлей
        settingsModal.addEventListener('click', (e) => {
            if (e.target === settingsModal) {
                settingsModal.remove();
            }
        });
    }

    changePassword() {
        const passwordModal = document.createElement('div');
        passwordModal.className = 'modal active';
        passwordModal.innerHTML = `
            <div class="modal-content" style="max-width: 400px;">
                <div class="modal-header">
                    <h3>Изменение пароля</h3>
                    <button class="modal-close" onclick="this.closest('.modal').remove()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body">
                    <form id="changePasswordForm">
                        <div class="form-group">
                            <label>Текущий пароль</label>
                            <input type="password" name="currentPassword" required>
                        </div>
                        <div class="form-group">
                            <label>Новый пароль</label>
                            <input type="password" name="newPassword" required minlength="6">
                        </div>
                        <div class="form-group">
                            <label>Подтверждение пароля</label>
                            <input type="password" name="confirmPassword" required>
                        </div>
                        <button type="submit" class="submit-btn">
                            <i class="fas fa-key"></i>
                            Изменить пароль
                        </button>
                    </form>
                </div>
            </div>
        `;

        document.body.appendChild(passwordModal);

        const form = passwordModal.querySelector('#changePasswordForm');
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const formData = new FormData(form);
            const newPassword = formData.get('newPassword');
            const confirmPassword = formData.get('confirmPassword');
            
            if (newPassword !== confirmPassword) {
                window.app.showError('Пароли не совпадают');
                return;
            }
            
            try {
                // Симуляция изменения пароля
                await new Promise(resolve => setTimeout(resolve, 1000));
                
                window.app.showSuccess('Пароль успешно изменен');
                passwordModal.remove();
            } catch (error) {
                window.app.showError('Не удалось изменить пароль');
            }
        });

        // Закрытие по клику на оверлей
        passwordModal.addEventListener('click', (e) => {
            if (e.target === passwordModal) {
                passwordModal.remove();
            }
        });
    }

    exportData() {
        const data = {
            profile: window.app.currentUser,
            orders: window.OrdersManager ? window.OrdersManager.orders : [],
            stats: this.userStats,
            exportDate: new Date().toISOString()
        };

        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = `ideal_transport_data_${new Date().toISOString().split('T')[0]}.json`;
        link.click();
        
        URL.revokeObjectURL(url);
        window.app.showSuccess('Данные экспортированы');
    }

    async deleteAccount() {
        const confirmed = confirm(
            'Вы уверены, что хотите удалить аккаунт? Это действие необратимо.'
        );
        
        if (!confirmed) return;

        const doubleConfirm = prompt(
            'Для подтверждения введите "УДАЛИТЬ" (заглавными буквами):'
        );
        
        if (doubleConfirm !== 'УДАЛИТЬ') {
            window.app.showError('Удаление отменено');
            return;
        }

        try {
            // Симуляция удаления аккаунта
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            window.app.showSuccess('Аккаунт будет удален в течение 24 часов');
        } catch (error) {
            window.app.showError('Не удалось удалить аккаунт');
        }
    }
}

// Инициализация после загрузки DOM
document.addEventListener('DOMContentLoaded', () => {
    window.ProfileManager = new ProfileManager();
});