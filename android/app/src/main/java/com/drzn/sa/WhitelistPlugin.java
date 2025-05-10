package com.drzn.sa;

import android.webkit.WebView;
import com.getcapacitor.Bridge;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "WhitelistPlugin")
public class WhitelistPlugin extends Plugin {

    @Override
    public void load() {
        Bridge bridge = getBridge();
        WebView webView = bridge.getWebView();
        
        // Enable cross-origin requests
        webView.getSettings().setAllowUniversalAccessFromFileURLs(true);
        webView.getSettings().setAllowFileAccessFromFileURLs(true);
        webView.getSettings().setDomStorageEnabled(true);
        
        // Enable mixed content, similar to allowMixedContent in capacitor.config.ts
        webView.getSettings().setMixedContentMode(android.webkit.WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        
        JSObject ret = new JSObject();
        ret.put("initialized", true);
        notifyListeners("whitelistInitialized", ret);
    }

    @PluginMethod
    public void echo(PluginCall call) {
        String value = call.getString("value");
        JSObject ret = new JSObject();
        ret.put("value", value);
        call.resolve(ret);
    }
}