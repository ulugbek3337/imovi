<?php
require_once 'db.php';
$stmt = $pdo->query("SELECT * FROM users");
$users = $stmt->fetchAll();
echo json_encode($users, JSON_PRETTY_PRINT);
?>