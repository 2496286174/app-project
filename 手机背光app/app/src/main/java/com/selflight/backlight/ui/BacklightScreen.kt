package com.selflight.backlight.ui

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutVertically
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.luminance
import androidx.compose.ui.input.pointer.pointerInput
import com.selflight.backlight.data.LightSettings
import com.selflight.backlight.data.SettingsRepository
import com.selflight.backlight.model.ColorPreset
import com.selflight.backlight.model.LightColor
import com.selflight.backlight.model.CustomPaletteDraft
import com.selflight.backlight.model.buildPaletteGroups
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

private enum class AppScreen {
    Backlight,
    Settings,
    Camera,
    PaletteLibrary,
}

@Composable
fun BacklightApp(settingsRepository: SettingsRepository) {
    val savedSettings by settingsRepository.settings.collectAsState(initial = null)
    var lightColor by remember { mutableStateOf(LightColor.Default) }
    var hasLoadedSettings by remember { mutableStateOf(false) }
    var currentScreen by remember { mutableStateOf(AppScreen.Backlight) }
    var returnScreenAfterPalette by remember { mutableStateOf(AppScreen.Backlight) }
    val scope = rememberCoroutineScope()

    LaunchedEffect(savedSettings) {
        val settings = savedSettings
        if (settings != null && !hasLoadedSettings) {
            lightColor = if (settings.restoreLastColor) {
                settings.toLightColor()
            } else {
                LightColor.Default
            }
            hasLoadedSettings = true
        }
    }

    LaunchedEffect(lightColor, hasLoadedSettings) {
        if (hasLoadedSettings) {
            delay(150)
            settingsRepository.saveColor(lightColor)
        }
    }

    BackHandler(enabled = currentScreen != AppScreen.Backlight) {
        currentScreen = if (currentScreen == AppScreen.PaletteLibrary) {
            returnScreenAfterPalette
        } else {
            AppScreen.Backlight
        }
    }

    val settings = savedSettings ?: LightSettings()
    val paletteGroups = buildPaletteGroups(
        customHexColors = settings.customHexColors,
        customPaletteNames = settings.customPaletteNames,
    )
    val activePalette = paletteGroups.firstOrNull { it.key == settings.activePaletteKey }
        ?: paletteGroups.first()

    when (currentScreen) {
        AppScreen.Backlight -> BacklightScreen(
            lightColor = lightColor,
            settings = settings,
            activePaletteName = activePalette.name,
            activePaletteColors = activePalette.colors,
            onColorChange = { lightColor = it.normalized() },
            onOpenSettings = { currentScreen = AppScreen.Settings },
            onOpenCamera = { currentScreen = AppScreen.Camera },
            onOpenPaletteLibrary = {
                returnScreenAfterPalette = AppScreen.Backlight
                currentScreen = AppScreen.PaletteLibrary
            },
        )

        AppScreen.Settings -> SettingsScreen(
            settings = settings,
            lightColor = lightColor,
            onBack = { currentScreen = AppScreen.Backlight },
            onKeepScreenOnChange = { enabled ->
                scope.launch { settingsRepository.updateKeepScreenOn(enabled) }
            },
            onRestoreLastColorChange = { enabled ->
                scope.launch { settingsRepository.updateRestoreLastColor(enabled) }
            },
            onAutoHideControlsChange = { enabled ->
                scope.launch { settingsRepository.updateAutoHideControls(enabled) }
            },
            onAutoHideDelayChange = { seconds ->
                scope.launch { settingsRepository.updateAutoHideDelaySeconds(seconds) }
            },
            onCameraMenuSideChange = { onRight ->
                scope.launch { settingsRepository.updateCameraMenuOnRight(onRight) }
            },
        )

        AppScreen.Camera -> SelfieCameraScreen(
            lightColor = lightColor,
            settings = settings,
            activePaletteName = activePalette.name,
            activePaletteColors = activePalette.colors,
            onColorChange = { lightColor = it.normalized() },
            onBack = { currentScreen = AppScreen.Backlight },
            onOpenSettings = { currentScreen = AppScreen.Settings },
            onOpenPaletteLibrary = {
                returnScreenAfterPalette = AppScreen.Camera
                currentScreen = AppScreen.PaletteLibrary
            },
        )

        AppScreen.PaletteLibrary -> PaletteLibraryScreen(
            paletteGroups = paletteGroups,
            selectedPaletteKey = activePalette.key,
            onBack = { currentScreen = returnScreenAfterPalette },
            onSelectPalette = { palette ->
                scope.launch {
                    settingsRepository.updateActivePaletteKey(palette.key)
                }
                palette.colors.firstOrNull()?.let { lightColor = it.color.normalized() }
                currentScreen = returnScreenAfterPalette
            },
            onCreateCustomPalette = { name, colors ->
                scope.launch {
                    val index = settingsRepository.addCustomPalette(colors, name)
                    settingsRepository.updateActivePaletteKey("custom_$index")
                }
                colors.firstOrNull()?.let { lightColor = it.normalized() }
            },
            onUpdateCustomPalette = { index, name, colors ->
                scope.launch {
                    settingsRepository.updateCustomPalette(index, name, colors)
                    settingsRepository.updateActivePaletteKey("custom_$index")
                }
                colors.firstOrNull()?.let { lightColor = it.normalized() }
            },
            onDeleteCustomPalette = { palette ->
                val index = palette.customIndex ?: return@PaletteLibraryScreen
                scope.launch {
                    settingsRepository.deleteCustomPalette(index)
                    val activeCustomIndex = settings.activePaletteKey
                        .removePrefix("custom_")
                        .toIntOrNull()
                    if (settings.activePaletteKey == palette.key) {
                        settingsRepository.updateActivePaletteKey("daily_selfie")
                    } else if (activeCustomIndex != null && activeCustomIndex > index) {
                        settingsRepository.updateActivePaletteKey("custom_${activeCustomIndex - 1}")
                    }
                }
                if (settings.activePaletteKey == palette.key) {
                    lightColor = buildPaletteGroups(emptyList()).first().colors.first().color
                }
            },
            onDuplicatePalette = { palette ->
                val colors = palette.colors.map { it.color }
                scope.launch {
                    val index = settingsRepository.addCustomPalette(colors, "${palette.name} 副本")
                    settingsRepository.updateActivePaletteKey("custom_$index")
                }
                colors.firstOrNull()?.let { lightColor = it.normalized() }
            },
            onReplaceCustomPalettes = { palettes, nextActiveKey ->
                scope.launch {
                    settingsRepository.replaceCustomPalettes(palettes)
                    settingsRepository.updateActivePaletteKey(nextActiveKey)
                }
                palettes.firstOrNull()?.colors?.firstOrNull()?.let { lightColor = it.normalized() }
            },
            onAppendCustomPalettes = { palettes ->
                scope.launch {
                    var firstNewIndex: Int? = null
                    palettes.forEach { palette ->
                        val index = settingsRepository.addCustomPalette(palette.colors, palette.name)
                        if (firstNewIndex == null) {
                            firstNewIndex = index
                        }
                    }
                    firstNewIndex?.let {
                        settingsRepository.updateActivePaletteKey("custom_$it")
                    }
                }
                palettes.firstOrNull()?.colors?.firstOrNull()?.let { lightColor = it.normalized() }
            },
        )
    }
}

