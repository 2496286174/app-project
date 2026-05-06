package com.selflight.backlight.model

data class PaletteGroup(
    val key: String,
    val name: String,
    val colors: List<ColorPreset>,
    val tags: List<String> = emptyList(),
    val isCustom: Boolean = false,
    val customIndex: Int? = null,
)

data class CustomPaletteDraft(
    val name: String,
    val colors: List<LightColor>,
)

val BuiltInPaletteGroups = listOf(
    PaletteGroup(
        key = "daily_selfie",
        name = "日常自拍",
        colors = DefaultColorPresets,
        tags = listOf("自拍", "日常"),
    ),
    PaletteGroup(
        key = "soft_beauty",
        name = "柔肤美妆",
        colors = listOf(
            ColorPreset("奶油白", LightColor(42f, 0.12f, 1.00f)),
            ColorPreset("蜜桃", LightColor(18f, 0.28f, 1.00f)),
            ColorPreset("粉雾", LightColor(350f, 0.20f, 1.00f)),
            ColorPreset("裸杏", LightColor(28f, 0.24f, 0.96f)),
            ColorPreset("柔玫", LightColor(340f, 0.24f, 0.96f)),
            ColorPreset("暖肤", LightColor(36f, 0.20f, 0.98f)),
        ),
        tags = listOf("美妆", "柔和"),
    ),
    PaletteGroup(
        key = "night_mood",
        name = "夜景氛围",
        colors = listOf(
            ColorPreset("冰蓝", LightColor(210f, 0.38f, 0.92f)),
            ColorPreset("青蓝", LightColor(190f, 0.46f, 0.88f)),
            ColorPreset("靛蓝", LightColor(235f, 0.48f, 0.86f)),
            ColorPreset("紫雾", LightColor(275f, 0.40f, 0.88f)),
            ColorPreset("玫紫", LightColor(310f, 0.38f, 0.88f)),
            ColorPreset("月白", LightColor(220f, 0.12f, 0.96f)),
        ),
        tags = listOf("夜景", "氛围"),
    ),
    PaletteGroup(
        key = "sunset_film",
        name = "日落电影",
        colors = listOf(
            ColorPreset("金橙", LightColor(32f, 0.46f, 1.00f)),
            ColorPreset("琥珀", LightColor(42f, 0.42f, 0.96f)),
            ColorPreset("夕粉", LightColor(8f, 0.38f, 0.96f)),
            ColorPreset("暮红", LightColor(356f, 0.42f, 0.90f)),
            ColorPreset("暖黄", LightColor(50f, 0.34f, 1.00f)),
            ColorPreset("橙影", LightColor(24f, 0.50f, 0.94f)),
        ),
        tags = listOf("电影", "暖调"),
    ),
    PaletteGroup(
        key = "clean_cool",
        name = "清冷高调",
        colors = listOf(
            ColorPreset("冷白", LightColor(210f, 0.08f, 1.00f)),
            ColorPreset("雾白", LightColor(220f, 0.06f, 0.96f)),
            ColorPreset("浅蓝", LightColor(205f, 0.22f, 1.00f)),
            ColorPreset("浅青", LightColor(175f, 0.20f, 0.96f)),
            ColorPreset("浅紫", LightColor(260f, 0.18f, 0.98f)),
            ColorPreset("银灰", LightColor(220f, 0.04f, 0.88f)),
        ),
        tags = listOf("冷调", "高调"),
    ),
)

fun buildPaletteGroups(
    customHexColors: List<String>,
    customPaletteNames: List<String> = emptyList(),
): List<PaletteGroup> {
    val customGroups = customHexColors
        .mapNotNull(LightColor::fromHexRgb)
        .chunked(6)
        .mapIndexed { index, colors ->
            PaletteGroup(
                key = "custom_$index",
                name = customPaletteNames.getOrNull(index)?.takeIf { it.isNotBlank() }
                    ?: "自定义色卡 ${index + 1}",
                colors = colors.mapIndexed { colorIndex, color ->
                    ColorPreset("颜色 ${colorIndex + 1}", color)
                },
                tags = listOf("自定义"),
                isCustom = true,
                customIndex = index,
            )
        }

    return BuiltInPaletteGroups + customGroups
}

fun PaletteGroup.toCustomPaletteDraft(): CustomPaletteDraft =
    CustomPaletteDraft(
        name = name,
        colors = colors.map { it.color },
    )
