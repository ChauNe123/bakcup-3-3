<?php
// 1. Quản lý Session đồng bộ với hệ thống
$session_dir = __DIR__ . '/_sessions';
if (!is_dir($session_dir)) { mkdir($session_dir, 0777, true); }
session_save_path($session_dir);
session_start();

header('Content-Type: application/json; charset=utf-8');

// 2. Chặn truy cập trái phép: Chỉ nhân viên đã đăng nhập mới được gọi API này
if (!isset($_SESSION['user'])) {
    http_response_code(401);
    echo json_encode(["error" => "Unauthorized - Vui lòng đăng nhập"]);
    exit;
}

// 3. Cấu hình API Kho hàng
$url = "https://inventory.kbtech.vn/api/public/inventory/brand/ad3c4860-1bcf-4f23-9333-57cd52c50b14";

$ch = curl_init($url);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    'X-API-KEY: kb-public-api-key-2026',
    'Content-Type: application/json'
]);

// 4. BẢO MẬT: Bật kiểm tra SSL (Chống tấn công giả mạo khi chạy trên Internet)
// Nếu bạn chạy ở Localhost bị lỗi chứng chỉ, hãy đổi thành false, nhưng lên Server thật phải là true.
curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true); 

$response = curl_exec($ch);

if(curl_errno($ch)){
    echo json_encode(["error" => "Lỗi kết nối kho: " . curl_error($ch)]);
} else {
    echo $response; 
}

curl_close($ch);
?>