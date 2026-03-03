<?php
// 1. Cấu hình Session an toàn
$session_dir = __DIR__ . '/_sessions';
if (!is_dir($session_dir)) { mkdir($session_dir, 0700, true); }

ini_set('session.use_only_cookies', 1);
ini_set('session.cookie_httponly', 1); // Chống XSS lấy Cookie
session_save_path($session_dir);
session_start();

require_once 'db_auth.php'; 

function sendJson($data) {
    if (ob_get_length()) ob_clean();
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data);
    exit;
}

$action = $_GET['action'] ?? '';

// Kiểm tra trạng thái đăng nhập
if ($action === 'check') {
    if (isset($_SESSION['user'])) {
        sendJson(["status" => "logged_in", "user" => $_SESSION['user']]);
    } else {
        sendJson(["status" => "logged_out"]);
    }
}

// Đăng xuất
if ($action === 'logout') {
    $_SESSION = array();
    if (ini_get("session.use_cookies")) {
        $params = session_get_cookie_params();
        setcookie(session_name(), '', time() - 42000,
            $params["path"], $params["domain"],
            $params["secure"], $params["httponly"]
        );
    }
    session_destroy();
    sendJson(["status" => "success"]);
}

// Xử lý Đăng nhập
$input = json_decode(file_get_contents('php://input'), true);
if ($input) {
    $user = trim($input['username'] ?? '');
    $pass = $input['password'] ?? '';

    if (empty($user) || empty($pass)) {
        sendJson(["status" => "error", "message" => "Vui lòng nhập đầy đủ thông tin."]);
    }

    try {
        // Sử dụng Prepared Statement để chống SQL Injection
        $stmt = $pdo_auth->prepare("SELECT username, password FROM users WHERE username = ? LIMIT 1");
        $stmt->execute([$user]);
        $db_user = $stmt->fetch();

        // Kiểm tra mật khẩu (Hỗ trợ cả plaintext cũ và Hash mới)
        if ($db_user) {
            $is_valid = false;
            if (password_verify($pass, $db_user['password'])) {
                $is_valid = true;
            } elseif ($pass === $db_user['password']) {
                // Tùy chọn: Cho phép login bằng plaintext nếu bạn chưa hash mật khẩu trong DB
                $is_valid = true;
            }

            if ($is_valid) {
                session_regenerate_id(true); // Chống Session Fixation
                $_SESSION['user'] = $db_user['username'];
                sendJson(["status" => "success", "user" => $db_user['username']]);
            }
        }
        
        sendJson(["status" => "error", "message" => "Tài khoản hoặc mật khẩu không đúng."]);

    } catch (Exception $e) {
        sendJson(["status" => "error", "message" => "Hệ thống đang bận, vui lòng thử lại sau."]);
    }
}