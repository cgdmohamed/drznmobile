# Taqnyat OTP API Proxy - Installation Guide

This guide explains how to install and configure the Taqnyat OTP API Proxy WordPress plugin, which provides secure endpoints for handling OTP verification without IP restrictions.

## Installation Steps

### 1. Upload the Plugin

1. Download the `taqnyat-otp-plugin.php` file
2. Log in to your WordPress admin dashboard
3. Navigate to **Plugins > Add New > Upload Plugin**
4. Choose the downloaded file and click **Install Now**
5. After installation, click **Activate Plugin**

Alternatively, you can manually upload the file:

1. Upload the `taqnyat-otp-plugin.php` file to the `/wp-content/plugins/taqnyat-otp-proxy/` directory
2. Create the directory if it doesn't exist
3. Activate the plugin through the 'Plugins' menu in WordPress

### 2. Configure the API Key

There are two ways to set your Taqnyat API key:

#### Option 1: Define in wp-config.php (Recommended for security)

Add the following line to your `wp-config.php` file:

```php
define('TAQNYAT_API_KEY', 'your_taqnyat_api_key_here');
```

#### Option 2: Set through WordPress options

Run the following SQL query in your WordPress database:

```sql
INSERT INTO wp_options (option_name, option_value, autoload) 
VALUES ('taqnyat_api_key', 'your_taqnyat_api_key_here', 'yes')
ON DUPLICATE KEY UPDATE option_value = 'your_taqnyat_api_key_here';
```

Or use WP-CLI:

```bash
wp option set taqnyat_api_key "your_taqnyat_api_key_here"
```

## API Endpoints

After installation, the plugin provides the following REST API endpoints:

### 1. Send OTP

**Endpoint:** `https://your-wordpress-site.com/wp-json/taqnyat/v1/send-otp`
**Method:** POST
**Parameters:**
- `phone` (required): The phone number to send the OTP to
- `lang` (optional): Language for the SMS, default is 'ar'
- `note` (optional): Note to include in the SMS, default is 'DRZN'

**Example Request:**
```json
{
  "phone": "5XXXXXXXX"
}
```

**Success Response:**
```json
{
  "status": "success",
  "message": "Activation code sent successfully",
  "requestId": "xxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxx"
}
```

### 2. Verify OTP

**Endpoint:** `https://your-wordpress-site.com/wp-json/taqnyat/v1/verify-otp`
**Method:** POST
**Parameters:**
- `phone` (required): The phone number that received the OTP
- `code` (required): The OTP code entered by the user
- `requestId` (optional): The request ID from the send OTP response

**Example Request:**
```json
{
  "phone": "5XXXXXXXX",
  "code": "123456",
  "requestId": "xxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxx"
}
```

**Success Response:**
```json
{
  "status": "success",
  "message": "Activation process completed successfully"
}
```

## Troubleshooting

### Common Issues

1. **Error: "Taqnyat API key not configured"**
   - Ensure you've properly set the API key using one of the methods above
   
2. **Error: "Invalid response from Taqnyat API"**
   - Check that your Taqnyat account is active and has sufficient balance
   - Verify your WordPress server can make outbound HTTP requests

3. **REST API Endpoint Not Found**
   - Ensure permalink structure is set to something other than "Plain"
   - Try navigating to WordPress admin → Settings → Permalinks and click "Save Changes"

## Security Considerations

- The plugin does not implement authentication for the API endpoints
- For production, consider adding additional security like:
  - API keys for requests
  - Rate limiting
  - IP whitelisting for your app servers

## Support

If you encounter any issues with this plugin, please contact your development team or administrator.