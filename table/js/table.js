// Современный интерфейс таблицы отправлений
class TableApp {
    constructor() {
        this.currentPage = 1;
        this.pageSize = 25;
        this.totalRecords = 0;
        this.totalPages = 0;
        this.sortField = null;
        this.sortDirection = 'asc';
        this.filters = {
            city: '',
            paymentType: '',
            search: ''
        };
        this.data = [];
        this.filteredData = [];
        
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.loadData();
    }

    setupEventListeners() {
        // Фильтры
        document.getElementById('cityFilter').addEventListener('change', () => {
            this.filters.city = document.getElementById('cityFilter').value;
            this.applyFilters();
        });

        document.getElementById('paymentTypeFilter').addEventListener('change', () => {
            this.filters.paymentType = document.getElementById('paymentTypeFilter').value;
            this.applyFilters();
        });

        document.getElementById('searchInput').addEventListener('input', this.debounce(() => {
            this.filters.search = document.getElementById('searchInput').value.toLowerCase();
            this.applyFilters();
        }, 300));

        document.getElementById('perPageSelect').addEventListener('change', () => {
            this.pageSize = parseInt(document.getElementById('perPageSelect').value);
            this.currentPage = 1;
            this.renderTable();
            this.renderPagination();
        });

        // Сортировка
        document.querySelectorAll('.sortable').forEach(th => {
            th.addEventListener('click', () => {
                const field = th.dataset.sort;
                this.handleSort(field, th);
            });
        });

        // Модальное окно
        document.getElementById('photoModal').addEventListener('click', (e) => {
            if (e.target === document.getElementById('photoModal')) {
                this.closePhotoModal();
            }
        });
    }

    async loadData() {
        this.showLoading(true);
        
        try {
            const response = await fetch('../fetch_data.php');
            const data = await response.json();
            
            if (Array.isArray(data)) {
                this.data = data;
                this.filteredData = [...data];
                this.updateStats();
                this.renderTable();
                this.renderPagination();
            } else {
                this.showError('Ошибка загрузки данных');
            }
        } catch (error) {
            console.error('Ошибка загрузки:', error);
            this.showError('Ошибка подключения к серверу');
        } finally {
            this.showLoading(false);
        }
    }

    applyFilters() {
        this.filteredData = this.data.filter(item => {
            const cityMatch = !this.filters.city || item.city === this.filters.city;
            const paymentMatch = !this.filters.paymentType || item.payment_type === this.filters.paymentType;
            const searchMatch = !this.filters.search || this.matchesSearch(item, this.filters.search);
            
            return cityMatch && paymentMatch && searchMatch;
        });

        this.currentPage = 1;
        this.updateStats();
        this.renderTable();
        this.renderPagination();
    }

    matchesSearch(item, query) {
        const searchFields = [
            item.sender,
            item.direction,
            item.comment,
            item.shipment_type,
            item.payment?.toString(),
            item.boxes?.toString()
        ];

        return searchFields.some(field => 
            field && field.toString().toLowerCase().includes(query)
        );
    }

    handleSort(field, thElement) {
        // Сброс всех иконок сортировки
        document.querySelectorAll('.sortable').forEach(th => {
            th.classList.remove('sort-asc', 'sort-desc');
        });

        if (this.sortField === field) {
            this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
        } else {
            this.sortField = field;
            this.sortDirection = 'asc';
        }

        thElement.classList.add(`sort-${this.sortDirection}`);
        
        this.sortData();
        this.renderTable();
    }

    sortData() {
        if (!this.sortField) return;

        this.filteredData.sort((a, b) => {
            let aVal = a[this.sortField];
            let bVal = b[this.sortField];

            // Обработка null/undefined
            if (aVal == null) aVal = '';
            if (bVal == null) bVal = '';

            // Числовые поля
            if (['boxes', 'payment'].includes(this.sortField)) {
                aVal = parseFloat(aVal) || 0;
                bVal = parseFloat(bVal) || 0;
                return this.sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
            }

            // Даты
            if (['submission_date', 'date_of_delivery'].includes(this.sortField)) {
                aVal = new Date(aVal);
                bVal = new Date(bVal);
                return this.sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
            }

            // Строки
            aVal = aVal.toString().toLowerCase();
            bVal = bVal.toString().toLowerCase();
            
            if (this.sortDirection === 'asc') {
                return aVal.localeCompare(bVal, 'ru');
            } else {
                return bVal.localeCompare(aVal, 'ru');
            }
        });
    }

