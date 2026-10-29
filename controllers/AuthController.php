<?php
require_once __DIR__ . '/AuthRepository.php';

class AuthController {
    private $repository;

    public function __construct($pdo) {
        $this->repository = new AuthRepository($pdo);
    }

    // Admin tizimga kirishi
    public function adminLogin() {
        $password = $_POST['password'] ?? '';
        if ($password === ADMIN_PASSWORD) { // db.php da belgilangan
            $_SESSION['is_admin'] = true;
            echo json_encode([
                'success' => true,
                'token' => ADMIN_TOKEN_HASH,
                'message' => "Muvaffaqiyatli tizimga kirildi."
            ]);
        } else {
            http_response_code(401);
            echo json_encode(['success' => false, 'error' => "Noto'g'ri maxfiy parol!"]);
        }
        exit();
    }

    // Foydalanuvchi ro'yxatdan o'tishi
    public function userRegister() {
        $name = trim($_POST['name'] ?? '');
        $email = strtolower(trim($_POST['email'] ?? ''));
        $password = $_POST['password'] ?? '';

        if (empty($name) || empty($email) || empty($password)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => "Barcha maydonlarni to'ldiring!"]);
            exit();
        }

        // Email band emasligini tekshirish
        $stmt = $this->pdo->prepare("SELECT id FROM users WHERE email = :email");
        $stmt->execute([':email' => $email]);
        if ($stmt->fetch()) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => "Ushbu email bilan allaqachon ro'yxatdan o'tilgan!"]);
            exit();
        }

        $hash = password_hash($password, PASSWORD_BCRYPT);
        $defaultAvatar = 'https://api.dicebear.com/7.x/bottts/svg?seed=' . urlencode($name);

        $ins = $this->pdo->prepare("INSERT INTO users (name, email, password_hash, avatar_url, role, created_at) VALUES (:name, :email, :pwd, :avatar, 'user', :time)");
        $ins->execute([
            ':name' => $name,
            ':email' => $email,
            ':pwd' => $hash,
            ':avatar' => $defaultAvatar,
            ':time' => time()
        ]);

        $newId = $this->pdo->lastInsertId();
        $_SESSION['user_id'] = $newId;

        echo json_encode([
            'success' => true,
            'message' => "Muvaffaqiyatli ro'yxatdan o'tdingiz!",
            'token' => 'usr_' . $newId . '_' . bin2hex(random_bytes(8)),
            'user' => ['id' => $newId, 'name' => $name, 'email' => $email, 'avatar_url' => $defaultAvatar, 'role' => 'user']
        ]);
        exit();
    }

    // Foydalanuvchi tizimga kirishi
    public function userLogin() {
        $email = strtolower(trim($_POST['email'] ?? ''));
        $password = $_POST['password'] ?? '';

        $stmt = $this->pdo->prepare("SELECT * FROM users WHERE email = :email");
        $stmt->execute([':email' => $email]);
        $user = $stmt->fetch();

        if (!$user || !password_verify($password, $user['password_hash'])) {
            http_response_code(401);
            echo json_encode(['success' => false, 'error' => "Email yoki parol noto'g'ri!"]);
            exit();
        }

        $_SESSION['user_id'] = $user['id'];
        echo json_encode([
            'success' => true,
            'message' => "Xush kelibsiz, " . $user['name'] . "!",
            'token' => 'usr_' . $user['id'] . '_' . bin2hex(random_bytes(8)),
            'user' => [
                'id' => $user['id'],
                'name' => $user['name'],
                'email' => $user['email'],
                'avatar_url' => $user['avatar_url'],
                'role' => $user['role']
            ]
        ]);
        exit();
    }

    // Foydalanuvchi profilini olish
    public function getUserProfile() {
        $user = getCurrentUser($this->pdo); // db.php dagi funksiya
        if ($user) {
            echo json_encode(['success' => true, 'user' => $user]);
        } else {
            echo json_encode(['success' => false, 'user' => null]);
        }
        exit();
    }
}
?>