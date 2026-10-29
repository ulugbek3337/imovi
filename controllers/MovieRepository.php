<?php
class MovieRepository {
    private $pdo;

    public function __construct($pdo) {
        $this->pdo = $pdo;
    }

    public function getAll() {
        $stmt = $this->pdo->prepare("SELECT * FROM movies ORDER BY id DESC");
        $stmt->execute();
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    public function delete($id) {
        $stmt = $this->pdo->prepare("DELETE FROM movies WHERE id = :id");
        return $stmt->execute([':id' => $id]);
    }
    
    public function incrementView($id) {
        $stmt = $this->pdo->prepare("UPDATE movies SET views = COALESCE(views, 0) + 1 WHERE id = :id");
        return $stmt->execute([':id' => $id]);
    }
}
