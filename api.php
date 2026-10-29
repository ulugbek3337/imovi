<?php
/**
 * KinoPrime - Markaziy API Router
 */
require_once __DIR__ . '/db.php';

// Kontrollerlarni ulash
require_once __DIR__ . '/controllers/MovieController.php';
require_once __DIR__ . '/controllers/AuthController.php';
require_once __DIR__ . '/controllers/InteractionController.php';

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$action = isset($_GET['action']) ? $_GET['action'] : '';

// Kontroller obyektlarini yaratish
$movieController = new MovieController($pdo);
$authController = new AuthController($pdo);
$interactionController = new InteractionController($pdo);

// RESTful API Routing
$method = $_SERVER['REQUEST_METHOD'];

switch ($method) {
    case 'GET':
        if ($action === 'get_comments') {
            $interactionController->getComments();
        } elseif ($action === 'get_history') {
            $interactionController->getHistory();
        } elseif ($action === 'user_me') {
            $authController->getUserProfile();
        } else {
            $movieController->getAllMovies();
        }
        break;

    case 'POST':
        switch ($action) {
            case 'login':
                $authController->adminLogin();
                break;
            case 'user_login':
                $authController->userLogin();
                break;
            case 'register':
                $authController->userRegister();
                break;
            case 'add_comment':
                $interactionController->addComment();
                break;
            case 'add':
                $movieController->addMovie();
                break;
        }
        break;

    case 'PUT':
    case 'PATCH':
        if ($action === 'update' || $action === 'edit') {
            $movieController->editMovie();
        }
        break;

    case 'DELETE':
        if ($action === 'delete') {
            $movieController->deleteMovie();
        }
        break;

    default:
        http_response_code(405);
        echo json_encode(['success' => false, 'error' => "Metod ruxsat etilmagan!"]);
        break;
}

?>