package com.selflight.backlight.ui

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.camera.core.CameraSelector
import androidx.camera.core.Preview
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInHorizontally
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutHorizontally
import androidx.compose.animation.slideOutVertically
import androidx.compose.foundation.background
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.border
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBars
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBars
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Slider
import androidx.compose.material3.SliderDefaults
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.luminance
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.viewinterop.AndroidView
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import androidx.lifecycle.LifecycleOwner
import androidx.lifecycle.compose.LocalLifecycleOwner
import com.selflight.backlight.data.LightSettings
import com.selflight.backlight.model.ColorPreset
import com.selflight.backlight.model.LightColor
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException
import kotlin.coroutines.suspendCoroutine
import kotlinx.coroutines.delay

@Composable
fun SelfieCameraScreen(
    lightColor: LightColor,
    settings: LightSettings,
    activePaletteName: String,
    activePaletteColors: List<ColorPreset>,
    onColorChange: (LightColor) -> Unit,
    onBack: () -> Unit,
    onOpenSettings: () -> Unit,
    onOpenPaletteLibrary: () -> Unit,
) {
    val backgroundColor = lightColor.toComposeColor()
    val isBrightBackground = backgroundColor.luminance() > 0.55f
    val contentColor = if (isBrightBackground) Color(0xFF171717) else Color.White
    val panelColor = if (isBrightBackground) {
        Color.White.copy(alpha = 0.64f)
    } else {
        Color.Black.copy(alpha = 0.40f)
    }
    val panelBorderColor = contentColor.copy(alpha = if (isBrightBackground) 0.12f else 0.20f)
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

    BoxWithConstraints(
        modifier = Modifier
            .fillMaxSize()
            .background(backgroundColor)
            .pointerInput(Unit) {
                detectTapGestures {
                    controlsVisible = !controlsVisible
                }
            },
    ) {
        val isLandscape = maxWidth > maxHeight

        if (isLandscape) {
            CameraStage(
                modifier = Modifier.fillMaxSize(),
                lightColor = lightColor,
                contentColor = contentColor,
                panelColor = panelColor,
                panelBorderColor = panelBorderColor,
                onColorChange = onColorChange,
                slidersVisible = false,
                onBack = onBack,
            )

            val menuOnRight = settings.cameraMenuOnRight
            AnimatedVisibility(
                visible = controlsVisible,
                enter = fadeIn() + slideInHorizontally(
                    initialOffsetX = { fullWidth ->
                        if (menuOnRight) fullWidth else -fullWidth
                    },
                ),
                exit = fadeOut() + slideOutHorizontally(
                    targetOffsetX = { fullWidth ->
                        if (menuOnRight) fullWidth else -fullWidth
                    },
                ),
                modifier = Modifier.align(
                    if (menuOnRight) Alignment.CenterEnd else Alignment.CenterStart,
                ),
            ) {
                ControlPanel(
                    modifier = Modifier
                        .width(340.dp)
                        .fillMaxHeight()
                        .windowInsetsPadding(WindowInsets.statusBars)
                        .windowInsetsPadding(WindowInsets.navigationBars),
                    shape = if (menuOnRight) {
                        RoundedCornerShape(topStart = 20.dp, bottomStart = 20.dp)
                    } else {
                        RoundedCornerShape(topEnd = 20.dp, bottomEnd = 20.dp)
                    },
                    applyNavigationBarsPadding = false,
                    maxHeight = 900.dp,
                    lightColor = lightColor,
                    paletteName = activePaletteName,
                    presets = activePaletteColors,
                    contentColor = contentColor,
                    panelColor = panelColor,
                    panelBorderColor = panelBorderColor,
                    actionText = "补光",
                    onAction = onBack,
                    onOpenSettings = onOpenSettings,
                    onOpenPaletteLibrary = onOpenPaletteLibrary,
                    onColorChange = onColorChange,
                    onPresetSelected = { onColorChange(it.color) },
                    onHide = { controlsVisible = false },
                    compactPresets = true,
                )
            }
        } else {
            Column(
                modifier = Modifier.fillMaxSize(),
            ) {
                CameraStage(
                    modifier = Modifier
                        .weight(1f)
                        .fillMaxWidth(),
                    lightColor = lightColor,
                    contentColor = contentColor,
                    panelColor = panelColor,
                    panelBorderColor = panelBorderColor,
                    onColorChange = onColorChange,
                    slidersVisible = controlsVisible,
                    onBack = onBack,
                )

                AnimatedVisibility(
                    visible = controlsVisible,
                    enter = fadeIn() + slideInVertically(initialOffsetY = { it / 2 }),
                    exit = fadeOut() + slideOutVertically(targetOffsetY = { it / 2 }),
                ) {
                    CameraBottomPanel(
                        lightColor = lightColor,
                        activePaletteColors = activePaletteColors,
                        contentColor = contentColor,
                        panelColor = panelColor,
                        panelBorderColor = panelBorderColor,
                        onColorChange = onColorChange,
                        onBack = onBack,
                        onOpenSettings = onOpenSettings,
                        onOpenPaletteLibrary = onOpenPaletteLibrary,
                        onHide = { controlsVisible = false },
                    )
                }
            }
        }
    }
}

