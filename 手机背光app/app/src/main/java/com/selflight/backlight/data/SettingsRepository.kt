package com.selflight.backlight.data

import android.content.Context
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.booleanPreferencesKey
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.emptyPreferences
import androidx.datastore.preferences.core.floatPreferencesKey
import androidx.datastore.preferences.core.intPreferencesKey
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import com.selflight.backlight.model.CustomPaletteDraft
import com.selflight.backlight.model.LightColor
import java.io.IOException
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.map

private val Context.lightSettingsDataStore by preferencesDataStore(name = "light_settings")

data class LightSettings(
    val lastHue: Float = LightColor.Default.hue,
    val lastSaturation: Float = LightColor.Default.saturation,
    val lastBrightness: Float = LightColor.Default.brightness,
    val keepScreenOn: Boolean = true,
    val autoHideControls: Boolean = true,
    val autoHideDelaySeconds: Int = 5,
    val restoreLastColor: Boolean = true,
    val customHexColors: List<String> = emptyList(),
    val customPaletteNames: List<String> = emptyList(),
    val cameraMenuOnRight: Boolean = false,
    val activePaletteKey: String = "daily_selfie",
) {
    fun toLightColor(): LightColor =
        LightColor(
            hue = lastHue,
            saturation = lastSaturation,
            brightness = lastBrightness,
        ).normalized()
}

class SettingsRepository(private val context: Context) {
    val settings: Flow<LightSettings> =
        context.lightSettingsDataStore.data
            .catch { exception ->
                if (exception is IOException) {
                    emit(emptyPreferences())
                } else {
                    throw exception
                }
            }
            .map { preferences ->
                LightSettings(
                    lastHue = preferences[Keys.LastHue] ?: LightColor.Default.hue,
                    lastSaturation = preferences[Keys.LastSaturation]
                        ?: LightColor.Default.saturation,
                    lastBrightness = preferences[Keys.LastBrightness]
                        ?: LightColor.Default.brightness,
                    keepScreenOn = preferences[Keys.KeepScreenOn] ?: true,
                    autoHideControls = preferences[Keys.AutoHideControls] ?: true,
                    autoHideDelaySeconds = preferences[Keys.AutoHideDelaySeconds] ?: 5,
                    restoreLastColor = preferences[Keys.RestoreLastColor] ?: true,
                    customHexColors = preferences[Keys.CustomHexColors]
                        ?.split("|")
                        ?.filter { it.isNotBlank() }
                        ?: emptyList(),
                    customPaletteNames = preferences[Keys.CustomPaletteNames]
                        ?.split(NameSeparator)
                        ?.filter { it.isNotBlank() }
                        ?: emptyList(),
                    cameraMenuOnRight = preferences[Keys.CameraMenuOnRight] ?: false,
                    activePaletteKey = preferences[Keys.ActivePaletteKey] ?: "daily_selfie",
                )
            }

    suspend fun saveColor(color: LightColor) {
        val normalizedColor = color.normalized()
        context.lightSettingsDataStore.edit { preferences ->
            preferences[Keys.LastHue] = normalizedColor.hue
            preferences[Keys.LastSaturation] = normalizedColor.saturation
            preferences[Keys.LastBrightness] = normalizedColor.brightness
        }
    }

    suspend fun updateKeepScreenOn(enabled: Boolean) {
        context.lightSettingsDataStore.edit { preferences ->
            preferences[Keys.KeepScreenOn] = enabled
        }
    }

    suspend fun updateAutoHideControls(enabled: Boolean) {
        context.lightSettingsDataStore.edit { preferences ->
            preferences[Keys.AutoHideControls] = enabled
        }
    }

    suspend fun updateAutoHideDelaySeconds(seconds: Int) {
        context.lightSettingsDataStore.edit { preferences ->
            preferences[Keys.AutoHideDelaySeconds] = seconds.coerceIn(3, 15)
        }
    }

