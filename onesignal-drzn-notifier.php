<?php
/**
 * Plugin Name: OneSignal DRZN Notifier
 * Description: Custom integration for sending OneSignal notifications to your app users through WordPress.
 * Version: 1.0.0
 * Author: DRZN
 */

// If this file is called directly, abort.
if (!defined('WPINC')) {
    die;
}

// Define plugin constants
define('ONESIGNAL_DRZN_NOTIFIER_VERSION', '1.0.0');
define('ONESIGNAL_DRZN_NOTIFIER_PLUGIN_DIR', plugin_dir_path(__FILE__));

// Enqueue admin scripts and styles
function onesignal_drzn_notifier_admin_scripts() {
    // Only add to our custom page
    if (isset($_GET['page']) && $_GET['page'] === 'onesignal-drzn-notifier') {
        wp_enqueue_style('onesignal-drzn-notifier-admin', plugin_dir_url(__FILE__) . 'admin/css/admin.css', array(), ONESIGNAL_DRZN_NOTIFIER_VERSION);
        wp_enqueue_script('onesignal-drzn-notifier-admin', plugin_dir_url(__FILE__) . 'admin/js/admin.js', array('jquery'), ONESIGNAL_DRZN_NOTIFIER_VERSION, true);
        
        // Add localized script data
        wp_localize_script('onesignal-drzn-notifier-admin', 'onesignal_drzn_notifier', array(
            'ajax_url' => admin_url('admin-ajax.php'),
            'nonce' => wp_create_nonce('onesignal_drzn_notifier_nonce'),
        ));
    }
}
add_action('admin_enqueue_scripts', 'onesignal_drzn_notifier_admin_scripts');

// Add admin menu
function onesignal_drzn_notifier_admin_menu() {
    add_menu_page(
        'OneSignal DRZN Notifier',
        'Push Notifications',
        'manage_options',
        'onesignal-drzn-notifier',
        'onesignal_drzn_notifier_admin_page',
        'dashicons-megaphone',
        30
    );
    
    // Add Settings submenu
    add_submenu_page(
        'onesignal-drzn-notifier',
        'OneSignal Settings',
        'Settings',
        'manage_options',
        'onesignal-drzn-notifier-settings',
        'onesignal_drzn_notifier_settings_page'
    );
}
add_action('admin_menu', 'onesignal_drzn_notifier_admin_menu');

// Register settings
function onesignal_drzn_notifier_register_settings() {
    register_setting('onesignal_drzn_notifier_settings', 'onesignal_app_id');
    register_setting('onesignal_drzn_notifier_settings', 'onesignal_rest_api_key');
}
add_action('admin_init', 'onesignal_drzn_notifier_register_settings');

// Settings page
function onesignal_drzn_notifier_settings_page() {
    ?>
    <div class="wrap">
        <h1>OneSignal Push Notification Settings</h1>
        <form method="post" action="options.php">
            <?php settings_fields('onesignal_drzn_notifier_settings'); ?>
            <?php do_settings_sections('onesignal_drzn_notifier_settings'); ?>
            <table class="form-table">
                <tr valign="top">
                    <th scope="row">OneSignal App ID</th>
                    <td><input type="text" name="onesignal_app_id" value="<?php echo esc_attr(get_option('onesignal_app_id')); ?>" class="regular-text" /></td>
                </tr>
                <tr valign="top">
                    <th scope="row">OneSignal REST API Key</th>
                    <td><input type="text" name="onesignal_rest_api_key" value="<?php echo esc_attr(get_option('onesignal_rest_api_key')); ?>" class="regular-text" /></td>
                </tr>
            </table>
            <?php submit_button(); ?>
        </form>
    </div>
    <?php
}

