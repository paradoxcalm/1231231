// Основной файл приложения
class App {
    constructor() {
        this.currentSection = 'schedule';
        this.currentUser = null;

        this.init();
    }

    init() {
        this.setupNavigation();
        this.setupModals();
        this.setupNotifications();
        this.loadInitialData();
    }

    setupNavigation() {
        // Десктопная навигация
        const desktopNavLinks = document.querySelectorAll('.nav-link');
        desktopNavLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const section = link.dataset.section;
                this.switchSection(section);
                
                // Обновляем активные состояния
                desktopNavLinks.forEach(l => l.classList.remove('active'));
                link.classList.add('active');
            });
        });

        // Мобильная навигация
        const mobileNavItems = document.querySelectorAll('.mobile-nav-item');
        mobileNavItems.forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();

                if (item.dataset.action === 'logout') {
                    this.openModal(document.getElementById('logoutConfirmModal'));
                    return;
                }

                const section = item.dataset.section;
                if (!section) {
                    return;
                }

                this.switchSection(section);

                // Обновляем активные состояния
                mobileNavItems.forEach(i => i.classList.remove('active'));
                item.classList.add('active');
            });
        });

        // Профильное меню
        const profileBtn = document.querySelector('.profile-btn');
        const profileDropdown = document.querySelector('.profile-dropdown');

        if (profileBtn && profileDropdown) {
            profileBtn.addEventListener('click', () => {
                profileDropdown.classList.toggle('active');
            });

            const dropdownItems = profileDropdown.querySelectorAll('.dropdown-item');
            dropdownItems.forEach(item => {
                item.addEventListener('click', (event) => {
                    profileDropdown.classList.remove('active');

                    if (item.dataset.action === 'logout') {
                        event.preventDefault();
                        this.logout();
                    }
                });
            });

            // Закрытие при клике вне меню
            document.addEventListener('click', (e) => {
                if (!profileBtn.contains(e.target) && !profileDropdown.contains(e.target)) {
                    profileDropdown.classList.remove('active');
                }
            });
        }
    }

    logout() {
        window.location.href = '../logout.php';
    }

    switchSection(sectionName) {
        // Скрываем все секции
        const sections = document.querySelectorAll('.content-section');
        sections.forEach(section => section.classList.remove('active'));

        // Показываем выбранную секцию
        const targetSection = document.getElementById(`${sectionName}Section`);
        if (targetSection) {
            targetSection.classList.add('active');
            this.currentSection = sectionName;
        }

        // Загружаем данные для секции при необходимости
        this.loadSectionData(sectionName);
    }

    loadSectionData(sectionName) {
        switch (sectionName) {
            case 'schedule':
                if (window.scheduleController) {
                    window.scheduleController.loadSchedules();
                }
                break;
            case 'tariffs':
                if (window.TariffsManager) {
                    window.TariffsManager.loadTariffs();
                }
                break;
            case 'orders':
                if (window.OrdersManager) {
                    window.OrdersManager.loadOrders();
                }
                break;
            case 'profile':
                if (window.ProfileManager) {
                    window.ProfileManager.loadProfile();
                }
                break;
        }
    }

    setupModals() {
        // Модальные окна
        const modals = document.querySelectorAll('.modal');
        modals.forEach(modal => {
            const closeBtn = modal.querySelector('.modal-close');
            if (closeBtn) {
                closeBtn.addEventListener('click', () => {
                    this.closeModal(modal);
                });
            }

            // Закрытие по клику на оверлей
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.closeModal(modal);
                }
            });
        });

        const confirmLogoutBtn = document.getElementById('confirmLogoutBtn');
        const cancelLogoutBtn = document.getElementById('cancelLogoutBtn');
        const logoutModal = document.getElementById('logoutConfirmModal');

        if (confirmLogoutBtn) {
            confirmLogoutBtn.addEventListener('click', () => {
                this.logout();
            });
        }

        if (cancelLogoutBtn) {
            cancelLogoutBtn.addEventListener('click', () => {
                this.closeModal(logoutModal);
            });
        }

    }

    setupNotifications() {
        const notificationBtn = document.getElementById('notificationBtn');
        const notificationsPanel = document.getElementById('notificationsPanel');
        const closeNotifications = document.getElementById('closeNotifications');

        if (notificationBtn && notificationsPanel) {
            notificationBtn.addEventListener('click', () => {
                const isActive = notificationsPanel.classList.toggle('active');
                if (isActive) {
                    this.loadNotifications();
                }
            });
        }

        if (closeNotifications) {
            closeNotifications.addEventListener('click', () => {
                notificationsPanel.classList.remove('active');
            });
        }

        // Закрытие при клике вне панели
        document.addEventListener('click', (e) => {
            if (notificationsPanel &&
                !notificationsPanel.contains(e.target) &&
                !notificationBtn.contains(e.target)) {
                notificationsPanel.classList.remove('active');
            }
        });

        this.fetchNotifications(false)
            .then((notifications) => {
                this.updateNotificationBadge(notifications);
            })
            .catch((error) => {
                console.error('Ошибка загрузки уведомлений', error);
            });

        // Кнопка сброса фильтров расписания
        const resetBtn = document.getElementById('resetScheduleFilters');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                if (window.scheduleController) {
                    window.scheduleController.resetFilters();
                }
            });
        }
    }

    openModal(modal) {
        if (modal) {
            modal.classList.add('active');
            document.body.style.overflow = 'hidden';
        }
    }

    closeModal(modal) {
        if (modal) {
            modal.classList.remove('active');
            document.body.style.overflow = '';
        }
    }

    async fetchNotifications(markAsRead = false) {
        const response = await fetch(`../fetch_notifications.php?mark_as_read=${markAsRead ? '1' : '0'}`, {
            credentials: 'include'
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        return Array.isArray(data) ? data : [];
    }

    updateNotificationBadge(notifications) {
        const badge = document.getElementById('notificationBadge');
        if (!badge) {
            return;
        }

        const unreadCount = notifications.filter(n => !n.read).length;
        badge.textContent = unreadCount > 0 ? unreadCount : '';
        badge.style.display = unreadCount > 0 ? 'block' : 'none';
    }

    async loadNotifications() {
        const content = document.getElementById('notificationsContent');
        if (!content) return;

        content.innerHTML = '<div class="notifications-empty">Загрузка...</div>';

        try {
            const notifications = await this.fetchNotifications(true);

            content.innerHTML = '';

            if (notifications.length === 0) {
                content.innerHTML = '<div class="notifications-empty">Уведомлений нет</div>';
            } else {
                notifications.forEach((notification) => {
                    const item = document.createElement('div');
                    item.className = 'notification-item';
                    if (!notification.read) {
                        item.classList.add('unread');
                    }

                    const text = document.createElement('div');
                    text.className = 'notification-text';
                    text.textContent = notification.message || '';

                    const time = document.createElement('div');
                    time.className = 'notification-time';
                    const createdAt = notification.created_at ? new Date(notification.created_at) : null;
                    time.textContent = createdAt && !isNaN(createdAt) ? createdAt.toLocaleString('ru-RU') : '';

                    item.appendChild(text);
                    item.appendChild(time);
                    content.appendChild(item);
                });
            }

            this.updateNotificationBadge(notifications);
        } catch (error) {
            console.error('Ошибка загрузки уведомлений', error);
            if (typeof this.showError === 'function') {
                this.showError('Не удалось загрузить уведомления. Попробуйте позже.');
            }
            content.innerHTML = '<div class="notifications-error">Ошибка загрузки уведомлений</div>';
        }
    }

    loadInitialData() {
        // Загружаем данные для текущей секции
        this.loadSectionData(this.currentSection);
    }

    showSuccess(message) {
        this.showToast(message, 'success');
    }

    showError(message) {
        this.showToast(message, 'error');
    }

    showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.innerHTML = `
            <div class="toast-content">
                <i class="fas ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle'}"></i>
                <span>${message}</span>
            </div>
        `;

        // Добавляем стили для toast
        if (!document.getElementById('toastStyles')) {
            const styles = document.createElement('style');
            styles.id = 'toastStyles';
            styles.textContent = `
                .toast {
                    position: fixed;
                    top: 90px;
                    right: 20px;
                    background: white;
                    border-radius: 8px;
                    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15);
                    z-index: 3000;
                    transform: translateX(400px);
                    transition: transform 0.3s ease;
                    max-width: 400px;
                    border-left: 4px solid;
                }
                .toast-success { border-left-color: var(--success); }
                .toast-error { border-left-color: var(--error); }
                .toast-info { border-left-color: var(--secondary); }
                .toast.show { transform: translateX(0); }
                .toast-content {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    padding: 16px 20px;
                }
                .toast-content i {
                    font-size: 1.2rem;
                }
                .toast-success i { color: var(--success); }
                .toast-error i { color: var(--error); }
                .toast-info i { color: var(--secondary); }
            `;
            document.head.appendChild(styles);
        }

        document.body.appendChild(toast);

        // Показываем toast
        setTimeout(() => toast.classList.add('show'), 100);

        // Автоматически скрываем
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 4000);
    }
}

// Инициализация приложения
document.addEventListener('DOMContentLoaded', () => {
    window.app = new App();
});

// Глобальные утилиты
window.utils = {
    formatDate: (date) => {
        return new Date(date).toLocaleDateString('ru-RU', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    },

    formatDateTime: (date) => {
        return new Date(date).toLocaleDateString('ru-RU', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    },

    formatCurrency: (amount) => {
        return new Intl.NumberFormat('ru-RU', {
            style: 'currency',
            currency: 'RUB',
            minimumFractionDigits: 0
        }).format(amount);
    },

    debounce: (func, wait) => {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },

    generateId: () => {
        return Date.now() + Math.random().toString(36).substr(2, 9);
    }
};