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
    </style>
    <script src='../main.js' defer></script>
</head>
<body>
    <header class='header'>
        <div class='title'>Кабинет бухгалтера</div>
        <a class='exit' href='../logout.php'>Выйти</a>
    </header>
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
    </main>
    <script>
    async function fetchSummary() {
        const params = new URLSearchParams();
        ['date_from','date_to','city','warehouses','client_id'].forEach(id => {
            const v = document.getElementById(id).value;
            if (v) params.append(id, v);
        });
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
    document.getElementById('applyFilters').addEventListener('click', fetchSummary);
    window.addEventListener('DOMContentLoaded', fetchSummary);
    </script>
</body>
</html>
