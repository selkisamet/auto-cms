<?php
// api.php
header('Content-Type: application/json; charset=utf-8');
require_once 'db.php';

$action = $_GET['action'] ?? $_POST['action'] ?? null;
if (!$action) {
    echo json_encode(['error' => 'no action']);
    exit;
}
function json($d)
{
    echo json_encode($d);
    exit;
}

/** Helpers **/
function getColumns(PDO $pdo, $table)
{
    $sql = "SELECT COLUMN_NAME, DATA_TYPE, COLUMN_TYPE, IS_NULLABLE, COLUMN_KEY, EXTRA
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :table
            ORDER BY ORDINAL_POSITION";
    $stmt = $pdo->prepare($sql);
    $stmt->execute(['table' => $table]);
    $cols = $stmt->fetchAll();
    // detect file-like columns
    foreach ($cols as &$c) {
        $name = $c['COLUMN_NAME'];
        $dt = strtolower($c['DATA_TYPE']);
        $ct = strtolower($c['COLUMN_TYPE']);
        $c['is_file'] = (strpos($name, 'image') !== false || strpos($name, 'file') !== false || in_array($dt, ['blob', 'longblob', 'mediumblob']) || strpos($ct, 'varbinary') !== false);
    }
    return $cols;
}
function getLabel(PDO $pdo, $table, $column)
{
    $stmt = $pdo->prepare("SELECT label_text FROM cms_field_labels WHERE table_name = :t AND column_name = :c");
    $stmt->execute(['t' => $table, 'c' => $column]);
    $r = $stmt->fetchColumn();
    return $r ?: $column;
}
function getPrimaryKey(PDO $pdo, $table)
{
    $stmt = $pdo->prepare("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :t AND COLUMN_KEY = 'PRI' LIMIT 1");
    $stmt->execute(['t' => $table]);
    $col = $stmt->fetchColumn();
    return $col ?: null;
}
function isImageExtension($filename)
{
    $ext = strtolower(pathinfo($filename, PATHINFO_EXTENSION));
    return in_array($ext, ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg']);
}
function sanitizeFilename($name)
{
    $name = preg_replace('/[^A-Za-z0-9\-\_\.]/', '_', $name);
    return $name;
}

/** Actions **/

// --- AUTH ---
session_start();
if ($action === 'login') {
    $data = json_decode(file_get_contents('php://input'), true);
    $username = $data['username'] ?? '';
    $password = $data['password'] ?? '';
    $stmt = $pdo->prepare("SELECT * FROM users WHERE username = :u LIMIT 1");
    $stmt->execute(['u' => $username]);
    $user = $stmt->fetch();
    $loginOk = false;
    if ($user) {
        // Önce bcrypt ile kontrol et
        if (password_verify($password, $user['password'])) {
            $loginOk = true;
        } else {
            // Eski MD5 ile kayıtlı ise (geriye dönük uyumluluk)
            if ($user['password'] === md5($password)) {
                $loginOk = true;
            }
        }
    }
    if ($loginOk) {
        $role = $user['role'];
        if ($role === 'admin' || $role === 'editor') {
            $role = $role === 'admin' ? 'yonetici' : 'standart';
        }
        $_SESSION['user'] = [
            'id' => $user['id'],
            'username' => $user['username'],
            'role' => $role
        ];
        json(['ok' => true, 'user' => $_SESSION['user']]);
    } else {
        json(['error' => 'Giriş başarısız']);
    }
}
if ($action === 'logout') {
    session_destroy();
    json(['ok' => true]);
}
if (!in_array($action, ['login', 'logout']) && !isset($_SESSION['user'])) {
    http_response_code(401);
    json(['error' => 'Giriş gerekli']);
}

switch ($action) {
    case 'remove_file':
        // Dosya veya resim alanını anlık siler
        $table = $_POST['table'] ?? null;
        $pkRaw = $_POST['pk'] ?? null;
        $column = $_POST['column'] ?? null;
        if (!$table || !$pkRaw || !$column) json(['error' => 'Eksik parametre']);
        $pk = is_string($pkRaw) && json_decode($pkRaw, true) ? json_decode($pkRaw, true) : $pkRaw;
        $pkCol = null;
        $pkVal = null;
        if (is_array($pk)) {
            $pkCol = array_keys($pk)[0];
            $pkVal = $pk[$pkCol];
        } else {
            $pkCol = getPrimaryKey($pdo, $table) ?? 'id';
            $pkVal = $pk;
        }
        // Eski dosya yolunu bul
        $sqlOld = "SELECT `$column` FROM `$table` WHERE `$pkCol` = :pk LIMIT 1";
        $stmtOld = $pdo->prepare($sqlOld);
        $stmtOld->execute(['pk' => $pkVal]);
        $oldPath = $stmtOld->fetchColumn();
        if ($oldPath) {
            $oldPathDecoded = urldecode($oldPath);
            $oldAbs = __DIR__ . '/' . $oldPathDecoded;
            if (file_exists($oldAbs) && is_file($oldAbs)) {
                @unlink($oldAbs);
            }
        }
        // DB'de alanı boşalt
        $sql = "UPDATE `$table` SET `$column` = '' WHERE `$pkCol` = :pk";
        $stmt = $pdo->prepare($sql);
        $stmt->execute(['pk' => $pkVal]);
        json(['ok' => true]);
        break;
    case 'list_tables':
        // Menü için cms_routes tablosu varsa onu kullan
        $tables = [];
        $routes = [];
        try {
            $stmt = $pdo->query("SELECT route_name, route_label, route_icon FROM cms_routes");
            while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) $routes[] = $row;
        } catch (Exception $e) {
            // fallback eski yöntem
            $stmt = $pdo->query("SHOW TABLES");
            while ($row = $stmt->fetch(PDO::FETCH_NUM)) $tables[] = $row[0];
        }
        if ($routes) {
            json(['routes' => $routes]);
        } else {
            json(['tables' => $tables]);
        }
        break;

    case 'get_columns':
        $table = $_GET['table'] ?? null;
        if (!$table) json(['error' => 'no table']);
        $cols = getColumns($pdo, $table);
        foreach ($cols as &$c) {
            $c['label'] = getLabel($pdo, $table, $c['COLUMN_NAME']);
        }
        $pk = getPrimaryKey($pdo, $table);
        json(['columns' => $cols, 'primary_key' => $pk]);
        break;

    case 'dropdown_tables':
        // Tabloları dropdown için
        $tables = [];
        $stmt = $pdo->query("SHOW TABLES");
        while ($row = $stmt->fetch(PDO::FETCH_NUM)) $tables[] = $row[0];
        json(['tables' => $tables]);
        break;

    case 'dropdown_columns':
        $table = $_GET['table'] ?? null;
        if (!$table) json(['error' => 'no table']);
        $cols = getColumns($pdo, $table);
        $colNames = array_map(fn($c) => $c['COLUMN_NAME'], $cols);
        json(['columns' => $colNames]);
        break;

    case 'save_label':
        $data = json_decode(file_get_contents('php://input'), true);
        $table = $data['table'] ?? null;
        $column = $data['column'] ?? null;
        $label = $data['label'] ?? null;
        if (!$table || !$column) json(['error' => 'missing']);
        $stmt = $pdo->prepare("INSERT INTO cms_field_labels (table_name, column_name, label_text) VALUES (:t,:c,:l) ON DUPLICATE KEY UPDATE label_text = :l2");
        $stmt->execute(['t' => $table, 'c' => $column, 'l' => $label, 'l2' => $label]);
        json(['ok' => true]);
        break;

    case 'list_records':
        $table = $_GET['table'] ?? null;
        if (!$table) json(['error' => 'no table']);
        $page = max(1, intval($_GET['page'] ?? 1));
        $per = max(1, intval($_GET['per'] ?? 50));
        $offset = ($page - 1) * $per;
        $search = trim($_GET['search'] ?? '');
        $dateFrom = $_GET['date_from'] ?? null;
        $dateTo = $_GET['date_to'] ?? null;
        $cols = getColumns($pdo, $table);
        $colNames = array_map(fn($c) => $c['COLUMN_NAME'], $cols);
        $colList = implode(', ', array_map(fn($c) => "`$c`", $colNames));
        $where = [];
        $params = [];
        if ($search) {
            $like = [];
            foreach ($colNames as $c) $like[] = "`$c` LIKE :search";
            $where[] = '(' . implode(' OR ', $like) . ')';
            $params['search'] = "%$search%";
        }
        // Tarih aralığı için created_at varsa
        if (in_array('created_at', $colNames)) {
            if ($dateFrom) {
                $where[] = "`created_at` >= :dateFrom";
                $params['dateFrom'] = $dateFrom;
            }
            if ($dateTo) {
                $where[] = "`created_at` <= :dateTo";
                $params['dateTo'] = $dateTo;
            }
        }
        $whereSql = $where ? ('WHERE ' . implode(' AND ', $where)) : '';
        $sql = "SELECT $colList FROM `$table` $whereSql LIMIT :off, :lim";
        $stmt = $pdo->prepare($sql);
        foreach ($params as $k => $v) $stmt->bindValue(":$k", $v);
        $stmt->bindValue(':off', $offset, PDO::PARAM_INT);
        $stmt->bindValue(':lim', $per, PDO::PARAM_INT);
        $stmt->execute();
        $rows = $stmt->fetchAll();
        // attach labels
        foreach ($cols as &$c) $c['label'] = getLabel($pdo, $table, $c['COLUMN_NAME']);
        $pk = getPrimaryKey($pdo, $table);
        // created_at alanını gizle
        $cols = array_filter($cols, fn($c) => $c['COLUMN_NAME'] !== 'created_at');
        foreach ($rows as &$row) unset($row['created_at']);
        // toplam kayıt sayısı
        $countSql = "SELECT COUNT(*) FROM `$table` $whereSql";
        $countStmt = $pdo->prepare($countSql);
        foreach ($params as $k => $v) $countStmt->bindValue(":$k", $v);
        $countStmt->execute();
        $total = $countStmt->fetchColumn();
        json(['cols' => array_values($cols), 'rows' => $rows, 'primary_key' => $pk, 'page' => $page, 'per' => $per, 'total' => $total]);
        break;

    case 'create_record':
        // accept form-data with possible files or JSON
        $table = $_POST['table'] ?? ($_GET['table'] ?? null);
        if (!$table) json(['error' => 'no table']);
        $colsDef = getColumns($pdo, $table);
        $payload = [];
        // gather fields from $_POST
        foreach ($_POST as $k => $v) {
            if ($k !== 'table') {
                // Eğer tablo users ve alan password ise, bcrypt ile hashle
                if ($table === 'users' && $k === 'password' && !empty($v)) {
                    $payload[$k] = password_hash($v, PASSWORD_BCRYPT);
                } else {
                    $payload[$k] = $v;
                }
            }
        }
        // handle files
        if (!empty($_FILES)) {
            $uploadDir = __DIR__ . '/uploads/' . $table . '/';
            if (!is_dir($uploadDir)) mkdir($uploadDir, 0755, true);
            foreach ($_FILES as $fieldName => $fileInfo) {
                if ($fileInfo['error'] === UPLOAD_ERR_NO_FILE) {
                    continue;
                }
                if ($fileInfo['error'] !== UPLOAD_ERR_OK) json(['error' => "upload error for $fieldName"]);
                $orig = basename($fileInfo['name']);
                $safe = time() . '_' . sanitizeFilename($orig);
                $dest = $uploadDir . $safe;
                if (!move_uploaded_file($fileInfo['tmp_name'], $dest)) json(['error' => "move failed for $fieldName"]);
                // store relative path
                $payload[$fieldName] = 'uploads/' . rawurlencode($table) . '/' . rawurlencode($safe);
            }
        }
        if (count($payload) === 0) json(['error' => 'no payload']);
        $cols = array_keys($payload);
        $placeholders = array_map(fn($c) => ":$c", $cols);
        $sql = "INSERT INTO `$table` (`" . implode('`,`', $cols) . "`) VALUES (" . implode(',', $placeholders) . ")";
        $stmt = $pdo->prepare($sql);
        foreach ($payload as $k => $v) $stmt->bindValue(":$k", $v);
        $stmt->execute();
        json(['ok' => true, 'insert_id' => $pdo->lastInsertId()]);
        break;

    case 'update_record':
        // support form-data with files
        $table = $_POST['table'] ?? ($_GET['table'] ?? null);
        if (!$table) json(['error' => 'no table']);
        $pkRaw = $_POST['pk'] ?? null;
        if (!$pkRaw) json(['error' => 'no pk']);
        // pk may be JSON encoded if complex
        $pk = is_string($pkRaw) && json_decode($pkRaw, true) ? json_decode($pkRaw, true) : $pkRaw;
        $pkCol = null;
        $pkVal = null;
        if (is_array($pk)) {
            $pkCol = array_keys($pk)[0];
            $pkVal = $pk[$pkCol];
        } else {
            $pkCol = getPrimaryKey($pdo, $table) ?? 'id';
            $pkVal = $pk;
        }

        $payload = [];
        // fetch current row for old file paths (for remove logic)
        $oldRow = null;
        $oldRowFetched = false;
        foreach ($_POST as $k => $v) {
            if (in_array($k, ['table', 'pk'])) continue;
            // Kaldırma checkbox'u ise
            if (strpos($k, 'remove_') === 0 && $v == '1') {
                $field = substr($k, 7);
                // ilk seferde eski satırı çek
                if (!$oldRowFetched) {
                    $sqlOld = "SELECT * FROM `$table` WHERE `$pkCol` = :pk LIMIT 1";
                    $stmtOld = $pdo->prepare($sqlOld);
                    $stmtOld->execute(['pk' => $pkVal]);
                    $oldRow = $stmtOld->fetch(PDO::FETCH_ASSOC);
                    $oldRowFetched = true;
                }
                if (!empty($oldRow[$field])) {
                    $oldPath = $oldRow[$field];
                    $oldPathDecoded = urldecode($oldPath);
                    $oldAbs = __DIR__ . '/' . $oldPathDecoded;
                    if (file_exists($oldAbs) && is_file($oldAbs)) {
                        @unlink($oldAbs);
                    }
                }
                $payload[$field] = '';
                continue;
            }
            // Eğer tablo users ve alan password ise
            if ($table === 'users' && $k === 'password') {
                if (!empty($v)) {
                    $payload[$k] = password_hash($v, PASSWORD_BCRYPT);
                }
                // Boşsa güncelleme yapma
            } else if (strpos($k, 'remove_') !== 0) {
                $payload[$k] = $v;
            }
        }

        // handle files and delete old file if new uploaded
        if (!empty($_FILES)) {
            $uploadDir = __DIR__ . '/uploads/' . $table . '/';
            if (!is_dir($uploadDir)) mkdir($uploadDir, 0755, true);
            // fetch current row for old file paths
            $sqlOld = "SELECT * FROM `$table` WHERE `$pkCol` = :pk LIMIT 1";
            $stmtOld = $pdo->prepare($sqlOld);
            $stmtOld->execute(['pk' => $pkVal]);
            $oldRow = $stmtOld->fetch(PDO::FETCH_ASSOC);
            foreach ($_FILES as $fieldName => $fileInfo) {
                if ($fileInfo['error'] === UPLOAD_ERR_NO_FILE) continue;
                if ($fileInfo['error'] !== UPLOAD_ERR_OK) json(['error' => "upload error for $fieldName"]);
                $orig = basename($fileInfo['name']);
                $safe = time() . '_' . sanitizeFilename($orig);
                $dest = $uploadDir . $safe;
                if (!move_uploaded_file($fileInfo['tmp_name'], $dest)) json(['error' => "move failed for $fieldName"]);
                $payload[$fieldName] = 'uploads/' . rawurlencode($table) . '/' . rawurlencode($safe);
                // Eski dosyayı sil
                if (!empty($oldRow[$fieldName])) {
                    $oldPath = $oldRow[$fieldName];
                    $oldPathDecoded = urldecode($oldPath);
                    $oldAbs = __DIR__ . '/' . $oldPathDecoded;
                    if (file_exists($oldAbs) && is_file($oldAbs)) {
                        @unlink($oldAbs);
                    }
                }
            }
        }
        if (count($payload) === 0) json(['error' => 'no payload']);
        $sets = [];
        foreach ($payload as $k => $v) $sets[] = "`$k` = :$k";
        $sql = "UPDATE `$table` SET " . implode(',', $sets) . " WHERE `$pkCol` = :__pk";
        $stmt = $pdo->prepare($sql);
        foreach ($payload as $k => $v) $stmt->bindValue(":$k", $v);
        $stmt->bindValue(':__pk', $pkVal);
        $stmt->execute();
        json(['ok' => true, 'rows_affected' => $stmt->rowCount()]);
        break;

    case 'delete_record':
        $data = json_decode(file_get_contents('php://input'), true);
        $table = $data['table'] ?? null;
        $pk = $data['pk'] ?? null;
        if (!$table || !$pk) json(['error' => 'no table or pk']);
        if (is_array($pk)) {
            $pkCol = array_keys($pk)[0];
            $pkVal = $pk[$pkCol];
        } else {
            $pkCol = getPrimaryKey($pdo, $table) ?? 'id';
            $pkVal = $pk;
        }
        $stmt = $pdo->prepare("DELETE FROM `$table` WHERE `$pkCol` = :val");
        $stmt->execute(['val' => $pkVal]);
        json(['ok' => true, 'deleted' => $stmt->rowCount()]);
        break;

    case 'update_profile':
        if (!isset($_SESSION['user'])) json(['error' => 'Giriş gerekli']);
        $userId = $_SESSION['user']['id'];
        $data = json_decode(file_get_contents('php://input'), true);
        $newPass = $data['password'] ?? '';
        $newUsername = trim($data['username'] ?? '');
        $updates = [];
        $params = ['id' => $userId];
        if ($newUsername) {
            $updates[] = 'username = :u';
            $params['u'] = $newUsername;
        }
        if ($newPass !== '') {
            $updates[] = 'password = :p';
            $params['p'] = password_hash($newPass, PASSWORD_BCRYPT);
        }
        if ($updates) {
            $sql = "UPDATE users SET " . implode(',', $updates) . " WHERE id = :id";
            $stmt = $pdo->prepare($sql);
            $stmt->execute($params);
        }
        // Güncellenen kullanıcıyı tekrar döndür
        $stmt = $pdo->prepare("SELECT username FROM users WHERE id = :id");
        $stmt->execute(['id' => $userId]);
        $user = $stmt->fetch(PDO::FETCH_ASSOC);
        json(['ok' => true, 'user' => $user]);
        break;
    case 'whoami':
        if (isset($_SESSION['user'])) {
            json(['ok' => true, 'user' => $_SESSION['user']]);
        } else {
            json(['ok' => false]);
        }
        break;
    default:
        json(['error' => 'unknown action']);
}
