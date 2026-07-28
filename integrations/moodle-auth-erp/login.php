<?php
// This file is part of Moodle - http://moodle.org/
require_once(__DIR__ . '/../../config.php');
require_once($CFG->libdir.'/moodlelib.php');

$token = optional_param('token', optional_param('erp_token', '', PARAM_RAW), PARAM_RAW);
$wanturl = optional_param('wanturl', $CFG->wwwroot . '/my/courses.php', PARAM_LOCALURL);

if (empty($token)) {
    throw new moodle_exception('missingtoken', 'auth_erp');
}

$config = get_config('auth_erp');
$apibase = rtrim((string)($config->erp_api_base ?? ''), '/');
if (empty($apibase)) {
    throw new moodle_exception('missingconfig', 'auth_erp');
}

$verifyurl = $apibase . '/v1/moodle/sso/verify';
$payload = json_encode(['token' => $token]);

$ch = curl_init($verifyurl);
curl_setopt_array($ch, [
    CURLOPT_POST => true,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HTTPHEADER => [
        'Content-Type: application/json',
        'Accept: application/json',
    ],
    CURLOPT_POSTFIELDS => $payload,
    CURLOPT_TIMEOUT => 20,
    CURLOPT_CONNECTTIMEOUT => 10,
]);
$responsebody = curl_exec($ch);
$httpcode = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
$curlerror = curl_error($ch);
curl_close($ch);

if ($responsebody === false || $httpcode !== 200) {
    debugging('auth_erp verify failed: HTTP ' . $httpcode . ' ' . $curlerror, DEBUG_DEVELOPER);
    throw new moodle_exception('verifyfailed', 'auth_erp');
}

$json = json_decode($responsebody, true);
$data = is_array($json) ? ($json['data'] ?? null) : null;
if (!is_array($data) || empty($data['moodleUserId'])) {
    throw new moodle_exception('nouser', 'auth_erp');
}

$moodleuserid = (int)$data['moodleUserId'];
$user = $DB->get_record('user', ['id' => $moodleuserid, 'deleted' => 0, 'suspended' => 0]);
if (!$user) {
    throw new moodle_exception('nouser', 'auth_erp');
}

complete_user_login($user);
redirect(new moodle_url($wanturl));
