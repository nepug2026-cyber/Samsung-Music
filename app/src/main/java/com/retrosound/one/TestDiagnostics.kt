package com.retrosound.one

import android.app.Application
import android.content.Context
import android.os.Build
import android.os.Process
import androidx.work.BackoffPolicy
import androidx.work.Constraints
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.Worker
import androidx.work.WorkerParameters
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.net.URL
import java.nio.charset.StandardCharsets
import java.util.concurrent.TimeUnit
import javax.net.ssl.HttpsURLConnection

class RetroSoundApp : Application() {
    override fun onCreate() {
        super.onCreate()
        TestDiagnostics.initialize(this)
    }
}

/**
 * Test diagnostics: local-only until HTTPS relay is configured.
 * No logs with music titles, file names, content:// URI or device identity.
 */
object TestDiagnostics {
    private val lock = Any()
    private var app: Context? = null
    private const val MAX_RECORDS = 300

    private fun logFile(ctx: Context) = File(ctx.noBackupFilesDir, "retro-errors.jsonl")
    fun uploadConfigured() = BuildConfig.DIAGNOSTICS_ENDPOINT.startsWith("https://")

    fun initialize(context: Context) {
        synchronized(lock) {
            if (app != null) return
            app = context.applicationContext
        }
        val previous = Thread.getDefaultUncaughtExceptionHandler()
        Thread.setDefaultUncaughtExceptionHandler { thread, ex ->
            try {
                error("fatal", ex.javaClass.simpleName)
            } catch (_: Throwable) {}
            if (previous != null) previous.uncaughtException(thread, ex)
            else Process.killProcess(Process.myPid())
        }
        if (uploadConfigured() && snapshot().isNotEmpty()) scheduleUpload()
    }

    private fun clean(s: String): String =
        s.replace(Regex("[^A-Za-z0-9_.;=:-]"), "_").take(90)

    fun error(category: String, code: String, detail: String = "") {
        val ctx = app ?: return
        val item = JSONObject()
            .put("timestamp", System.currentTimeMillis())
            .put("category", clean(category))
            .put("code", clean(code))
            .put("detail", clean(detail))
            .toString()
        synchronized(lock) {
            try {
                val f = logFile(ctx)
                f.appendText(item + "\n", Charsets.UTF_8)
                if (f.length() > 130_000L) {
                    f.writeText(f.readLines().takeLast(MAX_RECORDS).joinToString("\n") + "\n")
                }
            } catch (_: Exception) {}
        }
        if (uploadConfigured()) scheduleUpload()
    }

    fun snapshot(): List<String> {
        val ctx = app ?: return emptyList()
        synchronized(lock) {
            return try { logFile(ctx).takeIf { it.exists() }?.readLines()?.filter { it.isNotBlank() } ?: emptyList() }
            catch (_: Exception) { emptyList() }
        }
    }

    fun acknowledge(sent: List<String>) {
        val ctx = app ?: return
        synchronized(lock) {
            try {
                val f = logFile(ctx)
                if (!f.exists()) return
                val remaining = f.readLines().toMutableList()
                for (line in sent) {
                    val i = remaining.indexOf(line)
                    if (i >= 0) remaining.removeAt(i)
                }
                f.writeText(if (remaining.isEmpty()) "" else remaining.joinToString("\n") + "\n")
            } catch (_: Exception) {}
        }
    }

    fun read(): String {
        val list = snapshot()
        return if (list.isEmpty()) "Журнал ошибок пуст." else list.takeLast(150).joinToString("\n")
    }

    fun clear() {
        val ctx = app ?: return
        synchronized(lock) { try { logFile(ctx).writeText("") } catch (_: Exception) {} }
    }

    private fun scheduleUpload() {
        val ctx = app ?: return
        try {
            val constraints = Constraints.Builder()
                .setRequiredNetworkType(NetworkType.CONNECTED).build()
            val request = OneTimeWorkRequestBuilder<DiagnosticsUploadWorker>()
                .setConstraints(constraints)
                .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 30, TimeUnit.SECONDS)
                .build()
            WorkManager.getInstance(ctx).enqueueUniqueWork(
                "retrosound-upload-errors", ExistingWorkPolicy.KEEP, request)
        } catch (_: Exception) {} // Never break music playback due to diagnostics.
    }
}

class DiagnosticsUploadWorker(context: Context, params: WorkerParameters) : Worker(context, params) {
    override fun doWork(): Result {
        val endpoint = BuildConfig.DIAGNOSTICS_ENDPOINT
        if (!endpoint.startsWith("https://")) return Result.success()
        val pending = TestDiagnostics.snapshot().take(80)
        if (pending.isEmpty()) return Result.success()

        var conn: HttpsURLConnection? = null
        return try {
            val body = JSONObject()
                .put("app", "RetroSoundOne")
                .put("version", BuildConfig.VERSION_NAME)
                .put("sdk", Build.VERSION.SDK_INT)
                .put("events", JSONArray(pending.map { JSONObject(it) }))
                .toString()
            conn = (URL(endpoint).openConnection() as HttpsURLConnection).apply {
                requestMethod = "POST"
                doOutput = true
                connectTimeout = 12_000
                readTimeout = 12_000
                setRequestProperty("Content-Type", "application/json; charset=utf-8")
                setRequestProperty("X-RetroSound-Report", "1")
            }
            conn.outputStream.use { it.write(body.toByteArray(StandardCharsets.UTF_8)) }
            val status = conn.responseCode
            if (status in 200..299) {
                TestDiagnostics.acknowledge(pending)
                if (TestDiagnostics.snapshot().isNotEmpty()) Result.retry() else Result.success()
            } else if (status == 408 || status == 429 || status >= 500) Result.retry()
            else Result.failure()
        } catch (_: Exception) { Result.retry() }
        finally { conn?.disconnect() }
    }
}
