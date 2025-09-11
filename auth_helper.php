<?php
require_once 'session_init.php';
// Centralized authentication and authorization helpers
// This file defines two utility functions: requireLogin() and requireRole().
// Include this file in any script that needs to verify the user's session
// and role before performing actions.

/**
 * Ensure that a user is logged in. If not, respond with a 401 (Unauthorized)
 * and a JSON message, then terminate execution.
 */
function requireLogin(): void {
    // Start the session if it hasn't been already
    if (session_status() !== PHP_SESSION_ACTIVE) {
        session_start();
    }
    // Check if user ID and role are set in the session
    if (empty($_SESSION['user_id']) || empty($_SESSION['role'])) {
        http_response_code(401);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode([
            'success' => false,
            'message' => 'Не авторизован',
        ]);
        exit;
    }
}

/**
 * Ensure that the logged-in user has one of the allowed roles. If not, respond
 * with a 403 (Forbidden) and a JSON message, then terminate execution.
 *
 * @param array $allowedRoles List of role strings that are permitted.
 */
function requireRole(array $allowedRoles): void {
    // Start the session if it hasn't been already
    if (session_status() !== PHP_SESSION_ACTIVE) {
        session_start();
    }
    // First verify that the user is logged in
    if (empty($_SESSION['user_id']) || empty($_SESSION['role'])) {
        http_response_code(401);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode([
            'success' => false,
            'message' => 'Не авторизован',
        ]);
        exit;
    }
    // Check if the user's role is in the allowed list
    $currentRole = $_SESSION['role'];
    if (!in_array($currentRole, $allowedRoles, true)) {
        http_response_code(403);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode([
            'success' => false,
            'message' => 'Доступ запрещён',
        ]);
        exit;
    }
}
?>