<?php
/**
 * KinoPrime - Yangilangan va xavfsiz ma'lumotlar bazasi ulanishi (.env orqali)
 */

// 1. Xavfsiz sessiya sozlamalari (Cookie orqali JS o'qiy olmasligi uchun HttpOnly yoqilgan)
ini_set('session.cookie_httponly', 1);
ini_set('session.use_only_cookies', 1);
// ini_set('session.cookie_secure', 1); // SSL (https) o'rnatilganda buni yoqish kerak
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS');
// Cookie va ruxsatnomalar ulanishini ta'minlash
header('Access-Control-Allow-Credentials: true'); 
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// 2. .env faylini o'qish funksiyasi
function loadEnv($path) {
    if (!file_exists($path)) return;
    $lines = file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    foreach ($lines as $line) {
        if (strpos(trim($line), '#') === 0) continue;
        list($name, $value) = explode('=', $line, 2);
        $_ENV[trim($name)] = trim($value);
    }
}
loadEnv(__DIR__ . '/.env');

define('ADMIN_PASSWORD', 'admin123'); // Buni ham keyinchalik .env ga o'tkazish mumkin
define('ADMIN_TOKEN_HASH', hash('sha256', $_ENV['ADMIN_SECRET_KEY'] ?? 'default_salt'));

// 3. PostgreSQL yoki MySQL'ga ulanish
$dbType = $_ENV['DB_CONNECTION'] ?? 'sqlite';

try {
    if ($dbType === 'pgsql') {
        $dsn = "pgsql:host=" . $_ENV['DB_HOST'] . ";port=" . $_ENV['DB_PORT'] . ";dbname=" . $_ENV['DB_DATABASE'];
        $pdo = new PDO($dsn, $_ENV['DB_USERNAME'], $_ENV['DB_PASSWORD']);
    } elseif ($dbType === 'mysql') {
        $dsn = "mysql:host=" . $_ENV['DB_HOST'] . ";port=" . $_ENV['DB_PORT'] . ";dbname=" . $_ENV['DB_DATABASE'] . ";charset=utf8mb4";
        $pdo = new PDO($dsn, $_ENV['DB_USERNAME'], $_ENV['DB_PASSWORD']);
    } else {
        // Zaxira varianti
        $pdo = new PDO("sqlite:" . __DIR__ . "/movies.db");
    }
    
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);

    // Xavfsizlik: Uploads papkasi himoyasi
    $uploadsDir = __DIR__ . '/uploads';
    if (!is_dir($uploadsDir)) {
        @mkdir($uploadsDir, 0755, true);
    }
    $htaccessFile = $uploadsDir . '/.htaccess';
    if (!file_exists($htaccessFile)) {
        @file_put_contents($htaccessFile, "Order Deny,Allow\nDeny from all\n<FilesMatch \"\.(mp4|webm|jpg|jpeg|png|webp)$\">\nAllow from all\n</FilesMatch>\nOptions -Indexes\nphp_flag engine off");
    }

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => "Baza bilan ulanishda xatolik! Sozlamalarni tekshiring."]);
    exit();
}
?>