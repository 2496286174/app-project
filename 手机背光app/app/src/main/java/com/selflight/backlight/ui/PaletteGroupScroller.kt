package com.selflight.backlight.ui

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.selflight.backlight.model.LightColor

@Composable
fun PaletteGroupScroller(
    colors: List<LightColor>,
    selectedColor: LightColor,
    contentColor: Color,
    panelBorderColor: Color,
    onPaletteSelected: (List<LightColor>) -> Unit,
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .horizontalScroll(rememberScrollState()),
        horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        colors.chunked(6).forEachIndexed { index, palette ->
            val isSelected = palette.any { selectedColor.isCloseTo(it) }
            Surface(
                modifier = Modifier
                    .width(142.dp)
                    .height(76.dp)
                    .clickable { onPaletteSelected(palette) },
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
                    verticalArrangement = Arrangement.Center,
                ) {
                    Text(
                        text = "色卡 ${index + 1}",
                        color = contentColor,
                        fontSize = 12.sp,
                        fontWeight = FontWeight.SemiBold,
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    Row(
                        horizontalArrangement = Arrangement.spacedBy(5.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        repeat(6) { colorIndex ->
                            val color = palette.getOrNull(colorIndex)
                            Box(
                                modifier = Modifier
                                    .size(16.dp)
                                    .clip(RoundedCornerShape(999.dp))
                                    .background(
                                        color?.toComposeColor()
                                            ?: contentColor.copy(alpha = 0.10f),
                                    )
                                    .border(
                                        BorderStroke(
                                            1.dp,
                                            contentColor.copy(alpha = 0.26f),
                                        ),
                                        RoundedCornerShape(999.dp),
                                    ),
                            )
                        }
                    }
                }
            }
        }
    }
}

