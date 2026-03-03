<?php
error_reporting(0);
ini_set('display_errors', 0);

$auth_db_config = [
    'host' => '127.0.0.1',
    'user' => 'root',        
    'pass' => '0705.KenBen', 
    'name' => 'kb_sso_db', 
    'port' => '3306' 
];

try {
    $dsn_auth = "mysql:host={$auth_db_config['host']};port={$auth_db_config['port']};dbname={$auth_db_config['name']};charset=utf8mb4";
    $pdo_auth = new PDO($dsn_auth, $auth_db_config['user'], $auth_db_config['pass'], [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES   => false,
    ]);
} catch (PDOException $e) {
    header('Content-Type: application/json');
    die(json_encode(["status" => "error", "message" => "Auth Database Connection Failed"]));
}