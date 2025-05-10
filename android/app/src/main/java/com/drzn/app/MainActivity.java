package com.drzn.app;

import android.os.Bundle;
import android.webkit.WebSettings;
import android.webkit.WebView;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        // Configure WebView after Capacitor initialization
        WebView webView = getBridge().getWebView();
        WebSettings settings = webView.getSettings();
        
        // Enable JavaScript
        settings.setJavaScriptEnabled(true);
        
        // Enable DOM storage
        settings.setDomStorageEnabled(true);
        
        // Allow mixed content (http resources on https pages)
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        
        // Allow cross-origin requests from file:// URLs
        settings.setAllowFileAccessFromFileURLs(true);
        settings.setAllowUniversalAccessFromFileURLs(true);
        
        // Enable remote debugging
        WebView.setWebContentsDebuggingEnabled(true);
    }
}
