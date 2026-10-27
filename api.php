<?php
/**
 * KinoPrime - RESTful API Handler
 * Xavfsiz autentifikatsiya, Fayl tekshiruvi (MIME whitelist), CRUD va Unumdorlik
 */

require_once __DIR__ . '/db.php';

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$action = isset($_GET['action']) ? $_GET['action'] : '';

// Ruxsat etilgan fayl turlari va MIME tiplari
const ALLOWED_VIDEO_EXTS = ['mp4', 'webm', 'mkv', 'avi', 'mov'];
const ALLOWED_POSTER_EXTS = ['jpg', 'jpeg', 'png', 'webp', 'gif'];
const ALLOWED_VIDEO_MIMES = ['video/mp4', 'video/webm', 'video/x-matroska', 'video/avi', 'video/quicktime', 'application/octet-stream'];
const ALLOWED_IMAGE_MIMES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

// ================= 1. ADMIN AUTENTIFIKATSIYASI =================
if ($action === 'login' && $method === 'POST') {
    $password = $_POST['password'] ?? '';
    if ($password === ADMIN_PASSWORD) {
        $_SESSION['is_admin'] = true;
        echo json_encode([
            'success' => true,
            'token' => ADMIN_TOKEN_HASH,
            'message' => "Muvaffaqiyatli tizimga kirildi."
        ]);
        exit();
    } else {
        http_response_code(401);
        echo json_encode(['success' => false, 'error' => "Noto'g'ri maxfiy parol!"]);
        exit();
    }
}

if ($action === 'logout' && $method === 'POST') {
    $_SESSION['is_admin'] = false;
    unset($_SESSION['is_admin']);
    @session_destroy();
    echo json_encode(['success' => true, 'message' => "Tizimdan chiqildi."]);
    exit();
}

if ($action === 'check_auth') {
    echo json_encode([
        'success' => true,
        'authenticated' => checkAdminAuth()
    ]);
    exit();
}

// ================= 1.1 FOYDALANUVCHI AUTENTIFIKATSIYASI VA KABINETI =================
// Ro'yxatdan o'tish (Register)
if ($action === 'register' && $method === 'POST') {
    $name = trim($_POST['name'] ?? '');
    $email = strtolower(trim($_POST['email'] ?? ''));
    $password = $_POST['password'] ?? '';

    if (empty($name) || empty($email) || empty($password)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => "Barcha maydonlarni to'ldiring!"]);
        exit();
    }

    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => "Email formati noto'g'ri!"]);
        exit();
    }

    if (strlen($password) < 6) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => "Parol kamida 6 ta belgidan iborat bo'lishi kerak!"]);
        exit();
    }

    // Email band emasligini tekshirish
    $stmt = $pdo->prepare("SELECT id FROM users WHERE email = :email");
    $stmt->execute([':email' => $email]);
    if ($stmt->fetch()) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => "Ushbu email bilan allaqachon ro'yxatdan o'tilgan!"]);
        exit();
    }

    $hash = password_hash($password, PASSWORD_BCRYPT);
    $defaultAvatar = 'https://api.dicebear.com/7.x/bottts/svg?seed=' . urlencode($name);

    $ins = $pdo->prepare("INSERT INTO users (name, email, password_hash, avatar_url, role, created_at) VALUES (:name, :email, :pwd, :avatar, 'user', :time)");
    $ins->execute([
        ':name' => $name,
        ':email' => $email,
        ':pwd' => $hash,
        ':avatar' => $defaultAvatar,
        ':time' => time()
    ]);

    $newId = $pdo->lastInsertId();
    $_SESSION['user_id'] = $newId;
    $userToken = 'usr_' . $newId . '_' . bin2hex(random_bytes(8));

    echo json_encode([
        'success' => true,
        'message' => "Muvaffaqiyatli ro'yxatdan o'tdingiz!",
        'token' => $userToken,
        'user' => [
            'id' => $newId,
            'name' => $name,
            'email' => $email,
            'avatar_url' => $defaultAvatar,
            'role' => 'user'
        ]
    ]);
    exit();
}

