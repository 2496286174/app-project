package com.selflight.backlight.ui

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.navigationBars
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Slider
import androidx.compose.material3.SliderDefaults
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.getValue
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.sp
import com.selflight.backlight.model.ColorPreset
import com.selflight.backlight.model.LightColor

@Composable
fun ControlPanel(
    lightColor: LightColor,
    paletteName: String,
    presets: List<ColorPreset>,
    contentColor: Color,
    panelColor: Color,
    panelBorderColor: Color,
    actionText: String,
    onAction: () -> Unit,
    onOpenSettings: () -> Unit,
    onOpenPaletteLibrary: () -> Unit,
    onColorChange: (LightColor) -> Unit,
    onPresetSelected: (ColorPreset) -> Unit,
    onHide: () -> Unit,
    modifier: Modifier = Modifier.fillMaxWidth(),
    shape: Shape = RoundedCornerShape(topStart = 20.dp, topEnd = 20.dp),
    applyNavigationBarsPadding: Boolean = true,
    maxHeight: Dp = 680.dp,
    compactPresets: Boolean = false,
) {
    Surface(
        modifier = if (applyNavigationBarsPadding) {
            modifier.windowInsetsPadding(WindowInsets.navigationBars)
        } else {
            modifier
        },
        color = panelColor,
        contentColor = contentColor,
        border = BorderStroke(1.dp, panelBorderColor),
        shape = shape,
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .heightIn(max = maxHeight)
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 18.dp, vertical = 14.dp),
        ) {
            Box(
                modifier = Modifier
                    .align(Alignment.CenterHorizontally)
                    .width(42.dp)
                    .height(4.dp)
                    .clip(CircleShape)
                    .background(contentColor.copy(alpha = 0.24f)),
            )

            Spacer(modifier = Modifier.height(14.dp))

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    Box(
                        modifier = Modifier
                            .size(42.dp)
                            .clip(CircleShape)
                            .background(lightColor.toComposeColor())
                            .border(
                                BorderStroke(1.dp, contentColor.copy(alpha = 0.28f)),
                                CircleShape,
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
                    if (actionText != "补光") {
                        PanelActionButton(
                            text = actionText,
                            contentColor = contentColor,
                            onClick = onAction,
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(16.dp))

            PresetRow(
                paletteName = paletteName,
                presets = presets,
                selectedColor = lightColor,
                contentColor = contentColor,
                panelBorderColor = panelBorderColor,
                onPresetSelected = onPresetSelected,
                onPaletteLibraryClick = onOpenPaletteLibrary,
                compactPresets = compactPresets,
            )

            Spacer(modifier = Modifier.height(18.dp))

            LabeledSlider(
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
                onValueChange = {
                    onColorChange(lightColor.copy(hue = it))
                },
            )

            LabeledSlider(
                label = "饱和度",
                valueText = "${lightColor.saturationPercent}%",
                value = lightColor.normalized().saturation,
                valueRange = 0f..1f,
                activeColor = lightColor.copy(saturation = 1f, brightness = 1f).toComposeColor(),
                contentColor = contentColor,
                onValueChange = {
                    onColorChange(lightColor.copy(saturation = it))
                },
            )

            LabeledSlider(
                label = "明度",
                valueText = "${lightColor.brightnessPercent}%",
                value = lightColor.normalized().brightness,
                valueRange = 0f..1f,
                activeColor = lightColor.copy(brightness = 1f).toComposeColor(),
                contentColor = contentColor,
                onValueChange = {
                    onColorChange(lightColor.copy(brightness = it))
                },
            )

            Spacer(modifier = Modifier.height(12.dp))
        }
    }
}

@Composable
private fun PresetRow(
    paletteName: String,
    presets: List<ColorPreset>,
    selectedColor: LightColor,
    contentColor: Color,
    panelBorderColor: Color,
    onPresetSelected: (ColorPreset) -> Unit,
    onPaletteLibraryClick: () -> Unit,
    compactPresets: Boolean,
) {
    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.Start,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(
                text = paletteName,
                color = contentColor.copy(alpha = 0.78f),
                fontSize = 13.sp,
                fontWeight = FontWeight.Medium,
            )
        }

        if (compactPresets) {
            CompactPresetGrid(
                presets = presets,
                selectedColor = selectedColor,
                contentColor = contentColor,
                panelBorderColor = panelBorderColor,
                onPresetSelected = onPresetSelected,
                onPaletteLibraryClick = onPaletteLibraryClick,
            )
        } else {
            PresetScroller(
                presets = presets,
                selectedColor = selectedColor,
                contentColor = contentColor,
                panelBorderColor = panelBorderColor,
                onPresetSelected = onPresetSelected,
                onPaletteLibraryClick = onPaletteLibraryClick,
            )
        }
    }
}

