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