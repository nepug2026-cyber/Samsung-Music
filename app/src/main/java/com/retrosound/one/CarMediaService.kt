package com.retrosound.one

import android.Manifest
import android.content.ContentUris
import android.content.pm.PackageManager
import android.os.Build
import android.provider.MediaStore
import android.net.Uri
import org.json.JSONArray
import androidx.media3.common.C
import androidx.media3.common.MediaItem
import androidx.media3.common.Player
import androidx.media3.common.PlaybackException
import androidx.media3.common.MediaMetadata
import androidx.media3.common.util.UnstableApi
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.session.LibraryResult
import androidx.media3.session.MediaLibraryService
import androidx.media3.session.MediaSession
import com.google.common.collect.ImmutableList
import com.google.common.util.concurrent.Futures
import com.google.common.util.concurrent.ListenableFuture

/**
 * Android Auto beta. Android Auto supplies its own safe UI, not a dancing avatar.
 * The source menu permits one-tap RESUME of a service's existing active Android
 * media session. With no session / permission, the user must switch through
 * the official Android Auto app launcher. No cross-provider stream aggregation.
 */
@UnstableApi
class CarMediaService : MediaLibraryService() {
    private var player: ExoPlayer? = null
    private var carSession: MediaLibrarySession? = null
    private val root = "rs:root"
    private val demos = "rs:demo"
    private val phone = "rs:phone"
    private val sources = "rs:sources"
    private val picked = "rs:picked-folder"
    private fun savedFolderTracks(): List<MediaItem> {
        val raw = getSharedPreferences("local_folder", MODE_PRIVATE).getString("tracks", "[]") ?: "[]"
        return try {
            val data = JSONArray(raw)
            (0 until data.length()).mapNotNull { i ->
                val value = data.optJSONObject(i) ?: return@mapNotNull null
                val path = value.optString("uri")
                if (!path.startsWith("content://")) return@mapNotNull null
                MediaItem.Builder().setMediaId("rs:saf:$i").setUri(Uri.parse(path))
                    .setMediaMetadata(MediaMetadata.Builder()
                        .setTitle(value.optString("title", "Композиция"))
                        .setArtist(value.optString("artist", "Моя музыка"))
                        .setAlbumTitle(value.optString("album", "Выбранная папка"))
                        .setIsPlayable(true).setIsBrowsable(false).build()).build()
            }
        } catch (_: Exception) { emptyList() }
    }

    private fun folder(id: String, title: String, subtitle: String? = null): MediaItem =
        MediaItem.Builder().setMediaId(id).setMediaMetadata(
            MediaMetadata.Builder().setTitle(title).setSubtitle(subtitle)
                .setIsBrowsable(true).setIsPlayable(false).build()).build()

    private fun action(id: String, title: String, subtitle: String): MediaItem =
        MediaItem.Builder().setMediaId(id).setMediaMetadata(
            MediaMetadata.Builder().setTitle(title).setSubtitle(subtitle)
                .setIsBrowsable(false).setIsPlayable(true).build()).build()

    private fun localPermission(): Boolean {
        val permission = if (Build.VERSION.SDK_INT >= 33) Manifest.permission.READ_MEDIA_AUDIO
            else Manifest.permission.READ_EXTERNAL_STORAGE
        return checkSelfPermission(permission) == PackageManager.PERMISSION_GRANTED
    }

