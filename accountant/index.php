<?php
require_once __DIR__ . '/../db_connection.php';
require_once __DIR__ . '/../session_init.php';
require_once __DIR__ . '/../auth_helper.php';

session_start();
if (!isset($_SESSION['role']) || $_SESSION['role'] !== 'accountant') {
    header('Location: /index.php');
    exit();
}
requireRole(['accountant']);
?>
<!DOCTYPE html>
<html lang='ru'>
<head>
    <meta charset='utf-8'>
    <meta name='viewport' content='width=device-width, initial-scale=1.0'>
    <title>Кабинет бухгалтера</title>
    <style>
        * { box-sizing: border-box; }
        body {
            margin: 0;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            background-color: #f0f2f5;
            color: #222;
        }
        .header {
            position: sticky;
            top: 0;
            z-index: 100;
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 16px 20px;
            background: #0d47a1;
            color: #fff;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
        .header .title {
            font-size: 22px;
            font-weight: 600;
        }
        .header .exit {
            color: #fff;
            text-decoration: none;
            font-weight: 600;
            font-size: 14px;
        }
        .accountant-menu {
            background: #fff;
            padding: 10px 20px;
            box-shadow: 0 1px 4px rgba(0,0,0,0.1);
            display: flex;
            gap: 20px;
        }
        .accountant-menu a {
            text-decoration: none;
            color: #0d47a1;
            font-weight: 600;
        }
        .container {
            max-width: 900px;
            margin: 20px auto;
            padding: 0 16px;
        }
        .filters {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
            margin-bottom: 20px;
            align-items: flex-end;
        }
        .filters input,
        .filters button {
            padding: 8px;
            font-size: 14px;
        }
        .metrics {
            display: flex;
            flex-wrap: wrap;
            gap: 20px;
        }
        .card {
            background: #fff;
            border-radius: 8px;
            padding: 16px;
            flex: 1;
            min-width: 150px;
            box-shadow: 0 1px 4px rgba(0,0,0,0.1);
        }
        .card .label {
            color: #555;
            font-size: 14px;
            margin-bottom: 4px;
        }
        .card .value {
            font-size: 24px;
            font-weight: 600;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 20px;
            background: #fff;
            box-shadow: 0 1px 4px rgba(0,0,0,0.1);
        }
        th, td {
            padding: 8px;
            border: 1px solid #ddd;
            font-size: 14px;
        }
        th {
            background: #f7f7f7;
            cursor: pointer;
            user-select: none;
        }
        .pagination {
            display: flex;
            justify-content: center;
            align-items: center;
            gap: 10px;
            margin-top: 10px;
        }
        .pagination button {
            padding: 6px 12px;
        }
    </style>
    <script src='../main.js' defer></script>
</head>
<body>
    <header class='header'>
        <div class='title'>Кабинет бухгалтера</div>
        <a class='exit' href='../logout.php'>Выйти</a>
    </header>
    <?php include __DIR__ . '/menu.php'; ?>
    <main class='container'>
        <div class='filters'>
            <input type='date' id='date_from'>
            <input type='date' id='date_to'>
            <input type='text' id='city' placeholder='Город'>
            <input type='text' id='warehouses' placeholder='Склады'>
            <input type='number' id='client_id' placeholder='ID клиента'>
            <button id='applyFilters'>Показать</button>
        </div>
        <div class='metrics'>
            <div class='card'>
                <div class='label'>Отправок</div>
                <div class='value' id='shipments_count'>0</div>
            </div>
            <div class='card'>
                <div class='label'>Сумма оплат</div>
                <div class='value' id='total_payments'>0</div>
            </div>
            <div class='card'>
                <div class='label'>Клиентов</div>
                <div class='value' id='clients_count'>0</div>
            </div>
        </div>
        <table id='ordersTable'>
            <thead>
                <tr>
                    <th data-sort='order_id'>ID</th>
                    <th data-sort='order_date'>Дата заявки</th>
                    <th data-sort='submission_date'>Дата отправки</th>
                    <th data-sort='city'>Город/Склад</th>
                    <th data-sort='client'>Клиент</th>
                    <th data-sort='payment'>Сумма</th>
                    <th data-sort='payment_type'>Тип оплаты</th>
                    <th data-sort='status'>Статус</th>
                    <th data-sort='author'>Автор</th>
                    <th>Действия</th>
                </tr>
            </thead>
            <tbody id='ordersBody'></tbody>
        </table>
        <div class='pagination'>
            <button id='prevPage'>Назад</button>
            <span id='pageInfo'></span>
            <button id='nextPage'>Вперёд</button>
        </div>
    </main>
    <script>
    function getFilters() {
        const params = new URLSearchParams();
        ['date_from','date_to','city','warehouses','client_id'].forEach(id => {
            const v = document.getElementById(id).value;
            if (v) params.append(id, v);
        });
        return params;
    }

    async function fetchSummary() {
        const params = getFilters();
        try {
            const res = await fetch('../api/accountant/get_summary.php?' + params.toString());
            const json = await res.json();
            if (json.success) {
                document.getElementById('shipments_count').textContent = json.data.shipments_count;
                document.getElementById('total_payments').textContent = json.data.total_payments;
                document.getElementById('clients_count').textContent = json.data.clients_count;
            }
        } catch (e) {
            console.error(e);
        }
    }

    let currentPage = 1;
    let sortField = 'order_date';
    let sortDir = 'desc';

    async function fetchOrders() {
        const params = getFilters();
        params.append('page', currentPage);
        params.append('sort_field', sortField);
        params.append('sort_dir', sortDir);
        try {
            const res = await fetch('../api/accountant/get_orders.php?' + params.toString());
            const json = await res.json();
            if (json.success) {
                renderTable(json.data.orders);
                renderPagination(json.data.total);
            }
        } catch (e) {
            console.error(e);
        }
    }

    function renderTable(data) {
        const tbody = document.getElementById('ordersBody');
        tbody.innerHTML = '';
        data.forEach(row => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${row.order_id}</td>
                <td>${row.order_date || ''}</td>
                <td>${row.submission_date || ''}</td>
                <td>${row.city || ''} ${row.warehouses ? '/' + row.warehouses : ''}</td>
                <td>${row.client || ''}</td>
                <td class='cell-payment'>${row.payment}</td>
                <td class='cell-payment-type'>${row.payment_type || ''}</td>
                <td>${row.status || ''}</td>
                <td>${row.author || ''}</td>
                <td><button class='edit-btn'>Редактировать</button></td>`;
            tbody.appendChild(tr);
            const btn = tr.querySelector('.edit-btn');
            btn.addEventListener('click', () => editPayment(row.order_id, row.payment, row.payment_type || '', tr, row));
        });
    }

    function renderPagination(total) {
        const perPage = 20;
        const totalPages = Math.ceil(total / perPage) || 1;
        document.getElementById('pageInfo').textContent = `${currentPage} / ${totalPages}`;
        document.getElementById('prevPage').disabled = currentPage <= 1;
        document.getElementById('nextPage').disabled = currentPage >= totalPages;
    }

    async function editPayment(orderId, currentPayment, currentType, rowEl, rowData) {
        const amountStr = prompt('Введите новую сумму', currentPayment);
        if (amountStr === null) return;
        const amount = parseFloat(amountStr);
        if (isNaN(amount)) {
            alert('Некорректная сумма');
            return;
        }
        const type = prompt('Введите тип оплаты', currentType);
        if (type === null) return;
        try {
            const res = await fetch('../api/accountant/update_payment.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ order_id: orderId, payment: amount, payment_type: type })
            });
            const json = await res.json();
            if (json.success) {
                rowEl.querySelector('.cell-payment').textContent = amount;
                rowEl.querySelector('.cell-payment-type').textContent = type;
                rowData.payment = amount;
                rowData.payment_type = type;
                fetchSummary();
            } else {
                alert(json.message || 'Ошибка');
            }
        } catch (e) {
            console.error(e);
            alert('Ошибка');
        }
    }

    document.getElementById('applyFilters').addEventListener('click', () => {
        currentPage = 1;
        fetchSummary();
        fetchOrders();
    });

    document.getElementById('prevPage').addEventListener('click', () => {
        if (currentPage > 1) {
            currentPage--;
            fetchOrders();
        }
    });
    document.getElementById('nextPage').addEventListener('click', () => {
        currentPage++;
        fetchOrders();
    });

    document.querySelectorAll('#ordersTable th').forEach(th => {
        th.addEventListener('click', () => {
            const field = th.dataset.sort;
            if (field) {
                if (sortField === field) {
                    sortDir = sortDir === 'asc' ? 'desc' : 'asc';
                } else {
                    sortField = field;
                    sortDir = 'asc';
                }
                currentPage = 1;
                fetchOrders();
            }
        });
    });

    window.addEventListener('DOMContentLoaded', () => {
        fetchSummary();
        fetchOrders();
    });
    </script>
</body>
</html>
