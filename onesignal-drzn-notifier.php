<?php
/**
 * Plugin Name: OneSignal DRZN Notifier
 * Description: Provides custom REST API endpoints to send push notifications via OneSignal from the DRZN app
 * Version: 1.0.0
 * Author: DRZN Team
 * Text Domain: onesignal-drzn-notifier
 */

// Exit if accessed directly
if (!defined('ABSPATH')) {
    exit;
}

class OneSignal_DRZN_Notifier {
    /**
     * Constructor
     */
    public function __construct() {
        // Register REST API endpoints
        add_action('rest_api_init', array($this, 'register_rest_routes'));
        
        // Add admin menu
        add_action('admin_menu', array($this, 'add_admin_menu'));
        
        // Add WooCommerce order status hooks
        add_action('woocommerce_order_status_changed', array($this, 'handle_order_status_change'), 10, 4);
    }

    /**
     * Register REST API routes
     */
    public function register_rest_routes() {
        register_rest_route('onesignal-drzn/v1', '/send-notification', array(
            'methods' => 'POST',
            'callback' => array($this, 'send_notification'),
            'permission_callback' => array($this, 'admin_permissions_check'),
        ));
        
        register_rest_route('onesignal-drzn/v1', '/test-notification', array(
            'methods' => 'POST',
            'callback' => array($this, 'send_test_notification'),
            'permission_callback' => array($this, 'admin_permissions_check'),
        ));
    }

    /**
     * Check if user has admin permissions
     *
     * @param WP_REST_Request $request Current request
     * @return bool
     */
    public function admin_permissions_check($request) {
        // JWT authentication check - ensure the user is logged in via JWT token
        if (!is_user_logged_in()) {
            return false;
        }
        
        // Check if the current user has administrator capability
        return current_user_can('administrator');
    }

    /**
     * Send push notification through OneSignal
     *
     * @param WP_REST_Request $request REST API request
     * @return WP_REST_Response REST API response
     */
    public function send_notification($request) {
        $params = $request->get_params();
        
        // Validate required fields
        if (empty($params['title']) || empty($params['message'])) {
            return new WP_REST_Response(array(
                'success' => false,
                'error' => 'Title and message are required'
            ), 400);
        }
        
        // Get notification type
        $type = !empty($params['type']) ? $params['type'] : 'all';
        
        // Default notification data
        $notification = array(
            'app_id' => getenv('ONESIGNAL_APP_ID'),
            'headings' => array('en' => $params['title']),
            'contents' => array('en' => $params['message']),
            'android_channel_id' => 'drzn_app_channel',
            'android_accent_color' => 'EC1C24',  // DRZN red color in hex
        );
        
        // Add filters based on type
        switch ($type) {
            case 'order':
                // Add order-specific data
                if (!empty($params['order_id'])) {
                    $notification['data'] = array(
                        'type' => 'order',
                        'order_id' => intval($params['order_id'])
                    );
                    
                    // Send to specific user who placed the order if available
                    $order = wc_get_order($params['order_id']);
                    if ($order) {
                        $user_id = $order->get_user_id();
                        if ($user_id) {
                            // Get external user ID for OneSignal (stored in user meta)
                            $external_user_id = get_user_meta($user_id, 'onesignal_user_id', true);
                            if (!empty($external_user_id)) {
                                $notification['include_external_user_ids'] = array($external_user_id);
                            }
                        }
                    }
                }
                break;
                
            case 'promotion':
                // Add promotion-specific data
                $notification['data'] = array(
                    'type' => 'promotion',
                );
                
                if (!empty($params['url'])) {
                    $notification['data']['url'] = $params['url'];
                }
                
                // Add filters for users who enabled promotion notifications
                $notification['filters'] = array(
                    array('field' => 'tag', 'key' => 'promotion_notifications', 'relation' => '=', 'value' => 'true')
                );
                break;
                
            case 'all':
            default:
                // Send to all subscribed users
                break;
        }
        
        // If no specific targeting, send to all subscribers
        if (empty($notification['include_external_user_ids']) && empty($notification['filters'])) {
            $notification['included_segments'] = array('Subscribed Users');
        }
        
        // Send notification via OneSignal
        $response = $this->send_onesignal_notification($notification);
        
        // Parse OneSignal response
        if (isset($response['id'])) {
            return new WP_REST_Response(array(
                'success' => true,
                'notification_id' => $response['id'],
                'recipients' => isset($response['recipients']) ? $response['recipients'] : 0
            ), 200);
        } else {
            return new WP_REST_Response(array(
                'success' => false,
                'error' => isset($response['errors']) ? $response['errors'][0] : 'Unknown error'
            ), 400);
        }
    }
    
