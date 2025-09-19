<?php

if (!function_exists('ff_is_https_request')) {
    function ff_is_https_request(): bool
    {
        if (!empty($_SERVER['HTTPS']) && strtolower($_SERVER['HTTPS']) !== 'off') {
            return true;
        }

        if (!empty($_SERVER['HTTP_X_FORWARDED_PROTO'])) {
            $forwardedProto = strtolower($_SERVER['HTTP_X_FORWARDED_PROTO']);
            if (strpos($forwardedProto, ',') !== false) {
                $forwardedProto = trim(explode(',', $forwardedProto)[0]);
            }

            if ($forwardedProto === 'https') {
                return true;
            }
        }

        if (!empty($_SERVER['HTTP_X_FORWARDED_SSL']) && strtolower($_SERVER['HTTP_X_FORWARDED_SSL']) === 'on') {
            return true;
        }

        if (!empty($_SERVER['HTTP_FRONT_END_HTTPS']) && strtolower($_SERVER['HTTP_FRONT_END_HTTPS']) !== 'off') {
            return true;
        }

        if (!empty($_SERVER['REQUEST_SCHEME']) && strtolower($_SERVER['REQUEST_SCHEME']) === 'https') {
            return true;
        }

        if (!empty($_SERVER['SERVER_PORT']) && (int)$_SERVER['SERVER_PORT'] === 443) {
            return true;
        }

        return false;
    }
}

if (!function_exists('ff_get_cookie_security_options')) {
    function ff_get_cookie_security_options(): array
    {
        $secure = ff_is_https_request();

        return [
            'secure' => $secure,
            'httponly' => true,
            'samesite' => $secure ? 'None' : 'Lax',
        ];
    }
}

$sessionLifetime = 60 * 24 * 60 * 60;
$cookieSecurity = ff_get_cookie_security_options();

session_set_cookie_params(array_merge([
    'lifetime' => $sessionLifetime,
    'path' => '/',
], $cookieSecurity));

ini_set('session.gc_maxlifetime', $sessionLifetime);
