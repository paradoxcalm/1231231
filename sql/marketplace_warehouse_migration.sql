-- Заполнение таблицы marketplaces на основе schedules
INSERT INTO marketplaces (name)
SELECT DISTINCT marketplace FROM schedules s
WHERE s.marketplace <> ''
ON DUPLICATE KEY UPDATE name = VALUES(name);

-- Добавление столбца marketplace_id в warehouses, если его нет
-- ALTER TABLE warehouses ADD COLUMN marketplace_id INT NOT NULL;

-- Привязка складов к маркетплейсам по данным из schedules.warehouses (CSV-строки)
-- Важно: для разбора CSV используйте внешний скрипт или функцию в СУБД
-- и заполните таблицу warehouses вида:
-- id | name              | marketplace_id
--    | "Ozon Склад №1"   | <id Ozon>
--    | "WB Склад Москва" | <id Wildberries>