    /**
     * Send test notification
     *
     * @param WP_REST_Request $request REST API request
     * @return WP_REST_Response REST API response
     */
    public function send_test_notification($request) {
        $notification = array(
            'app_id' => getenv('ONESIGNAL_APP_ID'),
            'headings' => array('en' => 'Test Notification'),
            'contents' => array('en' => 'This is a test notification from the DRZN app'),
            'included_segments' => array('Subscribed Users'),
            'android_channel_id' => 'drzn_app_channel',
            'android_accent_color' => 'EC1C24',  // DRZN red color in hex
        );
        
        // Send notification via OneSignal
        $response = $this->send_onesignal_notification($notification);
        
        // Parse OneSignal response
        if (isset($response['id'])) {
            return new WP_REST_Response(array(
                'success' => true,
                'notification_id' => $response['id'],
                'recipients' => isset($response['recipients']) ? $response['recipients'] : 0
            ), 200);
        } else {
            return new WP_REST_Response(array(
                'success' => false,
                'error' => isset($response['errors']) ? $response['errors'][0] : 'Unknown error'
            ), 400);
        }
    }
    
    /**
     * Add admin menu page for notifications
     */
    public function add_admin_menu() {
        add_menu_page(
            'DRZN Notifications',
            'DRZN Notifications',
            'manage_options',
            'drzn-notifications',
            array($this, 'render_admin_page'),
            'dashicons-megaphone',
            30
        );
    }

    /**
     * Render admin page for notifications
     */
    public function render_admin_page() {
        // Check if form was submitted
        if (isset($_POST['drzn_notification_submit']) && check_admin_referer('drzn_notification_nonce')) {
            $title = sanitize_text_field($_POST['notification_title']);
            $message = sanitize_textarea_field($_POST['notification_message']);
            $type = sanitize_text_field($_POST['notification_type']);
            $url = esc_url_raw($_POST['notification_url']);
            
            // Send notification
            $notification = array(
                'app_id' => getenv('ONESIGNAL_APP_ID'),
                'headings' => array('en' => $title),
                'contents' => array('en' => $message),
                'data' => array(
                    'type' => $type
                ),
                'android_channel_id' => 'drzn_app_channel',
                'android_accent_color' => 'EC1C24'
            );
            
            // Add URL if provided
            if (!empty($url)) {
                $notification['data']['url'] = $url;
            }
            
            // Add segment targeting based on type
            if ($type === 'promotion') {
                // Target users who enabled promotion notifications
                $notification['filters'] = array(
                    array('field' => 'tag', 'key' => 'promotion_notifications', 'relation' => '=', 'value' => 'enabled')
                );
            } else {
                // Target all subscribed users
                $notification['included_segments'] = array('Subscribed Users');
            }
            
            // Send to OneSignal
            $response = $this->send_onesignal_notification($notification);
            
            if (isset($response['id'])) {
                echo '<div class="notice notice-success is-dismissible"><p>Notification sent successfully to ' . 
                    esc_html($response['recipients']) . ' recipients.</p></div>';
            } else {
                echo '<div class="notice notice-error is-dismissible"><p>Error sending notification: ' . 
                    esc_html(isset($response['errors']) ? $response['errors'][0] : 'Unknown error') . '</p></div>';
            }
        }
        
        // Display form
        ?>
        <div class="wrap">
            <h1>DRZN Notifications</h1>
            <p>Send push notifications to app users</p>
            
            <form method="post" action="">
                <?php wp_nonce_field('drzn_notification_nonce'); ?>
                <table class="form-table" role="presentation">
                    <tr>
                        <th scope="row"><label for="notification_title">Notification Title</label></th>
                        <td><input name="notification_title" type="text" id="notification_title" class="regular-text" required></td>
                    </tr>
                    <tr>
                        <th scope="row"><label for="notification_message">Notification Message</label></th>
                        <td><textarea name="notification_message" id="notification_message" class="large-text" rows="5" required></textarea></td>
                    </tr>
                    <tr>
                        <th scope="row"><label for="notification_type">Notification Type</label></th>
                        <td>
                            <select name="notification_type" id="notification_type">
                                <option value="all">All Users</option>
                                <option value="promotion">Promotion Only</option>
                                <option value="order">Order Updates</option>
                            </select>
                        </td>
                    </tr>
                    <tr>
                        <th scope="row"><label for="notification_url">URL (Optional)</label></th>
                        <td><input name="notification_url" type="url" id="notification_url" class="regular-text"></td>
                    </tr>
                </table>
                
                <p class="submit">
                    <input type="submit" name="drzn_notification_submit" id="drzn_notification_submit" class="button button-primary" value="Send Notification">
                </p>
            </form>
        </div>
        <?php
    }

