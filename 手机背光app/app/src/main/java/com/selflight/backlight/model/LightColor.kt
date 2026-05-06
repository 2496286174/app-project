package com.selflight.backlight.model

import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.toArgb
import kotlin.math.abs
import kotlin.math.roundToInt

data class LightColor(
    val hue: Float,
    val saturation: Float,
    val brightness: Float,
) {
    fun normalized(): LightColor =
        copy(
            hue = ((hue % 360f) + 360f) % 360f,
            saturation = saturation.coerceIn(0f, 1f),
            brightness = brightness.coerceIn(0f, 1f),
        )

    fun toComposeColor(): Color {
        val color = normalized()
        return Color(
            android.graphics.Color.HSVToColor(
                floatArrayOf(color.hue, color.saturation, color.brightness),
            ),
        )
    }

    fun toHexRgb(): String =
        "#%06X".format(0xFFFFFF and toComposeColor().toArgb())

    fun isCloseTo(other: LightColor): Boolean {
        val normalizedSelf = normalized()
        val normalizedOther = other.normalized()
        val hueDistance = abs(normalizedSelf.hue - normalizedOther.hue)
            .let { minOf(it, 360f - it) }
        return hueDistance <= 2f &&
            abs(normalizedSelf.saturation - normalizedOther.saturation) <= 0.02f &&
            abs(normalizedSelf.brightness - normalizedOther.brightness) <= 0.02f
    }

    val hueDegrees: Int
        get() = normalized().hue.roundToInt()

    val saturationPercent: Int
        get() = (normalized().saturation * 100f).roundToInt()

    val brightnessPercent: Int
        get() = (normalized().brightness * 100f).roundToInt()

    companion object {
        val Default = LightColor(hue = 38f, saturation = 0.18f, brightness = 1f)

        fun fromHexRgb(value: String): LightColor? {
            val cleaned = value.trim()
                .removePrefix("#")
                .replace("\\s".toRegex(), "")
            val expanded = when (cleaned.length) {
                3 -> cleaned.map { "$it$it" }.joinToString("")
                6 -> cleaned
                else -> return null
            }
            if (!expanded.all { it in '0'..'9' || it in 'a'..'f' || it in 'A'..'F' }) {
                return null
            }
            val colorInt = android.graphics.Color.parseColor("#$expanded")
            val hsv = FloatArray(3)
            android.graphics.Color.colorToHSV(colorInt, hsv)
            return LightColor(
                hue = hsv[0],
                saturation = hsv[1],
                brightness = hsv[2],
            ).normalized()
        }
    }
}