// Admin page to send notifications
function onesignal_drzn_notifier_admin_page() {
    $app_id = get_option('onesignal_app_id');
    $rest_api_key = get_option('onesignal_rest_api_key');
    
    // Check if settings are configured
    if (empty($app_id) || empty($rest_api_key)) {
        ?>
        <div class="wrap">
            <h1>OneSignal Push Notifications</h1>
            <div class="notice notice-error">
                <p>Please configure your OneSignal App ID and REST API Key in the <a href="<?php echo admin_url('admin.php?page=onesignal-drzn-notifier-settings'); ?>">Settings</a> page.</p>
            </div>
        </div>
        <?php
        return;
    }
    ?>
    <div class="wrap">
        <h1>Send Push Notifications</h1>
        
        <div id="notification-result"></div>
        
        <form id="send-notification-form">
            <table class="form-table">
                <tr valign="top">
                    <th scope="row">Notification Title</th>
                    <td><input type="text" name="title" id="notification-title" class="regular-text" required /></td>
                </tr>
                <tr valign="top">
                    <th scope="row">Notification Message</th>
                    <td><textarea name="message" id="notification-message" class="large-text" rows="4" required></textarea></td>
                </tr>
                <tr valign="top">
                    <th scope="row">Notification Type</th>
                    <td>
                        <select name="notification_type" id="notification-type">
                            <option value="all">All Users</option>
                            <option value="order">Order Updates</option>
                            <option value="promotion">Promotions</option>
                        </select>
                    </td>
                </tr>
                <tr valign="top" id="order-id-container" style="display: none;">
                    <th scope="row">Order ID</th>
                    <td><input type="text" name="order_id" id="order-id" class="regular-text" /></td>
                </tr>
                <tr valign="top" id="promotion-action-container" style="display: none;">
                    <th scope="row">Promotion URL</th>
                    <td><input type="text" name="promotion_url" id="promotion-url" class="regular-text" /></td>
                </tr>
            </table>
            
            <p class="submit">
                <button type="submit" id="send-notification-button" class="button button-primary">Send Notification</button>
                <span class="spinner" style="float: none; margin-top: 0;"></span>
            </p>
        </form>
        
        <hr>
        
        <h2>Recently Sent Notifications</h2>
        <div id="notification-history">
            <table class="wp-list-table widefat fixed striped">
                <thead>
                    <tr>
                        <th>Date</th>
                        <th>Title</th>
                        <th>Message</th>
                        <th>Type</th>
                        <th>Recipients</th>
                    </tr>
                </thead>
                <tbody id="notification-history-body">
                    <tr>
                        <td colspan="5">No notifications sent yet.</td>
                    </tr>
                </tbody>
            </table>
        </div>
    </div>
    <?php
}

