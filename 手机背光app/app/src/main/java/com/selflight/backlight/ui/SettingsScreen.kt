package com.selflight.backlight.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBars
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBars
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.FilterChip
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.luminance
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.selflight.backlight.data.LightSettings
import com.selflight.backlight.model.LightColor

@Composable
fun SettingsScreen(
    settings: LightSettings,
    lightColor: LightColor,
    onBack: () -> Unit,
    onKeepScreenOnChange: (Boolean) -> Unit,
    onRestoreLastColorChange: (Boolean) -> Unit,
    onAutoHideControlsChange: (Boolean) -> Unit,
    onAutoHideDelayChange: (Int) -> Unit,
    onCameraMenuSideChange: (Boolean) -> Unit,
) {
    Surface(
        modifier = Modifier.fillMaxSize(),
        color = MaterialTheme.colorScheme.surface,
        contentColor = MaterialTheme.colorScheme.onSurface,
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .windowInsetsPadding(WindowInsets.statusBars)
                .windowInsetsPadding(WindowInsets.navigationBars)
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 22.dp, vertical = 18.dp),
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    text = "设置",
                    style = MaterialTheme.typography.headlineSmall,
                    fontWeight = FontWeight.SemiBold,
                )
                TextButton(onClick = onBack) {
                    Text(text = "完成")
                }
            }

            Spacer(modifier = Modifier.height(18.dp))

            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(88.dp)
                    .clip(RoundedCornerShape(18.dp))
                    .background(lightColor.toComposeColor()),
            ) {
                Text(
                    modifier = Modifier
                        .align(Alignment.BottomStart)
                        .padding(16.dp),
                    text = lightColor.toHexRgb(),
                    color = if (lightColor.toComposeColor().luminance() > 0.55f) {
                        Color(0xFF171717)
                    } else {
                        Color.White
                    },
                    fontWeight = FontWeight.SemiBold,
                )
            }

            Spacer(modifier = Modifier.height(24.dp))

            SettingSwitchRow(
                title = "屏幕常亮",
                summary = "开启后补光时保持屏幕不熄灭，并使用最高窗口亮度。",
                checked = settings.keepScreenOn,
                onCheckedChange = onKeepScreenOnChange,
            )

            HorizontalDivider()

            SettingSwitchRow(
                title = "恢复上次颜色",
                summary = "下次打开 App 时继续使用最后一次补光颜色。",
                checked = settings.restoreLastColor,
                onCheckedChange = onRestoreLastColorChange,
            )

            HorizontalDivider()

            SettingSwitchRow(
                title = "自动隐藏控制面板",
                summary = "无操作后收起面板，保留纯色补光画面。",
                checked = settings.autoHideControls,
                onCheckedChange = onAutoHideControlsChange,
            )

            Spacer(modifier = Modifier.height(22.dp))

            Text(
                text = "隐藏延迟",
                fontSize = 14.sp,
                fontWeight = FontWeight.SemiBold,
            )
            Spacer(modifier = Modifier.height(10.dp))
            Row(
                horizontalArrangement = Arrangement.spacedBy(10.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                listOf(3, 5, 10, 15).forEach { seconds ->
                    FilterChip(
                        selected = settings.autoHideDelaySeconds == seconds,
                        enabled = settings.autoHideControls,
                        onClick = { onAutoHideDelayChange(seconds) },
                        label = { Text(text = "${seconds}秒") },
                    )
                }
            }

            Spacer(modifier = Modifier.height(24.dp))

            Text(
                text = "横屏相机菜单",
                fontSize = 14.sp,
                fontWeight = FontWeight.SemiBold,
            )
            Spacer(modifier = Modifier.height(10.dp))
            Row(
                horizontalArrangement = Arrangement.spacedBy(10.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                FilterChip(
                    selected = !settings.cameraMenuOnRight,
                    onClick = { onCameraMenuSideChange(false) },
                    label = { Text(text = "左侧") },
                )
                FilterChip(
                    selected = settings.cameraMenuOnRight,
                    onClick = { onCameraMenuSideChange(true) },
                    label = { Text(text = "右侧") },
                )
            }
        }
    }
}

@Composable
private fun SettingSwitchRow(
    title: String,
    summary: String,
    checked: Boolean,
    onCheckedChange: (Boolean) -> Unit,
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 16.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(
            modifier = Modifier
                .weight(1f)
                .padding(end = 18.dp),
            verticalArrangement = Arrangement.spacedBy(5.dp),
        ) {
            Text(
                text = title,
                fontSize = 16.sp,
                fontWeight = FontWeight.SemiBold,
            )
            Text(
                text = summary,
                color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.62f),
                fontSize = 13.sp,
                lineHeight = 18.sp,
            )
        }
        Switch(
            checked = checked,
            onCheckedChange = onCheckedChange,
        )
    }
}
