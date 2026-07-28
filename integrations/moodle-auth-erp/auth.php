<?php
// This file is part of Moodle - http://moodle.org/
defined('MOODLE_INTERNAL') || die();

require_once($CFG->libdir.'/authlib.php');

/**
 * BCL OneCampus ERP SSO authentication plugin.
 */
class auth_plugin_erp extends auth_plugin_base {

    public function __construct() {
        $this->authtype = 'erp';
        $this->config = get_config('auth_erp');
    }

    public function user_login($username, $password) {
        return false;
    }

    public function can_signup() {
        return false;
    }

    public function is_internal() {
        return false;
    }

    public function can_change_password() {
        return false;
    }

    public function can_reset_password() {
        return false;
    }

    public function can_confirm() {
        return false;
    }

  /**
   * Redirect ERP token launches from the standard login page.
   */
    public function loginpage_hook() {
        global $CFG;
        $token = optional_param('erp_token', '', PARAM_RAW);
        if (empty($token)) {
            $token = optional_param('token', '', PARAM_RAW);
        }
        if (empty($token)) {
            return;
        }
        $wanturl = optional_param('wanturl', '', PARAM_LOCALURL);
        if (empty($wanturl)) {
            $wanturl = $CFG->wwwroot . '/my/courses.php';
        }
        redirect(new moodle_url('/auth/erp/login.php', [
            'token' => $token,
            'wanturl' => $wanturl,
        ]));
    }
}
