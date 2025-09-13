-- Добавление столбца payment_status в таблицу fbs
ALTER TABLE fbs
    ADD COLUMN payment_status ENUM('paid','debt') NOT NULL DEFAULT 'paid' AFTER comment;
