package com.selflight.backlight.ui

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectDragGesturesAfterLongPress
import androidx.compose.foundation.horizontalScroll
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
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBars
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.FilterChip
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.selflight.backlight.model.CustomPaletteDraft
import com.selflight.backlight.model.DefaultColorPresets
import com.selflight.backlight.model.LightColor
import com.selflight.backlight.model.PaletteGroup
import com.selflight.backlight.model.exportCustomPalettesJson
import com.selflight.backlight.model.importCustomPalettesJson
import com.selflight.backlight.model.toCustomPaletteDraft

@Composable
fun PaletteLibraryScreen(
    paletteGroups: List<PaletteGroup>,
    selectedPaletteKey: String,
    onBack: () -> Unit,
    onSelectPalette: (PaletteGroup) -> Unit,
    onCreateCustomPalette: (String, List<LightColor>) -> Unit,
    onUpdateCustomPalette: (Int, String, List<LightColor>) -> Unit,
    onDeleteCustomPalette: (PaletteGroup) -> Unit,
    onDuplicatePalette: (PaletteGroup) -> Unit,
    onReplaceCustomPalettes: (List<CustomPaletteDraft>, String) -> Unit,
    onAppendCustomPalettes: (List<CustomPaletteDraft>) -> Unit,
) {
    val clipboardManager = LocalClipboardManager.current
    val allTags = remember(paletteGroups) {
        listOf("全部") + paletteGroups.flatMap { it.tags }.distinct()
    }
    var showCreatePaletteDialog by remember { mutableStateOf(false) }
    var editingPalette by remember { mutableStateOf<PaletteGroup?>(null) }
    var deletingPalette by remember { mutableStateOf<PaletteGroup?>(null) }
    var showExportDialog by remember { mutableStateOf(false) }
    var showImportDialog by remember { mutableStateOf(false) }
    var showBulkDeleteDialog by remember { mutableStateOf(false) }
    var searchQuery by remember { mutableStateOf("") }
    var selectedTag by remember { mutableStateOf("全部") }
    var previewPaletteKey by remember(selectedPaletteKey) { mutableStateOf(selectedPaletteKey) }
    var selectionMode by remember { mutableStateOf(false) }
    var selectedCustomKeys by remember { mutableStateOf(setOf<String>()) }

    val filteredGroups = remember(paletteGroups, searchQuery, selectedTag) {
        paletteGroups.filter { group ->
            val matchesSearch = searchQuery.isBlank() ||
                group.name.contains(searchQuery, ignoreCase = true) ||
                group.tags.any { it.contains(searchQuery, ignoreCase = true) }
            val matchesTag = selectedTag == "全部" || selectedTag in group.tags
            matchesSearch && matchesTag
        }
    }
    val builtInGroups = filteredGroups.filterNot { it.isCustom }
    val customGroups = filteredGroups.filter { it.isCustom }
    val allCustomGroups = paletteGroups.filter { it.isCustom }
    val previewPalette = filteredGroups.firstOrNull { it.key == previewPaletteKey }
        ?: paletteGroups.firstOrNull { it.key == previewPaletteKey }
        ?: paletteGroups.first()

    if (showCreatePaletteDialog) {
        PaletteEditorDialog(
            title = "新建色卡",
            initialName = "自定义色卡",
            initialColors = DefaultColorPresets.map { it.color }.take(6),
            confirmLabel = "创建",
            onDismiss = { showCreatePaletteDialog = false },
            onSave = { name, colors ->
                onCreateCustomPalette(name, colors)
                showCreatePaletteDialog = false
            },
        )
    }

    editingPalette?.let { palette ->
        PaletteEditorDialog(
            title = "编辑色卡",
            initialName = palette.name,
            initialColors = List(6) { index ->
                palette.colors.getOrNull(index)?.color ?: LightColor.Default
            },
            confirmLabel = "保存",
            onDismiss = { editingPalette = null },
            onSave = { name, colors ->
                palette.customIndex?.let { index ->
                    onUpdateCustomPalette(index, name, colors)
                }
                editingPalette = null
            },
        )
    }

    deletingPalette?.let { palette ->
        AlertDialog(
            onDismissRequest = { deletingPalette = null },
            title = { Text(text = "删除色卡") },
            text = { Text(text = "确定删除「${palette.name}」吗？这个操作不能撤销。") },
            confirmButton = {
                TextButton(
                    onClick = {
                        onDeleteCustomPalette(palette)
                        deletingPalette = null
                    },
                ) {
                    Text(text = "删除")
                }
            },
            dismissButton = {
                TextButton(onClick = { deletingPalette = null }) {
                    Text(text = "取消")
                }
            },
        )
    }

    if (showBulkDeleteDialog) {
        AlertDialog(
            onDismissRequest = { showBulkDeleteDialog = false },
            title = { Text(text = "批量删除色卡") },
            text = { Text(text = "确定删除选中的 ${selectedCustomKeys.size} 组自定义色卡吗？") },
            confirmButton = {
                TextButton(
                    onClick = {
                        val remaining = allCustomGroups
                            .filterNot { it.key in selectedCustomKeys }
                            .map { it.toCustomPaletteDraft() }
                        val nextActiveKey = when {
                            selectedPaletteKey in selectedCustomKeys && remaining.isNotEmpty() -> "custom_0"
                            selectedPaletteKey in selectedCustomKeys -> "daily_selfie"
                            else -> selectedPaletteKey
                        }
                        onReplaceCustomPalettes(remaining, nextActiveKey)
                        selectedCustomKeys = emptySet()
                        selectionMode = false
                        showBulkDeleteDialog = false
                    },
                ) {
                    Text(text = "删除")
                }
            },
            dismissButton = {
                TextButton(onClick = { showBulkDeleteDialog = false }) {
                    Text(text = "取消")
                }
            },
        )
    }

    if (showExportDialog) {
        val exportJson = remember(customGroups) {
            exportCustomPalettesJson(customGroups.map { it.toCustomPaletteDraft() })
        }
        AlertDialog(
            onDismissRequest = { showExportDialog = false },
            title = { Text(text = "导出色卡") },
            text = {
                OutlinedTextField(
                    value = exportJson,
                    onValueChange = {},
                    readOnly = true,
                    minLines = 8,
                    maxLines = 12,
                    label = { Text("JSON") },
                )
            },
            confirmButton = {
                TextButton(
                    onClick = {
                        clipboardManager.setText(AnnotatedString(exportJson))
                    },
                ) {
                    Text(text = "复制")
                }
            },
            dismissButton = {
                TextButton(onClick = { showExportDialog = false }) {
                    Text(text = "关闭")
                }
            },
        )
    }

    if (showImportDialog) {
        PaletteImportDialog(
            onDismiss = { showImportDialog = false },
            onAppend = { palettes ->
                onAppendCustomPalettes(palettes)
                showImportDialog = false
            },
            onReplace = { palettes ->
                onReplaceCustomPalettes(
                    palettes,
                    if (palettes.isEmpty()) "daily_selfie" else "custom_0",
                )
                showImportDialog = false
            },
        )
    }

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
                Column {
                    Text(
                        text = "色卡库",
                        style = MaterialTheme.typography.headlineSmall,
                        fontWeight = FontWeight.SemiBold,
                    )
                    Text(
                        text = "每 6 个颜色为一组，点击即可切换当前色卡。",
                        color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.62f),
                        fontSize = 13.sp,
                    )
                }
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    TextButton(onClick = { showCreatePaletteDialog = true }) {
                        Text(text = "新建色卡")
                    }
                    TextButton(onClick = { showImportDialog = true }) {
                        Text(text = "导入")
                    }
                    TextButton(onClick = { showExportDialog = true }) {
                        Text(text = "导出")
                    }
                    TextButton(onClick = onBack) {
                        Text(text = "完成")
                    }
                }
            }

            Spacer(modifier = Modifier.height(16.dp))

            PalettePreviewHero(
                palette = previewPalette,
                selected = previewPalette.key == selectedPaletteKey,
            )

            Spacer(modifier = Modifier.height(16.dp))

            OutlinedTextField(
                modifier = Modifier.fillMaxWidth(),
                value = searchQuery,
                onValueChange = { searchQuery = it },
                singleLine = true,
                label = { Text(text = "搜索色卡") },
            )

            Spacer(modifier = Modifier.height(12.dp))

            Row(
                modifier = Modifier.horizontalScroll(rememberScrollState()),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                allTags.forEach { tag ->
                    FilterChip(
                        selected = selectedTag == tag,
                        onClick = { selectedTag = tag },
                        label = { Text(tag) },
                    )
                }
            }

            Spacer(modifier = Modifier.height(18.dp))

            builtInGroups.forEach { group ->
                PaletteGroupCard(
                    group = group,
                    selected = group.key == selectedPaletteKey,
                    marked = false,
                    selectionMode = false,
                    onClick = {
                        previewPaletteKey = group.key
                        onSelectPalette(group)
                    },
                    onDuplicate = { onDuplicatePalette(group) },
                    onEdit = null,
                    onDelete = null,
                    onDragMove = null,
                )
                Spacer(modifier = Modifier.height(12.dp))
            }

            if (customGroups.isNotEmpty()) {
                Spacer(modifier = Modifier.height(8.dp))
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(
                        text = "自定义色卡",
                        fontSize = 15.sp,
                        fontWeight = FontWeight.SemiBold,
                    )
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        TextButton(
                            onClick = {
                                selectionMode = !selectionMode
                                if (!selectionMode) {
                                    selectedCustomKeys = emptySet()
                                }
                            },
                        ) {
                            Text(text = if (selectionMode) "取消选择" else "批量删除")
                        }
                        if (selectionMode && selectedCustomKeys.isNotEmpty()) {
                            TextButton(onClick = { showBulkDeleteDialog = true }) {
                                Text(text = "删除选中 (${selectedCustomKeys.size})")
                            }
                        }
                    }
                }
                Spacer(modifier = Modifier.height(10.dp))
                ReorderableCustomPaletteColumn(
                    groups = customGroups,
                    selectedPaletteKey = selectedPaletteKey,
                    selectionMode = selectionMode,
                    selectedKeys = selectedCustomKeys,
                    onToggleSelected = { key ->
                        selectedCustomKeys = selectedCustomKeys.toMutableSet().also { keys ->
                            if (!keys.add(key)) {
                                keys.remove(key)
                            }
                        }
                    },
                    onSelectPalette = {
                        previewPaletteKey = it.key
                        onSelectPalette(it)
                    },
                    onDuplicatePalette = onDuplicatePalette,
                    onEditPalette = { editingPalette = it },
                    onDeletePalette = { deletingPalette = it },
                    onReorder = { reordered ->
                        val selectedName = customGroups.firstOrNull { it.key == selectedPaletteKey }?.name
                        val selectedIndex = reordered.indexOfFirst { it.name == selectedName }
                        val nextActiveKey = if (selectedIndex >= 0) {
                            "custom_$selectedIndex"
                        } else {
                            selectedPaletteKey
                        }
                        onReplaceCustomPalettes(reordered, nextActiveKey)
                    },
                )
            }

            if (filteredGroups.isEmpty()) {
                Spacer(modifier = Modifier.height(24.dp))
                Text(
                    text = "没有匹配的色卡",
                    color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.58f),
                    fontSize = 14.sp,
                )
            }
        }
    }
}

