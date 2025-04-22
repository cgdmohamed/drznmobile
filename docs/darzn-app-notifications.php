<?php
/**
 * DARZN App Notifications
 *
 * @package           DarznAppNotifications
 * @author            Your Name
 * @copyright         2025 DARZN
 * @license           GPL-2.0-or-later
 *
 * @wordpress-plugin
 * Plugin Name:       DARZN App Notifications
 * Plugin URI:        https://example.com/darzn-app-notifications
 * Description:       Manage in-app banners and push notifications for the DARZN mobile app.
 * Version:           1.0.0
 * Requires at least: 5.8
 * Requires PHP:      7.4
 * Author:            Your Name
 * Author URI:        https://example.com
 * Text Domain:       darzn-app-notifications
 * License:           GPL v2 or later
 * License URI:       http://www.gnu.org/licenses/gpl-2.0.txt
 * Update URI:        https://example.com/darzn-app-notifications/
 */

// If this file is called directly, abort.
if (!defined('WPINC')) {
    die;
}

// Define plugin constants
define('DARZN_NOTIFICATIONS_VERSION', '1.0.0');
define('DARZN_NOTIFICATIONS_PLUGIN_DIR', plugin_dir_path(__FILE__));
define('DARZN_NOTIFICATIONS_PLUGIN_URL', plugin_dir_url(__FILE__));

/**
 * Activate the plugin.
 */
function activate_darzn_app_notifications() {
    require_once DARZN_NOTIFICATIONS_PLUGIN_DIR . 'includes/class-activator.php';
    DarznAppNotifications_Activator::activate();
}

/**
 * Deactivate the plugin.
 */
function deactivate_darzn_app_notifications() {
    // Deactivation tasks if needed
}

register_activation_hook(__FILE__, 'activate_darzn_app_notifications');
register_deactivation_hook(__FILE__, 'deactivate_darzn_app_notifications');

/**
 * The core plugin class that is used to define internationalization,
 * admin-specific hooks, and public-facing site hooks.
 */
require DARZN_NOTIFICATIONS_PLUGIN_DIR . 'includes/class-darzn-app-notifications.php';

/**
 * Begins execution of the plugin.
 */
function run_darzn_app_notifications() {
    $plugin = new DarznAppNotifications();
    $plugin->run();
}
run_darzn_app_notifications();