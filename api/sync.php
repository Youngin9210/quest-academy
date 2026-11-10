<?php
/*
 * Quest Academy accounts + sync.
 * - Each family has its own account (name + password). Families never see each other.
 * - New families can only sign up with a one-time invite link made by the site owner's family.
 * - Each device signs in once and gets its own token; progress syncs per family.
 * Settings (database) live in quest-config.php, OUTSIDE the public folder. See server/quest-config.sample.php.
 */
declare(strict_types=1);
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Robots-Tag: noindex, nofollow');

function out(int $code, array $body): void { http_response_code($code); echo json_encode($body); exit; }
function now_ms(): int { return (int) round(microtime(true) * 1000); }
function rnd_hex(int $bytes): string { return bin2hex(random_bytes($bytes)); }
function words_code(): string {   // easy to write down: 4 groups of 4 letters/numbers, no look-alikes
  $abc = 'abcdefghjkmnpqrstuvwxyz23456789'; $g = [];
  for ($i = 0; $i < 4; $i++) { $s = ''; for ($j = 0; $j < 4; $j++) $s .= $abc[random_int(0, strlen($abc) - 1)]; $g[] = $s; }
  return implode('-', $g);
}
function name_key(string $n): string { return mb_strtolower(preg_replace('/\s+/', ' ', trim($n))); }

// One level above the site's public folder (public_html/api/ -> ../../). QUEST_CONFIG is for local testing only.
$configPaths = array_filter([getenv('QUEST_CONFIG') ?: null, __DIR__ . '/../../quest-config.php']);
$cfg = null;
foreach ($configPaths as $p) { if (is_file($p)) { $cfg = require $p; break; } }
if (!is_array($cfg) || empty($cfg['dsn'])) out(500, ['error' => 'Server is not set up yet (quest-config.php missing).']);

