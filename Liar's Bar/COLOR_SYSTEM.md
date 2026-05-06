# Liar's Bar Theme Color Plan

本主题使用用户指定的 6 个颜色重新安排 UI 色彩：

- `#81D4FA`
- `#B3E5FC`
- `#E1F5FE`
- `#FFF9C4`
- `#FFF176`
- `#FF6F00`

设计方向是「晴空牌桌」：浅蓝背景保持清爽，纸牌区域保持明亮，黄色只用于行动和选中，橙色只用于高风险或最高强调。整体避免脏灰、避免大面积同色糊在一起，也避免功能区出现无信息价值的整条背景。

## Palette Roles

| Color | Name | Role | Use Carefully |
| --- | --- | --- | --- |
| `#E1F5FE` | Sky Wash | 页面背景、轻量区域底色、默认冷调承载面 | 不要让所有面板都用它，否则层级会消失 |
| `#B3E5FC` | Sky Surface | 牌桌中层、信息面、次级按钮 hover、浅色边框底 | 不要用作正文文字 |
| `#81D4FA` | Action Blue | 信息强调、在线/手牌图标、可交互边框、确认类辅助按钮 | 白字对比不足，按钮文字用深色 |
| `#FFF9C4` | Card Warm | 纸牌槽、当前席位、手牌区暖底、提示底色 | 大面积使用时要和白色/浅蓝拉开边界 |
| `#FFF176` | Focus Yellow | 主行动高光、选中态、焦点环、当前行动提示 | 不配白字；只做短面积高光 |
| `#FF6F00` | Risk Orange | 质疑、危险确认、最高强调 CTA、警告图标 | 不配白字；需要文字或图标辅助表达风险 |

## Required Neutrals

这 6 个颜色都偏亮，不能单独承担完整主题。需要保留中性色来保证可读性：

| Token | Value | Usage |
| --- | --- | --- |
| `--ink` | `#122536` | 主文字、按钮文字、黑色牌面 |
| `--ink-soft` | `#647181` | 次级文字、说明、弱状态 |
| `--surface` | `#FFFFFF` 或 `#FFFDF8` | 主容器、弹窗、输入框、按钮底 |
| `--line` | `rgba(18, 37, 54, 0.12)` | 默认边框 |
| `--line-strong` | `rgba(18, 37, 54, 0.2)` | 强分隔、牌桌边框 |

规则：主题色负责气质和状态，中性色负责阅读和结构。

## Semantic Token Mapping

全局主题现在以 `packages/ui/src/theme.ts` 为主，`apps/web-client/app/layout.tsx` 会把 `defaultTheme.variables` 注入到 `<html>` 上，避免首屏闪烁。`apps/web-client/app/globals.css` 只保留同名 fallback，方便构建或静态页面没有加载 UI 包时仍能显示。

当前换色入口只有一个：优先改 `skyTableTheme.variables`，需要运行时覆盖时使用 `createThemeVariables(overrides)` 或 `applyGlobalTheme(theme)`。不要在组件里重新写一套硬编码色板。

最小换色示例：

```ts
import { applyGlobalTheme, createThemeVariables } from '@liars-bar/ui';

applyGlobalTheme(createThemeVariables({
  '--sky-blue': '#81D4FA',
  '--sky-surface': '#B3E5FC',
  '--sky-wash': '#E1F5FE',
  '--sun-wash': '#FFF9C4',
  '--sun': '#FFF176',
  '--orange': '#FF6F00'
}));
```

下面只列核心语义 token；完整列表以 `packages/ui/src/theme.ts` 为准。

