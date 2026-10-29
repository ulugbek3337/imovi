<?php
class InteractionRepository {
    private $pdo;

    public function __construct($pdo) {
        $this->pdo = $pdo;
    }

    public function getCommentsByMovie($movieId) {
        $stmt = $this->pdo->prepare("SELECT * FROM comments WHERE movie_id = :movie_id ORDER BY created_at DESC");
        $stmt->execute([':movie_id' => $movieId]);
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    public function addComment($movieId, $userId, $content) {
        $stmt = $this->pdo->prepare("INSERT INTO comments (movie_id, user_id, content) VALUES (:movie_id, :user_id, :content)");
        return $stmt->execute([
            ':movie_id' => $movieId,
            ':user_id' => $userId,
            ':content' => $content
        ]);
    }
}