// Create necessary directory structure on activation
function onesignal_drzn_notifier_activate() {
    // Create admin/css and admin/js directories
    wp_mkdir_p(ONESIGNAL_DRZN_NOTIFIER_PLUGIN_DIR . 'admin/css');
    wp_mkdir_p(ONESIGNAL_DRZN_NOTIFIER_PLUGIN_DIR . 'admin/js');
    
    // Create admin.css
    $css_content = "
    .spinner {
        visibility: visible;
        display: none;
    }
    
    #notification-result {
        margin: 15px 0;
    }
    
    .notification-success {
        padding: 10px;
        background-color: #dff0d8;
        border: 1px solid #d6e9c6;
        color: #3c763d;
        border-radius: 4px;
    }
    
    .notification-error {
        padding: 10px;
        background-color: #f2dede;
        border: 1px solid #ebccd1;
        color: #a94442;
        border-radius: 4px;
    }
    ";
    file_put_contents(ONESIGNAL_DRZN_NOTIFIER_PLUGIN_DIR . 'admin/css/admin.css', $css_content);
    
    // Create admin.js
    $js_content = "
    jQuery(document).ready(function($) {
        // Toggle order ID field based on notification type
        $('#notification-type').on('change', function() {
            var type = $(this).val();
            if (type === 'order') {
                $('#order-id-container').show();
            } else {
                $('#order-id-container').hide();
            }
            
            if (type === 'promotion') {
                $('#promotion-action-container').show();
            } else {
                $('#promotion-action-container').hide();
            }
        });
        
        // Handle form submission
        $('#send-notification-form').on('submit', function(e) {
            e.preventDefault();
            
            // Show spinner
            $('.spinner').css('display', 'inline-block');
            $('#send-notification-button').prop('disabled', true);
            
            // Clear previous result
            $('#notification-result').empty();
            
            // Get form data
            var title = $('#notification-title').val();
            var message = $('#notification-message').val();
            var type = $('#notification-type').val();
            var orderId = $('#order-id').val();
            var promotionUrl = $('#promotion-url').val();
            
            // Prepare data for AJAX
            var data = {
                action: 'send_onesignal_notification',
                nonce: onesignal_drzn_notifier.nonce,
                title: title,
                message: message,
                type: type
            };
            
            // Add conditional fields
            if (type === 'order' && orderId) {
                data.order_id = orderId;
            }
            
            if (type === 'promotion' && promotionUrl) {
                data.promotion_url = promotionUrl;
            }
            
            // Send AJAX request
            $.post(onesignal_drzn_notifier.ajax_url, data, function(response) {
                // Hide spinner
                $('.spinner').css('display', 'none');
                $('#send-notification-button').prop('disabled', false);
                
                if (response.success) {
                    $('#notification-result').html('<div class=\"notification-success\">' + response.data.message + '</div>');
                    
                    // Reset form
                    $('#notification-title').val('');
                    $('#notification-message').val('');
                    
                    // Update history
                    loadNotificationHistory();
                } else {
                    $('#notification-result').html('<div class=\"notification-error\">' + response.data.message + '</div>');
                }
            }).fail(function() {
                // Hide spinner
                $('.spinner').css('display', 'none');
                $('#send-notification-button').prop('disabled', false);
                
                $('#notification-result').html('<div class=\"notification-error\">Failed to send notification. Please try again.</div>');
            });
        });
        
        // Load notification history
        function loadNotificationHistory() {
            $.post(onesignal_drzn_notifier.ajax_url, {
                action: 'get_notification_history',
                nonce: onesignal_drzn_notifier.nonce
            }, function(response) {
                if (response.success && response.data.history) {
                    var history = response.data.history;
                    var html = '';
                    
                    if (history.length > 0) {
                        $.each(history, function(index, item) {
                            html += '<tr>';
                            html += '<td>' + item.date + '</td>';
                            html += '<td>' + item.title + '</td>';
                            html += '<td>' + item.message + '</td>';
                            html += '<td>' + item.type + '</td>';
                            html += '<td>' + item.recipients + '</td>';
                            html += '</tr>';
                        });
                    } else {
                        html = '<tr><td colspan=\"5\">No notifications sent yet.</td></tr>';
                    }
                    
                    $('#notification-history-body').html(html);
                }
            });
        }
        
        // Load history on page load
        loadNotificationHistory();
    });
    ";
    file_put_contents(ONESIGNAL_DRZN_NOTIFIER_PLUGIN_DIR . 'admin/js/admin.js', $js_content);
    
    // Initialize options
    add_option('onesignal_app_id', '');
    add_option('onesignal_rest_api_key', '');
    
    // Create table for notification history
    global $wpdb;
    $table_name = $wpdb->prefix . 'onesignal_notification_history';
    
    $charset_collate = $wpdb->get_charset_collate();
    
    $sql = "CREATE TABLE $table_name (
        id mediumint(9) NOT NULL AUTO_INCREMENT,
        date datetime NOT NULL,
        title text NOT NULL,
        message text NOT NULL,
        type varchar(20) NOT NULL,
        recipients int(11) NOT NULL,
        response text NOT NULL,
        PRIMARY KEY  (id)
    ) $charset_collate;";
    
    require_once(ABSPATH . 'wp-admin/includes/upgrade.php');
    dbDelta($sql);
}
register_activation_hook(__FILE__, 'onesignal_drzn_notifier_activate');

