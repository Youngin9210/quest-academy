<?php
/*
 * Quest Academy sync: stores each player's progress so every family device sees the same thing.
 * Settings (database + family passcode) live in quest-config.php, OUTSIDE the public folder.
 * See server/quest-config.sample.php.
 */
declare(strict_types=1);
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Robots-Tag: noindex, nofollow');

function out(int $code, array $body): void { http_response_code($code); echo json_encode($body); exit; }

// One level above the site's public folder (public_html/api/ -> ../../). QUEST_CONFIG is for local testing only.
$configPaths = array_filter([getenv('QUEST_CONFIG') ?: null, __DIR__ . '/../../quest-config.php']);
$cfg = null;
foreach ($configPaths as $p) { if (is_file($p)) { $cfg = require $p; break; } }
if (!is_array($cfg) || empty($cfg['family_passcode'])) out(500, ['error' => 'Server is not set up yet (quest-config.php missing).']);

try {
  $db = new PDO($cfg['dsn'], $cfg['db_user'] ?? null, $cfg['db_pass'] ?? null, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
} catch (Throwable $e) { out(500, ['error' => 'Database connection failed.']); }
$isSqlite = str_starts_with($cfg['dsn'], 'sqlite');
$db->exec('CREATE TABLE IF NOT EXISTS qa_players (id VARCHAR(64) PRIMARY KEY, data MEDIUMTEXT NOT NULL, updated BIGINT NOT NULL, deleted TINYINT NOT NULL DEFAULT 0)');
$db->exec('CREATE TABLE IF NOT EXISTS qa_attempts (ip VARCHAR(64) NOT NULL, at BIGINT NOT NULL)');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') out(405, ['error' => 'POST only']);

// Slow down passcode guessing: 10 wrong tries per 15 minutes per address.
$ip = substr($_SERVER['REMOTE_ADDR'] ?? 'unknown', 0, 64);
$now = (int) round(microtime(true) * 1000);
$db->prepare('DELETE FROM qa_attempts WHERE at < ?')->execute([$now - 15 * 60 * 1000]);
$q = $db->prepare('SELECT COUNT(*) FROM qa_attempts WHERE ip = ?'); $q->execute([$ip]);
if ((int) $q->fetchColumn() >= 10) out(429, ['error' => 'Too many tries. Wait 15 minutes.']);

$raw = file_get_contents('php://input');
if (strlen($raw) > 5_000_000) out(413, ['error' => 'Too big']);
$req = json_decode($raw, true);
if (!is_array($req)) out(400, ['error' => 'Bad request']);

if (!hash_equals((string) $cfg['family_passcode'], (string) ($req['passcode'] ?? ''))) {
  $db->prepare('INSERT INTO qa_attempts (ip, at) VALUES (?, ?)')->execute([$ip, $now]);
  out(403, ['error' => 'Wrong family code']);
}

$action = $req['action'] ?? '';
if ($action === 'check') out(200, ['ok' => true]);

if ($action === 'pull') {
  $since = (int) ($req['since'] ?? 0);
  $q = $db->prepare('SELECT id, data, updated, deleted FROM qa_players WHERE updated > ?');
  $q->execute([$since]);
  $players = [];
  foreach ($q->fetchAll(PDO::FETCH_ASSOC) as $r) {
    $players[] = ['id' => $r['id'], 'updated' => (int) $r['updated'], 'deleted' => (bool) $r['deleted'],
      'data' => $r['deleted'] ? null : json_decode($r['data'], true)];
  }
  out(200, ['players' => $players, 'now' => $now]);
}

if ($action === 'push') {
  $saved = [];
  $sel = $db->prepare('SELECT updated FROM qa_players WHERE id = ?');
  $ins = $isSqlite
    ? $db->prepare('INSERT OR REPLACE INTO qa_players (id, data, updated, deleted) VALUES (?, ?, ?, ?)')
    : $db->prepare('INSERT INTO qa_players (id, data, updated, deleted) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE data = VALUES(data), updated = VALUES(updated), deleted = VALUES(deleted)');
  foreach (array_slice($req['players'] ?? [], 0, 20) as $p) {
    $id = (string) ($p['id'] ?? '');
    if (!preg_match('/^[a-z0-9]{4,64}$/i', $id)) continue;
    $updated = (int) ($p['updated'] ?? 0);
    $sel->execute([$id]); $have = $sel->fetchColumn();
    if ($have !== false && (int) $have >= $updated) continue;   // server already has something newer
    $deleted = !empty($p['deleted']);
    $ins->execute([$id, $deleted ? '{}' : json_encode($p['data'] ?? new stdClass()), $updated, $deleted ? 1 : 0]);
    $saved[] = $id;
  }
  out(200, ['saved' => $saved, 'now' => $now]);
}

out(400, ['error' => 'Unknown action']);