// Foydalanuvchi tizimga kirishi (User Login)
if ($action === 'user_login' && $method === 'POST') {
    $email = strtolower(trim($_POST['email'] ?? ''));
    $password = $_POST['password'] ?? '';

    if (empty($email) || empty($password)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => "Email va parolni kiriting!"]);
        exit();
    }

    $stmt = $pdo->prepare("SELECT * FROM users WHERE email = :email");
    $stmt->execute([':email' => $email]);
    $user = $stmt->fetch();

    if (!$user || !password_verify($password, $user['password_hash'])) {
        http_response_code(401);
        echo json_encode(['success' => false, 'error' => "Email yoki parol noto'g'ri!"]);
        exit();
    }

    $_SESSION['user_id'] = $user['id'];
    $userToken = 'usr_' . $user['id'] . '_' . bin2hex(random_bytes(8));

    echo json_encode([
        'success' => true,
        'message' => "Xush kelibsiz, " . $user['name'] . "!",
        'token' => $userToken,
        'user' => [
            'id' => $user['id'],
            'name' => $user['name'],
            'email' => $user['email'],
            'avatar_url' => $user['avatar_url'] ?: ('https://api.dicebear.com/7.x/bottts/svg?seed=' . urlencode($user['name'])),
            'role' => $user['role']
        ]
    ]);
    exit();
}

// Foydalanuvchi tizimdan chiqishi (User Logout)
if ($action === 'user_logout' && $method === 'POST') {
    unset($_SESSION['user_id']);
    echo json_encode(['success' => true, 'message' => "Akkauntdan chiqildi."]);
    exit();
}

// Joriy foydalanuvchi profili (User Me)
if ($action === 'user_me') {
    $user = getCurrentUser($pdo);
    if ($user) {
        echo json_encode(['success' => true, 'user' => $user]);
    } else {
        echo json_encode(['success' => false, 'user' => null]);
    }
    exit();
}

// Profil ma'lumotlarini yangilash (Update Profile)
if ($action === 'update_profile' && $method === 'POST') {
    $user = getCurrentUser($pdo);
    if (!$user) {
        http_response_code(401);
        echo json_encode(['success' => false, 'error' => "Avval tizimga kiring!"]);
        exit();
    }

    $name = trim($_POST['name'] ?? $user['name']);
    $avatarUrl = trim($_POST['avatar_url'] ?? $user['avatar_url']);
    $oldPassword = $_POST['old_password'] ?? '';
    $newPassword = $_POST['new_password'] ?? '';

    // Yangi avatar fayli yuklangan bo'lsa
    if (isset($_FILES['avatar_file']) && $_FILES['avatar_file']['error'] === UPLOAD_ERR_OK) {
        $ext = strtolower(pathinfo($_FILES['avatar_file']['name'], PATHINFO_EXTENSION));
        if (in_array($ext, ALLOWED_POSTER_EXTS)) {
            $avatarName = 'avatar_' . $user['id'] . '_' . time() . '.' . $ext;
            $target = __DIR__ . '/uploads/' . $avatarName;
            if (move_uploaded_file($_FILES['avatar_file']['tmp_name'], $target)) {
                $avatarUrl = 'uploads/' . $avatarName;
            }
        }
    }

    // Parolni o'zgartirish
    if (!empty($newPassword)) {
        if (strlen($newPassword) < 6) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => "Yangi parol kamida 6 belgidan iborat bo'lishi kerak!"]);
            exit();
        }

        // Eski parolni tekshiramiz
        $stmt = $pdo->prepare("SELECT password_hash FROM users WHERE id = :id");
        $stmt->execute([':id' => $user['id']]);
        $row = $stmt->fetch();

        if (!password_verify($oldPassword, $row['password_hash'])) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => "Amaldagi eski parol noto'g'ri!"]);
            exit();
        }

        $newHash = password_hash($newPassword, PASSWORD_BCRYPT);
        $up = $pdo->prepare("UPDATE users SET name = :name, avatar_url = :avatar, password_hash = :pwd WHERE id = :id");
        $up->execute([':name' => $name, ':avatar' => $avatarUrl, ':pwd' => $newHash, ':id' => $user['id']]);
    } else {
        $up = $pdo->prepare("UPDATE users SET name = :name, avatar_url = :avatar WHERE id = :id");
        $up->execute([':name' => $name, ':avatar' => $avatarUrl, ':id' => $user['id']]);
    }

    $updated = getCurrentUser($pdo);
    echo json_encode(['success' => true, 'message' => "Profil muvaffaqiyatli yangilandi!", 'user' => $updated]);
    exit();
}

