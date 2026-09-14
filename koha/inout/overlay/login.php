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
  <div class="login-shell">
    <section class="login-hero" style="background-image:url('assets/img/campus.jpg')">
      <div class="login-hero-inner">
        <div class="login-brand">
          <img src="assets/img/dbc-crest.png" alt="Don Bosco College Tura">
          <div>
            <strong>Don Bosco College</strong>
            <span>Tura, Meghalaya</span>
            <em>Learn · Serve · Lead</em>
          </div>
        </div>
        <h1>In-Out Management<br><span>System</span></h1>
        <p class="lead">A safer campus. A smarter tomorrow.</p>
        <ul class="pills">
          <li>Secure Access</li>
          <li>Real-time Tracking</li>
          <li>Visitor Management</li>
          <li>Accurate Logs</li>
        </ul>
        <blockquote>“Education is a matter of the heart.”<small>— Don Bosco</small></blockquote>
      </div>
    </section>

    <section class="login-panel">
      <p class="script">Good People<br>Build Better Tomorrows</p>
      <img class="watermark" src="assets/img/don-bosco.png" alt="">
      <div class="login-card">
        <div class="avatar" aria-hidden="true"></div>
        <h2>Welcome Back</h2>
        <p class="sub">Sign in to access the In-Out Management System</p>
        <?php if ($alert !== '') { ?>
          <p class="banner"><?php echo $h($alert); ?></p>
        <?php } ?>
        <form method="post" action="login_verify.php">
          <label>
            <span>Username</span>
            <input type="text" name="name" autocomplete="username" autofocus required placeholder="Username">
          </label>
          <label>
            <span>Password</span>
            <input type="password" name="pass" autocomplete="current-password" required placeholder="Password">
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
          <div class="row-line">
            <label class="remember"><input type="checkbox" name="remember"> Remember me</label>
            <a class="forgot" href="mailto:library@donboscocollege.ac.in">Forgot password?</a>
          </div>
          <button type="submit" name="submit" value="Login">Login →</button>
        </form>
        <p class="secure">Secure · Reliable · For a Better Campus</p>
      </div>
      <p class="side-quote">“Presence Creates Possibilities.”</p>
    </section>
  </div>
  <footer>
    © <?php echo date('Y'); ?> Don Bosco College, Tura | In-Out Management System
    <span>
      <a href="https://koha.donboscocollege.ac.in/">Library catalogue</a>
      · <a href="mailto:library@donboscocollege.ac.in">Contact</a>
    </span>
  </footer>
</body>
</html>
