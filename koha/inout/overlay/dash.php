<?php
	include "./process/operations/main.php";
	include "./process/operations/stats.php";
	$title = "Gate Register";
	$acc_code = "U02";
	if(!isset($_SESSION['id']) && empty($_SESSION['id'])) {
   header("location:login.php");
	}
	require "./functions/access.php";
	require "functions/dbfunc.php";
  $h = static fn($v) => htmlspecialchars((string) ($v ?? ''), ENT_QUOTES, 'UTF-8');
  $lib = $_SESSION['lib'] ?? 'Don Bosco College Library';
  $locname = $_SESSION['locname'] ?? 'Library gate';
  $user = $_SESSION['user_name'] ?? 'Librarian';
  $entries = (int) ($visit[0] ?? 0);
  $exits = (int) ($tout[0] ?? 0);
  $inside = (int) ($tin[0] ?? 0);
  $visitors = (int) ($unique[0] ?? 0);
  $scans = $entries;
  $avg = $avgstay[0] ?? '00:00:00';
  $avg_mins = 0;
  if ($avg && $avg !== '00:00:00') {
    $p = explode(':', $avg);
    $avg_mins = ((int) $p[0] * 60) + (int) $p[1];
  }
  $show_card = isset($msg) && $msg !== null && $msg !== '';
  $photo = '';
  if (!empty($e_img)) {
    $photo = 'data:image/jpeg;base64,' . base64_encode($e_img);
  }
  $badge = 'SCAN READY';
  $badge_cls = 'ready';
  if ($msg === '1') { $badge = 'ENTRY ALLOWED'; $badge_cls = 'ok'; }
  if ($msg === '4') { $badge = 'CHECKED OUT'; $badge_cls = 'out'; }
  if ($msg === '3') { $badge = 'NOT FOUND / EXPIRED'; $badge_cls = 'bad'; }
  if ($msg === '2' || $msg === '5') { $badge = 'PLEASE WAIT'; $badge_cls = 'wait'; }
  $fee_label = ($e_fines > 0) ? 'OVERDUE' : 'None';
?>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Library In-Out · Don Bosco College</title>
  <link rel="stylesheet" href="assets/css/dbc-inout.css">