// Handle AJAX request to send notification
function send_onesignal_notification_callback() {
    // Check nonce for security
    if (!check_ajax_referer('onesignal_drzn_notifier_nonce', 'nonce', false)) {
        wp_send_json_error(array('message' => 'Invalid security token. Please refresh the page and try again.'));
        return;
    }
    
    // Check user permissions
    if (!current_user_can('manage_options')) {
        wp_send_json_error(array('message' => 'You do not have permission to send notifications.'));
        return;
    }
    
    // Get parameters
    $params = array(
        'title' => isset($_POST['title']) ? sanitize_text_field($_POST['title']) : '',
        'message' => isset($_POST['message']) ? sanitize_textarea_field($_POST['message']) : '',
        'type' => isset($_POST['type']) ? sanitize_text_field($_POST['type']) : 'all',
    );
    
    // Optional parameters
    if (isset($_POST['order_id'])) {
        $params['order_id'] = intval($_POST['order_id']);
    }
    
    if (isset($_POST['promotion_url'])) {
        $params['promotion_url'] = esc_url_raw($_POST['promotion_url']);
    }
    
    // Validate required fields
    if (empty($params['title']) || empty($params['message'])) {
        wp_send_json_error(array('message' => 'Title and message are required.'));
        return;
    }
    
    // Send notification
    $result = send_onesignal_notification($params);
    
    if (is_wp_error($result)) {
        wp_send_json_error(array('message' => $result->get_error_message()));
        return;
    }
    
    wp_send_json_success(array(
        'message' => sprintf('Notification sent successfully to %d recipients.', $result['recipients']),
        'notification_id' => $result['notification_id'],
        'recipients' => $result['recipients']
    ));
}
add_action('wp_ajax_send_onesignal_notification', 'send_onesignal_notification_callback');

// Get notification history
function get_notification_history_callback() {
    // Check nonce for security
    if (!check_ajax_referer('onesignal_drzn_notifier_nonce', 'nonce', false)) {
        wp_send_json_error(array('message' => 'Invalid security token. Please refresh the page and try again.'));
        return;
    }
    
    // Check user permissions
    if (!current_user_can('manage_options')) {
        wp_send_json_error(array('message' => 'You do not have permission to view notification history.'));
        return;
    }
    
    // Get history from database
    global $wpdb;
    $table_name = $wpdb->prefix . 'onesignal_notification_history';
    
    $history = $wpdb->get_results(
        "SELECT id, date, title, message, type, recipients FROM $table_name ORDER BY date DESC LIMIT 10",
        ARRAY_A
    );
    
    wp_send_json_success(array('history' => $history));
}
add_action('wp_ajax_get_notification_history', 'get_notification_history_callback');