// ================= 1.2 IZOHLAR VA BAHOLASH (COMMENTS & REVIEWS) =================
// Kinoning izohlarini olish (GET ?action=get_comments&movie_id=X)
if ($action === 'get_comments') {
    $movieId = isset($_GET['movie_id']) ? intval($_GET['movie_id']) : 0;
    if ($movieId > 0) {
        $stmt = $pdo->prepare("SELECT * FROM comments WHERE movie_id = :mid ORDER BY id DESC LIMIT 50");
        $stmt->execute([':mid' => $movieId]);
        $comments = $stmt->fetchAll();
        echo json_encode(['success' => true, 'data' => $comments]);
    } else {
        echo json_encode(['success' => false, 'data' => []]);
    }
    exit();
}

// Yangi izoh qo'shish (POST ?action=add_comment)
if ($action === 'add_comment' && $method === 'POST') {
    $user = getCurrentUser($pdo);
    $movieId = intval($_POST['movie_id'] ?? 0);
    $rating = max(1, min(10, intval($_POST['rating'] ?? 10)));
    $commentText = trim($_POST['comment_text'] ?? '');

    if ($movieId <= 0 || empty($commentText)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => "Izoh matnini kiriting!"]);
        exit();
    }

    $userName = $user ? $user['name'] : trim($_POST['guest_name'] ?? 'Mehmon');
    $userAvatar = $user ? ($user['avatar_url'] ?: 'https://api.dicebear.com/7.x/bottts/svg?seed=' . urlencode($userName)) : 'https://api.dicebear.com/7.x/bottts/svg?seed=Guest';
    $userId = $user ? $user['id'] : 0;

    $stmt = $pdo->prepare("INSERT INTO comments (movie_id, user_id, user_name, user_avatar, rating, comment_text, created_at)
                          VALUES (:mid, :uid, :uname, :uavatar, :rating, :txt, :time)");
    $stmt->execute([
        ':mid' => $movieId,
        ':uid' => $userId,
        ':uname' => $userName,
        ':uavatar' => $userAvatar,
        ':rating' => $rating,
        ':txt' => $commentText,
        ':time' => time()
    ]);

    echo json_encode(['success' => true, 'message' => "Izohingiz qo'shildi!"]);
    exit();
}