    renderTable() {
        const tbody = document.getElementById('tableBody');
        const tableEmpty = document.getElementById('tableEmpty');
        
        if (this.filteredData.length === 0) {
            tbody.innerHTML = '';
            tableEmpty.style.display = 'block';
            return;
        }

        tableEmpty.style.display = 'none';
        
        const start = (this.currentPage - 1) * this.pageSize;
        const end = start + this.pageSize;
        const pageData = this.filteredData.slice(start, end);

        tbody.innerHTML = pageData.map(item => `
            <tr>
                <td>${this.escapeHtml(item.sender || '—')}</td>
                <td>${this.escapeHtml(item.direction || '—')}</td>
                <td>${this.formatDate(item.submission_date)}</td>
                <td>${this.formatDate(item.date_of_delivery)}</td>
                <td>${this.escapeHtml(item.shipment_type || '—')}</td>
                <td>${item.boxes || 0}</td>
                <td>
                    <div class="payment-info">
                        <span class="amount">${this.formatCurrency(item.payment || 0)}</span>
                        ${item.payment_type ? `<span class="payment-type">${this.escapeHtml(item.payment_type)}</span>` : ''}
                    </div>
                </td>
                <td class="photo-cell">
                    ${this.renderPhotoCell(item)}
                </td>
                <td>
                    <div class="comment-cell" title="${this.escapeHtml(item.comment || '')}">
                        ${this.truncateText(item.comment || '—', 50)}
                    </div>
                </td>
            </tr>
        `).join('');

        // Обновляем информацию о таблице
        const tableInfo = document.getElementById('tableInfo');
        const showing = Math.min(end, this.filteredData.length);
        tableInfo.textContent = `Показано ${start + 1}-${showing} из ${this.filteredData.length} записей`;
    }

    renderPhotoCell(item) {
        if (item.photo_thumb) {
            return `<img src="${item.photo_thumb}" alt="Фото" class="photo-thumbnail" onclick="tableApp.openPhotoModal('${item.photo_thumb}', ${item.id})">`;
        } else {
            return '<div class="no-photo">Нет фото</div>';
        }
    }

    renderPagination() {
        this.totalPages = Math.ceil(this.filteredData.length / this.pageSize);
        
        // Обновляем информацию
        const start = (this.currentPage - 1) * this.pageSize + 1;
        const end = Math.min(this.currentPage * this.pageSize, this.filteredData.length);
        document.getElementById('paginationInfo').textContent = 
            `Показано ${start}-${end} из ${this.filteredData.length}`;

        // Кнопки навигации
        document.getElementById('firstPageBtn').disabled = this.currentPage <= 1;
        document.getElementById('prevPageBtn').disabled = this.currentPage <= 1;
        document.getElementById('nextPageBtn').disabled = this.currentPage >= this.totalPages;
        document.getElementById('lastPageBtn').disabled = this.currentPage >= this.totalPages;

        // Номера страниц
        this.renderPageNumbers();
    }

    renderPageNumbers() {
        const container = document.getElementById('pageNumbers');
        const maxVisible = 5;
        const start = Math.max(1, this.currentPage - Math.floor(maxVisible / 2));
        const end = Math.min(this.totalPages, start + maxVisible - 1);

        let html = '';
        
        for (let i = start; i <= end; i++) {
            html += `
                <button class="page-btn ${i === this.currentPage ? 'active' : ''}" 
                        onclick="tableApp.goToPage(${i})">
                    ${i}
                </button>
            `;
        }

        container.innerHTML = html;
    }

    updateStats() {
        const totalRecords = this.filteredData.length;
        const totalAmount = this.filteredData.reduce((sum, item) => sum + (parseFloat(item.payment) || 0), 0);
        const totalBoxes = this.filteredData.reduce((sum, item) => sum + (parseInt(item.boxes) || 0), 0);
        const avgAmount = totalRecords > 0 ? totalAmount / totalRecords : 0;

        document.getElementById('totalRecords').textContent = totalRecords.toLocaleString('ru-RU');
        document.getElementById('totalAmount').textContent = this.formatCurrency(totalAmount);
        document.getElementById('totalBoxes').textContent = totalBoxes.toLocaleString('ru-RU');
        document.getElementById('avgAmount').textContent = this.formatCurrency(avgAmount);
    }

    goToPage(page) {
        if (page >= 1 && page <= this.totalPages) {
            this.currentPage = page;
            this.renderTable();
            this.renderPagination();
        }
    }

    previousPage() {
        if (this.currentPage > 1) {
            this.goToPage(this.currentPage - 1);
        }
    }