// Send notification to OneSignal
function send_onesignal_notification($params) {
    $app_id = get_option('onesignal_app_id');
    $rest_api_key = get_option('onesignal_rest_api_key');
    
    if (empty($app_id) || empty($rest_api_key)) {
        return new WP_Error('missing_credentials', 'OneSignal App ID and REST API Key are required.', array('status' => 400));
    }
    
    // Construct notification data
    $fields = array(
        'app_id' => $app_id,
        'headings' => array('en' => $params['title']),
        'contents' => array('en' => $params['message']),
        'data' => array(
            'type' => $params['type']
        ),
        'android_channel_id' => 'drzn_app_channel',
        'android_accent_color' => 'EC1C24'  // DRZN red color in hex
    );
    
    // Handle different notification types
    switch ($params['type']) {
        case 'order':
            // Add order-specific data
            if (!empty($params['order_id'])) {
                $fields['data']['order_id'] = intval($params['order_id']);
                
                // If targeting a specific order, send to the customer
                $order = wc_get_order($params['order_id']);
                if ($order) {
                    $user_id = $order->get_user_id();
                    if ($user_id) {
                        // Get external user ID for OneSignal (stored in user meta)
                        $external_user_id = get_user_meta($user_id, 'onesignal_player_id', true);
                        if (!empty($external_user_id)) {
                            $fields['include_external_user_ids'] = array($external_user_id);
                        }
                    }
                }
            }
            break;
            
        case 'promotion':
            // Add promotion-specific data
            if (!empty($params['promotion_url'])) {
                $fields['data']['url'] = $params['promotion_url'];
            }
            
            // Target users who have enabled promotion notifications
            $fields['filters'] = array(
                array('field' => 'tag', 'key' => 'promotion_notifications', 'relation' => '=', 'value' => 'enabled')
            );
            break;
            
        case 'all':
        default:
            // Send to all subscribed users
            $fields['included_segments'] = array('Subscribed Users');
            break;
    }
    
    // Send the notification
    $response = wp_remote_post(
        'https://onesignal.com/api/v1/notifications',
        array(
            'headers' => array(
                'Content-Type' => 'application/json; charset=utf-8',
                'Authorization' => 'Basic ' . $rest_api_key
            ),
            'body' => json_encode($fields),
            'method' => 'POST',
            'timeout' => 45
        )
    );
    
    if (is_wp_error($response)) {
        return new WP_Error('api_error', 'Failed to send notification: ' . $response->get_error_message(), array('status' => 500));
    }
    
    $body = json_decode(wp_remote_retrieve_body($response), true);
    
    // Save to history
    global $wpdb;
    $table_name = $wpdb->prefix . 'onesignal_notification_history';
    
    $wpdb->insert(
        $table_name,
        array(
            'date' => current_time('mysql'),
            'title' => sanitize_text_field($params['title']),
            'message' => sanitize_textarea_field($params['message']),
            'type' => !empty($params['type']) ? sanitize_text_field($params['type']) : 'all',
            'recipients' => isset($body['recipients']) ? intval($body['recipients']) : 0,
            'response' => wp_json_encode($body)
        )
    );
    
    if (isset($body['id'])) {
        return array(
            'success' => true,
            'notification_id' => $body['id'],
            'recipients' => isset($body['recipients']) ? $body['recipients'] : 0
        );
    } else {
        return new WP_Error(
            'api_response_error',
            'Failed to send notification: ' . (isset($body['errors'][0]) ? $body['errors'][0] : 'Unknown error'),
            array('status' => 500)
        );
    }
}

// Handle WooCommerce order status changes
function handle_order_status_change($order_id, $from_status, $to_status, $order) {
    // Skip if not a real status change or if triggered by admin in dashboard
    if ($from_status === $to_status || (is_admin() && !wp_doing_ajax())) {
        return;
    }
    
    $customer_id = $order->get_customer_id();
    if (!$customer_id) {
        return; // Can't send notification without a user ID
    }
    
    // Get notification settings
    $status_title = '';
    $status_message = '';
    
    // Set custom messages based on status
    switch ($to_status) {
        case 'processing':
            $status_title = 'طلبك قيد التجهيز';
            $status_message = "طلبك رقم #$order_id قيد التجهيز. سنرسل لك إشعارًا عندما يتم شحن طلبك.";
            break;
        case 'completed':
            $status_title = 'طلبك مكتمل';
            $status_message = "طلبك رقم #$order_id مكتمل. شكرًا لتسوقك معنا!";
            break;
        case 'on-hold':
            $status_title = 'طلبك معلق';
            $status_message = "طلبك رقم #$order_id معلق حاليًا. سيتم الاتصال بك قريبًا.";
            break;
        case 'cancelled':
            $status_title = 'طلبك ملغي';
            $status_message = "للأسف، تم إلغاء طلبك رقم #$order_id. يرجى الاتصال بخدمة العملاء للمزيد من المعلومات.";
            break;
        default:
            $status_title = 'تحديث الطلب';
            $status_message = "تم تحديث حالة طلبك رقم #$order_id إلى $to_status.";
            break;
    }
    
    // Don't continue if no title/message
    if (empty($status_title) || empty($status_message)) {
        return;
    }
    
    // Get OneSignal player ID from user meta
    $player_id = get_user_meta($customer_id, 'onesignal_player_id', true);
    if (empty($player_id)) {
        return; // User doesn't have a player ID
    }
    
    // Send notification
    send_onesignal_notification(array(
        'title' => $status_title,
        'message' => $status_message,
        'type' => 'order',
        'order_id' => $order_id
    ));
}
add_action('woocommerce_order_status_changed', 'handle_order_status_change', 10, 4);

