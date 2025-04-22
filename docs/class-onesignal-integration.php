<?php
/**
 * The OneSignal integration functionality.
 *
 * @package    DarznAppNotifications
 */

class DarznAppNotifications_OneSignal_Integration {

    /**
     * The OneSignal App ID.
     *
     * @var      string    $app_id    The OneSignal App ID.
     */
    private $app_id;

    /**
     * The OneSignal REST API Key.
     *
     * @var      string    $rest_api_key    The OneSignal REST API Key.
     */
    private $rest_api_key;

    /**
     * Initialize the class and set its properties.
     */
    public function __construct() {
        $this->app_id = get_option('darzn_app_notifications_onesignal_app_id', '');
        $this->rest_api_key = get_option('darzn_app_notifications_onesignal_rest_api_key', '');
    }

    /**
     * Send a push notification.
     *
     * @param array $data The notification data.
     * @return mixed Result of the notification or WP_Error.
     */
    public function send_notification($data) {
        if (empty($this->app_id) || empty($this->rest_api_key)) {
            return new WP_Error('missing_onesignal_config', __('OneSignal configuration is missing', 'darzn-app-notifications'));
        }

        // Prepare the notification data
        $fields = array(
            'app_id' => $this->app_id,
            'headings' => array('en' => $data['title']),
            'contents' => array('en' => $data['message']),
        );

        // Add image if provided
        if (!empty($data['image_url'])) {
            $fields['big_picture'] = $data['image_url'];
            $fields['ios_attachments'] = array('id' => $data['image_url']);
        }

        // Target specific segments
        if (!empty($data['segment'])) {
            if ($data['segment'] === 'all') {
                $fields['included_segments'] = array('All');
            } else {
                $fields['included_segments'] = array($data['segment']);
            }
        }

        // Target specific devices
        if (!empty($data['player_ids']) && is_array($data['player_ids'])) {
            $fields['include_player_ids'] = $data['player_ids'];
        }

        // Target specific users
        if (!empty($data['user_ids']) && is_array($data['user_ids'])) {
            // Get player IDs for these users from the database
            $player_ids = $this->get_player_ids_for_users($data['user_ids']);
            if (!empty($player_ids)) {
                $fields['include_player_ids'] = $player_ids;
            }
        }

        // Add action data for deep linking
        if (!empty($data['action_type']) && !empty($data['action_data'])) {
            $fields['data'] = array(
                'action_type' => $data['action_type'],
                'action_data' => $data['action_data'],
            );
        }

        // Add scheduled delivery if specified
        if (!empty($data['scheduled_at'])) {
            // OneSignal requires delivery time in UTC format
            $scheduled_time = new DateTime($data['scheduled_at'], new DateTimeZone(wp_timezone_string()));
            $scheduled_time->setTimezone(new DateTimeZone('UTC'));
            $fields['send_after'] = $scheduled_time->format('Y-m-d H:i:s \U\T\C');
        }

        // Make the API request to OneSignal
        $response = wp_remote_post(
            'https://onesignal.com/api/v1/notifications',
            array(
                'headers' => array(
                    'Authorization' => 'Basic ' . $this->rest_api_key,
                    'Content-Type' => 'application/json',
                ),
                'body' => json_encode($fields),
            )
        );

        // Handle API response
        if (is_wp_error($response)) {
            return $response;
        }

        $response_code = wp_remote_retrieve_response_code($response);
        $response_body = json_decode(wp_remote_retrieve_body($response), true);

        if ($response_code !== 200) {
            return new WP_Error(
                'onesignal_api_error',
                isset($response_body['errors']) ? implode(', ', $response_body['errors']) : __('Unknown error from OneSignal API', 'darzn-app-notifications'),
                array('status' => $response_code)
            );
        }

        return $response_body;
    }

    /**
     * Send a test notification to a specific device.
     *
     * @param string $player_id The OneSignal player ID.
     * @param array $data The notification data.
     * @return mixed Result of the notification or WP_Error.
     */
    public function send_test_notification($player_id, $data) {
        $data['player_ids'] = array($player_id);
        return $this->send_notification($data);
    }

    /**
     * Get player IDs for a list of user IDs.
     *
     * @param array $user_ids Array of user IDs.
     * @return array Array of player IDs.
     */
    private function get_player_ids_for_users($user_ids) {
        global $wpdb;
        $table_name = $wpdb->prefix . 'darzn_app_devices';
        
        // Convert user IDs to comma-separated list for SQL query
        $user_ids_str = implode(',', array_map('intval', $user_ids));
        
        // Get player IDs for these users
        $player_ids = $wpdb->get_col(
            "SELECT player_id FROM {$table_name} WHERE user_id IN ({$user_ids_str}) AND status = 'active'"
        );
        
        return $player_ids;
    }

