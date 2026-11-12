package com.retrosound.one

import android.Manifest
import android.app.Activity
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.provider.Settings
import android.webkit.JavascriptInterface
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import org.json.JSONObject

/**
 * Phone beta: the 0.5 visual demo packaged in the APK. Does not need web access.
 * Android Auto uses the independent Media3 session in CarMediaService.
 */
class MainActivity : Activity() {
    private lateinit var browser: WebView
    private var fileCallback: ValueCallback<Array<android.net.Uri>>? = null
    private val filePickerRequest = 108

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        browser = WebView(this).apply {
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            settings.allowFileAccess = true
            settings.allowContentAccess = true
            // No broad file/file or file/network cross-origin access.
            settings.allowFileAccessFromFileURLs = false
            settings.allowUniversalAccessFromFileURLs = false
            settings.mediaPlaybackRequiresUserGesture = true
            webViewClient = object : WebViewClient() {
                override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                    val url = request.url.toString()
                    return !url.startsWith("file:///android_asset/demo/")
                }
            }
            webChromeClient = object : WebChromeClient() {
                override fun onShowFileChooser(
                    webView: WebView, callback: ValueCallback<Array<android.net.Uri>>,
                    params: FileChooserParams
                ): Boolean {
                    fileCallback?.onReceiveValue(null)
                    fileCallback = callback
                    return try {
                        startActivityForResult(Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
                            addCategory(Intent.CATEGORY_OPENABLE)
                            type = "*/*"
                            putExtra(Intent.EXTRA_MIME_TYPES, arrayOf("audio/*", "image/*"))
                            putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true)
                            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                        }, filePickerRequest)
                        true
                    } catch (_: Exception) {
                        fileCallback = null
                        callback.onReceiveValue(null)
                        false
                    }
                }
            }
            addJavascriptInterface(Bridge(), "AndroidBridge")
        }
        setContentView(browser)
        browser.loadUrl("file:///android_asset/demo/index.html")
        requestAudioPermission()
    }

    private fun requestAudioPermission() {
        val p = if (Build.VERSION.SDK_INT >= 33) Manifest.permission.READ_MEDIA_AUDIO
                else Manifest.permission.READ_EXTERNAL_STORAGE
        if (checkSelfPermission(p) != PackageManager.PERMISSION_GRANTED) requestPermissions(arrayOf(p), 100)
    }

    @Deprecated("Compatibility callback for Android 10+")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode == filePickerRequest) {
            val result = if (resultCode == RESULT_OK) WebChromeClient.FileChooserParams.parseResult(resultCode, data)
                         else null
            fileCallback?.onReceiveValue(result)
            fileCallback = null
        }
    }

    private inner class Bridge {
        @JavascriptInterface fun saveState(payload: String) {
            try {
                val obj = JSONObject(payload)
                val order = obj.optJSONArray("order") ?: return
                val hidden = obj.optJSONArray("hidden") ?: return
                val allow = SourceCatalog.ids.toSet()
                val ids = (0 until order.length()).map { order.optString(it) }.filter { it in allow }.distinct()
                val hide = (0 until hidden.length()).map { hidden.optString(it) }.filter { it in allow }.distinct()
                val selected = obj.optString("selected", "local").takeIf { it in allow } ?: "local"
                getSharedPreferences("car_sources", Context.MODE_PRIVATE).edit()
                    .putString("order", (ids + SourceCatalog.ids.filterNot { it in ids }).joinToString(","))
                    .putString("hidden", hide.joinToString(","))
                    .putString("selected", selected)
                    .apply()
            } catch (_: Exception) { }
        }
        /** Only a direct user tap from the local, trusted UI invokes this method. */
        @JavascriptInterface fun activateSource(sourceId: String) {
            runOnUiThread {
                if (sourceId != "local") SourceSessions.activateFromPhone(this@MainActivity, sourceId)
            }
        }
        @JavascriptInterface fun haptic(intensity: Int) {
            if (intensity <= 0) return
            runOnUiThread {
                try {
                    val vibrator = if (Build.VERSION.SDK_INT >= 31)
                        (getSystemService(VIBRATOR_MANAGER_SERVICE) as VibratorManager).defaultVibrator
                    else (getSystemService(VIBRATOR_SERVICE) as Vibrator)
                    vibrator.vibrate(VibrationEffect.createOneShot((intensity * 16).toLong(),
                        VibrationEffect.DEFAULT_AMPLITUDE))
                } catch (_: Exception) {}
            }
        }
        @JavascriptInterface fun requestSessionAccess() {
            runOnUiThread {
                startActivity(Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS))
            }
        }
    }

    @Deprecated("Android back behavior")
    override fun onBackPressed() {
        // The web UI implements its own back buttons for collection/settings.
        super.onBackPressed()
    }
    override fun onDestroy() {
        browser.removeJavascriptInterface("AndroidBridge")
        browser.destroy()
        super.onDestroy()
    }
}