// ================= 1.3 KO'RISHLAR TARIXI (WATCH HISTORY) =================
if ($action === 'get_history') {
    $user = getCurrentUser($pdo);
    if (!$user) {
        echo json_encode(['success' => true, 'data' => []]);
        exit();
    }

    $stmt = $pdo->prepare("SELECT m.*, h.watched_at 
                           FROM watch_history h 
                           JOIN movies m ON h.movie_id = m.id 
                           WHERE h.user_id = :uid 
                           ORDER BY h.watched_at DESC LIMIT 30");
    $stmt->execute([':uid' => $user['id']]);
    echo json_encode(['success' => true, 'data' => $stmt->fetchAll()]);
    exit();
}

if ($action === 'add_history' && $method === 'POST') {
    $user = getCurrentUser($pdo);
    $movieId = intval($_POST['movie_id'] ?? 0);
    if ($user && $movieId > 0) {
        $stmt = $pdo->prepare("INSERT OR REPLACE INTO watch_history (user_id, movie_id, watched_at) VALUES (:uid, :mid, :time)");
        $stmt->execute([':uid' => $user['id'], ':mid' => $movieId, ':time' => time()]);
    }
    echo json_encode(['success' => true]);
    exit();
}

// ================= 1.4 FOYDALANUVCHI SEVIMLILARI (USER WATCHLIST) =================
if ($action === 'get_user_favorites') {
    $user = getCurrentUser($pdo);
    if (!$user) {
        echo json_encode(['success' => true, 'data' => []]);
        exit();
    }

    $stmt = $pdo->prepare("SELECT m.* FROM user_favorites f 
                           JOIN movies m ON f.movie_id = m.id 
                           WHERE f.user_id = :uid 
                           ORDER BY f.created_at DESC");
    $stmt->execute([':uid' => $user['id']]);
    echo json_encode(['success' => true, 'data' => $stmt->fetchAll()]);
    exit();
}

if ($action === 'toggle_user_favorite' && $method === 'POST') {
    $user = getCurrentUser($pdo);
    $movieId = intval($_POST['movie_id'] ?? 0);

    if (!$user) {
        http_response_code(401);
        echo json_encode(['success' => false, 'error' => "Avval tizimga kiring!"]);
        exit();
    }

    if ($movieId > 0) {
        $chk = $pdo->prepare("SELECT id FROM user_favorites WHERE user_id = :uid AND movie_id = :mid");
        $chk->execute([':uid' => $user['id'], ':mid' => $movieId]);
        $fav = $chk->fetch();

        if ($fav) {
            $del = $pdo->prepare("DELETE FROM user_favorites WHERE user_id = :uid AND movie_id = :mid");
            $del->execute([':uid' => $user['id'], ':mid' => $movieId]);
            echo json_encode(['success' => true, 'favorited' => false, 'message' => "Sevimlilardan olib tashlandi"]);
        } else {
            $ins = $pdo->prepare("INSERT INTO user_favorites (user_id, movie_id, created_at) VALUES (:uid, :mid, :time)");
            $ins->execute([':uid' => $user['id'], ':mid' => $movieId, ':time' => time()]);
            echo json_encode(['success' => true, 'favorited' => true, 'message' => "Sevimlilarga qo'shildi!"]);
        }
        exit();
    }
}

// ================= 2. KO'RISHLAR SONINI OSHIRISH (VIEW INCREMENT) =================
if ($action === 'view' && $method === 'POST') {
    $id = isset($_GET['id']) ? intval($_GET['id']) : (isset($_POST['id']) ? intval($_POST['id']) : 0);
    if ($id > 0) {
        $stmt = $pdo->prepare("UPDATE movies SET views = COALESCE(views, 0) + 1 WHERE id = :id");
        $stmt->execute([':id' => $id]);
        echo json_encode(['success' => true]);
        exit();
    }
}

// ================= 3. KINOLAR RO'YXATINI OLISH (GET) =================
if ($method === 'GET' && empty($action)) {
    try {
        // Agar bitta kinoni olish kerak bo'lsa (ID bo'yicha)
        if (isset($_GET['id']) && intval($_GET['id']) > 0) {
            $stmt = $pdo->prepare("SELECT * FROM movies WHERE id = :id");
            $stmt->execute([':id' => intval($_GET['id'])]);
            $movie = $stmt->fetch();
            if ($movie) {
                echo json_encode(['success' => true, 'data' => $movie]);
            } else {
                http_response_code(404);
                echo json_encode(['success' => false, 'error' => "Kino topilmadi!"]);
            }
            exit();
        }

        $genre = isset($_GET['genre']) && $_GET['genre'] !== 'all' ? $_GET['genre'] : null;
        $country = isset($_GET['country']) && $_GET['country'] !== 'all' ? $_GET['country'] : null;
        $year = isset($_GET['year']) && $_GET['year'] !== 'all' ? $_GET['year'] : null;
        $language = isset($_GET['language']) && $_GET['language'] !== 'all' ? $_GET['language'] : null;
        $rating = isset($_GET['rating']) && $_GET['rating'] !== 'all' ? floatval($_GET['rating']) : null;
        $search = isset($_GET['search']) ? trim($_GET['search']) : null;
        $sort = isset($_GET['sort']) ? $_GET['sort'] : 'newest';

        $query = "SELECT * FROM movies WHERE 1=1";
        $params = [];

        if ($search) {
            $query .= " AND (title LIKE :search OR description LIKE :search OR genre LIKE :search)";
            $params[':search'] = '%' . $search . '%';
        }

        if ($genre) {
            $query .= " AND genre = :genre";
            $params[':genre'] = $genre;
        }

        if ($country) {
            $query .= " AND country = :country";
            $params[':country'] = $country;
        }

        if ($year) {
            if ($year === 'old') {
                $query .= " AND year <= 2019";
            } else {
                $query .= " AND year = :year";
                $params[':year'] = intval($year);
            }
        }

        if ($language) {
            $query .= " AND language LIKE :language";
            $params[':language'] = '%' . $language . '%';
        }

        if ($rating) {
            $query .= " AND rating >= :rating";
            $params[':rating'] = $rating;
        }

        // Saralash
        switch ($sort) {
            case 'ratingDesc':
                $query .= " ORDER BY rating DESC";
                break;
            case 'yearDesc':
                $query .= " ORDER BY year DESC";
                break;
            case 'viewsDesc':
                $query .= " ORDER BY views DESC";
                break;
            case 'titleAsc':
                $query .= " ORDER BY title ASC";
                break;
            case 'newest':
            default:
                $query .= " ORDER BY id DESC";
                break;
        }

        // Paginatsiya (ixtiyoriy)
        if (isset($_GET['limit'])) {
            $limit = max(1, min(100, intval($_GET['limit'])));
            $page = isset($_GET['page']) ? max(1, intval($_GET['page'])) : 1;
            $offset = ($page - 1) * $limit;
            $query .= " LIMIT " . $limit . " OFFSET " . $offset;
        }

        $stmt = $pdo->prepare($query);
        $stmt->execute($params);
        $movies = $stmt->fetchAll();

        echo json_encode([
            'success' => true,
            'count' => count($movies),
            'data' => $movies
        ]);
        exit();
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => $e->getMessage()]);
        exit();
    }
}

