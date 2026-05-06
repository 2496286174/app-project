# Roadmap

## 目标版本

- `v0`：跑通最小链路，单主机 + 浏览器联机。
- `v1`：Android App 作为最终主机形态稳定可用。
- `v2`：PC 辅助宿主、自动发现和稳定性增强。

## 当前进度同步

- `v0` 主链路已经具备：PC 调试主机、浏览器加入、房间、开局、局内操作和结算均有对应实现。
- `v1` 正在验证：Android 原生 Host 已能打包 APK，App 内启动 HTTP/WebSocket 主机并托管同一套 WebView 页面。
- UI 正在按横屏 HUD 方向收敛：主题 token、局内尺寸 token、玩家状态图标、满员 mock 页面已落地。
- 协议已从全量广播推进到 `gameEvent` 增量同步，并保留 `gameState` 兜底恢复。
- release APK 当前仍使用 debug keystore 签名，只适合本地安装测试。

## 阶段计划

### Phase 0 - 协议与边界统一

目标：统一通信行为，避免协议分叉。

交付项：

1. 动作名与字段统一，例如 `joinGame`、`playCards`、`toggleReady`。
2. 消息结构统一，例如 `commandId`、`version`、`payload`。
3. 明确错误码和失败返回策略。
4. 明确 Android 不引入 Node/React Native runtime，只对齐协议和状态字段。

验收：

- Web/PC/Android 都能识别同一套动作协议。
- 无效请求可得到一致错误响应。
- Android APK 不包含 native `.so`。

### Phase 1 - 浏览器调试链路

目标：先把 UI、协议和一条主链路做稳。

交付项：

1. PC 调试主机可创建房间并广播状态。
2. 浏览器可加入、准备、开局、完整结算。
3. 基础断线重连，刷新后可恢复当前玩家身份。
4. 登录页、房间页、游戏页可在移动宽度下稳定显示。

验收：

- 至少 4 个浏览器客户端完成一局无阻塞对局。
- 中途断线后可在 5 秒内恢复状态同步。

### Phase 2 - Android App 主机

目标：让 Android App 成为最终可用主机。

交付项：

1. Android App 启动即开服。
2. 主机本人默认通过 App 内登录页加入。
3. 登录页展示局域网加入链接和二维码。
4. 其他玩家通过同热点或同局域网浏览器加入。
5. Android 原生主机实现与 PC 调试主机等价的房间能力。
6. Android 特有生命周期处理，例如前后台切换、进程恢复。

验收：

- Android 主机下至少 4 个浏览器客户端完成完整对局。
- Android App 内 UI 与浏览器移动端 UI 对齐。
- 与 PC 调试主机对局结果一致。
- 16 KB alignment 检查通过。

### Phase 3 - 加入体验优化

目标：降低加入门槛。

交付项：

1. MVP 方案：二维码 + 加入链接。
2. 兜底方案：手动输入 `host-ip:port`。
3. 增强方案：发现桥接层，将 UDP 或平台发现能力转换为浏览器可访问接口。
4. 房间列表缓存与过期机制。

验收：

- 新客户端可在 10 秒内定位可加入主机。
- 主机离线后房间列表可自动剔除。

### Phase 4 - 稳定性与可维护性

目标：支撑持续迭代。

交付项：

1. 关键链路日志与追踪，例如连接、命令、异常。
2. 回归测试集，例如规则、协议、联机流程。
3. Android 启动、WebView、WebSocket、二维码加入的自动化检查。
4. 架构文档和接口文档同步流程。

验收：

- 核心流程自动化测试覆盖关键场景。
- 版本迭代不引入明显联机回归。
- Android 依赖边界保持轻量，不重新引入 Node/React Native runtime。

## 技术风险清单

1. 协议漂移风险：Android Kotlin 主机与 PC TypeScript 调试主机行为不一致。
2. 浏览器网络限制：浏览器无法原生监听 UDP 广播。
3. 主机单点风险：主机异常会导致整局中断。
4. WebView 兼容风险：旧版 Android WebView 对新 JS 语法支持不足。
5. 状态漂移风险：客户端本地状态与主机状态不一致。

## 里程碑 Definition of Done

满足以下条件视为目标达成：

1. Android App 可稳定开房。
2. 主机本人可在 App 内默认加入游戏。
3. 浏览器客户端可跨设备稳定加入并完成完整对局。
4. Android App 内 UI 与浏览器移动端 UI 对齐。
5. 断线重连后客户端可恢复到正确游戏状态。
6. Android APK 保持轻内核，无 Node/React Native runtime，无 native `.so`。