    nextPage() {
        if (this.currentPage < this.totalPages) {
            this.goToPage(this.currentPage + 1);
        }
    }

    goToLastPage() {
        this.goToPage(this.totalPages);
    }

    openPhotoModal(photoUrl, itemId) {
        const modal = document.getElementById('photoModal');
        const img = document.getElementById('modalPhoto');
        
        // Загружаем все фото для этого элемента
        fetch(`../fetch_photos.php?id=${itemId}`)
            .then(r => r.json())
            .then(data => {
                if (data.photos && data.photos.length > 0) {
                    img.src = data.photos[0];
                } else {
                    img.src = photoUrl;
                }
                modal.classList.add('show');
            })
            .catch(() => {
                img.src = photoUrl;
                modal.classList.add('show');
            });
    }

    closePhotoModal() {
        document.getElementById('photoModal').classList.remove('show');
    }

    showLoading(show) {
        const loading = document.getElementById('tableLoading');
        const table = document.querySelector('.table-wrapper');
        
        if (show) {
            loading.style.display = 'flex';
            table.style.opacity = '0.5';
        } else {
            loading.style.display = 'none';
            table.style.opacity = '1';
        }
    }

    showError(message) {
        const tbody = document.getElementById('tableBody');
        tbody.innerHTML = `
            <tr>
                <td colspan="9" class="error-message">
                    <i class="fas fa-exclamation-triangle"></i>
                    ${message}
                </td>
            </tr>
        `;
    }

    // Утилиты
    formatDate(dateString) {
        if (!dateString) return '—';
        return new Date(dateString).toLocaleDateString('ru-RU', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    }

    formatCurrency(amount) {
        return new Intl.NumberFormat('ru-RU', {
            style: 'currency',
            currency: 'RUB',
            minimumFractionDigits: 0
        }).format(amount || 0);
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    truncateText(text, maxLength) {
        if (!text || text.length <= maxLength) return text;
        return text.substring(0, maxLength) + '...';
    }

    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }
}

// Глобальные функции для вызова из HTML
function goBackToAdmin() {
    window.location.href = '../index.php';
}

function refreshData() {
    tableApp.loadData();
    showToast('Данные обновлены', 'success');
}

function exportData() {
    window.open('../export_to_excel.php', '_blank');
    showToast('Экспорт начат', 'info');
}

function applyFilters() {
    tableApp.applyFilters();
}

function resetFilters() {
    document.getElementById('cityFilter').value = '';
    document.getElementById('paymentTypeFilter').value = '';
    document.getElementById('searchInput').value = '';
    
    tableApp.filters = {
        city: '',
        paymentType: '',
        search: ''
    };
    
    tableApp.applyFilters();
    showToast('Фильтры сброшены', 'info');
}

function goToPage(page) {
    tableApp.goToPage(page);
}

function previousPage() {
    tableApp.previousPage();
}

function nextPage() {
    tableApp.nextPage();
}

function goToLastPage() {
    tableApp.goToLastPage();
}

function closePhotoModal() {
    tableApp.closePhotoModal();
}

// Уведомления
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
        <div class="toast-content">
            <i class="fas ${getToastIcon(type)}"></i>
            <span>${message}</span>
        </div>
    `;

    // Добавляем стили для toast если их нет
    if (!document.getElementById('toastStyles')) {
        const styles = document.createElement('style');
        styles.id = 'toastStyles';
        styles.textContent = `
            .toast {
                position: fixed;
                top: 20px;
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
            .toast-info { border-left-color: var(--info); }
            .toast-warning { border-left-color: var(--warning); }
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
            .toast-info i { color: var(--info); }
            .toast-warning i { color: var(--warning); }
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

function getToastIcon(type) {
    const icons = {
        success: 'fa-check-circle',
        error: 'fa-exclamation-circle',
        warning: 'fa-exclamation-triangle',
        info: 'fa-info-circle'
    };
    return icons[type] || icons.info;
}

// Инициализация приложения
document.addEventListener('DOMContentLoaded', () => {
    window.tableApp = new TableApp();
});

// Обработка клавиш
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closePhotoModal();
    }
    
    // Навигация по страницам
    if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
            case 'ArrowLeft':
                e.preventDefault();
                previousPage();
                break;
            case 'ArrowRight':
                e.preventDefault();
                nextPage();
                break;
        }
    }
});

// Обработка изменения размера окна
window.addEventListener('resize', () => {
    // Можно добавить логику для адаптации интерфейса
});

// Экспорт для совместимости
window.fetchDataAndDisplayTable = () => {
    if (window.tableApp) {
        window.tableApp.loadData();
    }
};