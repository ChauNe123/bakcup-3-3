<?php
// Tắt hiển thị lỗi ra ngoài màn hình để tránh lộ cấu hình server
error_reporting(0);
ini_set('display_errors', 0);

$db_config = [
    'host' => '127.0.0.1',
    'user' => 'root',        
    'pass' => '0705.KenBen', 
    'name' => 'kb_quotes_db',
    'port' => '3306' 
];

try {
    $dsn = "mysql:host={$db_config['host']};port={$db_config['port']};dbname={$db_config['name']};charset=utf8mb4";
    $pdo = new PDO($dsn, $db_config['user'], $db_config['pass'], [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES   => false, // Chống SQL Injection tốt hơn
    ]);
} catch (PDOException $e) {
    header('Content-Type: application/json');
    die(json_encode(["status" => "error", "message" => "Database Connection Failed"]));
}