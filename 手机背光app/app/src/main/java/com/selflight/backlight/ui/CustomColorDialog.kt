package com.selflight.backlight.ui

import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.text.input.KeyboardType
import com.selflight.backlight.model.LightColor

@Composable
fun CustomColorDialog(
    initialColor: LightColor,
    onDismiss: () -> Unit,
    onApply: (LightColor) -> Unit,
) {
    var hexInput by remember(initialColor.toHexRgb()) {
        mutableStateOf(initialColor.toHexRgb())
    }
    val parsedColor = LightColor.fromHexRgb(hexInput)
    val cleanedLength = hexInput.trim().removePrefix("#").length
    val isError = cleanedLength >= 6 && parsedColor == null

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(text = "自定义颜色") },
        text = {
            OutlinedTextField(
                value = hexInput,
                onValueChange = { value ->
                    val compact = value
                        .uppercase()
                        .filter { it == '#' || it in '0'..'9' || it in 'A'..'F' }
                        .take(7)
                    hexInput = if (compact.startsWith("#")) compact else "#$compact"
                },
                singleLine = true,
                label = { Text("16进制颜色") },
                supportingText = {
                    Text(
                        text = if (isError) "格式示例 #FFEED1" else "支持 #RRGGBB 或 #FFF",
                    )
                },
                isError = isError,
                keyboardOptions = KeyboardOptions(
                    capitalization = KeyboardCapitalization.Characters,
                    keyboardType = KeyboardType.Ascii,
                    imeAction = ImeAction.Done,
                ),
                keyboardActions = KeyboardActions(
                    onDone = {
                        parsedColor?.let(onApply)
                    },
                ),
            )
        },
        confirmButton = {
            TextButton(
                enabled = parsedColor != null,
                onClick = {
                    parsedColor?.let(onApply)
                },
            ) {
                Text(text = "保存并应用")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text(text = "取消")
            }
        },
    )
}
