<?php
/**
 * KBTECH SYSTEM - API BACKEND (SYSTEM EXPERT EDITION)
 */
error_reporting(0);
ini_set('display_errors', 0);

$session_dir = __DIR__ . '/_sessions';
if (!is_dir($session_dir)) { mkdir($session_dir, 0777, true); }
session_save_path($session_dir);
session_start();

header('Content-Type: application/json; charset=utf-8');
require_once 'db.php';

$action = $_GET['action'] ?? '';
$input = json_decode(file_get_contents('php://input'), true);

if (!isset($_SESSION['user']) && $action !== 'fetch_inventory') {
    http_response_code(401);
    exit(json_encode(["status" => "error", "message" => "Unauthorized"]));
}

switch ($action) {
    case 'fetch_inventory':
        $api_url = "https://inventory.kbtech.vn/api/public/inventory/brand/ad3c4860-1bcf-4f23-9333-57cd52c50b14";
        $opts = ["http" => ["method" => "GET", "header" => "Content-Type: application/json\r\nX-API-KEY: KBTECH_INTERNAL_KEY\r\n", "timeout" => 5]];
        $response = @file_get_contents($api_url, false, stream_context_create($opts));
        echo $response ?: json_encode([]);
        break;

    case 'save_quote':
        try {
            $productsJson = json_encode($input['products'], JSON_UNESCAPED_UNICODE);
            // Chuẩn hóa dữ liệu để tránh lỗi SQL nếu thiếu trường
            $data = [
                $input['quoteNo'] ?? '', $input['date'] ?? date('Y-m-d'), $input['contractNo'] ?? '',
                $input['projectName'] ?? '', $input['buyerName'] ?? '', $input['buyerAddress'] ?? '',
                $input['deliveryAddress'] ?? '', $input['buyerTax'] ?? '', $input['buyerPhone'] ?? '',
                $input['buyerRep'] ?? '', $input['buyerRole'] ?? '', $input['paymentOpt'] ?? '',
                $productsJson, $_SESSION['user']
            ];

            $sql = "INSERT INTO quotes (quote_no, doc_date, contract_no, project_name, buyer_name, buyer_address, delivery_address, buyer_tax, buyer_phone, buyer_rep, buyer_role, payment_opt, products_json, created_by) 
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ON DUPLICATE KEY UPDATE 
                        doc_date=VALUES(doc_date), project_name=VALUES(project_name), 
                        buyer_name=VALUES(buyer_name), products_json=VALUES(products_json),
                        contract_no=VALUES(contract_no), buyer_tax=VALUES(buyer_tax)";
            
            $stmt = $pdo->prepare($sql);
            $stmt->execute($data);
            echo json_encode(["status" => "success", "message" => "Đã lưu vào NAS"]);
        } catch (Exception $e) {
            echo json_encode(["status" => "error", "message" => $e->getMessage()]);
        }
        break;
}
?>