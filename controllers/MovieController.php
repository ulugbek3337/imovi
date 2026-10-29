<?php
require_once __DIR__ . '/MovieRepository.php';

class MovieController {
    private $repository;

    public function __construct($pdo) {
        $this->repository = new MovieRepository($pdo);
    }

    public function getAllMovies() {
        try {
            $movies = $this->repository->getAll();
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

    public function deleteMovie() {
        if (!checkAdminAuth()) {
            http_response_code(401);
            echo json_encode(['success' => false, 'error' => "Ruxsat berilmagan!"]);
            exit();
        }

        $id = intval($_GET['id'] ?? $_POST['id'] ?? 0);
        if ($id > 0) {
            $this->repository->delete($id);
            echo json_encode(['success' => true, 'message' => "O'chirildi!"]);
        }
        exit();
    }
    
    public function incrementView() {
        $id = intval($_GET['id'] ?? $_POST['id'] ?? 0);
        if ($id > 0) {
            $this->repository->incrementView($id);
            echo json_encode(['success' => true]);
        }
        exit();
    }
}
