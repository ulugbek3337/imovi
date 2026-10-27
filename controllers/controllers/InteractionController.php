<?php
class InteractionController {
    private $pdo;

    public function __construct($pdo) {
        $this->pdo = $pdo;
    }

    // Kinoning izohlarini olish
    public function getComments() {
        $movieId = isset($_GET['movie_id']) ? intval($_GET['movie_id']) : 0;
        if ($movieId > 0) {
            $stmt = $this->pdo->prepare("SELECT * FROM comments WHERE movie_id = :mid ORDER BY id DESC LIMIT 50");
            $stmt->execute([':mid' => $movieId]);
            $comments = $stmt->fetchAll();
            echo json_encode(['success' => true, 'data' => $comments]);
        } else {
            echo json_encode(['success' => false, 'data' => []]);
        }
        exit();
    }

    // Yangi izoh qo'shish
    public function addComment() {
        $user = getCurrentUser($this->pdo);
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

        $stmt = $this->pdo->prepare("INSERT INTO comments (movie_id, user_id, user_name, user_avatar, rating, comment_text, created_at)
                              VALUES (:mid, :uid, :uname, :uavatar, :rating, :txt, :time)");
        $stmt->execute([
            ':mid' => $movieId, ':uid' => $userId, ':uname' => $userName,
            ':uavatar' => $userAvatar, ':rating' => $rating, ':txt' => $commentText, ':time' => time()
        ]);

        echo json_encode(['success' => true, 'message' => "Izohingiz qo'shildi!"]);
        exit();
    }

    // Ko'rishlar tarixini olish va qo'shish
    public function getHistory() {
        $user = getCurrentUser($this->pdo);
        if (!$user) {
            echo json_encode(['success' => true, 'data' => []]);
            exit();
        }
        $stmt = $this->pdo->prepare("SELECT m.*, h.watched_at FROM watch_history h JOIN movies m ON h.movie_id = m.id WHERE h.user_id = :uid ORDER BY h.watched_at DESC LIMIT 30");
        $stmt->execute([':uid' => $user['id']]);
        echo json_encode(['success' => true, 'data' => $stmt->fetchAll()]);
        exit();
    }
}
?>