@Composable
private fun PalettePreviewHero(
    palette: PaletteGroup,
    selected: Boolean,
) {
    Surface(
        modifier = Modifier.fillMaxWidth(),
        color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.05f),
        contentColor = MaterialTheme.colorScheme.onSurface,
        border = BorderStroke(
            if (selected) 1.5.dp else 1.dp,
            if (selected) MaterialTheme.colorScheme.primary.copy(alpha = 0.70f)
            else MaterialTheme.colorScheme.onSurface.copy(alpha = 0.12f),
        ),
        shape = RoundedCornerShape(20.dp),
    ) {
        Column(
            modifier = Modifier.padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Text(
                        text = palette.name,
                        fontSize = 18.sp,
                        fontWeight = FontWeight.SemiBold,
                    )
                    Text(
                        text = palette.tags.joinToString(" · "),
                        color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.58f),
                        fontSize = 12.sp,
                    )
                }
                Text(
                    text = if (selected) "当前使用" else "预览",
                    color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.58f),
                    fontSize = 12.sp,
                )
            }
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                repeat(6) { index ->
                    val color = palette.colors.getOrNull(index)?.color
                    Box(
                        modifier = Modifier
                            .weight(1f)
                            .height(58.dp)
                            .clip(RoundedCornerShape(16.dp))
                            .background(
                                color?.toComposeColor()
                                    ?: MaterialTheme.colorScheme.onSurface.copy(alpha = 0.08f),
                            )
                            .border(
                                BorderStroke(1.dp, Color.Black.copy(alpha = 0.10f)),
                                RoundedCornerShape(16.dp),
                            ),
                    )
                }
            }
        }
    }
}

