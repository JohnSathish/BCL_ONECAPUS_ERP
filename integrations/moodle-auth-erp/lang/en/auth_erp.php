<?php
// This file is part of Moodle - http://moodle.org/
defined('MOODLE_INTERNAL') || die();

$string['pluginname'] = 'BCL OneCampus ERP SSO';
$string['auth_erpdescription'] = 'Seamless login from BCL OneCampus ERP using short-lived signed launch tokens.';
$string['erp_api_base'] = 'ERP API base URL';
$string['erp_api_base_desc'] = 'Base URL of the ERP API (e.g. https://erp.donboscocollege.ac.in/api). Do not include /v1.';
$string['missingtoken'] = 'ERP SSO token is missing.';
$string['missingconfig'] = 'ERP API base URL is not configured for auth_erp.';
$string['verifyfailed'] = 'ERP could not verify the SSO token.';
$string['nouser'] = 'No matching Moodle user was found for this ERP account. Run user sync from ERP first.';
