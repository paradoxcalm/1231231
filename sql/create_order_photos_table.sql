-- Создание таблицы для хранения фотографий заказов
CREATE TABLE IF NOT EXISTS order_photos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    order_id INT NOT NULL,
    file_path VARCHAR(255) NOT NULL,
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_order_photos_order FOREIGN KEY (order_id)
        REFERENCES orders(order_id) ON DELETE CASCADE
);