    /**
     * Handle order status changes
     *
     * @param int $order_id The order ID
     * @param string $from_status The old status
     * @param string $to_status The new status
     * @param object $order The order object
     */
    public function handle_order_status_change($order_id, $from_status, $to_status, $order) {
        // Don't send for admin-triggered events if we're in admin dashboard
        if (is_admin() && !wp_doing_ajax()) {
            return;
        }
        
        // Get customer ID
        $customer_id = $order->get_customer_id();
        if (!$customer_id) {
            return;
        }
        
        // Get notification settings
        $status_title = '';
        $status_message = '';
        
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
        $user_id = $customer_id;
        $player_id = get_user_meta($user_id, 'onesignal_player_id', true);
        
        if (empty($player_id)) {
            return;
        }
        
        // Prepare notification
        $notification = array(
            'app_id' => getenv('ONESIGNAL_APP_ID'),
            'headings' => array('en' => $status_title),
            'contents' => array('en' => $status_message),
            'include_external_user_ids' => array($player_id),
            'data' => array(
                'type' => 'order',
                'order_id' => $order_id
            ),
            'android_channel_id' => 'drzn_order_channel',
            'android_accent_color' => 'EC1C24'
        );
        
        // Send notification
        $this->send_onesignal_notification($notification);
    }

    /**
     * Send notification to OneSignal API
     *
     * @param array $fields Notification data
     * @return array Response from OneSignal API
     */
    private function send_onesignal_notification($fields) {
        $onesignal_app_id = getenv('ONESIGNAL_APP_ID');
        
        if (empty($onesignal_app_id)) {
            return array('errors' => array('OneSignal App ID is not configured'));
        }
        
        $fields = json_encode($fields);
        
        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, 'https://onesignal.com/api/v1/notifications');
        curl_setopt($ch, CURLOPT_HTTPHEADER, array(
            'Content-Type: application/json; charset=utf-8',
            'Authorization: Basic ' . getenv('ONESIGNAL_REST_API_KEY')
        ));
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_HEADER, false);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, $fields);
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
        
        $response = curl_exec($ch);
        
        if (curl_errno($ch)) {
            return array('errors' => array(curl_error($ch)));
        }
        
        curl_close($ch);
        
        return json_decode($response, true);
    }
}

// Initialize the plugin
new OneSignal_DRZN_Notifier();