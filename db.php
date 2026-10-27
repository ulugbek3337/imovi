<?php
/**
 * KinoPrime - Ma'lumotlar bazasi ulanishi (SQLite / MySQL)
 * Standart holatda nol konfiguratsiya talab qiluvchi SQLite ishlatiladi
 * (XAMPP / OpenServer yoki oddiy PHP o'rnatilgan har qanday joyda darhol ishlaydi).
 */

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Admin-Token');

$requestMethod = $_SERVER['REQUEST_METHOD'] ?? 'GET';
if ($requestMethod === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Xavfsizlik konstantalari
define('ADMIN_PASSWORD', 'admin123');
define('ADMIN_TOKEN_HASH', hash('sha256', 'admin123_kinoprime_secret_salt'));

function getAdminTokenFromRequest() {
    if (!empty($_SERVER['HTTP_X_ADMIN_TOKEN'])) {
        return $_SERVER['HTTP_X_ADMIN_TOKEN'];
    }
    if (function_exists('getallheaders')) {
        $headers = getallheaders();
        if (!empty($headers['X-Admin-Token'])) return $headers['X-Admin-Token'];
        if (!empty($headers['x-admin-token'])) return $headers['x-admin-token'];
    }
    return $_POST['admin_token'] ?? $_GET['admin_token'] ?? '';
}

function checkAdminAuth() {
    if (!empty($_SESSION['is_admin']) && $_SESSION['is_admin'] === true) {
        return true;
    }
    $token = getAdminTokenFromRequest();
    if ($token === ADMIN_TOKEN_HASH) {
        return true;
    }
    return false;
}

// Foydalanuvchi sessiyasi yordamchilari
function getCurrentUserId() {
    if (!empty($_SESSION['user_id'])) {
        return intval($_SESSION['user_id']);
    }
    $token = $_SERVER['HTTP_X_USER_TOKEN'] ?? $_POST['user_token'] ?? $_GET['user_token'] ?? '';
    if ($token && strpos($token, 'usr_') === 0) {
        $parts = explode('_', $token);
        if (isset($parts[1])) return intval($parts[1]);
    }
    return 0;
}

function getCurrentUser($pdo) {
    $uid = getCurrentUserId();
    if ($uid <= 0) return null;
    $stmt = $pdo->prepare("SELECT id, name, email, avatar_url, role, created_at FROM users WHERE id = :id");
    $stmt->execute([':id' => $uid]);
    return $stmt->fetch() ?: null;
}

$dbPath = __DIR__ . '/movies.db';

try {
    $pdo = new PDO("sqlite:" . $dbPath);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);

    // Kinolar jadvalini yaratish (agar mavjud bo'lmasa)
    $pdo->exec("CREATE TABLE IF NOT EXISTS movies (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        genre TEXT NOT NULL,
        country TEXT NOT NULL,
        year INTEGER NOT NULL,
        language TEXT NOT NULL,
        rating REAL NOT NULL,
        quality TEXT NOT NULL,
        duration TEXT NOT NULL,
        description TEXT,
        type TEXT NOT NULL,
        video_url TEXT,
        poster_url TEXT,
        views INTEGER DEFAULT 0,
        created_at INTEGER NOT NULL
    )");

    // `views` ustuni mavjudligini tekshirish va qo'shish (migratsiya)
    $columns = $pdo->query("PRAGMA table_info(movies)")->fetchAll(PDO::FETCH_COLUMN, 1);
    if (!in_array('views', $columns)) {
        $pdo->exec("ALTER TABLE movies ADD COLUMN views INTEGER DEFAULT 0");
    }

    // Foydalanuvchilar jadvali
    $pdo->exec("CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        avatar_url TEXT DEFAULT '',
        role TEXT DEFAULT 'user',
        created_at INTEGER NOT NULL
    )");

    // Kinolarga izohlar va baholar jadvali
    $pdo->exec("CREATE TABLE IF NOT EXISTS comments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        movie_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        user_name TEXT NOT NULL,
        user_avatar TEXT DEFAULT '',
        rating INTEGER DEFAULT 10,
        comment_text TEXT NOT NULL,
        created_at INTEGER NOT NULL
    )");

    // Ko'rishlar tarixi (Watch History)
    $pdo->exec("CREATE TABLE IF NOT EXISTS watch_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        movie_id INTEGER NOT NULL,
        watched_at INTEGER NOT NULL,
        UNIQUE(user_id, movie_id)
    )");

    // Foydalanuvchi sevimlilari (User Watchlist)
    $pdo->exec("CREATE TABLE IF NOT EXISTS user_favorites (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        movie_id INTEGER NOT NULL,
        created_at INTEGER NOT NULL,
        UNIQUE(user_id, movie_id)
    )");

    // Unumdorlik uchun indekslar yaratish
    $pdo->exec("CREATE INDEX IF NOT EXISTS idx_movies_genre ON movies(genre)");
    $pdo->exec("CREATE INDEX IF NOT EXISTS idx_movies_country ON movies(country)");
    $pdo->exec("CREATE INDEX IF NOT EXISTS idx_movies_year ON movies(year)");
    $pdo->exec("CREATE INDEX IF NOT EXISTS idx_movies_rating ON movies(rating)");
    $pdo->exec("CREATE INDEX IF NOT EXISTS idx_movies_created ON movies(created_at)");
    $pdo->exec("CREATE INDEX IF NOT EXISTS idx_comments_movie ON comments(movie_id)");
    $pdo->exec("CREATE INDEX IF NOT EXISTS idx_history_user ON watch_history(user_id)");
    $pdo->exec("CREATE INDEX IF NOT EXISTS idx_fav_user ON user_favorites(user_id)");

    // Uploads papkasini xavfsiz holatda yaratish va PHP skriptlar ijrosini taqiqlash (.htaccess)
    $uploadsDir = __DIR__ . '/uploads';
    if (!is_dir($uploadsDir)) {
        @mkdir($uploadsDir, 0755, true);
    }
    $htaccessFile = $uploadsDir . '/.htaccess';
    if (!file_exists($htaccessFile)) {
        @file_put_contents($htaccessFile, "# PHP ijrosini taqiqlash (Xavfsizlik)\n<FilesMatch \"\\.(php|phtml|php3|php4|php5|php7|phps|cgi|pl|exe|sh)$\">\nOrder Deny,Allow\nDeny from all\n</FilesMatch>\n");
    }

    // Agar jadval bo'sh bo'lsa, boshlang'ich namunaviy kinolarni kiritish
    $count = $pdo->query("SELECT COUNT(*) FROM movies")->fetchColumn();
    if ($count == 0) {
        $initialMovies = [
            [
                'title' => 'Qasoskorlar: Intiho (Avengers Endgame)',
                'genre' => 'Jangari',
                'country' => 'AQSH',
                'year' => 2024,
                'language' => "O'zbekcha",
                'rating' => 8.9,
                'quality' => '4K Ultra HD',
                'duration' => '181 daqiqa',
                'description' => "Tanos butun koinotning yarmini yo'q qilganidan so'ng, omon qolgan Qasoskorlar bor kuchlarini birlashtirib, vaqt bo'ylab sayohat qilishadi va koinotni qutqarishga urinishadi.",
                'type' => 'url',
                'video_url' => 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
                'poster_url' => 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=800&auto=format&fit=crop&q=80',
                'views' => 1420,
                'created_at' => time() - 1000
            ],
            [
                'title' => 'Yulduzlararo (Interstellar)',
                'genre' => 'Fantastika',
                'country' => 'AQSH',
                'year' => 2023,
                'language' => "O'zbekcha",
                'rating' => 8.7,
                'quality' => '4K Ultra HD',
                'duration' => '169 daqiqa',
                'description' => "Yer yuzida hayot xavf ostida qolganda, bir guruh fazogirlar insoniyat uchun yangi sayyora izlash maqsadida qora tuynuk orqali boshqa galaktikaga yo'l oladilar.",
                'type' => 'url',
                'video_url' => 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4',
                'poster_url' => 'https://images.unsplash.com/photo-1506703719100-a0f3a48c0f86?w=800&auto=format&fit=crop&q=80',
                'views' => 980,
                'created_at' => time() - 2000
            ],
            [
                'title' => 'Parazitlar (Parasite)',
                'genre' => 'Drama',
                'country' => 'Janubiy Koreya',
                'year' => 2021,
                'language' => "O'zbekcha",
                'rating' => 8.5,
                'quality' => 'Full HD 1080p',
                'duration' => '132 daqiqa',
                'description' => "Kambag'al oila a'zolari birin-ketin boy oilaning xonadoniga turli kasb egalari sifatida ishga joylashishadi. Biroq kutilmagan sir ularning rejalarini ostin-ustun qiladi.",
                'type' => 'url',
                'video_url' => 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
                'poster_url' => 'https://images.unsplash.com/photo-1485846234645-a62644f84728?w=800&auto=format&fit=crop&q=80',
                'views' => 640,
                'created_at' => time() - 3000
            ],
            [
                'title' => "O'tgan Kunlar (Yangi Talqin)",
                'genre' => 'Tarixiy',
                'country' => "O'zbekiston",
                'year' => 2024,
                'language' => "O'zbekcha",
                'rating' => 8.4,
                'quality' => '4K Ultra HD',
                'duration' => '145 daqiqa',
                'description' => "Abdulla Qodiriyning mashhur romani asosida suratga olingan buyuk muhabbat va tarixiy burilishlar haqidagi qahramonlik dramasi.",
                'type' => 'url',
                'video_url' => 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
                'poster_url' => 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=800&auto=format&fit=crop&q=80',
                'views' => 1120,
                'created_at' => time() - 4000
            ]
        ];

        $insertSql = "INSERT INTO movies (title, genre, country, year, language, rating, quality, duration, description, type, video_url, poster_url, views, created_at)
                      VALUES (:title, :genre, :country, :year, :language, :rating, :quality, :duration, :description, :type, :video_url, :poster_url, :views, :created_at)";
        $stmt = $pdo->prepare($insertSql);

        foreach ($initialMovies as $m) {
            $stmt->execute([
                ':title' => $m['title'],
                ':genre' => $m['genre'],
                ':country' => $m['country'],
                ':year' => $m['year'],
                ':language' => $m['language'],
                ':rating' => $m['rating'],
                ':quality' => $m['quality'],
                ':duration' => $m['duration'],
                ':description' => $m['description'],
                ':type' => $m['type'],
                ':video_url' => $m['video_url'],
                ':poster_url' => $m['poster_url'],
                ':views' => $m['views'],
                ':created_at' => $m['created_at']
            ]);
        }
    }
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => "Baza bilan ulanishda xatolik: " . $e->getMessage()]);
    exit();
}