@Composable
private fun ReorderableCustomPaletteColumn(
    groups: List<PaletteGroup>,
    selectedPaletteKey: String,
    selectionMode: Boolean,
    selectedKeys: Set<String>,
    onToggleSelected: (String) -> Unit,
    onSelectPalette: (PaletteGroup) -> Unit,
    onDuplicatePalette: (PaletteGroup) -> Unit,
    onEditPalette: (PaletteGroup) -> Unit,
    onDeletePalette: (PaletteGroup) -> Unit,
    onReorder: (List<CustomPaletteDraft>) -> Unit,
) {
    var orderedGroups by remember(groups) { mutableStateOf(groups) }
    val moveThresholdPx = with(LocalDensity.current) { 110.dp.toPx() }

    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        orderedGroups.forEachIndexed { index, group ->
            var dragAccumulated by remember(group.key) { mutableStateOf(0f) }
            PaletteGroupCard(
                group = group,
                selected = group.key == selectedPaletteKey,
                marked = group.key in selectedKeys,
                selectionMode = selectionMode,
                onClick = {
                    if (selectionMode) {
                        onToggleSelected(group.key)
                    } else {
                        onSelectPalette(group)
                    }
                },
                onDuplicate = { onDuplicatePalette(group) },
                onEdit = if (!selectionMode) ({ onEditPalette(group) }) else null,
                onDelete = if (!selectionMode) ({ onDeletePalette(group) }) else null,
                onDragMove = if (!selectionMode) {
                    Modifier.pointerInput(orderedGroups.map { it.key }) {
                        detectDragGesturesAfterLongPress(
                            onDrag = { change, dragAmount ->
                                change.consume()
                                dragAccumulated += dragAmount.y
                                when {
                                    dragAccumulated > moveThresholdPx && index < orderedGroups.lastIndex -> {
                                        val next = orderedGroups.toMutableList()
                                        val moved = next.removeAt(index)
                                        next.add(index + 1, moved)
                                        orderedGroups = next
                                        onReorder(next.map { it.toCustomPaletteDraft() })
                                        dragAccumulated = 0f
                                    }

                                    dragAccumulated < -moveThresholdPx && index > 0 -> {
                                        val next = orderedGroups.toMutableList()
                                        val moved = next.removeAt(index)
                                        next.add(index - 1, moved)
                                        orderedGroups = next
                                        onReorder(next.map { it.toCustomPaletteDraft() })
                                        dragAccumulated = 0f
                                    }
                                }
                            },
                            onDragEnd = { dragAccumulated = 0f },
                            onDragCancel = { dragAccumulated = 0f },
                        )
                    }
                } else {
                    null
                },
            )
        }
    }
}

