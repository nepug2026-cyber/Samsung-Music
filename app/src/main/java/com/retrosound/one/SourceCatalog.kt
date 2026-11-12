package com.retrosound.one

import android.app.NotificationManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.media.session.MediaController
import android.media.session.MediaSessionManager
import android.media.session.PlaybackState
import android.net.Uri
import android.service.notification.NotificationListenerService

class SourceNotificationListener : NotificationListenerService()

data class MusicSource(val id: String, val title: String, val packageName: String? = null)

object SourceCatalog {
    val all = listOf(
        MusicSource("local", "Музыка телефона"),
        MusicSource("yandex", "Яндекс Музыка", "ru.yandex.music"),
        MusicSource("mts", "МТС Музыка / КИОН", "ru.mts.music.android"),
        MusicSource("zvuk", "Сбер Музыка / Звук", "com.zvooq.openplay"),
        MusicSource("apple", "Apple Music", "com.apple.android.music"),
        MusicSource("youtube", "YouTube Music", "com.google.android.apps.youtube.music"),
        MusicSource("vk", "VK Музыка", "com.uma.musicvk"),
        MusicSource("spotify", "Spotify", "com.spotify.music"),
        MusicSource("tidal", "TIDAL", "com.aspiro.tidal")
    )
    val ids = all.map { it.id }
    val byId = all.associateBy { it.id }
    fun visible(context: Context): List<MusicSource> {
        val prefs = context.getSharedPreferences("car_sources", Context.MODE_PRIVATE)
        val order = prefs.getString("order", null)?.split(',')?.filter { it in byId }?.distinct() ?: ids
        val hidden = prefs.getString("hidden", "tidal")?.split(',')?.toSet() ?: setOf("tidal")
        return (order + ids.filterNot { it in order }).filterNot { it in hidden }.mapNotNull { byId[it] }
    }
}

/**
 * Playback transport to an existing Android media session.
 * No DRM bypass, stream extraction or unsupported launch from Android Auto.
 */
object SourceSessions {
    private fun component(context: Context) = ComponentName(context, SourceNotificationListener::class.java)
    fun hasAccess(context: Context): Boolean = try {
        (context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager)
            .isNotificationListenerAccessGranted(component(context))
    } catch (_: Exception) { false }
    fun active(context: Context): List<MediaController> = try {
        if (!hasAccess(context)) emptyList() else
        (context.getSystemService(Context.MEDIA_SESSION_SERVICE) as MediaSessionManager)
            .getActiveSessions(component(context))
    } catch (_: Exception) { emptyList() }
    fun controller(context: Context, id: String): MediaController? {
        val pkg = SourceCatalog.byId[id]?.packageName ?: return null
        return active(context).firstOrNull { it.packageName == pkg }
    }
    fun canResume(context: Context, id: String): Boolean {
        val state = controller(context, id)?.playbackState ?: return false
        return state.state == PlaybackState.STATE_PLAYING ||
            ((state.actions and (PlaybackState.ACTION_PLAY or PlaybackState.ACTION_PLAY_PAUSE)) != 0L)
    }
    fun resumeAlreadyActive(context: Context, id: String): Boolean {
        val player = controller(context, id) ?: return false
        if (!canResume(context, id)) return false
        return try {
            val others = SourceCatalog.all.mapNotNull { it.packageName }.toSet()
            active(context).filter { it.packageName != player.packageName && it.packageName in others }
                .forEach { it.transportControls.pause() }
            player.transportControls.play()
            true
        } catch (_: Exception) { false }
    }
    fun activateFromPhone(context: Context, id: String) {
        if (resumeAlreadyActive(context, id)) return
        val pkg = SourceCatalog.byId[id]?.packageName ?: return
        val launch = context.packageManager.getLaunchIntentForPackage(pkg) ?: return
        try { context.startActivity(launch) } catch (_: Exception) { }
    }
}