@Composable
private fun CompactPresetGrid(
    presets: List<ColorPreset>,
    selectedColor: LightColor,
    contentColor: Color,
    panelBorderColor: Color,
    onPresetSelected: (ColorPreset) -> Unit,
    onPaletteLibraryClick: () -> Unit,
) {
    FlowRow(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(10.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        PresetTile(
            presetName = "色卡库",
            color = null,
            isSelected = false,
            contentColor = contentColor,
            panelBorderColor = panelBorderColor,
            onClick = onPaletteLibraryClick,
        )
        presets.forEach { preset ->
            PresetTile(
                presetName = preset.name,
                color = preset.color,
                isSelected = selectedColor.isCloseTo(preset.color),
                contentColor = contentColor,
                panelBorderColor = panelBorderColor,
                onClick = { onPresetSelected(preset) },
            )
        }
    }
}

@Composable
private fun SavedColorScroller(
    colors: List<LightColor>,
    selectedColor: LightColor,
    contentColor: Color,
    panelBorderColor: Color,
    onColorSelected: (LightColor) -> Unit,
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .horizontalScroll(rememberScrollState()),
        horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        colors.forEach { color ->
            val isSelected = selectedColor.isCloseTo(color)
            Surface(
                modifier = Modifier
                    .widthIn(min = 72.dp)
                    .height(54.dp)
                    .clickable { onColorSelected(color) },
                color = contentColor.copy(alpha = if (isSelected) 0.16f else 0.07f),
                contentColor = contentColor,
                border = BorderStroke(
                    width = if (isSelected) 1.5.dp else 1.dp,
                    color = if (isSelected) contentColor.copy(alpha = 0.58f) else panelBorderColor,
                ),
                shape = RoundedCornerShape(16.dp),
            ) {
                Row(
                    modifier = Modifier.padding(horizontal = 10.dp, vertical = 8.dp),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Box(
                        modifier = Modifier
                            .size(26.dp)
                            .clip(RoundedCornerShape(999.dp))
                            .background(color.toComposeColor())
                            .border(
                                BorderStroke(1.dp, contentColor.copy(alpha = 0.30f)),
                                RoundedCornerShape(999.dp),
                            ),
                    )
                    Text(
                        text = color.toHexRgb(),
                        color = contentColor.copy(alpha = 0.82f),
                        fontSize = 11.sp,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                }
            }
        }
    }
}

@Composable
private fun PresetScroller(
    presets: List<ColorPreset>,
    selectedColor: LightColor,
    contentColor: Color,
    panelBorderColor: Color,
    onPresetSelected: (ColorPreset) -> Unit,
    onPaletteLibraryClick: () -> Unit,
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .horizontalScroll(rememberScrollState()),
        horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        PresetTile(
            presetName = "色卡库",
            color = null,
            isSelected = false,
            contentColor = contentColor,
            panelBorderColor = panelBorderColor,
            onClick = onPaletteLibraryClick,
        )

        presets.forEach { preset ->
            val isSelected = selectedColor.isCloseTo(preset.color)
            PresetTile(
                presetName = preset.name,
                color = preset.color,
                isSelected = isSelected,
                contentColor = contentColor,
                panelBorderColor = panelBorderColor,
                onClick = { onPresetSelected(preset) },
            )
        }
    }
}

@Composable
private fun PresetTile(
    presetName: String,
    color: LightColor?,
    isSelected: Boolean,
    contentColor: Color,
    panelBorderColor: Color,
    onClick: () -> Unit,
) {
    val labelFontSize = if (presetName.length >= 3) 11.sp else 12.sp

    Surface(
        modifier = Modifier
            .width(108.dp)
            .height(78.dp)
            .semantics {
                role = Role.Button
                selected = isSelected
                contentDescription = presetName
            }
            .clickable { onClick() },
        color = contentColor.copy(alpha = if (isSelected) 0.16f else 0.07f),
        contentColor = contentColor,
        border = BorderStroke(
            width = if (isSelected) 1.5.dp else 1.dp,
            color = if (isSelected) contentColor.copy(alpha = 0.58f) else panelBorderColor,
        ),
        shape = RoundedCornerShape(16.dp),
    ) {
        Column(
            modifier = Modifier.padding(horizontal = 10.dp, vertical = 9.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center,
        ) {
            Box(
                modifier = Modifier
                    .size(28.dp)
                    .clip(if (color == null) RoundedCornerShape(999.dp) else CircleShape)
                    .then(
                        if (color == null) {
                            Modifier.border(
                                BorderStroke(1.dp, contentColor.copy(alpha = 0.42f)),
                                RoundedCornerShape(999.dp),
                            )
                        } else {
                            Modifier
                                .background(color.toComposeColor())
                                .border(
                                    BorderStroke(1.dp, contentColor.copy(alpha = 0.30f)),
                                    CircleShape,
                                )
                        },
                    ),
                contentAlignment = Alignment.Center,
            ) {
                if (color == null) {
                    Text(
                        text = "+",
                        color = contentColor,
                        fontSize = 18.sp,
                        fontWeight = FontWeight.Medium,
                    )
                }
            }
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                text = presetName,
                color = contentColor,
                fontSize = labelFontSize,
                fontWeight = if (isSelected) FontWeight.SemiBold else FontWeight.Medium,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                textAlign = TextAlign.Center,
            )
        }
    }
}

@Composable
private fun LabeledSlider(
    label: String,
    valueText: String,
    value: Float,
    valueRange: ClosedFloatingPointRange<Float>,
    activeColor: Color,
    contentColor: Color,
    onValueChange: (Float) -> Unit,
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 2.dp),
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(
                text = label,
                color = contentColor,
                fontSize = 13.sp,
                fontWeight = FontWeight.Medium,
            )
            Surface(
                color = contentColor.copy(alpha = 0.10f),
                contentColor = contentColor,
                shape = CircleShape,
            ) {
                Text(
                    modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp),
                    text = valueText,
                    color = contentColor.copy(alpha = 0.84f),
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Medium,
                )
            }
        }
        Slider(
            value = value,
            onValueChange = onValueChange,
            valueRange = valueRange,
            colors = SliderDefaults.colors(
                thumbColor = contentColor,
                activeTrackColor = activeColor,
                inactiveTrackColor = contentColor.copy(alpha = 0.22f),
            ),
        )
    }
}
