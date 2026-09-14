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
header('Cache-Control: no-store, no-cache, must-revalidate');
header('Pragma: no-cache');
?>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>In-Out Management · Don Bosco College Tura</title>
  <link rel="stylesheet" href="assets/css/dbc-login.css?v=wave3">
</head>
<body class="dbc-login">
  <div class="shell">
    <section class="hero">
      <div class="hero-top">
        <img src="assets/img/dbc-crest.png" alt="Don Bosco College Tura">
        <div>
          <strong>Don Bosco College</strong>
          <span>Tura, Meghalaya</span>
          <em>Learn · Serve · Lead</em>
        </div>
      </div>
      <p class="kicker">Welcome to</p>
      <h1>In-Out Management<br><b>System</b></h1>
      <p class="lead">A safer campus. A smarter tomorrow.</p>
      <div class="feats">
        <div><strong>Secure Access</strong><small>Controlled and reliable</small></div>
        <div><strong>Real-time Tracking</strong><small>Stay informed always</small></div>
        <div><strong>Visitor Management</strong><small>Safe and organised</small></div>
        <div><strong>Accurate Logs</strong><small>Data you can trust</small></div>
      </div>
      <blockquote>“Education is a matter of the heart.”<small>— Don Bosco</small></blockquote>
      <ul class="values">
        <li>Discipline today</li>
        <li>Community always</li>
        <li>Brighter tomorrow</li>
      </ul>
    </section>

    <section class="panel">
      <p class="script">Good People<br>Build Better Tomorrows</p>
      <img class="mark" src="assets/img/don-bosco.png" alt="">
      <div class="card">
        <div class="avatar" aria-hidden="true"></div>
        <h2>Welcome Back</h2>
        <p class="sub">Sign in to access the In-Out Management System</p>
        <?php if ($alert !== '') { ?>
          <p class="banner"><?php echo $h($alert); ?></p>
        <?php } ?>
        <form method="post" action="login_verify.php">
          <label>
            <span>Username</span>
            <input type="text" name="name" autocomplete="username" autofocus required placeholder="Enter your username">
          </label>
          <label>
            <span>Password</span>
            <input type="password" name="pass" autocomplete="current-password" required placeholder="Enter your password">
          </label>
          <label>
            <span>Select Location</span>
            <select name="loc" required>
              <option value="" disabled selected>Select Location</option>
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
          <div class="meta">
            <label class="chk"><input type="checkbox" name="remember"> Remember me</label>
            <a href="mailto:library@donboscocollege.ac.in">Forgot password?</a>
          </div>
          <button type="submit" name="submit" value="Login">Login →</button>
        </form>
        <p class="foot">Secure · Reliable · For a Better Campus</p>
      </div>
    </section>
  </div>
  <footer>
    © <?php echo date('Y'); ?> Don Bosco College, Tura | In-Out Management System
    <a href="https://koha.donboscocollege.ac.in/">Library catalogue</a>
  </footer>
</body>
</html>