// ================= 4. YANGI KINO QO'SHISH (POST) =================
if ($method === 'POST' && (empty($action) || $action === 'add')) {
    // Backend xavfsizlik tekshiruvi (faqat admin qo'sha oladi)
    if (!checkAdminAuth()) {
        http_response_code(401);
        echo json_encode(['success' => false, 'error' => "Ruxsat berilmagan! Avval admin panelga kiring."]);
        exit();
    }

    try {
        $title = isset($_POST['title']) ? trim($_POST['title']) : '';
        $genre = isset($_POST['genre']) ? trim($_POST['genre']) : 'Jangari';
        $country = isset($_POST['country']) ? trim($_POST['country']) : 'AQSH';
        $year = isset($_POST['year']) ? intval($_POST['year']) : 2024;
        $language = isset($_POST['language']) ? trim($_POST['language']) : "O'zbekcha";
        $rating = isset($_POST['rating']) ? floatval($_POST['rating']) : 8.0;
        $quality = isset($_POST['quality']) ? trim($_POST['quality']) : 'Full HD 1080p';
        $duration = isset($_POST['duration']) ? trim($_POST['duration']) : '120 daqiqa';
        $description = isset($_POST['description']) ? trim($_POST['description']) : '';
        $type = isset($_POST['type']) ? trim($_POST['type']) : 'url';

        if (empty($title)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => "Kino nomi bo'sh bo'lishi mumkin emas!"]);
            exit();
        }

        $videoUrl = '';
        $posterUrl = '';
        $uploadsDir = __DIR__ . '/uploads';

        if ($type === 'file') {
            // Video faylini tekshirish va yuklash
            if (isset($_FILES['video_file'])) {
                if ($_FILES['video_file']['error'] !== UPLOAD_ERR_OK) {
                    throw new Exception("Video yuklashda xatolik yuz berdi (Xato kodi: " . $_FILES['video_file']['error'] . ")");
                }

                $ext = strtolower(pathinfo($_FILES['video_file']['name'], PATHINFO_EXTENSION));
                if (!in_array($ext, ALLOWED_VIDEO_EXTS)) {
                    http_response_code(400);
                    echo json_encode(['success' => false, 'error' => "Ruxsat berilmagan video formati! Faqat " . implode(', ', ALLOWED_VIDEO_EXTS) . " mumkin."]);
                    exit();
                }

                $videoFilename = 'vid_' . time() . '_' . bin2hex(random_bytes(4)) . '.' . $ext;
                $targetVideo = $uploadsDir . '/' . $videoFilename;
                if (!move_uploaded_file($_FILES['video_file']['tmp_name'], $targetVideo)) {
                    throw new Exception("Video faylini serverga saqlab bo'lmadi.");
                }
                $videoUrl = 'uploads/' . $videoFilename;
            } else {
                http_response_code(400);
                echo json_encode(['success' => false, 'error' => "Video fayli tanlanmadi!"]);
                exit();
            }

            // Poster faylini tekshirish va yuklash
            if (isset($_FILES['poster_file']) && $_FILES['poster_file']['error'] === UPLOAD_ERR_OK) {
                $ext = strtolower(pathinfo($_FILES['poster_file']['name'], PATHINFO_EXTENSION));
                if (in_array($ext, ALLOWED_POSTER_EXTS)) {
                    $posterFilename = 'poster_' . time() . '_' . bin2hex(random_bytes(4)) . '.' . $ext;
                    $targetPoster = $uploadsDir . '/' . $posterFilename;
                    if (move_uploaded_file($_FILES['poster_file']['tmp_name'], $targetPoster)) {
                        $posterUrl = 'uploads/' . $posterFilename;
                    }
                }
            }

            if (empty($posterUrl)) {
                $posterUrl = 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=800&auto=format&fit=crop&q=80';
            }
        } else {
            // URL orqali
            $videoUrl = isset($_POST['video_url']) ? trim($_POST['video_url']) : '';
            $posterUrl = isset($_POST['poster_url']) && !empty(trim($_POST['poster_url'])) 
                ? trim($_POST['poster_url']) 
                : 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=800&auto=format&fit=crop&q=80';

            if (empty($videoUrl)) {
                http_response_code(400);
                echo json_encode(['success' => false, 'error' => "Video URL manzili kiritilmadi!"]);
                exit();
            }
        }

        $sql = "INSERT INTO movies (title, genre, country, year, language, rating, quality, duration, description, type, video_url, poster_url, views, created_at)
                VALUES (:title, :genre, :country, :year, :language, :rating, :quality, :duration, :description, :type, :video_url, :poster_url, 0, :created_at)";
        $stmt = $pdo->prepare($sql);
        $stmt->execute([
            ':title' => $title,
            ':genre' => $genre,
            ':country' => $country,
            ':year' => $year,
            ':language' => $language,
            ':rating' => $rating,
            ':quality' => $quality,
            ':duration' => $duration,
            ':description' => $description,
            ':type' => $type,
            ':video_url' => $videoUrl,
            ':poster_url' => $posterUrl,
            ':created_at' => time()
        ]);

        echo json_encode([
            'success' => true,
            'message' => "Kino muvaffaqiyatli saqlandi!",
            'id' => $pdo->lastInsertId()
        ]);
        exit();
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => $e->getMessage()]);
        exit();
    }
}