@Composable
private fun CameraStage(
    modifier: Modifier,
    lightColor: LightColor,
    contentColor: Color,
    panelColor: Color,
    panelBorderColor: Color,
    onColorChange: (LightColor) -> Unit,
    slidersVisible: Boolean,
    onBack: () -> Unit,
) {
    val context = LocalContext.current
    var hasCameraPermission by remember {
        mutableStateOf(
            ContextCompat.checkSelfPermission(
                context,
                Manifest.permission.CAMERA,
            ) == PackageManager.PERMISSION_GRANTED,
        )
    }
    val permissionLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.RequestPermission(),
    ) { granted ->
        hasCameraPermission = granted
    }

    LaunchedEffect(Unit) {
        if (!hasCameraPermission) {
            permissionLauncher.launch(Manifest.permission.CAMERA)
        }
    }

    BoxWithConstraints(modifier = modifier) {
        val isPortrait = maxHeight >= maxWidth
        val previewModifier = if (isPortrait) {
            Modifier
                .fillMaxWidth(0.58f)
                .aspectRatio(3f / 4f)
        } else {
            Modifier
                .fillMaxHeight(0.62f)
                .aspectRatio(3f / 4f)
        }

        Surface(
            modifier = Modifier
                .align(Alignment.Center)
                .then(previewModifier),
            color = Color.Black.copy(alpha = 0.18f),
            contentColor = contentColor,
            border = BorderStroke(1.dp, panelBorderColor),
            shape = RoundedCornerShape(28.dp),
        ) {
            Box(modifier = Modifier.fillMaxSize()) {
                if (hasCameraPermission) {
                    CameraPreview(
                        modifier = Modifier
                            .fillMaxSize()
                            .clip(RoundedCornerShape(28.dp)),
                        contentColor = Color.White,
                    )
                } else {
                    CameraPermissionPanel(
                        contentColor = Color.White,
                        onRequestPermission = {
                            permissionLauncher.launch(Manifest.permission.CAMERA)
                        },
                    )
                }
            }
        }

        if (slidersVisible) {
            CameraSideSlider(
                modifier = Modifier
                    .align(Alignment.CenterStart)
                    .padding(start = 16.dp),
                label = "色相",
                valueText = "${lightColor.hueDegrees}°",
                value = lightColor.normalized().hue,
                valueRange = 0f..360f,
                activeColor = LightColor(
                    hue = lightColor.hue,
                    saturation = 1f,
                    brightness = 1f,
                ).toComposeColor(),
                contentColor = contentColor,
                panelColor = panelColor,
                panelBorderColor = panelBorderColor,
                onValueChange = { onColorChange(lightColor.copy(hue = it)) },
            )
            CameraSideSlider(
                modifier = Modifier
                    .align(Alignment.CenterEnd)
                    .padding(end = 16.dp),
                label = "明度",
                valueText = "${lightColor.brightnessPercent}%",
                value = lightColor.normalized().brightness,
                valueRange = 0f..1f,
                activeColor = lightColor.copy(brightness = 1f).toComposeColor(),
                contentColor = contentColor,
                panelColor = panelColor,
                panelBorderColor = panelBorderColor,
                onValueChange = { onColorChange(lightColor.copy(brightness = it)) },
            )
            CameraHorizontalSlider(
                modifier = Modifier
                    .align(Alignment.BottomCenter)
                    .padding(horizontal = 90.dp, vertical = 18.dp),
                label = "饱和度",
                valueText = "${lightColor.saturationPercent}%",
                value = lightColor.normalized().saturation,
                valueRange = 0f..1f,
                activeColor = lightColor.copy(saturation = 1f, brightness = 1f).toComposeColor(),
                contentColor = contentColor,
                panelColor = panelColor,
                panelBorderColor = panelBorderColor,
                onValueChange = { onColorChange(lightColor.copy(saturation = it)) },
            )
        }

        Surface(
            modifier = Modifier
                .align(Alignment.TopCenter)
                .windowInsetsPadding(WindowInsets.statusBars)
                .padding(top = 16.dp),
            color = panelColor,
            contentColor = contentColor,
            border = BorderStroke(1.dp, panelBorderColor),
            shape = RoundedCornerShape(999.dp),
        ) {
            Row(
                modifier = Modifier.padding(start = 8.dp, end = 16.dp, top = 4.dp, bottom = 4.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                PanelActionButton(
                    text = "返回",
                    contentColor = contentColor,
                    onClick = onBack,
                )
                Text(
                    text = "自拍模式",
                    color = contentColor.copy(alpha = 0.82f),
                    style = MaterialTheme.typography.labelLarge,
                )
            }
        }
    }
}