```css
:root {
  --ink: #122536;
  --ink-soft: #647181;
  --paper: #FFFDF8;

  --sky-blue: #81D4FA;
  --sky-surface: #B3E5FC;
  --sky-wash: #E1F5FE;
  --sun-wash: #FFF9C4;
  --sun: #FFF176;
  --orange: #FF6F00;

  --background: #F3FBFF;
  --surface: #FFFCF3;
  --surface-strong: #ffffff;
  --surface-glass: rgba(255, 255, 255, 0.86);
  --surface-soft: rgba(255, 253, 248, 0.78);
  --surface-tint: var(--sky-surface);
  --surface-warm: var(--sun-wash);
  --surface-danger: rgba(255, 111, 0, 0.14);

  --primary: var(--sky-blue);
  --accent: var(--sun);
  --warning: var(--orange);
  --destructive: var(--orange);

  --foreground: var(--ink);
  --muted-foreground: var(--ink-soft);
  --line: rgba(18, 37, 54, 0.12);
  --line-bright: rgba(129, 212, 250, 0.42);
  --line-warm: rgba(255, 241, 118, 0.66);
  --ring: var(--sun);
}
```

如果需要兼容现有别名：

```css
--cyan: var(--sky-blue);
--teal: #075d70;
--mint: var(--sky-blue);
--navy: var(--ink);
--coral: var(--orange);
--text-soft: var(--ink-soft);
```

`--teal` 不直接用 `#81D4FA`，因为浅蓝当文字对比不够；它应该是从蓝色派生出来的深色文字 token。

## Game Area Tokens

| Token | Suggested Value | Meaning |
| --- | --- | --- |
| `--panel-stage-a` | `#E1F5FE` | 牌桌浅蓝起点 |
| `--panel-stage-b` | `#B3E5FC` | 牌桌中层蓝 |
| `--panel-stage-c` | `#FFF9C4` | 牌桌暖光边缘 |
| `--panel-shell` | `rgba(255, 255, 255, 0.18)` | 玩家席位所在大面，只做层级，不做大色块 |
| `--panel-shell-strong` | `rgba(255, 255, 255, 0.34)` | 公共牌外层 |
| `--table-slot` | `#fffdf8` | 公共牌槽和桌心 |
| `--table-slot-glow` | `rgba(255, 249, 196, 0.58)` | 桌心暖光，避免白框感 |
| `--seat-surface` | `rgba(255, 255, 255, 0.84)` | 普通玩家卡 |
| `--seat-active` | `#FFF9C4` | 当前行动或本人高亮 |
| `--panel-hand` | `rgba(255, 249, 196, 0.34)` | 手牌区域背景 |
| `--panel-hand-well` | `#fffdf8` | 手牌真实承载面 |
| `--panel-player` | `rgba(255, 253, 248, 0.86)` | 当前玩家信息卡 |
| `--panel-metric-bullet` | `rgba(255, 241, 118, 0.36)` | 子弹指标 |
| `--panel-metric-hand` | `rgba(129, 212, 250, 0.18)` | 手牌指标 |

牌桌区域可以使用轻微渐变，但不要把 `#B3E5FC`、`#E1F5FE`、`#FFF9C4` 三个颜色都以高不透明度堆叠，否则会再次变脏。

## Function Area Rules

功能区只承载按钮，不应该再有整条背景色。

- `--panel-control` 应保持 `transparent`。
- 功能区外层只做定位和层级，不设置背景、不设置固定大宽度。
- 按钮组宽度由按钮数量决定：
  - 双按钮：建议 `216px` 到 `260px`。
  - 单按钮：建议 `152px` 到 `180px`。
  - 多状态纵向按钮：建议 `168px` 到 `204px`。
- 按钮之间只保留 `6px` 到 `8px` gap。
- 不要使用横跨桌面的浅蓝/浅黄条作为功能区底板。

## Button Mapping