try {
  $db = new PDO($cfg['dsn'], $cfg['db_user'] ?? null, $cfg['db_pass'] ?? null, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
} catch (Throwable $e) { out(500, ['error' => 'Database connection failed.']); }
$sqlite = str_starts_with($cfg['dsn'], 'sqlite');
$AI = $sqlite ? 'INTEGER PRIMARY KEY AUTOINCREMENT' : 'INT AUTO_INCREMENT PRIMARY KEY';

/* ---------- tables (created / upgraded automatically) ---------- */
$db->exec("CREATE TABLE IF NOT EXISTS qa_families (id $AI, name VARCHAR(60) NOT NULL, name_key VARCHAR(60) NOT NULL UNIQUE,
  pass_hash VARCHAR(255) NOT NULL, recovery_hash VARCHAR(255) NOT NULL, is_admin TINYINT NOT NULL DEFAULT 0, created BIGINT NOT NULL)");
$db->exec('CREATE TABLE IF NOT EXISTS qa_tokens (token_hash CHAR(64) PRIMARY KEY, family_id INT NOT NULL, created BIGINT NOT NULL, last_used BIGINT NOT NULL)');
$db->exec('CREATE TABLE IF NOT EXISTS qa_invites (code_hash CHAR(64) PRIMARY KEY, created_by INT NOT NULL, created BIGINT NOT NULL, expires BIGINT NOT NULL, used_by INT NULL)');
$db->exec('CREATE TABLE IF NOT EXISTS qa_attempts (ip VARCHAR(64) NOT NULL, at BIGINT NOT NULL)');
$db->exec('CREATE TABLE IF NOT EXISTS qa_players (family_id INT NOT NULL DEFAULT 0, id VARCHAR(64) NOT NULL, data MEDIUMTEXT NOT NULL,
  updated BIGINT NOT NULL, deleted TINYINT NOT NULL DEFAULT 0, PRIMARY KEY (family_id, id))');
// Upgrade the first version of qa_players (one shared family, keyed by id only)
$cols = $sqlite ? array_column($db->query('PRAGMA table_info(qa_players)')->fetchAll(PDO::FETCH_ASSOC), 'name')
                : array_column($db->query('SHOW COLUMNS FROM qa_players')->fetchAll(PDO::FETCH_ASSOC), 'Field');
if (!in_array('family_id', $cols, true)) {
  if ($sqlite) {
    $db->exec('ALTER TABLE qa_players RENAME TO qa_players_old');
    $db->exec('CREATE TABLE qa_players (family_id INT NOT NULL DEFAULT 0, id VARCHAR(64) NOT NULL, data MEDIUMTEXT NOT NULL, updated BIGINT NOT NULL, deleted TINYINT NOT NULL DEFAULT 0, PRIMARY KEY (family_id, id))');
    $db->exec('INSERT INTO qa_players (family_id, id, data, updated, deleted) SELECT 0, id, data, updated, deleted FROM qa_players_old');
    $db->exec('DROP TABLE qa_players_old');
  } else {
    $db->exec('ALTER TABLE qa_players ADD COLUMN family_id INT NOT NULL DEFAULT 0 FIRST, DROP PRIMARY KEY, ADD PRIMARY KEY (family_id, id)');
  }
}

/* ---------- request + rate limiting ---------- */
if ($_SERVER['REQUEST_METHOD'] !== 'POST') out(405, ['error' => 'POST only']);
$ip = substr($_SERVER['REMOTE_ADDR'] ?? 'unknown', 0, 64);
$now = now_ms();
$db->prepare('DELETE FROM qa_attempts WHERE at < ?')->execute([$now - 15 * 60 * 1000]);
function too_many(PDO $db, string $ip): bool { $q = $db->prepare('SELECT COUNT(*) FROM qa_attempts WHERE ip = ?'); $q->execute([$ip]); return (int) $q->fetchColumn() >= 10; }
function fail(PDO $db, string $ip, int $now, string $msg, int $code = 403): void { $db->prepare('INSERT INTO qa_attempts (ip, at) VALUES (?, ?)')->execute([$ip, $now]); out($code, ['error' => $msg]); }
if (too_many($db, $ip)) out(429, ['error' => 'Too many tries. Wait 15 minutes and try again.']);

$raw = file_get_contents('php://input');
if (strlen($raw) > 5_000_000) out(413, ['error' => 'Too big']);
$req = json_decode($raw, true);
if (!is_array($req)) out(400, ['error' => 'Bad request']);
$action = (string) ($req['action'] ?? '');

function new_token(PDO $db, int $familyId, int $now): string {
  $t = rnd_hex(32);
  $db->prepare('INSERT INTO qa_tokens (token_hash, family_id, created, last_used) VALUES (?, ?, ?, ?)')->execute([hash('sha256', $t), $familyId, $now, $now]);
  return $t;
}
function family_by_name(PDO $db, string $name): ?array {
  $q = $db->prepare('SELECT * FROM qa_families WHERE name_key = ?'); $q->execute([name_key($name)]);
  $r = $q->fetch(PDO::FETCH_ASSOC); return $r ?: null;
}
function me_info(array $f): array { return ['family' => $f['name'], 'admin' => (bool) $f['is_admin']]; }
function valid_name(string $n): bool { $n = trim($n); return mb_strlen($n) >= 2 && mb_strlen($n) <= 40; }
function valid_pass(string $p): bool { return mb_strlen($p) >= 8 && mb_strlen($p) <= 200; }

/* ---------- actions that don't need a signed-in device ---------- */

// Sign in on a device: family name + password
if ($action === 'login') {
  $f = family_by_name($db, (string) ($req['family'] ?? ''));
  // First ever sign-in: no families yet + the owner's code from quest-config.php creates the owner account
  $noFamilies = (int) $db->query('SELECT COUNT(*) FROM qa_families')->fetchColumn() === 0;
  if (!$f && $noFamilies && !empty($cfg['family_passcode']) && hash_equals((string) $cfg['family_passcode'], (string) ($req['password'] ?? ''))) {
    $name = trim((string) ($req['family'] ?? ''));
    if (!valid_name($name)) out(400, ['error' => 'Family name must be 2 to 40 characters.']);
    $recovery = words_code();
    $db->prepare('INSERT INTO qa_families (name, name_key, pass_hash, recovery_hash, is_admin, created) VALUES (?, ?, ?, ?, 1, ?)')
      ->execute([$name, name_key($name), password_hash((string) $req['password'], PASSWORD_DEFAULT), password_hash($recovery, PASSWORD_DEFAULT), $now]);
    $fid = (int) $db->lastInsertId();
    $db->prepare('UPDATE qa_players SET family_id = ? WHERE family_id = 0')->execute([$fid]);
    $f = $db->query("SELECT * FROM qa_families WHERE id = $fid")->fetch(PDO::FETCH_ASSOC);
    out(200, ['token' => new_token($db, $fid, $now), 'recovery' => $recovery] + me_info($f));
  }
  if (!$f || !password_verify((string) ($req['password'] ?? ''), $f['pass_hash'])) fail($db, $ip, $now, 'Family name or password is wrong.');
  out(200, ['token' => new_token($db, (int) $f['id'], $now)] + me_info($f));
}

// One-time upgrade from the first version (single family code in quest-config.php)
if ($action === 'legacy') {
  $code = (string) ($req['passcode'] ?? '');
  if (empty($cfg['family_passcode']) || !hash_equals((string) $cfg['family_passcode'], $code)) fail($db, $ip, $now, 'Please sign in with your family name and password.');
  $q = $db->query('SELECT * FROM qa_families WHERE is_admin = 1 ORDER BY id LIMIT 1'); $f = $q->fetch(PDO::FETCH_ASSOC);
  $recovery = null;
  if (!$f) {
    $name = trim((string) ($cfg['admin_family_name'] ?? 'Our Family')) ?: 'Our Family';
    $recovery = words_code();
    $db->prepare('INSERT INTO qa_families (name, name_key, pass_hash, recovery_hash, is_admin, created) VALUES (?, ?, ?, ?, 1, ?)')
      ->execute([$name, name_key($name), password_hash($code, PASSWORD_DEFAULT), password_hash($recovery, PASSWORD_DEFAULT), $now]);
    $fid = (int) $db->lastInsertId();
    $db->prepare('UPDATE qa_players SET family_id = ? WHERE family_id = 0')->execute([$fid]);
    $f = $db->query("SELECT * FROM qa_families WHERE id = $fid")->fetch(PDO::FETCH_ASSOC);
  }
  out(200, ['token' => new_token($db, (int) $f['id'], $now), 'recovery' => $recovery] + me_info($f));
}

// Is this invite link still good? (so the app can show the sign-up form)
if ($action === 'invite_check' || $action === 'signup') {
  $ch = hash('sha256', (string) ($req['invite'] ?? ''));
  $q = $db->prepare('SELECT * FROM qa_invites WHERE code_hash = ?'); $q->execute([$ch]); $inv = $q->fetch(PDO::FETCH_ASSOC);
  if (!$inv || $inv['used_by'] !== null || (int) $inv['expires'] < $now) fail($db, $ip, $now, 'This invite link has expired or was already used. Ask for a new one.');
  if ($action === 'invite_check') out(200, ['ok' => true]);
  $name = trim((string) ($req['family'] ?? '')); $pass = (string) ($req['password'] ?? '');
  if (!valid_name($name)) out(400, ['error' => 'Family name must be 2 to 40 characters.']);
  if (!valid_pass($pass)) out(400, ['error' => 'Password must be at least 8 characters.']);
  if (family_by_name($db, $name)) out(409, ['error' => 'That family name is taken. Try adding something, like your last name.']);
  $recovery = words_code();
  $db->beginTransaction();
  $db->prepare('INSERT INTO qa_families (name, name_key, pass_hash, recovery_hash, is_admin, created) VALUES (?, ?, ?, ?, 0, ?)')
    ->execute([$name, name_key($name), password_hash($pass, PASSWORD_DEFAULT), password_hash($recovery, PASSWORD_DEFAULT), $now]);
  $fid = (int) $db->lastInsertId();
  $db->prepare('UPDATE qa_invites SET used_by = ? WHERE code_hash = ?')->execute([$fid, $ch]);
  $db->commit();
  $f = $db->query("SELECT * FROM qa_families WHERE id = $fid")->fetch(PDO::FETCH_ASSOC);
  out(200, ['token' => new_token($db, $fid, $now), 'recovery' => $recovery] + me_info($f));
}

// Forgot password: family name + recovery code -> new password (signs out all other devices)
if ($action === 'recover') {
  $f = family_by_name($db, (string) ($req['family'] ?? ''));
  $pass = (string) ($req['password'] ?? '');
  if (!$f || !password_verify(strtolower(trim((string) ($req['recovery'] ?? ''))), $f['recovery_hash'])) fail($db, $ip, $now, 'Family name or recovery code is wrong.');
  if (!valid_pass($pass)) out(400, ['error' => 'Password must be at least 8 characters.']);
  $db->prepare('UPDATE qa_families SET pass_hash = ? WHERE id = ?')->execute([password_hash($pass, PASSWORD_DEFAULT), $f['id']]);
  $db->prepare('DELETE FROM qa_tokens WHERE family_id = ?')->execute([$f['id']]);
  out(200, ['token' => new_token($db, (int) $f['id'], $now)] + me_info($f));
}

/* ---------- everything else needs a signed-in device ---------- */
$q = $db->prepare('SELECT f.* FROM qa_tokens t JOIN qa_families f ON f.id = t.family_id WHERE t.token_hash = ?');
$tokenHash = hash('sha256', (string) ($req['token'] ?? ''));
$q->execute([$tokenHash]);
$fam = $q->fetch(PDO::FETCH_ASSOC);
if (!$fam) fail($db, $ip, $now, 'Signed out. Please sign in again.', 401);
$fid = (int) $fam['id'];
$db->prepare('UPDATE qa_tokens SET last_used = ? WHERE token_hash = ?')->execute([$now, $tokenHash]);

if ($action === 'me') out(200, me_info($fam));

// Unlock the grown-ups page on a signed-in device
if ($action === 'verify') {
  if (!password_verify((string) ($req['password'] ?? ''), $fam['pass_hash'])) fail($db, $ip, $now, 'That password is not right.');
  out(200, ['ok' => true]);
}

if ($action === 'logout') { $db->prepare('DELETE FROM qa_tokens WHERE token_hash = ?')->execute([$tokenHash]); out(200, ['ok' => true]); }

if ($action === 'change_password') {
  if (!password_verify((string) ($req['old'] ?? ''), $fam['pass_hash'])) fail($db, $ip, $now, 'Current password is wrong.');
  if (!valid_pass((string) ($req['password'] ?? ''))) out(400, ['error' => 'Password must be at least 8 characters.']);
  $db->prepare('UPDATE qa_families SET pass_hash = ? WHERE id = ?')->execute([password_hash((string) $req['password'], PASSWORD_DEFAULT), $fid]);
  out(200, ['ok' => true]);
}

if ($action === 'rename') {
  $name = trim((string) ($req['family'] ?? ''));
  if (!valid_name($name)) out(400, ['error' => 'Family name must be 2 to 40 characters.']);
  $other = family_by_name($db, $name);
  if ($other && (int) $other['id'] !== $fid) out(409, ['error' => 'That family name is taken.']);
  $db->prepare('UPDATE qa_families SET name = ?, name_key = ? WHERE id = ?')->execute([$name, name_key($name), $fid]);
  out(200, ['family' => $name, 'admin' => (bool) $fam['is_admin']]);
}

if ($action === 'new_recovery') {   // show a fresh recovery code (needs the password)
  if (!password_verify((string) ($req['password'] ?? ''), $fam['pass_hash'])) fail($db, $ip, $now, 'Password is wrong.');
  $recovery = words_code();
  $db->prepare('UPDATE qa_families SET recovery_hash = ? WHERE id = ?')->execute([password_hash($recovery, PASSWORD_DEFAULT), $fid]);
  out(200, ['recovery' => $recovery]);
}

/* ----- site owner only ----- */
if ($action === 'invite' || $action === 'admin_reset') {
  if (!$fam['is_admin']) out(403, ['error' => 'Only the site owner can do that.']);
  if ($action === 'invite') {
    $code = rnd_hex(16);
    $db->prepare('INSERT INTO qa_invites (code_hash, created_by, created, expires) VALUES (?, ?, ?, ?)')
      ->execute([hash('sha256', $code), $fid, $now, $now + 14 * 24 * 3600 * 1000]);
    out(200, ['invite' => $code, 'expires_days' => 14]);
  }
  // Reset another family's password when they're locked out. Only their name is needed; no data is shown.
  $f = family_by_name($db, (string) ($req['family'] ?? ''));
  if (!$f || (int) $f['id'] === $fid) out(404, ['error' => 'No family with that name.']);
  $temp = words_code();
  $db->prepare('UPDATE qa_families SET pass_hash = ? WHERE id = ?')->execute([password_hash($temp, PASSWORD_DEFAULT), $f['id']]);
  $db->prepare('DELETE FROM qa_tokens WHERE family_id = ?')->execute([$f['id']]);
  out(200, ['family' => $f['name'], 'temp_password' => $temp]);
}

/* ----- sync (always limited to this family) ----- */
if ($action === 'pull') {
  $q = $db->prepare('SELECT id, data, updated, deleted FROM qa_players WHERE family_id = ? AND updated > ?');
  $q->execute([$fid, (int) ($req['since'] ?? 0)]);
  $players = [];
  foreach ($q->fetchAll(PDO::FETCH_ASSOC) as $r) {
    $players[] = ['id' => $r['id'], 'updated' => (int) $r['updated'], 'deleted' => (bool) $r['deleted'],
      'data' => $r['deleted'] ? null : json_decode($r['data'], true)];
  }
  out(200, ['players' => $players, 'now' => $now] + me_info($fam));
}

if ($action === 'push') {
  $saved = [];
  $sel = $db->prepare('SELECT updated FROM qa_players WHERE family_id = ? AND id = ?');
  $ins = $sqlite
    ? $db->prepare('INSERT OR REPLACE INTO qa_players (family_id, id, data, updated, deleted) VALUES (?, ?, ?, ?, ?)')
    : $db->prepare('INSERT INTO qa_players (family_id, id, data, updated, deleted) VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE data = VALUES(data), updated = VALUES(updated), deleted = VALUES(deleted)');
  $count = $db->prepare('SELECT COUNT(*) FROM qa_players WHERE family_id = ? AND deleted = 0'); $count->execute([$fid]);
  $existing = (int) $count->fetchColumn();
  foreach (array_slice($req['players'] ?? [], 0, 20) as $p) {
    $id = (string) ($p['id'] ?? '');
    if (!preg_match('/^[a-z0-9]{4,64}$/i', $id)) continue;
    $updated = (int) ($p['updated'] ?? 0);
    $sel->execute([$fid, $id]); $have = $sel->fetchColumn();
    if ($have !== false && (int) $have >= $updated) continue;   // already have something newer
    $deleted = !empty($p['deleted']);
    if ($have === false && !$deleted && ++$existing > 12) continue; // keep each family to a sensible size
    $ins->execute([$fid, $id, $deleted ? '{}' : json_encode($p['data'] ?? new stdClass()), $updated, $deleted ? 1 : 0]);
    $saved[] = $id;
  }
  out(200, ['saved' => $saved, 'now' => $now]);
}

out(400, ['error' => 'Unknown action']);