@Composable
private fun CameraSideSlider(
    modifier: Modifier,
    label: String,
    valueText: String,
    value: Float,
    valueRange: ClosedFloatingPointRange<Float>,
    activeColor: Color,
    contentColor: Color,
    panelColor: Color,
    panelBorderColor: Color,
    onValueChange: (Float) -> Unit,
) {
    Surface(
        modifier = modifier,
        color = panelColor,
        contentColor = contentColor,
        border = BorderStroke(1.dp, panelBorderColor),
        shape = RoundedCornerShape(999.dp),
    ) {
        Column(
            modifier = Modifier
                .width(52.dp)
                .height(430.dp)
                .padding(horizontal = 4.dp, vertical = 10.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.SpaceBetween,
        ) {
            Text(
                text = label,
                color = contentColor,
                fontSize = 12.sp,
                fontWeight = FontWeight.Medium,
            )
            Box(
                modifier = Modifier
                    .width(44.dp)
                    .height(340.dp),
                contentAlignment = Alignment.Center,
            ) {
                VerticalValueSlider(
                    modifier = Modifier
                        .width(44.dp)
                        .height(330.dp),
                    value = value,
                    valueRange = valueRange,
                    activeColor = activeColor,
                    inactiveColor = contentColor.copy(alpha = 0.24f),
                    thumbColor = contentColor,
                    onValueChange = onValueChange,
                )
            }
            Text(
                text = valueText,
                color = contentColor.copy(alpha = 0.82f),
                fontSize = 12.sp,
                fontWeight = FontWeight.Medium,
            )
        }
    }
}

@Composable
private fun VerticalValueSlider(
    value: Float,
    valueRange: ClosedFloatingPointRange<Float>,
    activeColor: Color,
    inactiveColor: Color,
    thumbColor: Color,
    onValueChange: (Float) -> Unit,
    modifier: Modifier = Modifier,
) {
    fun updateFromY(y: Float, height: Float) {
        val fraction = (1f - (y / height)).coerceIn(0f, 1f)
        val nextValue = valueRange.start + (valueRange.endInclusive - valueRange.start) * fraction
        onValueChange(nextValue)
    }

    Canvas(
        modifier = modifier
            .pointerInput(valueRange) {
                detectTapGestures { offset ->
                    updateFromY(offset.y, size.height.toFloat())
                }
            }
            .pointerInput(valueRange) {
                detectDragGestures { change, _ ->
                    updateFromY(change.position.y, size.height.toFloat())
                }
            },
    ) {
        val range = valueRange.endInclusive - valueRange.start
        val fraction = if (range == 0f) {
            0f
        } else {
            ((value - valueRange.start) / range).coerceIn(0f, 1f)
        }
        val stroke = 12.dp.toPx()
        val thumbStroke = 4.dp.toPx()
        val centerX = size.width / 2f
        val top = stroke / 2f
        val bottom = size.height - stroke / 2f
        val thumbY = bottom - (bottom - top) * fraction

        drawLine(
            color = inactiveColor,
            start = androidx.compose.ui.geometry.Offset(centerX, top),
            end = androidx.compose.ui.geometry.Offset(centerX, bottom),
            strokeWidth = stroke,
            cap = StrokeCap.Round,
        )
        drawLine(
            color = activeColor,
            start = androidx.compose.ui.geometry.Offset(centerX, bottom),
            end = androidx.compose.ui.geometry.Offset(centerX, thumbY),
            strokeWidth = stroke,
            cap = StrokeCap.Round,
        )
        drawLine(
            color = thumbColor,
            start = androidx.compose.ui.geometry.Offset(centerX - 20.dp.toPx(), thumbY),
            end = androidx.compose.ui.geometry.Offset(centerX + 20.dp.toPx(), thumbY),
            strokeWidth = thumbStroke,
            cap = StrokeCap.Round,
        )
    }
}

@Composable
private fun CameraHorizontalSlider(
    modifier: Modifier,
    label: String,
    valueText: String,
    value: Float,
    valueRange: ClosedFloatingPointRange<Float>,
    activeColor: Color,
    contentColor: Color,
    panelColor: Color,
    panelBorderColor: Color,
    onValueChange: (Float) -> Unit,
) {
    Surface(
        modifier = modifier,
        color = panelColor,
        contentColor = contentColor,
        border = BorderStroke(1.dp, panelBorderColor),
        shape = RoundedCornerShape(999.dp),
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 14.dp, vertical = 8.dp),
            horizontalArrangement = Arrangement.spacedBy(10.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(
                text = label,
                color = contentColor,
                fontSize = 12.sp,
                fontWeight = FontWeight.Medium,
            )
            Slider(
                modifier = Modifier.weight(1f),
                value = value,
                onValueChange = onValueChange,
                valueRange = valueRange,
                colors = SliderDefaults.colors(
                    thumbColor = contentColor,
                    activeTrackColor = activeColor,
                    inactiveTrackColor = contentColor.copy(alpha = 0.24f),
                ),
            )
            Text(
                text = valueText,
                color = contentColor.copy(alpha = 0.82f),
                fontSize = 12.sp,
                fontWeight = FontWeight.Medium,
            )
        }
    }
}

