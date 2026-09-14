<?php
include './functions/dbconn.php';
date_default_timezone_set('Asia/Kolkata');
$msg = $_GET['msg'] ?? null;
$alert = '';
if ($msg === '1') {
  $alert = 'Wrong username or password.';
} elseif ($msg === '2') {
  $alert = 'You have been signed out.';
} elseif ($msg === '3') {
  $alert = 'This user is deactivated. Contact the library desk.';
}
$h = static fn($v) => htmlspecialchars((string) ($v ?? ''), ENT_QUOTES, 'UTF-8');
?>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>In-Out Management · Don Bosco College Tura</title>
  <link rel="stylesheet" href="assets/css/dbc-login.css">
</head>
<body class="dbc-login">
  <header class="login-top">
    <img src="assets/img/dbc-crest.png" alt="Don Bosco College Tura">
    <div>
      <strong>Don Bosco College</strong>
      <span>Tura, Meghalaya · Library In-Out</span>
    </div>
  </header>

  <main class="login-wrap">
    <div class="login-card">
      <h1>Sign in</h1>
      <p class="sub">In-Out Management System</p>
      <?php if ($alert !== '') { ?>
        <p class="banner"><?php echo $h($alert); ?></p>
      <?php } ?>
      <form method="post" action="login_verify.php">
        <label>
          <span>Username</span>
          <input type="text" name="name" autocomplete="username" autofocus required>
        </label>
        <label>
          <span>Password</span>
          <input type="password" name="pass" autocomplete="current-password" required>
        </label>
        <label>
          <span>Location</span>
          <select name="loc" required>
            <option value="" disabled selected>Select location</option>
            <?php
            if ($conn) {
              $res = mysqli_query($conn, 'SELECT * FROM loc');
              if ($res) {
                while ($row = mysqli_fetch_array($res)) {
                  echo '<option>' . $h($row[1]) . '</option>';
                }
              }
            }
            ?>
            <option value="Master">Master</option>
          </select>
        </label>
        <button type="submit" name="submit" value="Login">Login</button>
      </form>
      <p class="help">Need help? <a href="mailto:library@donboscocollege.ac.in">library@donboscocollege.ac.in</a></p>
    </div>
  </main>

  <footer>
    © <?php echo date('Y'); ?> Don Bosco College, Tura
    · <a href="https://koha.donboscocollege.ac.in/">Library catalogue</a>
  </footer>
</body>
</html>
