<?php
session_set_cookie_params(['lifetime' => 60*24*60*60, 'path' => '/', 'secure' => !empty($_SERVER['HTTPS']), 'httponly' => true, 'samesite' => 'Lax']);
ini_set('session.gc_maxlifetime', 60*24*60*60);