    suspend fun updateRestoreLastColor(enabled: Boolean) {
        context.lightSettingsDataStore.edit { preferences ->
            preferences[Keys.RestoreLastColor] = enabled
        }
    }

    suspend fun saveCustomColor(color: LightColor) {
        val hex = color.toHexRgb()
        context.lightSettingsDataStore.edit { preferences ->
            val current = preferences[Keys.CustomHexColors]
                ?.split("|")
                ?.filter { it.isNotBlank() }
                ?: emptyList()
            val next = listOf(hex) + current.filterNot { it.equals(hex, ignoreCase = true) }
            preferences[Keys.CustomHexColors] = next.take(MaxCustomColors).joinToString("|")
        }
    }

    suspend fun addCustomPalette(colors: List<LightColor>, name: String? = null): Int {
        var newIndex = 0
        context.lightSettingsDataStore.edit { preferences ->
            val current = preferences[Keys.CustomHexColors]
                ?.split("|")
                ?.filter { it.isNotBlank() }
                ?.toMutableList()
                ?: mutableListOf()
            val names = preferences[Keys.CustomPaletteNames]
                ?.split(NameSeparator)
                ?.filter { it.isNotBlank() }
                ?.toMutableList()
                ?: mutableListOf()
            val padded = current.toMutableList()
            while (padded.size % CustomPaletteSize != 0) {
                padded.add(DefaultFillHex)
            }
            newIndex = padded.size / CustomPaletteSize
            padded.addAll(colors.take(CustomPaletteSize).map { it.toHexRgb() })
            preferences[Keys.CustomHexColors] = padded.take(MaxCustomColors).joinToString("|")
            while (names.size < newIndex) {
                names.add(defaultPaletteName(names.size))
            }
            names.add(name?.trim().takeUnless { it.isNullOrBlank() } ?: defaultPaletteName(newIndex))
            preferences[Keys.CustomPaletteNames] = names.joinToString(NameSeparator)
        }
        return newIndex
    }

    suspend fun updateCustomPalette(index: Int, name: String, colors: List<LightColor>) {
        context.lightSettingsDataStore.edit { preferences ->
            val current = preferences[Keys.CustomHexColors]
                ?.split("|")
                ?.filter { it.isNotBlank() }
                ?.toMutableList()
                ?: mutableListOf()
            val names = preferences[Keys.CustomPaletteNames]
                ?.split(NameSeparator)
                ?.filter { it.isNotBlank() }
                ?.toMutableList()
                ?: mutableListOf()
            val start = index * CustomPaletteSize
            if (start >= current.size) {
                return@edit
            }

            repeat(CustomPaletteSize) {
                if (start < current.size) {
                    current.removeAt(start)
                }
            }

            current.addAll(
                start.coerceAtMost(current.size),
                colors.take(CustomPaletteSize).map { it.toHexRgb() },
            )
            preferences[Keys.CustomHexColors] = current.take(MaxCustomColors).joinToString("|")
            while (names.size <= index) {
                names.add(defaultPaletteName(names.size))
            }
            names[index] = name.trim().ifBlank { defaultPaletteName(index) }
            preferences[Keys.CustomPaletteNames] = names.joinToString(NameSeparator)
        }
    }

    suspend fun deleteCustomPalette(index: Int) {
        context.lightSettingsDataStore.edit { preferences ->
            val current = preferences[Keys.CustomHexColors]
                ?.split("|")
                ?.filter { it.isNotBlank() }
                ?.toMutableList()
                ?: mutableListOf()
            val names = preferences[Keys.CustomPaletteNames]
                ?.split(NameSeparator)
                ?.filter { it.isNotBlank() }
                ?.toMutableList()
                ?: mutableListOf()
            val start = index * CustomPaletteSize
            if (start >= current.size) {
                return@edit
            }

            repeat(CustomPaletteSize) {
                if (start < current.size) {
                    current.removeAt(start)
                }
            }
            preferences[Keys.CustomHexColors] = current.joinToString("|")
            if (index < names.size) {
                names.removeAt(index)
            }
            preferences[Keys.CustomPaletteNames] = names.joinToString(NameSeparator)
        }
    }