// Save OneSignal player ID to user meta
function save_onesignal_player_id() {
    // Check nonce for security
    if (!check_ajax_referer('onesignal_player_id_nonce', 'nonce', false)) {
        wp_send_json_error(array('message' => 'Invalid security token.'));
        return;
    }
    
    // Verify user is logged in
    if (!is_user_logged_in()) {
        wp_send_json_error(array('message' => 'User not logged in.'));
        return;
    }
    
    $user_id = get_current_user_id();
    $player_id = isset($_POST['player_id']) ? sanitize_text_field($_POST['player_id']) : '';
    
    if (empty($player_id)) {
        wp_send_json_error(array('message' => 'Player ID is required.'));
        return;
    }
    
    // Save to user meta
    update_user_meta($user_id, 'onesignal_player_id', $player_id);
    
    wp_send_json_success(array('message' => 'Player ID saved successfully.'));
}
add_action('wp_ajax_save_onesignal_player_id', 'save_onesignal_player_id');
add_action('wp_ajax_nopriv_save_onesignal_player_id', 'save_onesignal_player_id');

// Register REST API endpoint to save player ID
function register_onesignal_rest_routes() {
    register_rest_route('darzn/v1', '/devices', array(
        'methods' => 'POST',
        'callback' => 'register_device_callback',
        'permission_callback' => function() {
            return is_user_logged_in();
        }
    ));
    
    register_rest_route('darzn/v1', '/devices/(?P<player_id>[\\w-]+)', array(
        'methods' => 'PUT',
        'callback' => 'update_device_callback',
        'permission_callback' => function() {
            return is_user_logged_in();
        }
    ));
}
add_action('rest_api_init', 'register_onesignal_rest_routes');

// Register device callback
function register_device_callback($request) {
    $params = $request->get_params();
    
    if (empty($params['player_id'])) {
        return new WP_Error('missing_player_id', 'Player ID is required.', array('status' => 400));
    }
    
    $user_id = get_current_user_id();
    if (!$user_id) {
        return new WP_Error('not_logged_in', 'User must be logged in.', array('status' => 401));
    }
    
    update_user_meta($user_id, 'onesignal_player_id', sanitize_text_field($params['player_id']));
    
    return array(
        'success' => true,
        'message' => 'Device registered successfully.'
    );
}

// Update device callback
function update_device_callback($request) {
    $player_id = $request['player_id'];
    $params = $request->get_params();
    
    $user_id = get_current_user_id();
    if (!$user_id) {
        return new WP_Error('not_logged_in', 'User must be logged in.', array('status' => 401));
    }
    
    $stored_player_id = get_user_meta($user_id, 'onesignal_player_id', true);
    
    if ($stored_player_id !== $player_id) {
        return new WP_Error('invalid_player_id', 'Player ID does not match stored ID.', array('status' => 400));
    }
    
    // If deactivating
    if (isset($params['status']) && $params['status'] === 'inactive') {
        delete_user_meta($user_id, 'onesignal_player_id');
    }
    
    return array(
        'success' => true,
        'message' => 'Device updated successfully.'
    );
}