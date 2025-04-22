<?php
/**
 * The core plugin class.
 *
 * This is used to define internationalization, admin-specific hooks, and
 * public-facing site hooks.
 *
 * @package    DarznAppNotifications
 */

class DarznAppNotifications {

    /**
     * The loader that's responsible for maintaining and registering all hooks that power
     * the plugin.
     *
     * @var      DarznAppNotifications_Loader    $loader    Maintains and registers all hooks for the plugin.
     */
    protected $loader;

    /**
     * The unique identifier of this plugin.
     *
     * @var      string    $plugin_name    The string used to uniquely identify this plugin.
     */
    protected $plugin_name;

    /**
     * The current version of the plugin.
     *
     * @var      string    $version    The current version of the plugin.
     */
    protected $version;

    /**
     * Define the core functionality of the plugin.
     */
    public function __construct() {
        $this->version = DARZN_NOTIFICATIONS_VERSION;
        $this->plugin_name = 'darzn-app-notifications';

        $this->load_dependencies();
        $this->set_locale();
        $this->define_admin_hooks();
        $this->define_public_hooks();
        $this->define_api_hooks();
    }

    /**
     * Load the required dependencies for this plugin.
     *
     * Include the following files that make up the plugin:
     *
     * - DarznAppNotifications_Loader. Orchestrates the hooks of the plugin.
     * - DarznAppNotifications_i18n. Defines internationalization functionality.
     * - DarznAppNotifications_Admin. Defines all hooks for the admin area.
     * - DarznAppNotifications_Public. Defines all hooks for the public side of the site.
     * - DarznAppNotifications_API. Defines all hooks for the REST API endpoints.
     *
     * Create an instance of the loader which will be used to register the hooks
     * with WordPress.
     *
     * @access   private
     */
    private function load_dependencies() {

        /**
         * The class responsible for orchestrating the actions and filters of the
         * core plugin.
         */
        require_once DARZN_NOTIFICATIONS_PLUGIN_DIR . 'includes/class-loader.php';

        /**
         * The class responsible for defining internationalization functionality
         * of the plugin.
         */
        require_once DARZN_NOTIFICATIONS_PLUGIN_DIR . 'includes/class-i18n.php';

        /**
         * The class responsible for defining all actions that occur in the admin area.
         */
        require_once DARZN_NOTIFICATIONS_PLUGIN_DIR . 'admin/class-admin.php';

        /**
         * The class responsible for defining all actions that occur in the public-facing
         * side of the site.
         */
        require_once DARZN_NOTIFICATIONS_PLUGIN_DIR . 'public/class-public.php';

        /**
         * The class responsible for defining all REST API endpoints.
         */
        require_once DARZN_NOTIFICATIONS_PLUGIN_DIR . 'includes/class-api.php';

        /**
         * The class responsible for managing banners.
         */
        require_once DARZN_NOTIFICATIONS_PLUGIN_DIR . 'includes/class-banner-controller.php';

        /**
         * The class responsible for managing notifications.
         */
        require_once DARZN_NOTIFICATIONS_PLUGIN_DIR . 'includes/class-notifications-controller.php';

        /**
         * The class responsible for OneSignal integration.
         */
        require_once DARZN_NOTIFICATIONS_PLUGIN_DIR . 'includes/class-onesignal-integration.php';

        $this->loader = new DarznAppNotifications_Loader();
    }

    /**
     * Define the locale for this plugin for internationalization.
     *
     * Uses the DarznAppNotifications_i18n class in order to set the domain and to register the hook
     * with WordPress.
     *
     * @access   private
     */
    private function set_locale() {
        $plugin_i18n = new DarznAppNotifications_i18n();
        $plugin_i18n->set_domain($this->get_plugin_name());

        $this->loader->add_action('plugins_loaded', $plugin_i18n, 'load_plugin_textdomain');
    }

    /**
     * Register all of the hooks related to the admin area functionality
     * of the plugin.
     *
     * @access   private
     */
    private function define_admin_hooks() {
        $plugin_admin = new DarznAppNotifications_Admin($this->get_plugin_name(), $this->get_version());

        // Admin menu items
        $this->loader->add_action('admin_menu', $plugin_admin, 'add_plugin_admin_menu');
        
        // Admin assets
        $this->loader->add_action('admin_enqueue_scripts', $plugin_admin, 'enqueue_styles');
        $this->loader->add_action('admin_enqueue_scripts', $plugin_admin, 'enqueue_scripts');
        
        // Banner management hooks
        $this->loader->add_action('admin_post_add_banner', $plugin_admin, 'handle_add_banner');
        $this->loader->add_action('admin_post_edit_banner', $plugin_admin, 'handle_edit_banner');
        $this->loader->add_action('admin_post_delete_banner', $plugin_admin, 'handle_delete_banner');
        
        // Notification management hooks
        $this->loader->add_action('admin_post_add_notification', $plugin_admin, 'handle_add_notification');
        $this->loader->add_action('admin_post_edit_notification', $plugin_admin, 'handle_edit_notification');
        $this->loader->add_action('admin_post_delete_notification', $plugin_admin, 'handle_delete_notification');
        $this->loader->add_action('admin_post_send_notification', $plugin_admin, 'handle_send_notification');
        
        // AJAX handlers
        $this->loader->add_action('wp_ajax_send_test_notification', $plugin_admin, 'ajax_send_test_notification');
        $this->loader->add_action('wp_ajax_get_notification_stats', $plugin_admin, 'ajax_get_notification_stats');
    }

    /**
     * Register all of the hooks related to the public-facing functionality
     * of the plugin.
     *
     * @access   private
     */
    private function define_public_hooks() {
        $plugin_public = new DarznAppNotifications_Public($this->get_plugin_name(), $this->get_version());

        // Public assets (if needed)
        $this->loader->add_action('wp_enqueue_scripts', $plugin_public, 'enqueue_styles');
        $this->loader->add_action('wp_enqueue_scripts', $plugin_public, 'enqueue_scripts');
    }

    /**
     * Register all of the hooks related to the REST API functionality
     * of the plugin.
     *
     * @access   private
     */
    private function define_api_hooks() {
        $plugin_api = new DarznAppNotifications_API($this->get_plugin_name(), $this->get_version());

        // Register REST API routes
        $this->loader->add_action('rest_api_init', $plugin_api, 'register_routes');
    }

    /**
     * Run the loader to execute all of the hooks with WordPress.
     */
    public function run() {
        $this->loader->run();
    }

    /**
     * The name of the plugin used to uniquely identify it within the context of
     * WordPress and to define internationalization functionality.
     *
     * @return    string    The name of the plugin.
     */
    public function get_plugin_name() {
        return $this->plugin_name;
    }

    /**
     * The reference to the class that orchestrates the hooks with the plugin.
     *
     * @return    DarznAppNotifications_Loader    Orchestrates the hooks of the plugin.
     */
    public function get_loader() {
        return $this->loader;
    }

    /**
     * Retrieve the version number of the plugin.
     *
     * @return    string    The version number of the plugin.
     */
    public function get_version() {
        return $this->version;
    }
}