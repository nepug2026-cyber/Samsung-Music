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
import android.provider.DocumentsContract
import android.net.Uri
import android.webkit.WebResourceResponse
import java.io.File
import java.io.FileInputStream
import java.io.InputStream
import java.io.BufferedInputStream
import org.json.JSONArray
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
    private val folderPickerRequest = 109
    private val folderPrefs by lazy { getSharedPreferences("local_folder", MODE_PRIVATE) }
    private val folderUris = java.util.concurrent.ConcurrentHashMap<String, Uri>()

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
                override fun shouldInterceptRequest(view: WebView?, request: WebResourceRequest?): WebResourceResponse? {
                    val u = request?.url ?: return null
                    if (u.scheme == "https" && u.host == "retrosound.local" && u.path?.startsWith("/audio/") == true) {
                        val id = u.lastPathSegment ?: return null
                        val uri = folderUris[id] ?: return null
                        return try {
                            val mime = contentResolver.getType(uri)?.takeIf { it.startsWith("audio/") } ?: "audio/mpeg"
                            val stream = contentResolver.openInputStream(uri) ?: return null
                            WebResourceResponse(mime, null, stream).apply {
                                responseHeaders = mapOf("Access-Control-Allow-Origin" to "*", "Cache-Control" to "no-store")
                            }
                        } catch (_: Exception) { null }
                    }
                    return super.shouldInterceptRequest(view, request)
                }
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
        browser.postDelayed({ loadSavedFolder() }, 1100)
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
        if (requestCode == folderPickerRequest) {
            if (resultCode == RESULT_OK && data?.data != null) {
                val uri = data.data!!
                try {
                    contentResolver.takePersistableUriPermission(uri, Intent.FLAG_GRANT_READ_URI_PERMISSION)
                    folderPrefs.edit().putString("uri", uri.toString()).apply()
                    scanFolder(uri)
                } catch (_: Exception) { browser.evaluateJavascript("window.retroNativeFolderError?.(\'Не удалось открыть папку\')", null) }
            }
            return
        }
        if (requestCode == filePickerRequest) {
            val result = if (resultCode == RESULT_OK) WebChromeClient.FileChooserParams.parseResult(resultCode, data)
                         else null
            fileCallback?.onReceiveValue(result)
            fileCallback = null
        }
    }

    private fun loadSavedFolder() {
        val saved = folderPrefs.getString("uri", null) ?: return
        try { scanFolder(Uri.parse(saved)) } catch (_: Exception) { }
    }

    private fun scanFolder(root: Uri) {
        Thread {
            try {
                val granted = contentResolver.persistedUriPermissions.any { it.uri == root && it.isReadPermission }
                if (!granted) throw SecurityException("Доступ к папке не сохранён. Выберите её повторно.")
                val items = JSONArray()
                folderUris.clear()
                val stack = java.util.ArrayDeque<Pair<String, Int>>()
                stack.add(DocumentsContract.getTreeDocumentId(root) to 0)
                while (!stack.isEmpty()) {
                    val (docId, depth) = stack.removeLast()
                    if (depth > 32) continue
                    val children = DocumentsContract.buildChildDocumentsUriUsingTree(root, docId)
                    contentResolver.query(children, arrayOf(
                        DocumentsContract.Document.COLUMN_DOCUMENT_ID,
                        DocumentsContract.Document.COLUMN_DISPLAY_NAME,
                        DocumentsContract.Document.COLUMN_MIME_TYPE
                    ), null, null, null)?.use { cursor ->
                        val idCol = cursor.getColumnIndexOrThrow(DocumentsContract.Document.COLUMN_DOCUMENT_ID)
                        val nameCol = cursor.getColumnIndexOrThrow(DocumentsContract.Document.COLUMN_DISPLAY_NAME)
                        val mimeCol = cursor.getColumnIndexOrThrow(DocumentsContract.Document.COLUMN_MIME_TYPE)
                        while (cursor.moveToNext()) {
                            val id = cursor.getString(idCol)
                            val name = cursor.getString(nameCol) ?: continue
                            val mime = cursor.getString(mimeCol) ?: ""
                            if (mime == DocumentsContract.Document.MIME_TYPE_DIR) {
                                stack.add(id to depth + 1)
                            } else if (mime.startsWith("audio/") || name.matches(Regex("(?i).*\\.(mp3|m4a|aac|ogg|wav|flac|opus)"))) {
                                val key = folderUris.size.toString()
                                folderUris[key] = DocumentsContract.buildDocumentUriUsingTree(root, id)
                                items.put(JSONObject().put("title", name.substringBeforeLast('.'))
                                    .put("artist", "Моя музыка").put("album", "Музыка телефона")
                                    .put("src", "https://retrosound.local/audio/$key"))
                            }
                        }
                    }
                }
                val json = items.toString()
                runOnUiThread { browser.evaluateJavascript("window.retroNativeTracks?.($json)", null) }
            } catch (e: Exception) {
                val message = JSONObject.quote(e.message ?: "Ошибка чтения папки")
                runOnUiThread { browser.evaluateJavascript("window.retroNativeFolderError?.($message)", null) }
            }
        }.start()
    }

    private inner class Bridge {
        @JavascriptInterface fun pickMusicFolder() {
            runOnUiThread {
                try { startActivityForResult(Intent(Intent.ACTION_OPEN_DOCUMENT_TREE).apply {
                    addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION)
                }, folderPickerRequest) } catch (_: Exception) { }
            }
        }
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
                if (sourceId != "local") {
                    val result = SourceSessions.activateFromPhone(this@MainActivity, sourceId)
                    browser.evaluateJavascript("window.retroSourceResult?.(" + JSONObject.quote(sourceId) + "," + JSONObject.quote(result) + ")", null)
                }
            }
        }
        @JavascriptInterface fun mediaCommand(command: String, sourceId: String) {
            runOnUiThread {
                val ok = SourceSessions.command(this@MainActivity, sourceId, command)
                browser.evaluateJavascript("window.retroMediaResult?.(" + JSONObject.quote(sourceId) + "," + ok.toString() + ")", null)
            }
        }
        @JavascriptInterface fun openMusicService(sourceId: String) {
            runOnUiThread { SourceSessions.openFromPhone(this@MainActivity, sourceId) }
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
