# Architecture

## 1. 目标

本项目目标是构建一个以 Android App 为最终优先形态的局域网联机系统：

1. Android App 打开后自己作为主机开服。
2. 主机本人默认在 App 内加入游戏。
3. 其他玩家通过同一热点或局域网，用浏览器扫码或打开链接加入。
4. 浏览器工程用于调试 UI、验证协议、生成静态页面资源，不作为最终 App 内核。
5. PC Host 保留为开发、调试和辅助验证形态。

## 2. 核心原则

### 2.1 单一权威主机

每局只有一个 `Authoritative Server`：

- 主机端负责规则校验和状态推进。
- 客户端只发送动作请求，不本地裁决结果。
- Android App 作为最终主机时，权威服务运行在 App 本机进程内。

### 2.2 Android 轻内核优先

Android 端不把桌面端或开发端运行时塞进 APK。

保留：

- Kotlin 原生代码
- Android WebView
- NanoHTTPD WebSocket
- 构建后的静态 HTML/CSS/JS

不引入：

- React Native
- Hermes
- nodejs-mobile
- Node/Express/ws 运行时
- Next.js dev server
- Electron

这个边界是为了减少崩溃面、降低 APK 体积、提升启动稳定性，并避免 Android 16 KB page size 的 native `.so` 对齐问题。

### 2.3 协议对齐，而不是运行时强行复用

PC/Web 端可以复用 TypeScript 包：

- `packages/shared`
- `packages/host-runtime`
- `packages/ui`

Android 端不直接运行这些 Node/TypeScript runtime。Android 端通过原生 Kotlin 实现同一套 HTTP/WebSocket 协议和客户端状态字段，与浏览器 UI 对齐。

原因是：如果为了代码复用而把 Node 或 JS runtime 放进 APK，App 内核会变重，之前的闪退、卡顿和 16 KB alignment 风险会重新回来。

### 2.4 单进程托管模型

打包/宿主模式下，不单独启动 `apps/web-client` Web 服务进程。

`apps/web-client` 在构建阶段导出静态资源，并同步到：

- `apps/pc-host/build`
- `apps/android-host/web-assets/web`

主机进程在同一端口同时承载：

- HTTP 静态页面分发
- WebSocket 实时协议服务
- `/host-info` 主机信息接口

浏览器通过 `http://<host-ip>:<port>` 打开页面后，直接连接 `ws://<host-ip>:<port>`。

Android App 通过 WebView 访问本机 `127.0.0.1:<port>`，外部玩家通过 Android 设备局域网 IP 访问。

当前 PC Host 和 Android Host 都采用同一套连接入口：

- `/`、`/login`、`/room`、`/game` 等页面由静态资源托管。
- `/host-info` 返回主机平台、局域网 IP、端口、加入链接、二维码文本、游戏模式和玩家数量。
- WebSocket 与页面同端口，避免玩家手动维护两个地址。

### 2.5 排行榜是累计积分源

积分以主机维护的排行榜为准。排行榜不是单局结算临时数据，而是跨局累计记录：

- 每次加减分都写回玩家累计分，并同步到 `scoreboard`。
- `resetGame`、回房、下一局不清空排行榜。
- 玩家离开房间时，排行榜记录保留为历史条目。
- PC 调试主机持久化到用户目录 `.liars-bar/scoreboard.json`；Android 主机持久化到 App `SharedPreferences`。
- 单局结算弹窗只读取本局开始分数与当前累计分的差值，展示“本局变化 + 排行榜累计分”。
- 结算页的下一局按当前房间玩家重新开局，重置本局淘汰状态，但沿用排行榜累计分。

结算手牌规则：

- 骗子酒馆：展示本局发牌后的初始手牌快照。
- 德州扑克：展示结算时最终手牌、最佳五张、牌型和比牌名次。

结束条件规则：

- 骗子酒馆：有人完成处决后，本局立即结束，生成 `roundSettlement`。
- 德州扑克：多人仍在手时继续推进公共牌阶段；处决后只剩 1 个在手玩家时，立即开牌并生成 `roundSettlement`。

### 2.6 不需要独立主机台页面

最终 Android App 不需要单独的主机台页面。

App 内登录页承担这些职责：

- 主机本人输入昵称并入座。
- 展示当前主机连接状态。
- 展示加入链接。
- 展示二维码。

调试用 `/host` 页面可以保留在浏览器开发流程里，但它不是最终 Android 产品流程。

## 3. 模块边界

### 3.1 Web/PC 侧