@Composable
private fun CameraBottomPanel(
    lightColor: LightColor,
    activePaletteColors: List<ColorPreset>,
    contentColor: Color,
    panelColor: Color,
    panelBorderColor: Color,
    onColorChange: (LightColor) -> Unit,
    onBack: () -> Unit,
    onOpenSettings: () -> Unit,
    onOpenPaletteLibrary: () -> Unit,
    onHide: () -> Unit,
) {
    Surface(
        modifier = Modifier
            .fillMaxWidth()
            .windowInsetsPadding(WindowInsets.navigationBars),
        color = panelColor,
        contentColor = contentColor,
        border = BorderStroke(1.dp, panelBorderColor),
        shape = RoundedCornerShape(topStart = 20.dp, topEnd = 20.dp),
    ) {
        Column(
            modifier = Modifier.padding(horizontal = 18.dp, vertical = 14.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Row(
                    modifier = Modifier.weight(1f),
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Box(
                        modifier = Modifier
                            .size(42.dp)
                            .clip(RoundedCornerShape(999.dp))
                            .background(lightColor.toComposeColor())
                            .border(
                                BorderStroke(1.dp, contentColor.copy(alpha = 0.28f)),
                                RoundedCornerShape(999.dp),
                            ),
                    )
                    Column {
                        Text(
                            text = "自拍补光板",
                            color = contentColor,
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.SemiBold,
                        )
                        Text(
                            text = "${lightColor.toHexRgb()} · H ${lightColor.hueDegrees}  S ${lightColor.saturationPercent}  B ${lightColor.brightnessPercent}",
                            color = contentColor.copy(alpha = 0.68f),
                            fontSize = 12.sp,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                        )
                    }
                }
                Row(
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    PanelActionButton(
                        text = "设置",
                        contentColor = contentColor,
                        onClick = onOpenSettings,
                    )
                }
            }

            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .horizontalScroll(rememberScrollState()),
                horizontalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                Surface(
                    modifier = Modifier
                        .widthIn(min = 82.dp)
                        .height(64.dp)
                        .clickable { onOpenPaletteLibrary() },
                    color = contentColor.copy(alpha = 0.07f),
                    contentColor = contentColor,
                    border = BorderStroke(1.dp, panelBorderColor),
                    shape = RoundedCornerShape(16.dp),
                ) {
                    Column(
                        modifier = Modifier.padding(horizontal = 10.dp, vertical = 8.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.Center,
                    ) {
                        Text(
                            text = "+",
                            color = contentColor,
                            fontSize = 18.sp,
                            fontWeight = FontWeight.Medium,
                        )
                        Spacer(modifier = Modifier.height(5.dp))
                        Text(
                            text = "色卡库",
                            color = contentColor,
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Medium,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                            textAlign = TextAlign.Center,
                        )
                    }
                }

                activePaletteColors.forEach { preset ->
                    val isSelected = lightColor.isCloseTo(preset.color)
                    Surface(
                        modifier = Modifier
                            .widthIn(min = 72.dp)
                            .height(64.dp)
                            .clickable { onColorChange(preset.color) },
                        color = contentColor.copy(alpha = if (isSelected) 0.16f else 0.07f),
                        contentColor = contentColor,
                        border = BorderStroke(
                            width = if (isSelected) 1.5.dp else 1.dp,
                            color = if (isSelected) {
                                contentColor.copy(alpha = 0.58f)
                            } else {
                                panelBorderColor
                            },
                        ),
                        shape = RoundedCornerShape(16.dp),
                    ) {
                        Column(
                            modifier = Modifier.padding(horizontal = 10.dp, vertical = 8.dp),
                            horizontalAlignment = Alignment.CenterHorizontally,
                            verticalArrangement = Arrangement.Center,
                        ) {
                            Box(
                                modifier = Modifier
                                    .size(26.dp)
                                    .clip(RoundedCornerShape(999.dp))
                                    .background(preset.color.toComposeColor())
                                    .border(
                                        BorderStroke(1.dp, contentColor.copy(alpha = 0.30f)),
                                        RoundedCornerShape(999.dp),
                                    ),
                            )
                            Spacer(modifier = Modifier.height(5.dp))
                            Text(
                                text = preset.name,
                                color = contentColor,
                                fontSize = 12.sp,
                                fontWeight = if (isSelected) {
                                    FontWeight.SemiBold
                                } else {
                                    FontWeight.Medium
                                },
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis,
                                textAlign = TextAlign.Center,
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun CameraPermissionPanel(
    contentColor: Color,
    onRequestPermission: () -> Unit,
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Color.Black.copy(alpha = 0.46f))
            .padding(22.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Text(
            text = "需要相机权限",
            color = contentColor,
            style = MaterialTheme.typography.titleMedium,
        )
        Spacer(modifier = Modifier.height(12.dp))
        TextButton(onClick = onRequestPermission) {
            Text(text = "授权", color = contentColor)
        }
    }
}

@Composable
private fun CameraPreview(
    modifier: Modifier,
    contentColor: Color,
) {
    val context = LocalContext.current
    val lifecycleOwner = LocalLifecycleOwner.current
    val previewView = remember {
        PreviewView(context).apply {
            implementationMode = PreviewView.ImplementationMode.COMPATIBLE
            scaleType = PreviewView.ScaleType.FILL_CENTER
        }
    }
    var cameraProvider by remember { mutableStateOf<ProcessCameraProvider?>(null) }
    var cameraError by remember { mutableStateOf<String?>(null) }

    LaunchedEffect(context, lifecycleOwner, previewView) {
        try {
            val provider = context.getCameraProvider()
            cameraProvider = provider
            bindSelfiePreview(
                cameraProvider = provider,
                lifecycleOwner = lifecycleOwner,
                previewView = previewView,
            )
            cameraError = null
        } catch (exception: Exception) {
            cameraError = "无法打开前置相机"
        }
    }

    DisposableEffect(Unit) {
        onDispose {
            cameraProvider?.unbindAll()
        }
    }

    Box(modifier = modifier) {
        AndroidView(
            modifier = Modifier.fillMaxSize(),
            factory = { previewView },
            update = { view ->
                view.scaleType = PreviewView.ScaleType.FILL_CENTER
            },
        )
        val error = cameraError
        if (error != null) {
            CameraMessageOverlay(
                message = error,
                contentColor = contentColor,
            )
        }
    }
}

@Composable
private fun CameraMessageOverlay(
    message: String,
    contentColor: Color,
) {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color.Black.copy(alpha = 0.58f))
            .padding(22.dp),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            text = message,
            color = contentColor,
            style = MaterialTheme.typography.titleMedium,
        )
    }
}

private suspend fun Context.getCameraProvider(): ProcessCameraProvider =
    suspendCoroutine { continuation ->
        val future = ProcessCameraProvider.getInstance(this)
        future.addListener(
            {
                try {
                    continuation.resume(future.get())
                } catch (exception: Exception) {
                    continuation.resumeWithException(exception)
                }
            },
            ContextCompat.getMainExecutor(this),
        )
    }

private fun bindSelfiePreview(
    cameraProvider: ProcessCameraProvider,
    lifecycleOwner: LifecycleOwner,
    previewView: PreviewView,
) {
    val preview = Preview.Builder()
        .build()
        .also { preview ->
            preview.setSurfaceProvider(previewView.surfaceProvider)
        }

    cameraProvider.unbindAll()
    cameraProvider.bindToLifecycle(
        lifecycleOwner,
        CameraSelector.DEFAULT_FRONT_CAMERA,
        preview,
    )
}