</head>
<body class="dbc-io">
  <aside class="io-side">
    <div class="io-brand">
      <img src="assets/img/dbc-logo.png" alt="">
      <div>
        <strong>Don Bosco College</strong>
        <span>Tura, Meghalaya</span>
      </div>
    </div>
    <form class="io-find" action="dash.php" method="get">
      <input name="id" placeholder="Search by name, USN or ID…" autocomplete="off">
    </form>
    <nav>
      <a class="is-on" href="dash.php">Dashboard</a>
      <a href="dash.php">Live Entry/Exit</a>
      <a href="today.php">Visitors Log</a>
      <a href="today.php">Students Inside</a>
      <a href="reports.php">Reports</a>
      <a href="notice.php">Alerts</a>
      <a href="setup.php">Settings</a>
    </nav>
    <p class="io-ql">Quick links</p>
    <nav>
      <a href="dash.php">Manual Entry</a>
      <a href="today.php">Student Search</a>
      <a href="today.php">Print Logs</a>
      <a href="reports.php">Export Reports</a>
    </nav>
    <blockquote>“A library is a gateway to a brighter tomorrow.”<small>— Don Bosco</small></blockquote>
  </aside>

  <div class="io-main">
    <header class="io-top">
      <div>
        <h1>Library In-Out Management System</h1>
        <p>Don Bosco College, Tura</p>
      </div>
      <div class="io-meta">
        <div id="io-clock"></div>
        <span class="online">System Online</span>
        <span class="who"><?php echo $h($user); ?><small>Gate operator</small></span>
        <a class="out" href="functions/signout.php">Sign out</a>
      </div>
    </header>
    <p class="io-script">Read · Learn · Grow · Belong</p>

    <section class="io-stats">
      <article class="s1"><em>Entries today (IN)</em><b><?php echo $entries; ?></b></article>
      <article class="s2"><em>Exits today (OUT)</em><b><?php echo $exits; ?></b></article>
      <article class="s3"><em>Currently inside</em><b><?php echo $inside; ?></b></article>
      <article class="s4"><em>Visitors today</em><b><?php echo $visitors; ?></b></article>
      <article class="s5"><em>Avg. stay time</em><b><?php echo $avg_mins; ?> mins</b></article>
      <article class="s6"><em>Total scans</em><b><?php echo $scans; ?></b></article>
    </section>

    <div class="io-grid">
      <section class="io-scan">
        <h2>Scan student ID card</h2>
        <p>Place the card in the scanner or type the card number / USN and press Enter.</p>
        <form action="dash.php" method="get" autocomplete="off">
          <input type="text" name="id" id="usn" autofocus placeholder="Scanner auto-capture · or type USN and press Enter">
          <button type="submit">Scan</button>
        </form>
        <p class="tip">Tip: you can also type the USN manually and press Enter.</p>

        <?php if ($show_card) { ?>
        <div class="patron <?php echo $h($badge_cls); ?>">
          <div class="patron-top">
            <?php if ($photo) { ?>
              <img src="<?php echo $photo; ?>" alt="">
            <?php } else { ?>
              <div class="ph"><?php echo $h(strtoupper(substr((string) $e_name, 0, 1))); ?></div>
            <?php } ?>
            <div>
              <span class="badge"><?php echo $h($badge); ?></span>
              <h3><?php echo $h(trim((string) $e_name) ?: 'Unknown patron'); ?></h3>
              <p class="usn"><?php echo $h($usn ?? ''); ?></p>
            </div>
          </div>
          <div class="patron-grid">
            <div><label>Category</label><span><?php echo $h($e_category ?: '—'); ?></span></div>
            <div><label>Library</label><span><?php echo $h($e_branch ?: '—'); ?></span></div>
            <div><label>Extra 1</label><span><?php echo $h($e_sort1 ?: '—'); ?></span></div>
            <div><label>Mobile</label><span><?php echo $h($e_mobile ?: '—'); ?></span></div>
            <div><label><?php echo $d_status === 'OUT' ? 'Exit time' : 'Entry time'; ?></label><span><?php echo $h($time1); ?></span></div>
            <div><label>Username</label><span><?php echo $h($e_userid ?: '—'); ?></span></div>
          </div>
          <div class="chips">
            <div><label>Membership</label><b><?php echo $h($e_member ?: '—'); ?></b></div>
            <div><label>Active loans</label><b><?php echo (int) $e_loans; ?></b></div>
            <div class="<?php echo $e_fines > 0 ? 'warn' : ''; ?>"><label>Fee status</label><b><?php echo $h($fee_label); ?></b></div>
            <div><label>Lib. fines</label><b><?php echo $e_fines > 0 ? $h(number_format($e_fines, 2)) : 'None'; ?></b></div>
            <div><label>Card / USN</label><b><?php echo $h($usn ?? ''); ?></b></div>
            <div><label>Mobile</label><b><?php echo $h($e_mobile ?: '—'); ?></b></div>
          </div>
          <?php if ($msg === '1') { ?><p class="note">Checked in. Entry time <?php echo $h($time1); ?>.</p><?php } ?>
          <?php if ($msg === '4') { ?><p class="note">Checked out. Duration <?php echo $h($otime[0] ?? ''); ?>.</p><?php } ?>
          <?php if ($msg === '3') { ?><p class="note bad">No matching Koha patron, or the card has expired. Ask at the library desk.</p><?php } ?>
          <?php if ($msg === '2' || $msg === '5') { ?><p class="note wait">Same card scanned again too soon. Wait 10 seconds.</p><?php } ?>
        </div>
        <?php } ?>
      </section>

      <aside class="io-right">
        <div class="panel">
          <h3>Today’s activity</h3>
          <ul class="act">
            <?php if (!$recent) { ?><li>No scans yet today.</li><?php } ?>
            <?php foreach ($recent as $row) {
              $st = $row['status'] === 'OUT' ? 'Checked OUT' : 'Checked IN';
              $tm = $row['status'] === 'OUT' ? $row['exit'] : $row['entry'];
            ?>
            <li>
              <span><?php echo $h(substr((string) $tm, 0, 8)); ?></span>
              <b><?php echo $h($row['cardnumber']); ?></b>
              <em class="<?php echo $row['status'] === 'OUT' ? 'out' : 'in'; ?>"><?php echo $st; ?></em>
            </li>
            <?php } ?>
          </ul>
        </div>
        <div class="panel occ">
          <h3>Live occupancy</h3>
          <p><b><?php echo $inside; ?></b> patrons inside</p>
          <p><?php echo (int) ($male[0] ?? 0); ?> gentlemen · <?php echo (int) ($female[0] ?? 0); ?> ladies</p>
        </div>
      </aside>
    </div>

    <section class="io-chart">
      <h3>Hourly footfall today</h3>
      <div class="bars">
        <?php for ($hr = 8; $hr <= 20; $hr++) {
          $inH = $hourly[$hr]['in'] ?? 0;
          $outH = $hourly[$hr]['out'] ?? 0;
          $inPct = max(6, (int) round(($inH / $maxbar) * 100));
          $outPct = max(6, (int) round(($outH / $maxbar) * 100));
        ?>
        <div class="col">
          <div class="stack">
            <i class="in" style="height:<?php echo $inPct; ?>%" title="IN <?php echo $inH; ?>"></i>
            <i class="out" style="height:<?php echo $outPct; ?>%" title="OUT <?php echo $outH; ?>"></i>
          </div>
          <span><?php echo $hr > 12 ? ($hr - 12) . ' PM' : ($hr === 12 ? '12 PM' : $hr . ' AM'); ?></span>
        </div>
        <?php } ?>
      </div>
    </section>

    <footer class="io-foot">
      Don Bosco College Library, Chandmari, Tura – 794002 ·
      <a href="tel:+919402152496">+91 9402152496</a> ·
      <a href="mailto:library@donboscocollege.ac.in">library@donboscocollege.ac.in</a>
      · Powered by Koha In/Out
    </footer>
  </div>
  <script>
    (function () {
      var el = document.getElementById('io-clock');
      function tick() {
        var n = new Date();
        el.innerHTML = n.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' })
          + '<b>' + n.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' }) + '</b>';
      }
      tick();
      setInterval(tick, 1000);
      var box = document.getElementById('usn');
      if (box) box.focus();
      <?php if ($show_card) { ?>
      setTimeout(function () { window.location.replace('dash.php'); }, 8000);
      <?php } ?>
    })();
  </script>
</body>
</html>