- `apps/web-client`：Next.js 页面源码，用于浏览器调试、WebView UI、外部玩家浏览器入口。
- `packages/ui`：React UI 组件。
- `packages/shared`：Web/PC 共享类型、协议和规则工具。
- `packages/host-runtime`：PC 端 HTTP + WebSocket 调试/辅助主机。
- `apps/pc-host`：PC/Electron 或浏览器测试宿主。

### 3.2 Android 侧

- `apps/android-host/android`：原生 Android 工程。
- `MainActivity`：启动主机服务，创建 WebView，进入 App 内登录页。
- `NativeHostServer`：原生 Kotlin HTTP/WebSocket 主机，托管静态页面和游戏协议。
- `apps/android-host/web-assets/web`：构建生成的静态页面资源，打进 Android assets。

Android 侧应该继续保持薄：平台入口、WebView、原生主机、必要规则。不要重新引入跨平台运行时。

## 4. 开发模式与打包模式

### 4.1 开发模式

`pnpm dev` 用于高频开发：

- 前端页面由 `next dev` 提供热更新。
- 游戏主机由 PC Node/WebSocket 调试主机提供。
- Android App 不参与这一步。

这个模式的目标是快，不要求完全等同最终 App 运行形态。

### 4.2 打包/宿主模式

打包/宿主模式用于最终验证：

- 前端先构建为静态资源。
- PC Host 或 Android Host 在本机托管页面和 WebSocket。
- Android App 打开即开服，并让主机本人从 App 内加入。

## 5. 网络协议

### 5.1 通信模型

- 主机与客户端统一使用 WebSocket。
- 主机广播权威状态。
- 客户端按 `version` 更新状态。
- 错误必须显式返回，不静默吞掉。

当前同步策略是“快照 + 事件补丁”：

- `gameState`：完整权威快照，用于首次进入、强制恢复和版本缺口过大时兜底。
- `gameEvent`：动作成功后的增量补丁，包含变化字段、变化玩家、移除玩家和玩家顺序。
- `sync`：客户端重连或发现版本缺口时发起，payload 会携带 `hasGameState`，主机据此决定补发事件或完整快照。
- `ack`：命令确认；`fireGun` 的确认数据会带 `penaltyResult`，用于本地转盘动画结束后立即展示射击结果。

### 5.2 消息结构

```ts
type ClientMessage = {
  type: 'command' | 'sync' | 'ping';
  action?: string;
  playerId: string;
  commandId: string;
  version?: number;
  payload?: unknown;
};

type ServerMessage = {
  type: 'gameState' | 'gameEvent' | 'ack' | 'error' | 'hostInfo' | 'pong';
  roomId?: string;
  version?: number;
  timestamp?: number;
  commandId?: string;
  data?: unknown;
  error?: {
    code: string;
    message: string;
    retryable: boolean;
  };
};
```

协议字段和动作定义以 [PROTOCOL.md](./PROTOCOL.md) 为准。

## 6. 局域网加入

MVP 采用二维码和链接加入：

1. Android App 获取本机局域网 IP。
2. 登录页展示 `joinUrl` 和二维码。
3. 其他玩家连接同一热点或局域网。
4. 玩家扫码或打开链接进入 `/login`，输入昵称后再进入房间。

浏览器无法直接监听 UDP 广播，所以自动发现可以作为后续增强，不作为当前 App 内核的前置条件。

## 7. UI 复用策略

- `packages/ui` 放 React 展示组件。
- `apps/web-client` 负责页面容器、路由和浏览器存储。
- Android App 不写一套复杂原生 UI，优先通过 WebView 复用静态 UI。
- Android 原生层只处理开服、端口、WebView、生命周期和平台能力。

当前 UI 设计以横屏局内 HUD 为主：

- 主题色从 `packages/ui/src/theme.ts` 输出，`apps/web-client/app/layout.tsx` 首屏注入 CSS 变量。
- 主题 fallback 保留在 `apps/web-client/app/globals.css`，用于静态页面兜底。
- 局内卡牌尺寸由 `packages/ui/src/cardMetrics.ts` 管理，避免不同组件自行推导尺寸。
- 玩家状态指标使用 `packages/ui/src/StatusIcon.tsx`，玩家卡只保留图标和数值。
- 局内页支持 `PullToRefresh` 下拉刷新状态，作为移动端网络波动时的手动恢复入口。

## 8. 文档边界

- Android 内核说明见 [ANDROID_HOST.md](./ANDROID_HOST.md)。
- 运行和打包步骤见 [RUNNING.md](./RUNNING.md)。
- 协议字段和动作定义见 [PROTOCOL.md](./PROTOCOL.md)。
- 迭代顺序、验收标准见 [ROADMAP.md](./ROADMAP.md)。