@Composable
fun BacklightScreen(
    lightColor: LightColor,
    settings: LightSettings,
    activePaletteName: String,
    activePaletteColors: List<ColorPreset>,
    onColorChange: (LightColor) -> Unit,
    onOpenSettings: () -> Unit,
    onOpenCamera: () -> Unit,
    onOpenPaletteLibrary: () -> Unit,
) {
    val backgroundColor = lightColor.toComposeColor()
    val isBrightBackground = backgroundColor.luminance() > 0.55f
    val contentColor = if (isBrightBackground) {
        Color(0xFF171717)
    } else {
        Color.White
    }
    val panelColor = if (isBrightBackground) {
        Color.White.copy(alpha = 0.62f)
    } else {
        Color.Black.copy(alpha = 0.36f)
    }
    val panelBorderColor = contentColor.copy(alpha = if (isBrightBackground) 0.10f else 0.18f)
    var controlsVisible by remember { mutableStateOf(true) }

    LaunchedEffect(
        controlsVisible,
        lightColor,
        settings.autoHideControls,
        settings.autoHideDelaySeconds,
    ) {
        if (controlsVisible && settings.autoHideControls) {
            delay(settings.autoHideDelaySeconds.coerceAtLeast(1) * 1000L)
            controlsVisible = false
        }
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(backgroundColor),
    ) {
        Box(
            modifier = Modifier
                .fillMaxSize()
                .pointerInput(Unit) {
                    detectTapGestures {
                        controlsVisible = !controlsVisible
                    }
                },
        )

        AnimatedVisibility(
            visible = controlsVisible,
            enter = fadeIn() + slideInVertically(initialOffsetY = { it / 2 }),
            exit = fadeOut() + slideOutVertically(targetOffsetY = { it / 2 }),
            modifier = Modifier.align(Alignment.BottomCenter),
        ) {
            ControlPanel(
                lightColor = lightColor,
                paletteName = activePaletteName,
                presets = activePaletteColors,
                contentColor = contentColor,
                panelColor = panelColor,
                panelBorderColor = panelBorderColor,
                actionText = "相机",
                onAction = onOpenCamera,
                onOpenSettings = onOpenSettings,
                onOpenPaletteLibrary = onOpenPaletteLibrary,
                onColorChange = onColorChange,
                onPresetSelected = { onColorChange(it.color) },
                onHide = { controlsVisible = false },
            )
        }
    }
}