    private fun phoneTracks(): List<MediaItem> {
        if (!localPermission()) return emptyList()
        val found = mutableListOf<MediaItem>()
        val columns = arrayOf(MediaStore.Audio.Media._ID, MediaStore.Audio.Media.TITLE,
            MediaStore.Audio.Media.ARTIST, MediaStore.Audio.Media.ALBUM)
        try {
            contentResolver.query(MediaStore.Audio.Media.EXTERNAL_CONTENT_URI, columns,
                "${MediaStore.Audio.Media.IS_MUSIC} != 0", null,
                "${MediaStore.Audio.Media.TITLE} COLLATE NOCASE ASC")?.use { cursor ->
                val a = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media._ID)
                val b = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.TITLE)
                val c = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.ARTIST)
                val d = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.ALBUM)
                while (cursor.moveToNext() && found.size < 800) {
                    val id = cursor.getLong(a)
                    val uri = ContentUris.withAppendedId(MediaStore.Audio.Media.EXTERNAL_CONTENT_URI, id)
                    found += MediaItem.Builder().setMediaId("rs:music:$id").setUri(uri)
                        .setMediaMetadata(MediaMetadata.Builder()
                            .setTitle(cursor.getString(b) ?: "Без названия")
                            .setArtist(cursor.getString(c) ?: "Неизвестный исполнитель")
                            .setAlbumTitle(cursor.getString(d) ?: "")
                            .setIsPlayable(true).setIsBrowsable(false).build())
                        .build()
                }
            }
        } catch (_: Exception) { return emptyList() }
        return found
    }

    private fun sourceItems(): List<MediaItem> {
        return SourceCatalog.visible(this).map { source ->
            when {
                source.id == "local" -> folder(phone, source.title, "Локальная медиатека")
                SourceSessions.canResume(this, source.id) ->
                    action("rs:switch:${source.id}", "▶ ${source.title}",
                        "Продолжить активную медиасессию; может потребоваться вход на телефоне")
                else -> folder("rs:hint:${source.id}", source.title,
                    "Нет доступной медиасессии — переключите через меню Android Auto")
            }
        }
    }

    private fun getById(mediaId: String): MediaItem? = when {
        mediaId.startsWith("rs:demo:") -> DemoAudio.items.firstOrNull { it.mediaId == mediaId }
        mediaId.startsWith("rs:music:") -> phoneTracks().firstOrNull { it.mediaId == mediaId }
        mediaId.startsWith("rs:saf:") -> savedFolderTracks().firstOrNull { it.mediaId == mediaId }
        else -> null
    }

    private fun switchExternal(mediaIds: List<MediaItem>): Boolean {
        val id = mediaIds.singleOrNull()?.mediaId ?: return false
        if (!id.startsWith("rs:switch:")) return false
        val serviceId = id.removePrefix("rs:switch:")
        if (SourceSessions.canResume(this, serviceId)) {
            player?.pause()
            SourceSessions.resumeAlreadyActive(this, serviceId)
        }
        return true
    }

    private val callback = object : MediaLibrarySession.Callback {
        override fun onGetLibraryRoot(
            session: MediaLibrarySession,
            browser: MediaSession.ControllerInfo,
            params: LibraryParams?
        ): ListenableFuture<LibraryResult<MediaItem>> =
            Futures.immediateFuture(LibraryResult.ofItem(
                folder(root, "RetroSound One", "Музыка и источники"), params))

        override fun onGetChildren(
            session: MediaLibrarySession,
            browser: MediaSession.ControllerInfo,
            parentId: String,
            page: Int,
            pageSize: Int,
            params: LibraryParams?
        ): ListenableFuture<LibraryResult<ImmutableList<MediaItem>>> {
            val all: List<MediaItem> = when {
                parentId == root -> listOf(
                    folder(picked, "Выбранная папка телефона", "Сохранённые аудиофайлы"),
                    folder(demos, "Демо: 10 композиций"),
                    folder(phone, "Музыка телефона"),
                    folder(sources, "Переключить источник", "По вашему порядку"))
                parentId == demos -> DemoAudio.items
                parentId == picked -> savedFolderTracks()
                parentId == phone -> phoneTracks()
                parentId == sources -> sourceItems()
                parentId.startsWith("rs:hint:") -> listOf(
                    folder("rs:info:${parentId.removePrefix("rs:hint:")}",
                    "Используйте меню приложений Android Auto",
                    "Откройте нужный сервис и запустите композицию"))
                else -> emptyList()
            }
            val start = (page.toLong() * pageSize.toLong()).coerceIn(0L, all.size.toLong()).toInt()
            val end = (start.toLong() + pageSize.toLong()).coerceAtMost(all.size.toLong()).toInt()
            return Futures.immediateFuture(LibraryResult.ofItemList(all.subList(start,end),params))
        }

        override fun onAddMediaItems(
            mediaSession: MediaSession,
            controller: MediaSession.ControllerInfo,
            mediaItems: List<MediaItem>
        ): ListenableFuture<List<MediaItem>> {
            if (switchExternal(mediaItems)) return Futures.immediateFuture(emptyList())
            return Futures.immediateFuture(mediaItems.mapNotNull { item ->
                if (item.mediaId.startsWith("rs:saf:") && item.localConfiguration?.uri?.scheme == "content") item
                else getById(item.mediaId)
            })
        }

        override fun onSetMediaItems(
            mediaSession: MediaSession,
            controller: MediaSession.ControllerInfo,
            mediaItems: List<MediaItem>,
            startIndex: Int,
            startPositionMs: Long
        ): ListenableFuture<MediaSession.MediaItemsWithStartPosition> {
            if (switchExternal(mediaItems)) {
                return Futures.immediateFuture(MediaSession.MediaItemsWithStartPosition(
                    emptyList(), C.INDEX_UNSET, C.TIME_UNSET))
            }
            val resolved = mediaItems.mapNotNull { item ->
                if (item.mediaId.startsWith("rs:saf:") && item.localConfiguration?.uri?.scheme == "content") item
                else getById(item.mediaId)
            }
            val idx = if (resolved.isEmpty()) C.INDEX_UNSET else startIndex.coerceIn(0,resolved.lastIndex)
            return Futures.immediateFuture(MediaSession.MediaItemsWithStartPosition(
                resolved, idx, if (idx == C.INDEX_UNSET) C.TIME_UNSET else startPositionMs))
        }
    }

    override fun onCreate() {
        super.onCreate()
        player = ExoPlayer.Builder(this).build()
        player!!.addListener(object : Player.Listener {
            override fun onPlayerError(error: PlaybackException) {
                TestDiagnostics.error("media3", "playback_error", "code=" + error.errorCode)
            }
        })
        carSession = MediaLibrarySession.Builder(this, player!!, callback).build()
    }

    override fun onGetSession(controllerInfo: MediaSession.ControllerInfo): MediaLibrarySession? = carSession

    override fun onDestroy() {
        carSession?.release()
        carSession = null
        player?.release()
        player = null
        super.onDestroy()
    }
}