| Button | Background | Text | Usage |
| --- | --- | --- | --- |
| Primary | `linear-gradient(135deg, #FFF176, #FF6F00)` | `--ink` | 下一局、进入房间、最推荐操作 |
| Confirm / Success | `#81D4FA` 或 `linear-gradient(135deg, #B3E5FC, #81D4FA)` | `--ink` | 出牌、确认、加入 |
| Risk / Challenge | `#FF6F00` | `--ink` | 质疑、危险确认、提前离场 |
| Info / Trust | `#FFFFFF` + `#81D4FA` border | `--teal` | 相信、查看、轻量操作 |
| Secondary | `#FFFFFF` 或透明 | `--ink` | 取消、返回、关闭 |

注意：`#FF6F00` 不适合白字，小字号白字只有约 `2.79:1` 对比度；按钮文字应使用 `--ink`。

## Accessibility Notes

按 `ui-ux-pro-max` 的可访问性规则，正常文字目标至少 `4.5:1`。本方案推荐以下配对：

| Foreground | Background | Contrast | Usage |
| --- | --- | ---: | --- |
| `#122536` | `#81D4FA` | `9.48:1` | 蓝色按钮文字 |
| `#122536` | `#B3E5FC` | `11.56:1` | 信息面文字 |
| `#122536` | `#E1F5FE` | `13.91:1` | 页面背景文字 |
| `#122536` | `#FFF9C4` | `14.59:1` | 暖色面文字 |
| `#122536` | `#FFF176` | `13.47:1` | 焦点高光文字 |
| `#122536` | `#FF6F00` | `5.60:1` | 橙色风险按钮文字 |

禁止配对：

- 白字 + `#81D4FA`
- 白字 + `#B3E5FC`
- 白字 + `#E1F5FE`
- 白字 + `#FFF9C4`
- 白字 + `#FFF176`
- 小字号白字 + `#FF6F00`

## Component Rules

### Player Seats

- 普通玩家卡使用白色半透明或 `#E1F5FE` 低透明度。
- 玩家名字用 `--ink`，席位号和状态图标用深蓝派生色 `--teal`。
- 在线状态点不要用黄色；使用 `#81D4FA` 或深蓝派生色都可以，但要和席位号保持一致。
- 当前行动席位用 `#FFF9C4` 底 + `#FFF176` ring。

### Cards

- 纸牌面继续使用接近白的 `--surface` / `--card-face`。
- 选中牌使用 `#FFF176` ring 或 `#FFF9C4` 底。
- 红色花色可以继续使用独立牌色 token；不要用 `#FF6F00` 替代红桃/方片。

### Table

- 桌心用白色或极浅暖色，保证牌面清晰。
- 桌面外层用 `#E1F5FE -> #B3E5FC -> #FFF9C4` 的低对比渐变。
- 不要用纯 `#B3E5FC` 覆盖整张牌桌。

### Status And Alerts

- `#FF6F00` 表示风险，不表示普通强调。
- 危险状态必须同时有文字，例如「质疑」「离线」「淘汰」，不能只靠橙色。
- 离线/淘汰如果需要更强烈的情绪，可以在后续新增真正的红色 token；不要强行把本主题的蓝黄体系拉脏。

## Implementation Order

1. 优先更新 `packages/ui/src/theme.ts` 的全局 token。
2. 同步 `apps/web-client/app/globals.css` fallback。
3. 更新 `packages/ui/src/styles.ts` 的按钮规则。
4. 确认 `packages/ui/src/GamePage.tsx` 功能区保持透明和内容宽度。
5. 更新 `CommunityCards`、`PlayerHand`、`PlayerBox` 中仍然硬编码的旧颜色。
6. 用 `844x390` 横屏和 `390x844` 竖屏各检查一次。
7. 跑：

```text
pnpm --filter @liars-bar/ui run build
pnpm --filter @liars-bar/web-client run build
```

## Anti-Patterns

- 不要再使用大面积灰绿色背景。
- 不要给功能区加整条浅色底板。
- 不要让浅蓝色承担正文文字。
- 不要在浅色按钮上使用白字。
- 不要把 `#FFF176` 当页面背景，它只适合焦点和选中。
- 不要把所有面板都设成蓝色；中间必须有白色和暖白留白。
