<?php
// Copy to quest-config.php in the folder ABOVE public_html (never inside it), then fill in.
return [
  // From Site Tools > Site > MySQL. Host is usually localhost.
  'dsn' => 'mysql:host=localhost;dbname=YOUR_DATABASE_NAME;charset=utf8mb4',
  'db_user' => 'YOUR_DATABASE_USER',
  'db_pass' => 'YOUR_DATABASE_PASSWORD',
  // The code each device enters once to join your family. Make it hard to guess.
  'family_passcode' => 'CHOOSE_A_FAMILY_CODE',
];
