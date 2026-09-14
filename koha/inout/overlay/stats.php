<?php
  $loc = $_SESSION['loc'];
  $date = date('Y-m-d');
  $query = "SELECT count(sl) FROM `inout` WHERE date='$date' and loc='$loc'";
  $result = mysqli_query($conn, $query) or die("Invalid query: " . mysqli_error($conn));
  $visit = mysqli_fetch_row($result);
  $query = "SELECT count(sl) FROM `inout` WHERE date='$date' and gender='M' and status='IN' and loc='$loc'";
  $result = mysqli_query($conn, $query) or die("Invalid query: " . mysqli_error($conn));
  $male = mysqli_fetch_row($result);
  $query = "SELECT count(sl) FROM `inout` WHERE date='$date' and gender='F' and status='IN' and loc='$loc'";
  $result = mysqli_query($conn, $query) or die("Invalid query: " . mysqli_error($conn));
  $female = mysqli_fetch_row($result);
  $query = "SELECT count(sl) FROM `inout` WHERE date='$date' and status='IN' and loc='$loc'";
  $result = mysqli_query($conn, $query) or die("Invalid query: " . mysqli_error($conn));
  $tin = mysqli_fetch_row($result);
  $query = "SELECT cc, COUNT(sl) FROM `inout` WHERE date='$date' AND loc='$loc' GROUP BY cc ORDER BY RAND() LIMIT 3 ";
  $extraCount = mysqli_query($conn, $query) or die("Invalid query: " . mysqli_error($conn));

  $query = "SELECT COUNT(*) FROM `inout` WHERE date='$date' AND loc='$loc' AND status='OUT'";
  $result = mysqli_query($conn, $query);
  $tout = mysqli_fetch_row($result);
  $query = "SELECT COUNT(DISTINCT cardnumber) FROM `inout` WHERE date='$date' AND loc='$loc'";
  $result = mysqli_query($conn, $query);
  $unique = mysqli_fetch_row($result);
  $query = "SELECT SEC_TO_TIME(IFNULL(AVG(TIME_TO_SEC(TIMEDIFF(`exit`,`entry`))),0)) FROM `inout` WHERE date='$date' AND loc='$loc' AND status='OUT' AND `exit` <> '00:00:00'";
  $result = mysqli_query($conn, $query);
  $avgstay = mysqli_fetch_row($result);
  $hourly = [];
  for ($h = 8; $h <= 20; $h++) {
      $hourly[$h] = ['in' => 0, 'out' => 0];
  }
  $query = "SELECT HOUR(entry) h, COUNT(*) c FROM `inout` WHERE date='$date' AND loc='$loc' GROUP BY HOUR(entry)";
  $result = mysqli_query($conn, $query);
  if ($result) {
      while ($row = mysqli_fetch_assoc($result)) {
          $h = (int) $row['h'];
          if ($h >= 8 && $h <= 20) {
              $hourly[$h]['in'] = (int) $row['c'];
          }
      }
  }
  $query = "SELECT HOUR(`exit`) h, COUNT(*) c FROM `inout` WHERE date='$date' AND loc='$loc' AND status='OUT' AND `exit` <> '00:00:00' GROUP BY HOUR(`exit`)";
  $result = mysqli_query($conn, $query);
  if ($result) {
      while ($row = mysqli_fetch_assoc($result)) {
          $h = (int) $row['h'];
          if ($h >= 8 && $h <= 20) {
              $hourly[$h]['out'] = (int) $row['c'];
          }
      }
  }
  $recent = [];
  $query = "SELECT name, cardnumber, status, entry, `exit` FROM `inout` WHERE date='$date' AND loc='$loc' ORDER BY sl DESC LIMIT 8";
  $result = mysqli_query($conn, $query);
  if ($result) {
      while ($row = mysqli_fetch_assoc($result)) {
          $recent[] = $row;
      }
  }
  $maxbar = 1;
  foreach ($hourly as $hv) {
      $maxbar = max($maxbar, $hv['in'], $hv['out']);
  }
?>