@Composable
private fun PaletteGroupCard(
    group: PaletteGroup,
    selected: Boolean,
    marked: Boolean,
    selectionMode: Boolean,
    onClick: () -> Unit,
    onDuplicate: () -> Unit,
    onEdit: (() -> Unit)?,
    onDelete: (() -> Unit)?,
    onDragMove: Modifier?,
) {
    val borderColor = when {
        marked -> MaterialTheme.colorScheme.error.copy(alpha = 0.70f)
        selected -> MaterialTheme.colorScheme.primary.copy(alpha = 0.85f)
        else -> MaterialTheme.colorScheme.onSurface.copy(alpha = 0.14f)
    }

    Surface(
        modifier = Modifier
            .fillMaxWidth()
            .then(onDragMove ?: Modifier)
            .clickable(onClick = onClick),
        color = MaterialTheme.colorScheme.onSurface.copy(alpha = if (selected || marked) 0.08f else 0.04f),
        contentColor = MaterialTheme.colorScheme.onSurface,
        border = BorderStroke(if (selected || marked) 1.5.dp else 1.dp, borderColor),
        shape = RoundedCornerShape(18.dp),
    ) {
        Column(
            modifier = Modifier.padding(horizontal = 14.dp, vertical = 12.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    text = group.name,
                    fontSize = 16.sp,
                    fontWeight = FontWeight.SemiBold,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    if (selectionMode) {
                        Text(
                            text = if (marked) "已选中" else "点选",
                            color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.58f),
                            fontSize = 12.sp,
                            modifier = Modifier.align(Alignment.CenterVertically),
                        )
                    } else {
                        if (onDragMove != null) {
                            Text(
                                text = "长按拖动",
                                color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.48f),
                                fontSize = 12.sp,
                                modifier = Modifier.align(Alignment.CenterVertically),
                            )
                        }
                        TextButton(onClick = onDuplicate) {
                            Text(text = "复制")
                        }
                        if (onEdit != null) {
                            TextButton(onClick = onEdit) {
                                Text(text = "编辑")
                            }
                        }
                        if (onDelete != null) {
                            TextButton(onClick = onDelete) {
                                Text(text = "删除")
                            }
                        }
                        Text(
                            text = if (selected) "当前使用" else "点击切换",
                            color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.58f),
                            fontSize = 12.sp,
                            modifier = Modifier.align(Alignment.CenterVertically),
                        )
                    }
                }
            }
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                repeat(6) { index ->
                    val color = group.colors.getOrNull(index)?.color
                    Box(
                        modifier = Modifier
                            .weight(1f)
                            .height(46.dp)
                            .clip(RoundedCornerShape(14.dp))
                            .background(
                                color?.toComposeColor()
                                    ?: MaterialTheme.colorScheme.onSurface.copy(alpha = 0.08f),
                            )
                            .border(
                                BorderStroke(1.dp, Color.Black.copy(alpha = 0.10f)),
                                RoundedCornerShape(14.dp),
                            ),
                    )
                }
            }
        }
    }
}

