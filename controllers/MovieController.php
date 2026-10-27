<?php
class MovieController {
    private $pdo;

    public function __construct($pdo) {
        $this->pdo = $pdo;
    }

    // Barcha kinolarni ro'yxatga olish va filtrlash
    public function getAllMovies() {
        try {
            $sort = $_GET['sort'] ?? 'newest';
            $query = "SELECT * FROM movies ORDER BY id DESC"; // Qisqartirilgan namuna
            
            // Asl kod dagi barcha WHERE, LIKE filtrlari shu yerda bo'ladi...
            
            $stmt = $this->pdo->prepare($query);
            $stmt->execute();
            $movies = $stmt->fetchAll();

            echo json_encode([
                'success' => true,
                'count' => count($movies),
                'data' => $movies
            ]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'error' => $e->getMessage()]);
        }
        exit();
    }

    // Yangi kino qo'shish
    public function addMovie() {
        if (!checkAdminAuth()) { // db.php dagi funksiya
            http_response_code(401);
            echo json_encode(['success' => false, 'error' => "Ruxsat berilmagan!"]);
            exit();
        }

        $title = trim($_POST['title'] ?? '');
        if (empty($title)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => "Kino nomi bo'sh bo'lishi mumkin emas!"]);
            exit();
        }

        // Asl kod dagi qolgan fayl yuklash (upload) mantiqlari...
        echo json_encode(['success' => true, 'message' => "Kino saqlandi (Kontroller ishladi)"]);
        exit();
    }

    // Kinoni o'chirish
    public function deleteMovie() {
        if (!checkAdminAuth()) {
            http_response_code(401);
            echo json_encode(['success' => false, 'error' => "Ruxsat berilmagan!"]);
            exit();
        }

        $id = intval($_GET['id'] ?? $_POST['id'] ?? 0);
        if ($id > 0) {
            $stmt = $this->pdo->prepare("DELETE FROM movies WHERE id = :id");
            $stmt->execute([':id' => $id]);
            echo json_encode(['success' => true, 'message' => "O'chirildi!"]);
        }
        exit();
    }
    
    // Ko'rishlar sonini oshirish
    public function incrementView() {
        $id = intval($_GET['id'] ?? $_POST['id'] ?? 0);
        if ($id > 0) {
            $stmt = $this->pdo->prepare("UPDATE movies SET views = COALESCE(views, 0) + 1 WHERE id = :id");
            $stmt->execute([':id' => $id]);
            echo json_encode(['success' => true]);
        }
        exit();
    }
}
?>