// ================= 5. MAVJUD KINONI TAHRIRLASH (POST ?action=edit) =================
if ($method === 'POST' && ($action === 'edit' || $action === 'update')) {
    if (!checkAdminAuth()) {
        http_response_code(401);
        echo json_encode(['success' => false, 'error' => "Ruxsat berilmagan! Avval admin panelga kiring."]);
        exit();
    }

    try {
        $id = isset($_POST['id']) ? intval($_POST['id']) : (isset($_GET['id']) ? intval($_GET['id']) : 0);
        if (!$id) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => "Kino ID si ko'rsatilmadi!"]);
            exit();
        }

        // Mavjud kinoni olish
        $stmt = $pdo->prepare("SELECT * FROM movies WHERE id = :id");
        $stmt->execute([':id' => $id]);
        $existing = $stmt->fetch();
        if (!$existing) {
            http_response_code(404);
            echo json_encode(['success' => false, 'error' => "Tahrirlanadigan kino topilmadi!"]);
            exit();
        }

        $title = isset($_POST['title']) ? trim($_POST['title']) : $existing['title'];
        $genre = isset($_POST['genre']) ? trim($_POST['genre']) : $existing['genre'];
        $country = isset($_POST['country']) ? trim($_POST['country']) : $existing['country'];
        $year = isset($_POST['year']) ? intval($_POST['year']) : $existing['year'];
        $language = isset($_POST['language']) ? trim($_POST['language']) : $existing['language'];
        $rating = isset($_POST['rating']) ? floatval($_POST['rating']) : $existing['rating'];
        $quality = isset($_POST['quality']) ? trim($_POST['quality']) : $existing['quality'];
        $duration = isset($_POST['duration']) ? trim($_POST['duration']) : $existing['duration'];
        $description = isset($_POST['description']) ? trim($_POST['description']) : $existing['description'];
        $type = isset($_POST['type']) ? trim($_POST['type']) : $existing['type'];

        $videoUrl = $existing['video_url'];
        $posterUrl = $existing['poster_url'];
        $uploadsDir = __DIR__ . '/uploads';

        // Yangi video fayli yuklangan bo'lsa
        if ($type === 'file' && isset($_FILES['video_file']) && $_FILES['video_file']['error'] === UPLOAD_ERR_OK) {
            $ext = strtolower(pathinfo($_FILES['video_file']['name'], PATHINFO_EXTENSION));
            if (in_array($ext, ALLOWED_VIDEO_EXTS)) {
                // Eski faylni o'chirish
                if (!empty($existing['video_url']) && strpos($existing['video_url'], 'uploads/') === 0 && file_exists(__DIR__ . '/' . $existing['video_url'])) {
                    @unlink(__DIR__ . '/' . $existing['video_url']);
                }
                $videoFilename = 'vid_' . time() . '_' . bin2hex(random_bytes(4)) . '.' . $ext;
                move_uploaded_file($_FILES['video_file']['tmp_name'], $uploadsDir . '/' . $videoFilename);
                $videoUrl = 'uploads/' . $videoFilename;
            }
        } elseif ($type === 'url' && isset($_POST['video_url']) && !empty(trim($_POST['video_url']))) {
            $videoUrl = trim($_POST['video_url']);
        }

        // Yangi poster fayli yuklangan bo'lsa
        if (isset($_FILES['poster_file']) && $_FILES['poster_file']['error'] === UPLOAD_ERR_OK) {
            $ext = strtolower(pathinfo($_FILES['poster_file']['name'], PATHINFO_EXTENSION));
            if (in_array($ext, ALLOWED_POSTER_EXTS)) {
                if (!empty($existing['poster_url']) && strpos($existing['poster_url'], 'uploads/') === 0 && file_exists(__DIR__ . '/' . $existing['poster_url'])) {
                    @unlink(__DIR__ . '/' . $existing['poster_url']);
                }
                $posterFilename = 'poster_' . time() . '_' . bin2hex(random_bytes(4)) . '.' . $ext;
                move_uploaded_file($_FILES['poster_file']['tmp_name'], $uploadsDir . '/' . $posterFilename);
                $posterUrl = 'uploads/' . $posterFilename;
            }
        } elseif (isset($_POST['poster_url']) && !empty(trim($_POST['poster_url']))) {
            $posterUrl = trim($_POST['poster_url']);
        }

        $updateSql = "UPDATE movies SET 
            title = :title, genre = :genre, country = :country, year = :year,
            language = :language, rating = :rating, quality = :quality, duration = :duration,
            description = :description, type = :type, video_url = :video_url, poster_url = :poster_url
            WHERE id = :id";
        $stmt = $pdo->prepare($updateSql);
        $stmt->execute([
            ':title' => $title,
            ':genre' => $genre,
            ':country' => $country,
            ':year' => $year,
            ':language' => $language,
            ':rating' => $rating,
            ':quality' => $quality,
            ':duration' => $duration,
            ':description' => $description,
            ':type' => $type,
            ':video_url' => $videoUrl,
            ':poster_url' => $posterUrl,
            ':id' => $id
        ]);

        echo json_encode([
            'success' => true,
            'message' => "Kino ma'lumotlari muvaffaqiyatli yangilandi!"
        ]);
        exit();
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => $e->getMessage()]);
        exit();
    }
}