    suspend fun moveCustomPalette(fromIndex: Int, toIndex: Int) {
        context.lightSettingsDataStore.edit { preferences ->
            val groups = preferences[Keys.CustomHexColors]
                ?.split("|")
                ?.filter { it.isNotBlank() }
                ?.chunked(CustomPaletteSize)
                ?.toMutableList()
                ?: mutableListOf()
            val names = preferences[Keys.CustomPaletteNames]
                ?.split(NameSeparator)
                ?.filter { it.isNotBlank() }
                ?.toMutableList()
                ?: mutableListOf()

            if (fromIndex !in groups.indices || toIndex !in groups.indices) {
                return@edit
            }

            val movedGroup = groups.removeAt(fromIndex)
            groups.add(toIndex, movedGroup)

            while (names.size < groups.size) {
                names.add(defaultPaletteName(names.size))
            }
            val movedName = names.removeAt(fromIndex)
            names.add(toIndex, movedName)

            preferences[Keys.CustomHexColors] = groups.flatten().joinToString("|")
            preferences[Keys.CustomPaletteNames] = names.joinToString(NameSeparator)
        }
    }

    suspend fun replaceCustomPalettes(palettes: List<CustomPaletteDraft>) {
        context.lightSettingsDataStore.edit { preferences ->
            val normalized = palettes.map { palette ->
                CustomPaletteDraft(
                    name = palette.name.trim().ifBlank { defaultPaletteName(0) },
                    colors = palette.colors.take(CustomPaletteSize),
                )
            }
            preferences[Keys.CustomHexColors] = normalized
                .flatMap { draft -> draft.colors.map { it.toHexRgb() } }
                .joinToString("|")
            preferences[Keys.CustomPaletteNames] = normalized
                .mapIndexed { index, draft ->
                    draft.name.ifBlank { defaultPaletteName(index) }
                }
                .joinToString(NameSeparator)
        }
    }

    suspend fun updateCameraMenuOnRight(enabled: Boolean) {
        context.lightSettingsDataStore.edit { preferences ->
            preferences[Keys.CameraMenuOnRight] = enabled
        }
    }

    suspend fun updateActivePaletteKey(key: String) {
        context.lightSettingsDataStore.edit { preferences ->
            preferences[Keys.ActivePaletteKey] = key
        }
    }

    private object Keys {
        val LastHue: Preferences.Key<Float> = floatPreferencesKey("last_hue")
        val LastSaturation: Preferences.Key<Float> = floatPreferencesKey("last_saturation")
        val LastBrightness: Preferences.Key<Float> = floatPreferencesKey("last_brightness")
        val KeepScreenOn: Preferences.Key<Boolean> = booleanPreferencesKey("keep_screen_on")
        val AutoHideControls: Preferences.Key<Boolean> = booleanPreferencesKey("auto_hide_controls")
        val AutoHideDelaySeconds: Preferences.Key<Int> =
            intPreferencesKey("auto_hide_delay_seconds")
        val RestoreLastColor: Preferences.Key<Boolean> = booleanPreferencesKey("restore_last_color")
        val CustomHexColors: Preferences.Key<String> = stringPreferencesKey("custom_hex_colors")
        val CustomPaletteNames: Preferences.Key<String> = stringPreferencesKey("custom_palette_names")
        val CameraMenuOnRight: Preferences.Key<Boolean> = booleanPreferencesKey("camera_menu_on_right")
        val ActivePaletteKey: Preferences.Key<String> = stringPreferencesKey("active_palette_key")
    }

    private companion object {
        const val MaxCustomColors = 60
        const val CustomPaletteSize = 6
        const val DefaultFillHex = "#FFFFFF"
        const val NameSeparator = "\u001F"

        fun defaultPaletteName(index: Int): String = "自定义色卡 ${index + 1}"
    }
}
