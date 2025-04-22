<?php
/**
 * The REST API functionality of the plugin.
 *
 * @package    DarznAppNotifications
 */

class DarznAppNotifications_API {

    /**
     * The ID of this plugin.
     *
     * @var      string    $plugin_name    The ID of this plugin.
     */
    private $plugin_name;

    /**
     * The version of this plugin.
     *
     * @var      string    $version    The current version of this plugin.
     */
    private $version;

    /**
     * The namespace for the REST API endpoints.
     *
     * @var      string    $namespace    The namespace for the REST API endpoints.
     */
    private $namespace;

    /**
     * The banner controller instance.
     *
     * @var      DarznAppNotifications_Banner_Controller    $banner_controller    The banner controller instance.
     */
    private $banner_controller;

    /**
     * The notifications controller instance.
     *
     * @var      DarznAppNotifications_Notifications_Controller    $notifications_controller    The notifications controller instance.
     */
    private $notifications_controller;

    /**
     * Initialize the class and set its properties.
     *
     * @param      string    $plugin_name       The name of this plugin.
     * @param      string    $version           The version of this plugin.
     */
    public function __construct($plugin_name, $version) {
        $this->plugin_name = $plugin_name;
        $this->version = $version;
        $this->namespace = 'darzn/v1';
        
        $this->banner_controller = new DarznAppNotifications_Banner_Controller();
        $this->notifications_controller = new DarznAppNotifications_Notifications_Controller();
    }

    /**
     * Register the REST API routes.
     */
    public function register_routes() {
        // Banner endpoints
        register_rest_route($this->namespace, '/banners', array(
            array(
                'methods'  => WP_REST_Server::READABLE,
                'callback' => array($this, 'get_banners'),
                'permission_callback' => '__return_true',
            ),
        ));

        register_rest_route($this->namespace, '/banners/(?P<id>\d+)', array(
            array(
                'methods'  => WP_REST_Server::READABLE,
                'callback' => array($this, 'get_banner'),
                'permission_callback' => '__return_true',
                'args'     => array(
                    'id' => array(
                        'validate_callback' => function($param) {
                            return is_numeric($param);
                        }
                    ),
                ),
            ),
        ));

        // Device registration endpoint
        register_rest_route($this->namespace, '/devices/register', array(
            array(
                'methods'  => WP_REST_Server::CREATABLE,
                'callback' => array($this, 'register_device'),
                'permission_callback' => '__return_true',
                'args'     => array(
                    'player_id' => array(
                        'required' => true,
                        'type' => 'string',
                    ),
                    'device_type' => array(
                        'required' => true,
                        'type' => 'string',
                        'enum' => array('ios', 'android', 'web'),
                    ),
                    'user_id' => array(
                        'type' => 'integer',
                    ),
                ),
            ),
        ));

        // Device update endpoint
        register_rest_route($this->namespace, '/devices/update', array(
            array(
                'methods'  => WP_REST_Server::CREATABLE,
                'callback' => array($this, 'update_device'),
                'permission_callback' => '__return_true',
                'args'     => array(
                    'player_id' => array(
                        'required' => true,
                        'type' => 'string',
                    ),
                    'user_id' => array(
                        'required' => true,
                        'type' => 'integer',
                    ),
                ),
            ),
        ));

        // User notifications endpoint
        register_rest_route($this->namespace, '/notifications', array(
            array(
                'methods'  => WP_REST_Server::READABLE,
                'callback' => array($this, 'get_user_notifications'),
                'permission_callback' => array($this, 'check_user_auth'),
            ),
        ));

        // Mark notification as read endpoint
        register_rest_route($this->namespace, '/notifications/(?P<id>\d+)/read', array(
            array(
                'methods'  => WP_REST_Server::CREATABLE,
                'callback' => array($this, 'mark_notification_read'),
                'permission_callback' => array($this, 'check_user_auth'),
                'args'     => array(
                    'id' => array(
                        'validate_callback' => function($param) {
                            return is_numeric($param);
                        }
                    ),
                ),
            ),
        ));
    }

    /**
     * Get active banners.
     *
     * @param WP_REST_Request $request Full details about the request.
     * @return WP_REST_Response|WP_Error Response object or error.
     */
    public function get_banners($request) {
        $banners = $this->banner_controller->get_active_banners();
        
        if (is_wp_error($banners)) {
            return $banners;
        }
        
        return rest_ensure_response($banners);
    }

    /**
     * Get a specific banner.
     *
     * @param WP_REST_Request $request Full details about the request.
     * @return WP_REST_Response|WP_Error Response object or error.
     */
    public function get_banner($request) {
        $banner_id = $request->get_param('id');
        $banner = $this->banner_controller->get_banner($banner_id);
        
        if (is_wp_error($banner)) {
            return $banner;
        }
        
        if (!$banner) {
            return new WP_Error('banner_not_found', __('Banner not found', 'darzn-app-notifications'), array('status' => 404));
        }
        
        return rest_ensure_response($banner);
    }

    /**
     * Register a device for push notifications.
     *
     * @param WP_REST_Request $request Full details about the request.
     * @return WP_REST_Response|WP_Error Response object or error.
     */
    public function register_device($request) {
        $player_id = $request->get_param('player_id');
        $device_type = $request->get_param('device_type');
        $user_id = $request->get_param('user_id');
        
        $result = $this->notifications_controller->register_device($player_id, $device_type, $user_id);
        
        if (is_wp_error($result)) {
            return $result;
        }
        
        return rest_ensure_response(array(
            'success' => true,
            'message' => __('Device registered successfully', 'darzn-app-notifications'),
        ));
    }

    /**
     * Update a device's user association.
     *
     * @param WP_REST_Request $request Full details about the request.
     * @return WP_REST_Response|WP_Error Response object or error.
     */
    public function update_device($request) {
        $player_id = $request->get_param('player_id');
        $user_id = $request->get_param('user_id');
        
        $result = $this->notifications_controller->update_device_user($player_id, $user_id);
        
        if (is_wp_error($result)) {
            return $result;
        }
        
        return rest_ensure_response(array(
            'success' => true,
            'message' => __('Device user updated successfully', 'darzn-app-notifications'),
        ));
    }

    /**
     * Get notifications for the authenticated user.
     *
     * @param WP_REST_Request $request Full details about the request.
     * @return WP_REST_Response|WP_Error Response object or error.
     */
    public function get_user_notifications($request) {
        $user_id = get_current_user_id();
        $notifications = $this->notifications_controller->get_user_notifications($user_id);
        
        if (is_wp_error($notifications)) {
            return $notifications;
        }
        
        return rest_ensure_response($notifications);
    }

    /**
     * Mark a notification as read.
     *
     * @param WP_REST_Request $request Full details about the request.
     * @return WP_REST_Response|WP_Error Response object or error.
     */
    public function mark_notification_read($request) {
        $notification_id = $request->get_param('id');
        $user_id = get_current_user_id();
        
        $result = $this->notifications_controller->mark_notification_read($notification_id, $user_id);
        
        if (is_wp_error($result)) {
            return $result;
        }
        
        return rest_ensure_response(array(
            'success' => true,
            'message' => __('Notification marked as read', 'darzn-app-notifications'),
        ));
    }

    /**
     * Check if a user is authenticated.
     *
     * @param WP_REST_Request $request Full details about the request.
     * @return bool True if user is logged in, false otherwise.
     */
    public function check_user_auth($request) {
        return is_user_logged_in();
    }
}