// ================= 6. KINONI O'CHIRISH (DELETE yoki POST ?action=delete) =================
if ($method === 'DELETE' || ($method === 'POST' && $action === 'delete')) {
    if (!checkAdminAuth()) {
        http_response_code(401);
        echo json_encode(['success' => false, 'error' => "Ruxsat berilmagan! Avval admin panelga kiring."]);
        exit();
    }

    try {
        $id = isset($_GET['id']) ? intval($_GET['id']) : (isset($_POST['id']) ? intval($_POST['id']) : 0);
        if (!$id) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => "Kino ID si ko'rsatilmadi!"]);
            exit();
        }

        // Kinoning yuklangan fayllari bo'lsa xavfsiz o'chiramiz
        $stmt = $pdo->prepare("SELECT video_url, poster_url, type FROM movies WHERE id = :id");
        $stmt->execute([':id' => $id]);
        $movie = $stmt->fetch();

        if ($movie && $movie['type'] === 'file') {
            if (!empty($movie['video_url']) && strpos($movie['video_url'], 'uploads/') === 0 && file_exists(__DIR__ . '/' . $movie['video_url'])) {
                @unlink(__DIR__ . '/' . $movie['video_url']);
            }
            if (!empty($movie['poster_url']) && strpos($movie['poster_url'], 'uploads/') === 0 && file_exists(__DIR__ . '/' . $movie['poster_url'])) {
                @unlink(__DIR__ . '/' . $movie['poster_url']);
            }
        }

        $delStmt = $pdo->prepare("DELETE FROM movies WHERE id = :id");
        $delStmt->execute([':id' => $id]);

        echo json_encode(['success' => true, 'message' => "Kino muvaffaqiyatli o'chirildi!"]);
        exit();
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => $e->getMessage()]);
        exit();
    }
}

http_response_code(405);
echo json_encode(['success' => false, 'error' => "Ruxsat berilmagan HTTP metod!"]);