@Composable
private fun PaletteImportDialog(
    onDismiss: () -> Unit,
    onAppend: (List<CustomPaletteDraft>) -> Unit,
    onReplace: (List<CustomPaletteDraft>) -> Unit,
) {
    var input by remember { mutableStateOf("") }
    val parsed = importCustomPalettesJson(input)
    val isValid = parsed != null

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(text = "导入色卡") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedTextField(
                    value = input,
                    onValueChange = { input = it },
                    minLines = 8,
                    maxLines = 12,
                    label = { Text("粘贴 JSON") },
                    isError = input.isNotBlank() && !isValid,
                )
                if (input.isNotBlank() && !isValid) {
                    Text(
                        text = "JSON 格式无效，或缺少 palettes/colors 字段。",
                        color = MaterialTheme.colorScheme.error,
                        fontSize = 12.sp,
                    )
                }
            }
        },
        confirmButton = {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                TextButton(enabled = isValid, onClick = { parsed?.let(onAppend) }) {
                    Text(text = "追加导入")
                }
                TextButton(enabled = isValid, onClick = { parsed?.let(onReplace) }) {
                    Text(text = "覆盖导入")
                }
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text(text = "取消")
            }
        },
    )
}

@Composable
private fun PaletteEditorDialog(
    title: String,
    initialName: String,
    initialColors: List<LightColor>,
    confirmLabel: String,
    onDismiss: () -> Unit,
    onSave: (String, List<LightColor>) -> Unit,
) {
    var paletteName by remember(title, initialName) { mutableStateOf(initialName) }
    var colorEntries by remember(title, initialName) {
        mutableStateOf(
            List(6) { index ->
                PaletteColorEntry(
                    id = index,
                    value = initialColors.getOrNull(index)?.toHexRgb() ?: "#FFFFFF",
                )
            },
        )
    }
    val parsedColors = colorEntries.map { LightColor.fromHexRgb(it.value) }
    val canSave = parsedColors.all { it != null }
    val moveThresholdPx = with(LocalDensity.current) { 58.dp.toPx() }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(text = title) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedTextField(
                    value = paletteName,
                    onValueChange = { paletteName = it },
                    singleLine = true,
                    label = { Text(text = "色卡名称") },
                )
                colorEntries.forEachIndexed { index, entry ->
                    var dragAccumulated by remember(entry.id) { mutableStateOf(0f) }
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .pointerInput(colorEntries.map { it.id }) {
                                detectDragGesturesAfterLongPress(
                                    onDrag = { change, dragAmount ->
                                        change.consume()
                                        dragAccumulated += dragAmount.y
                                        when {
                                            dragAccumulated > moveThresholdPx && index < colorEntries.lastIndex -> {
                                                val next = colorEntries.toMutableList()
                                                val moved = next.removeAt(index)
                                                next.add(index + 1, moved)
                                                colorEntries = next
                                                dragAccumulated = 0f
                                            }

                                            dragAccumulated < -moveThresholdPx && index > 0 -> {
                                                val next = colorEntries.toMutableList()
                                                val moved = next.removeAt(index)
                                                next.add(index - 1, moved)
                                                colorEntries = next
                                                dragAccumulated = 0f
                                            }
                                        }
                                    },
                                    onDragEnd = { dragAccumulated = 0f },
                                    onDragCancel = { dragAccumulated = 0f },
                                )
                            },
                        horizontalArrangement = Arrangement.spacedBy(10.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Box(
                            modifier = Modifier
                                .size(18.dp)
                                .clip(RoundedCornerShape(999.dp))
                                .background(
                                    LightColor.fromHexRgb(entry.value)?.toComposeColor()
                                        ?: MaterialTheme.colorScheme.onSurface.copy(alpha = 0.12f),
                                )
                                .border(
                                    BorderStroke(1.dp, MaterialTheme.colorScheme.onSurface.copy(alpha = 0.18f)),
                                    RoundedCornerShape(999.dp),
                                ),
                        )
                        Text(
                            text = "拖动",
                            color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.52f),
                            fontSize = 12.sp,
                            modifier = Modifier.width(36.dp),
                        )
                        OutlinedTextField(
                            modifier = Modifier.weight(1f),
                            value = entry.value,
                            onValueChange = { next ->
                                val compact = next
                                    .uppercase()
                                    .filter { it == '#' || it in '0'..'9' || it in 'A'..'F' }
                                    .take(7)
                                colorEntries = colorEntries.toMutableList().also {
                                    it[index] = entry.copy(
                                        value = if (compact.startsWith("#")) compact else "#$compact",
                                    )
                                }
                            },
                            singleLine = true,
                            label = { Text(text = "颜色 ${index + 1}") },
                            isError = LightColor.fromHexRgb(entry.value) == null,
                            keyboardOptions = KeyboardOptions(
                                capitalization = KeyboardCapitalization.Characters,
                                keyboardType = KeyboardType.Ascii,
                                imeAction = ImeAction.Next,
                            ),
                        )
                    }
                }
            }
        },
        confirmButton = {
            TextButton(
                enabled = canSave,
                onClick = {
                    onSave(
                        paletteName.trim().ifBlank { initialName },
                        parsedColors.filterNotNull(),
                    )
                },
            ) {
                Text(text = confirmLabel)
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text(text = "取消")
            }
        },
    )
}

private data class PaletteColorEntry(
    val id: Int,
    val value: String,
)
