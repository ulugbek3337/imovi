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

// Marshrutlash (Routing)
switch ($action) {
    // === KINOLAR BO'LIMI ===
    case 'add':
        $movieController->addMovie();
        break;
    case 'edit':
    case 'update':
        $movieController->editMovie();
        break;
    case 'delete':
        $movieController->deleteMovie();
        break;
    case 'view':
        $movieController->incrementView();
        break;
        
    // === AVTORIZATSIYA BO'LIMI ===
    case 'login':
        $authController->adminLogin();
        break;
    case 'user_login':
        $authController->userLogin();
        break;
    case 'register':
        $authController->userRegister();
        break;
    case 'user_me':
        $authController->getUserProfile();
        break;

    // === IZOHLAR VA TARIX BO'LIMI ===
    case 'get_comments':
        $interactionController->getComments();
        break;
    case 'add_comment':
        $interactionController->addComment();
        break;

    // Standart holat (Barcha kinolarni olish)
    default:
        if ($method === 'GET' && empty($action)) {
            $movieController->getAllMovies();
        } else {
            http_response_code(404);
            echo json_encode(['success' => false, 'error' => "Bunday marshrut topilmadi!"]);
        }
        break;
}
?>