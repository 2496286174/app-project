# Liar's Bar

以 Android App 为最终宿主的局域网联机桌游项目。

浏览器工程主要用于开发调试、查看 UI、验证协议，以及让其他玩家在同一热点或局域网里用浏览器加入房间。最终产品优先级是 App，Android 端必须保持轻内核：自己开服、自己托管页面、自己作为主机玩家加入，不依赖额外 Node 服务。

## 快速开始

```powershell
pnpm install
pnpm dev
```

开发服务启动后：

- 浏览器调试页：`http://127.0.0.1:3000/`
- 局域网调试页：`http://<PC局域网IP>:3000/`
- 满玩家 UI 测试页：`http://127.0.0.1:3000/game?mock=full`
- 开发游戏主机 WebSocket：`3001`
- 调试主机页：`http://<PC局域网IP>:3000/host`

`/host` 只保留给开发和排查用，不是 Android App 的最终主机台。
`/game?mock=full` 是 8 人满桌 mock 对局入口，不需要登录，主要用于检查满员桌面、移动端手牌区和底部操作按钮。

## 当前同步状态

- 当前项目以 Android Host 为最终形态，PC Host 和浏览器开发服务只用于调试与验证。
- Android Host 和 PC Host 都采用同端口模型：HTTP 静态页面、WebSocket 协议和 `/host-info` 由同一个主机端口提供。
- WebSocket 已支持 `gameEvent` 增量状态同步；客户端断线重连或版本缺口过大时会自动回退到完整 `gameState` 同步。
- 局内 UI 以横屏 HUD 为主，主题色由 `packages/ui/src/theme.ts` 全局控制，`apps/web-client/app/layout.tsx` 在首屏注入主题变量。
- 玩家状态指标已经改成图标化展示，子弹和手牌文字标签不再占用玩家卡空间。
- 根目录的 `app-release.apk` 是最近一次 release 构建复制出来的安装包；正式分发前仍需要替换为正式签名。

## 最终 App 形态

Android App 启动后会直接：

1. 在手机本机启动原生 Kotlin HTTP/WebSocket 主机。
2. 自动选择可用端口，优先 `3000`，被占用时尝试 `3001` 到 `3050`。
3. 在 App 内打开登录页，主机本人输入昵称后入座。
4. 在登录页展示局域网加入链接和二维码。
5. 其他玩家连接同一热点或局域网后，用浏览器扫码或打开链接加入。

因此不需要单独的 App 主机台页面，也不需要玩家手动修改主机地址。地址以 Android 设备当前局域网 IP 为准。

## 积分与结算

- 积分统一归排行榜管理，排行榜是累计分，不是单局临时分。
- 下一局、回房、切换游戏流程时不清空排行榜积分。
- 玩家离开房间后，排行榜仍保留历史记录；当前在线玩家会继续带着累计分参与后续对局。
- PC 调试主机把排行榜保存到用户目录 `.liars-bar/scoreboard.json`，Android 主机保存到 App 的 `SharedPreferences`。
- 结算页点击下一局会重置本局淘汰状态并重新发牌，但不会清空排行榜累计分。
- 单局结束时弹出结算弹窗，只展示本局积分变化、排行榜累计分和本局手牌快照。
- 骗子酒馆结算展示本局初始手牌；德州扑克结算展示最终手牌、最佳牌型和比牌名次。
- 骗子酒馆有人完成处决后，本局立即结束并进入结算。
- 德州扑克多人仍在手时继续推进公共牌阶段；处决后只剩 1 个在手玩家时，立即开牌结算。

## 运行模式

### 浏览器开发模式

`pnpm dev` 用于高频调试，会同时启动：

- `packages/shared` TypeScript watch
- `packages/ui` TypeScript watch
- `apps/web-client` Next.js dev server
- `scripts/run-browser-host.mjs` 局域网 WebSocket 调试主机

开发模式默认端口：

- 前端页面：`3000`
- 游戏主机：`3001`

如果端口冲突，可先设置：

```powershell
$env:WEB_PORT='3100'
$env:HOST_PORT='3101'
pnpm dev
```

### 打包/宿主模式

- `pnpm run:pc-browser`：构建静态资源后启动浏览器测试主机，不打开桌面壳。
- `pnpm run:pc-host`：构建静态资源后启动 PC Edge/WebView2 候选主机。
- `pnpm run:android-host`：构建静态资源后生成 Android 测试 APK，Android App 启动后自动开服并进入 App 内登录流程。
- release APK 手动构建入口：先执行 `pnpm run build:android-assets`，再到 `apps/android-host/android` 执行 `.\gradlew.bat assembleRelease`。

打包/宿主模式下，浏览器访问：`http://<主机IP>:<端口>/`

## Android 轻内核原则

Android 端只保留必要依赖：

- Android Gradle Plugin
- Kotlin Android 插件与 Kotlin 标准库
- `org.nanohttpd:nanohttpd-websocket`，用于 App 内 HTTP 静态托管和 WebSocket

Android 端不再引入：

- React Native
- Hermes
- nodejs-mobile
- Node/Express/ws 运行时
- 桌面 Chromium 运行时
- Next.js dev server

这样做的原因很直接：App 是最终形态，内核越薄，启动越稳，APK 越小，16 KB page size 兼容风险越低。浏览器项目只在构建阶段导出静态 HTML/CSS/JS，作为 App 内 WebView 和外部浏览器玩家的界面资源。

更详细的 App 内核说明见 [ANDROID_HOST.md](./ANDROID_HOST.md)。

## 文档导航

- [ANDROID_HOST.md](./ANDROID_HOST.md)：Android App 最终形态、轻内核原则和依赖边界。
- [RUNNING.md](./RUNNING.md)：运行、端口、打包与 Android Studio 手动构建说明。
- [ARCHITECTURE.md](./ARCHITECTURE.md)：局域网主机、共享协议、端侧边界。
- [PROTOCOL.md](./PROTOCOL.md)：WebSocket 消息、动作、错误码和 `hostInfo`。
- [COLOR_SYSTEM.md](./COLOR_SYSTEM.md)：全局主题 token、颜色职责和换色入口。
- [LANDSCAPE_UI_DESIGN.md](./LANDSCAPE_UI_DESIGN.md)：横屏局内 UI 设计基线、尺寸分区和响应式策略。
- [项目目录说明.md](./项目目录说明.md)：目录职责和生成产物说明。
- [ROADMAP.md](./ROADMAP.md)：阶段目标和后续风险。

## 仓库结构

```txt
apps/web-client/       # 浏览器调试界面和外部玩家浏览器入口
apps/pc-host/          # PC Edge/WebView2 候选宿主
apps/android-host/     # 原生 Kotlin Android 主机 + WebView 玩家界面
packages/shared/       # Web/PC 共享规则、协议和类型
packages/host-runtime/ # PC 端 HTTP + WebSocket 调试主机运行时
packages/ui/           # Web React UI 组件
scripts/               # 构建与同步脚本
```

## 当前边界

- 只做局域网联机，不做线上房间、公网穿透或云服务。
- Android Host 是最终优先目标，PC Host 和浏览器开发服务主要服务调试与对齐。
- Android Host 使用原生 Kotlin 实现本地 HTTP/WebSocket 服务和主流程规则，不把 Node/React Native 运行时塞进 APK。
- APK 内无 native `.so`，用于规避 Android 16 KB page size 的 ELF LOAD 对齐问题。
- PR、提交和推送由用户手动完成；需要时我只提供中文 PR 说明草稿。

## 许可证

MIT
