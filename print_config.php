<?php
// Конфигурация удалённого сервера печати
// Укажите базовый URL сервера и секретный токен авторизации.
// URL не должен заканчиваться символом "/".

define('PRINT_SERVICE_URL', 'http://printer-host:5000');
define('PRINT_SERVICE_TOKEN', 'change-me');

define('PRINT_SERVICE_TIMEOUT', 15); // секунд ожидания ответа сервера печати
