<?php
// This file is part of Moodle - http://moodle.org/
defined('MOODLE_INTERNAL') || die();

require_once($CFG->libdir.'/adminlib.php');

if ($ADMIN->fulltree) {
    $settings->add(new admin_setting_configtext(
        'auth_erp/erp_api_base',
        get_string('erp_api_base', 'auth_erp'),
        get_string('erp_api_base_desc', 'auth_erp'),
        'https://erp.donboscocollege.ac.in/api',
        PARAM_URL
    ));
}