    /**
     * Get user segments from OneSignal.
     *
     * @return array|WP_Error Array of segments or WP_Error.
     */
    public function get_segments() {
        if (empty($this->app_id) || empty($this->rest_api_key)) {
            return new WP_Error('missing_onesignal_config', __('OneSignal configuration is missing', 'darzn-app-notifications'));
        }

        // Make the API request to OneSignal
        $response = wp_remote_get(
            'https://onesignal.com/api/v1/apps/' . $this->app_id . '/segments',
            array(
                'headers' => array(
                    'Authorization' => 'Basic ' . $this->rest_api_key,
                    'Content-Type' => 'application/json',
                ),
            )
        );

        // Handle API response
        if (is_wp_error($response)) {
            return $response;
        }

        $response_code = wp_remote_retrieve_response_code($response);
        $response_body = json_decode(wp_remote_retrieve_body($response), true);

        if ($response_code !== 200) {
            return new WP_Error(
                'onesignal_api_error',
                isset($response_body['errors']) ? implode(', ', $response_body['errors']) : __('Unknown error from OneSignal API', 'darzn-app-notifications'),
                array('status' => $response_code)
            );
        }

        return $response_body;
    }

    /**
     * Create a new segment in OneSignal.
     *
     * @param string $name The segment name.
     * @param array $filters The segment filters.
     * @return array|WP_Error Result of the segment creation or WP_Error.
     */
    public function create_segment($name, $filters) {
        if (empty($this->app_id) || empty($this->rest_api_key)) {
            return new WP_Error('missing_onesignal_config', __('OneSignal configuration is missing', 'darzn-app-notifications'));
        }

        // Prepare the segment data
        $fields = array(
            'name' => $name,
            'filters' => $filters,
        );

        // Make the API request to OneSignal
        $response = wp_remote_post(
            'https://onesignal.com/api/v1/apps/' . $this->app_id . '/segments',
            array(
                'headers' => array(
                    'Authorization' => 'Basic ' . $this->rest_api_key,
                    'Content-Type' => 'application/json',
                ),
                'body' => json_encode($fields),
            )
        );

        // Handle API response
        if (is_wp_error($response)) {
            return $response;
        }

        $response_code = wp_remote_retrieve_response_code($response);
        $response_body = json_decode(wp_remote_retrieve_body($response), true);

        if ($response_code !== 200) {
            return new WP_Error(
                'onesignal_api_error',
                isset($response_body['errors']) ? implode(', ', $response_body['errors']) : __('Unknown error from OneSignal API', 'darzn-app-notifications'),
                array('status' => $response_code)
            );
        }

        return $response_body;
    }

    /**
     * Get notification delivery statistics.
     *
     * @param string $notification_id The OneSignal notification ID.
     * @return array|WP_Error Result of the statistics or WP_Error.
     */
    public function get_notification_stats($notification_id) {
        if (empty($this->app_id) || empty($this->rest_api_key)) {
            return new WP_Error('missing_onesignal_config', __('OneSignal configuration is missing', 'darzn-app-notifications'));
        }

        // Make the API request to OneSignal
        $response = wp_remote_get(
            'https://onesignal.com/api/v1/notifications/' . $notification_id . '?app_id=' . $this->app_id,
            array(
                'headers' => array(
                    'Authorization' => 'Basic ' . $this->rest_api_key,
                    'Content-Type' => 'application/json',
                ),
            )
        );

        // Handle API response
        if (is_wp_error($response)) {
            return $response;
        }

        $response_code = wp_remote_retrieve_response_code($response);
        $response_body = json_decode(wp_remote_retrieve_body($response), true);

        if ($response_code !== 200) {
            return new WP_Error(
                'onesignal_api_error',
                isset($response_body['errors']) ? implode(', ', $response_body['errors']) : __('Unknown error from OneSignal API', 'darzn-app-notifications'),
                array('status' => $response_code)
            );
        }

        // Extract useful stats
        $stats = array(
            'successful' => isset($response_body['successful']) ? $response_body['successful'] : 0,
            'failed' => isset($response_body['failed']) ? $response_body['failed'] : 0,
            'converted' => isset($response_body['converted']) ? $response_body['converted'] : 0,
            'remaining' => isset($response_body['remaining']) ? $response_body['remaining'] : 0,
            'queued_at' => isset($response_body['queued_at']) ? $response_body['queued_at'] : null,
            'completed_at' => isset($response_body['completed_at']) ? $response_body['completed_at'] : null,
        );

        return $stats;
    }
}