package com.selflight.backlight.ui

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Typography
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

@Composable
fun LightTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = lightColorScheme(
            primary = Color(0xFFFF7A59),
            secondary = Color(0xFFFFB3C7),
            background = Color.White,
            surface = Color.White,
            onPrimary = Color.White,
            onSecondary = Color(0xFF261116),
            onBackground = Color(0xFF171717),
            onSurface = Color(0xFF171717),
        ),
        typography = Typography(),
        content = content,
    )
}

