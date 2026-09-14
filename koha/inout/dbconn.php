<?php
mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);

function envv(string $key, string $default = ''): string
{
    $value = getenv($key);
    if ($value !== false && $value !== '') {
        return $value;
    }
    if (!empty($_SERVER[$key]) && is_string($_SERVER[$key])) {
        return $_SERVER[$key];
    }
    return $default;
}

$servername = envv('INOUT_DB_HOST', 'db');
$username = envv('KOHA_DB_USER', 'koha_library');
$password = envv('KOHA_DB_PASSWORD');
$db = envv('INOUT_DB_NAME', 'koha_inout');
$koha_db = envv('KOHA_DB_NAME', 'koha_library');

date_default_timezone_set('Asia/Kolkata');

try {
    $conn = new mysqli($servername, $username, $password, $db);
    $koha = new mysqli($servername, $username, $password, $koha_db);
    $conn->set_charset('utf8mb4');
    $koha->set_charset('utf8mb4');
} catch (mysqli_sql_exception $e) {
    die('Database connection failed: ' . $e->getMessage());
}

function sanitize(mysqli $conn, string|null $str): string
{
    return $str !== null ? $conn->real_escape_string($str) : '';
}
