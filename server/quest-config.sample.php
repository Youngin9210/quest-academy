<?php
// Copy to quest-config.php in the folder ABOVE public_html (never inside it), then fill in.
return [
  // From Site Tools > Site > MySQL. Host is usually localhost.
  'dsn' => 'mysql:host=localhost;dbname=YOUR_DATABASE_NAME;charset=utf8mb4',
  'db_user' => 'YOUR_DATABASE_USER',
  'db_pass' => 'YOUR_DATABASE_PASSWORD',
  // Optional, only used once: devices set up with the old single family code are moved into the site
  // owner's family account, which signs in with this name and the old code as its password.
  'family_passcode' => '',
  'admin_family_name' => 'Our Family',
];
