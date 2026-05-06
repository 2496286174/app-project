package com.selflight.backlight.model

data class ColorPreset(
    val name: String,
    val color: LightColor,
)

val DefaultColorPresets = listOf(
    ColorPreset("暖白", LightColor(hue = 38f, saturation = 0.18f, brightness = 1f)),
    ColorPreset("冷白", LightColor(hue = 210f, saturation = 0.08f, brightness = 1f)),
    ColorPreset("粉肤", LightColor(hue = 350f, saturation = 0.22f, brightness = 1f)),
    ColorPreset("日落橙", LightColor(hue = 24f, saturation = 0.45f, brightness = 1f)),
    ColorPreset("蓝调", LightColor(hue = 220f, saturation = 0.50f, brightness = 0.90f)),
    ColorPreset("柔紫", LightColor(hue = 280f, saturation = 0.35f, brightness = 0.95f)),
)

