package com.selflight.backlight.model

import org.json.JSONArray
import org.json.JSONObject

fun exportCustomPalettesJson(palettes: List<CustomPaletteDraft>): String {
    val root = JSONObject()
    root.put("version", 1)
    val paletteArray = JSONArray()
    palettes.forEach { palette ->
        val paletteObject = JSONObject()
        paletteObject.put("name", palette.name)
        val colorsArray = JSONArray()
        palette.colors.take(6).forEach { color ->
            colorsArray.put(color.toHexRgb())
        }
        paletteObject.put("colors", colorsArray)
        paletteArray.put(paletteObject)
    }
    root.put("palettes", paletteArray)
    return root.toString(2)
}

fun importCustomPalettesJson(json: String): List<CustomPaletteDraft>? {
    return runCatching {
        val root = JSONObject(json)
        val palettes = root.getJSONArray("palettes")
        buildList {
            for (index in 0 until palettes.length()) {
                val paletteObject = palettes.getJSONObject(index)
                val name = paletteObject.optString("name").ifBlank { "导入色卡 ${index + 1}" }
                val colorsArray = paletteObject.getJSONArray("colors")
                val colors = buildList {
                    for (colorIndex in 0 until colorsArray.length()) {
                        val parsed = LightColor.fromHexRgb(colorsArray.getString(colorIndex))
                            ?: continue
                        add(parsed)
                    }
                }.take(6)
                if (colors.isNotEmpty()) {
                    add(CustomPaletteDraft(name = name, colors = colors))
                }
            }
        }
    }.getOrNull()
}

