<?php
session_start();

$allowedRoles = ['client'];
if (!isset($_SESSION['role']) || !in_array($_SESSION['role'], $allowedRoles, true)) {
    header('Location: /index.php');
    exit();
}

require __DIR__ . '/frontend/index.php';
