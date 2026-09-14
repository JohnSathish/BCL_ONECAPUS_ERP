<?php
    session_start();
    $loc = $_SESSION['loc'];
    include './functions/dbconn.php';
    include './functions/general.php';
    $sql = "DELETE FROM `tmp2` WHERE `time` < DATE_SUB(NOW(),INTERVAL '00:10' MINUTE_SECOND)";
    $result = mysqli_query($conn, $sql) or die("Invalid query: 1" . mysqli_error());
    $e_category = '';
    $e_branch = '';
    $e_mobile = '';
    $e_sort1 = '';
    $e_sort2 = '';
    $e_loans = 0;
    $e_fines = 0.0;
    $e_expiry = '';
    $e_userid = '';
    $e_member = '';
    function dbc_load_koha_extras($koha, $borrowernumber): array
    {
        $out = ['loans' => 0, 'fines' => 0.0, 'expiry' => '', 'userid' => '', 'member' => ''];
        $bn = (int) $borrowernumber;
        if ($bn < 1) {
            return $out;
        }
        $r = mysqli_query($koha, "SELECT COUNT(*) FROM issues WHERE borrowernumber=$bn");
        if ($r) {
            $out['loans'] = (int) mysqli_fetch_row($r)[0];
        }
        $r = mysqli_query($koha, "SELECT COALESCE(SUM(amountoutstanding),0) FROM accountlines WHERE borrowernumber=$bn");
        if ($r) {
            $out['fines'] = (float) mysqli_fetch_row($r)[0];
        }
        $r = mysqli_query($koha, "SELECT dateexpiry, userid FROM borrowers WHERE borrowernumber=$bn");
        if ($r && $row = mysqli_fetch_row($r)) {
            $out['expiry'] = (string) $row[0];
            $out['userid'] = (string) $row[1];
            $out['member'] = ($row[0] && $row[0] >= date('Y-m-d')) ? 'ACTIVE' : 'EXPIRED';
        }
        return $out;
    }
    if (isset($_GET['id'])) {
        $usn = strtoupper(trim((string) $_GET['id']));
        $date = date('Y-m-d');
        $time = date('H:i:s');
        error_reporting(E_ALL);
        $usn_sql = mysqli_real_escape_string($koha, $usn);
        $sql = "SELECT CONCAT(IFNULL(title,''),' ',firstname,' ',surname) AS surname,borrowernumber,sex,categorycode,branchcode,sort1,sort2,mobile,email FROM borrowers WHERE (cardnumber='$usn_sql' OR userid='$usn_sql') AND (dateexpiry IS NULL OR dateexpiry > '$date')";
        $result = mysqli_query($koha, $sql) or die("Invalid query: 2" . mysqli_error());
        $data1 = mysqli_fetch_row($result);
        $data2 = [null];
        $data3 = [''];
        $data4 = [''];
        if ($data1) {
            $sql = "SELECT imagefile FROM patronimage WHERE borrowernumber = '$data1[1]'";
            $result = mysqli_query($koha, $sql);
            $data2 = mysqli_fetch_row($result) ?: [null];
            $sql = "SELECT description FROM categories WHERE categorycode = '$data1[3]'";
            $result = mysqli_query($koha, $sql);
            $data3 = mysqli_fetch_row($result) ?: [''];
            $sql = "SELECT branchname FROM branches WHERE branchcode = '$data1[4]'";
            $result = mysqli_query($koha, $sql);
            $data4 = mysqli_fetch_row($result) ?: [''];
            $extra = dbc_load_koha_extras($koha, $data1[1]);
            $e_category = $data3[0];
            $e_branch = $data4[0];
            $e_mobile = $data1[7];
            $e_sort1 = $data1[5];
            $e_sort2 = $data1[6];
            $e_loans = $extra['loans'];
            $e_fines = $extra['fines'];
            $e_expiry = $extra['expiry'];
            $e_userid = $extra['userid'];
            $e_member = $extra['member'];
        }
        if ($data1) {
            $sql = "SELECT *  FROM `inout` WHERE `cardnumber` = '$usn_sql' AND `date` = '$date' AND `status` = 'IN'";
            $result = mysqli_query($conn, $sql) or die("Invalid query: 3" . mysqli_error());
            $exit = mysqli_fetch_row($result);
            if ($exit) {
                $chk = "SELECT `usn` FROM tmp2 WHERE `usn`='$usn_sql'";
                $chk2 = mysqli_query($conn, $chk) or die("Invalid query: 4" . mysqli_error());
                $chk3 = mysqli_fetch_row($chk2);
                if (!$chk3) {
                    $sql = "SELECT *  FROM `inout` WHERE `cardnumber` = '$usn_sql' AND `date` = '$date' AND `status` = 'IN'";
                    $result = mysqli_query($conn, $sql) or die("Invalid query: 5" . mysqli_error());
                    $chk4 = mysqli_fetch_array($result);
                    if($chk4['loc'] != $_SESSION['locname']){
                        $sql = "UPDATE `inout` SET `exit` = '$time', `status` = 'OUT' WHERE `sl` = $exit[0];";
                        $result = mysqli_query($conn, $sql) or die("Invalid query: 6" . mysqli_error());
                        $sl = getsl($conn, "sl", "inout");
                        $nm = mysqli_real_escape_string($conn, $data1[0]);
                        $sql = "INSERT INTO `inout` (`sl`, `cardnumber`, `name`, `gender`, `date`, `entry`, `exit`, `status`,`loc`,`cc`,`branch`,`sort1`,`sort2`,`email`,`mob`) VALUES ('$sl', '$usn_sql', '$nm', '$data1[2]', '$date', '$time', '".$_SESSION['libtime']."', 'IN','$loc','$data3[0]','$data4[0]','$data1[5]','$data1[6]','$data1[8]','$data1[7]');";
                        $result = mysqli_query($conn, $sql) or die("Invalid query: 7" . mysqli_error());
                        $e_name = $data1[0];
                        $d_status = "IN";
                        $msg = "1";
                        $e_img = $data2[0];
                        $time1 = date('g:i A', strtotime($time));
                        $sql = "INSERT INTO `tmp2` (`usn`, `time`) VALUES ('$usn_sql', CURRENT_TIMESTAMP);";
                        $result = mysqli_query($conn, $sql) or die("Invalid query: 8" . mysqli_error());
                    }else{
                        $sql = "UPDATE `inout` SET `exit` = '$time', `status` = 'OUT' WHERE `sl` = $exit[0];";
                        $result = mysqli_query($conn, $sql) or die("Invalid query: 9" . mysqli_error());
                        $sql = "SELECT SUBTIME(`exit`,`entry`)  FROM `inout` WHERE `cardnumber`='$usn_sql' AND `sl` = $exit[0];";
                        $result = mysqli_query($conn, $sql) or die("Invalid query: 10" . mysqli_error());
                        $otime = mysqli_fetch_row($result);
                        $e_name = $data1[0];
                        $d_status = "OUT";
                        $msg = "4";
                        $e_img = $data2[0];
                        $time1 = date('g:i A', strtotime($time));
                        $sql = "INSERT INTO `tmp2` (`usn`, `time`) VALUES ('$usn_sql', CURRENT_TIMESTAMP);";
                        $result = mysqli_query($conn, $sql) or die("Invalid query: 8" . mysqli_error());
                    }
                } else {
                    $msg = "2";
                    $e_name = $data1[0];
                    $d_status = NULL;
                    $e_img = $data2[0];
                    $date = NULL;
                    $time1 = "-";
                }
            } else {
              $chk = "SELECT `usn` FROM tmp2 WHERE `usn`='$usn_sql'";
              $chk2 = mysqli_query($conn, $chk) or die("Invalid query: 4" . mysqli_error());
              $chk3 = mysqli_fetch_row($chk2);
              if($chk3){
                $msg = "5";
                $e_name = $data1[0];
                $d_status = NULL;
                $e_img = $data2[0];
                $date = NULL;
                $time1 = "-";
              } elseif ($data1) {
                    $sl = getsl($conn, "sl", "inout");
                    $nm = mysqli_real_escape_string($conn, $data1[0]);
                    $sql = "INSERT INTO `inout` (`sl`, `cardnumber`, `name`, `gender`, `date`, `entry`, `exit`, `status`,`loc`,`cc`,`branch`,`sort1`,`sort2`,`email`,`mob`) VALUES ('$sl', '$usn_sql', '$nm', '$data1[2]', '$date', '$time', '".$_SESSION['libtime']."', 'IN','$loc','$data3[0]','$data4[0]','$data1[5]','$data1[6]','$data1[8]','$data1[7]');";
                    $result = mysqli_query($conn, $sql) or die("Invalid query: 11" . mysqli_error($conn));
                    $e_name = $data1[0];
                    $d_status = "IN";
                    $msg = "1";
                    $e_img = $data2[0];
                    $time1 = date('g:i A', strtotime($time));
                    $sql = "INSERT INTO `tmp2` (`usn`, `time`) VALUES ('$usn_sql', CURRENT_TIMESTAMP);";
                    $result = mysqli_query($conn, $sql) or die("Invalid query: 12" . mysqli_error());
                }
            }
        } else {
            $msg = "3";
            $e_name = NULL;
            $d_status = NULL;
            $e_img = NULL;
            $date = NULL;
            $time1 = "-";
        }
    } else {
        $e_name = NULL;
        $d_status = NULL;
        $e_img = NULL;
        $msg = NULL;
        $date = NULL;
        $time1 = "-";
    }
?>
