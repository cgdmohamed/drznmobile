<?php
/**
 * Plugin Name: Taqnyat OTP API Proxy
 * Description: Provides proxy endpoints for the Taqnyat OTP verification service to bypass IP restrictions
 * Version: 1.0.0
 * Author: DRZN
 * Text Domain: taqnyat-otp-proxy
 */

// Exit if accessed directly
if (!defined('ABSPATH')) {
    exit;
}

class Taqnyat_OTP_Proxy {

    /**
     * Initialize the plugin
     */
    public function __construct() {
        // Register REST API routes
        add_action('rest_api_init', array($this, 'register_api_routes'));
    }

    /**
     * Register the REST API routes
     */
    public function register_api_routes() {
        // Register the endpoint for sending OTP
        register_rest_route('taqnyat/v1', '/send-otp', array(
            'methods' => 'POST',
            'callback' => array($this, 'send_otp'),
            'permission_callback' => '__return_true'
        ));

        // Register the endpoint for verifying OTP
        register_rest_route('taqnyat/v1', '/verify-otp', array(
            'methods' => 'POST',
            'callback' => array($this, 'verify_otp'),
            'permission_callback' => '__return_true'
        ));
    }

    /**
     * Send OTP via Taqnyat API
     * 
     * @param WP_REST_Request $request The REST request
     * @return WP_REST_Response The REST response
     */
    public function send_otp($request) {
        // Get the phone number from the request
        $params = $request->get_params();

        if (empty($params['phone'])) {
            return new WP_REST_Response(array(
                'status' => 'error',
                'message' => 'Missing phone number'
            ), 400);
        }

        // Format phone number
        $phone = $this->format_phone_number($params['phone']);

        // Get API key from options or use direct value
        $key = "a8a12c634d80e32a74a490d13579e1d4";
        $api_key = $key;//defined('TAQNYAT_API_KEY') ? TAQNYAT_API_KEY : get_option('taqnyat_api_key');

        if (empty($api_key)) {
            return new WP_REST_Response(array(
                'status' => 'error',
                'message' => 'Taqnyat API key not configured'
            ), 500);
        }

        // Prepare the request to Taqnyat API
        $taqnyat_request = array(
            'apiKey' => $api_key,
            'numbers' => array($phone),
            'method' => 'sms',
            'sender' => 'Drzn',
            'lang' => isset($params['lang']) ? $params['lang'] : 'ar',
            'note' => isset($params['note']) ? $params['note'] : 'DRZN',
            'returnJson' => 1
        );

        // Make the request to Taqnyat API
        $response = wp_remote_post('https://api.taqnyat.sa/verify.php', array(
            'body' => json_encode(array($taqnyat_request)),
            'headers' => array(
                'Content-Type' => 'application/json',
            ),
            'timeout' => 30
        ));

        // Check for errors
        if (is_wp_error($response)) {
            return new WP_REST_Response(array(
                'status' => 'error',
                'message' => $response->get_error_message()
            ), 500);
        }


        // Parse the response
        $body = wp_remote_retrieve_body($response);
        error_log('Taqnyat Raw Response: ' . print_r($body, true));

        $result = json_decode($body, true);

        // Format the response for the app
        if (
            isset($result['status']) &&
            $result['status'] == 1 &&
            isset($result['Data']['result']) &&
            $result['Data']['result'] == 5
        ) {
            return new WP_REST_Response([
                'status' => 'success',
                'message' => $result['Data']['MessageAr'] ?? $result['Data']['MessageEn'] ?? 'تم الإرسال',
                'requestId' => $result['Data']['id'] ?? null
            ], 200);
        } else {
            return new WP_REST_Response([
                'status' => 'error',
                'message' => $result['Data']['MessageAr'] ?? $result['Error'] ?? 'Unknown error',
                'code' => $result['Data']['result'] ?? 0
            ], 400);
        }

        // Fallback error response
        return new WP_REST_Response(array(
            'status' => 'error',
            'message' => 'Invalid response from Taqnyat API'
        ), 500);
    }

    /**
     * Verify OTP via Taqnyat API
     * 
     * @param WP_REST_Request $request The REST request
     * @return WP_REST_Response The REST response
     */
    public function verify_otp($request) {
        // Get the parameters from the request
        $params = $request->get_params();

        if (empty($params['phone']) || empty($params['code'])) {
            return new WP_REST_Response(array(
                'status' => 'error',
                'message' => 'Missing required parameters (phone or code)'
            ), 400);
        }

        // Format phone number
        $phone = $this->format_phone_number($params['phone']);
        $code = $params['code'];
        $requestId = isset($params['requestId']) ? $params['requestId'] : null;

        // Get API key from options or use direct value
        $api_key = defined('TAQNYAT_API_KEY') ? TAQNYAT_API_KEY : get_option('taqnyat_api_key');

        if (empty($api_key)) {
            return new WP_REST_Response(array(
                'status' => 'error',
                'message' => 'Taqnyat API key not configured'
            ), 500);
        }

        // Prepare the request to Taqnyat API
        $taqnyat_request = array(
            'apiKey' => $api_key,
            'numbers' => array($phone),
            'method' => 'sms',
            'activeKey' => $code,
            'returnJson' => 1
        );

        // Add requestId if provided
        if ($requestId) {
            $taqnyat_request['requestId'] = $requestId;
        }

        // Make the request to Taqnyat API
        $response = wp_remote_post('https://api.taqnyat.sa/verify.php', array(
            'body' => json_encode(array($taqnyat_request)),
            'headers' => array(
                'Content-Type' => 'application/json',
            ),
            'timeout' => 30
        ));

        // Check for errors
        if (is_wp_error($response)) {
            return new WP_REST_Response(array(
                'status' => 'error',
                'message' => $response->get_error_message()
            ), 500);
        }

        // Parse the response
        $body = wp_remote_retrieve_body($response);
        $result = json_decode($body, true);

        // Format the response for the app
        if (!empty($result) && is_array($result) && isset($result[0])) {
            $data = $result[0];

            if (isset($data['code']) && $data['code'] == 10) {
                // Success response for verification
                return new WP_REST_Response(array(
                    'status' => 'success',
                    'message' => $data['message']
                ), 200);
            } else {
                // Error response
                return new WP_REST_Response(array(
                    'status' => 'error',
                    'message' => isset($data['message']) ? $data['message'] : 'Invalid verification code',
                    'code' => isset($data['code']) ? $data['code'] : 0
                ), 400);
            }
        }

        // Fallback error response
        return new WP_REST_Response(array(
            'status' => 'error',
            'message' => 'Invalid response from Taqnyat API'
        ), 500);
    }

    /**
     * Format phone number to E.164 format for Saudi Arabia
     * 
     * @param string $phone The phone number to format
     * @return string The formatted phone number
     */
    private function format_phone_number($phone) {
        // Remove any non-digit characters
        $digits = preg_replace('/\D/', '', $phone);

        // Remove country code (966) if present
        if (strpos($digits, '966') === 0) {
            $digits = substr($digits, 3);
        }

        // Remove leading zero if present
        if (strpos($digits, '0') === 0) {
            $digits = substr($digits, 1);
        }

        // Add Saudi country code
        return '966' . $digits;
    }
}

// Initialize the plugin
$taqnyat_otp_proxy = new Taqnyat_OTP_Proxy();