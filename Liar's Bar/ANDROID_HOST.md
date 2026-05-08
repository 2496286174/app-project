# Android Host 内核说明

## 1. 定位

Android App 是本项目最终优先的产品形态。浏览器项目不是最终内核，它的作用是：

1. 方便开发时调试 UI 和联机协议。
2. 构建出静态页面资源，交给 Android App 托管。
3. 让非主机玩家可以直接用手机浏览器加入房间。

App 打开后不需要连接外部服务器。它自己作为主机在本机启动服务，主机本人也在 App 内默认加入游戏。

## 2. 运行形态

Android App 启动流程：

1. `MainActivity` 创建并启动 `NativeHostServer`。
2. `NativeHostServer` 监听 `3000`，如果被占用则尝试 `3001` 到 `3050`。
3. 服务在同一个端口提供 HTTP 静态页面和 WebSocket 联机协议。
4. App 内 WebView 访问 `http://127.0.0.1:<端口>/login`。
5. 登录页显示主机的局域网加入链接和二维码。
6. 其他玩家通过 `http://<Android设备局域网IP>:<端口>/login?...` 先进入登录页，再输入昵称加入。

这就是最终 App 的核心体验：打开 App 即开房，主机不需要手动配置地址。

当前 Android 原生主机与 PC 调试主机都支持两种游戏模式：

- `liarsBar`：骗子酒馆。
- `texasHoldem`：德州扑克。

房主在开局前可在房间页切换模式；模式切换会保留房间玩家和排行榜累计分，但会重置本局状态。

## 3. 排行榜与结算状态

Android 原生主机需要和 PC 调试主机保持同名状态字段：

- `scoreboard`：排行榜累计积分，玩家回房、下一局或离开后不清空。
- `roundSettlement`：单局结算弹窗数据，只在游戏结束后生成。
- `roundSettlement.scoreDeltas`：本局积分变化，`totalScore` 是排行榜累计分。
- `roundSettlement.hands`：本局手牌快照。
- 结算页点击下一局时，Android 主机重置本局淘汰状态并重新发牌，排行榜累计分保留。

手牌快照规则：

- 骗子酒馆保存发牌后的初始手牌，用于结算时展示。
- 德州扑克保存结算时最终手牌，并在有公共牌比牌时写入牌型、最佳五张和名次。

结束条件必须区分模式：

- 骗子酒馆处决完成后立即结束本局并弹出结算。
- 德州扑克多人仍在手时继续走公共牌阶段；处决后只剩 1 个在手玩家时立即开牌结算。

排行榜是积分唯一来源，结算弹窗不另建一套长期积分。
Android 主机使用 App `SharedPreferences` 持久化排行榜，App 重启后会恢复历史累计分。

## 4. 状态同步模型

Android Host 当前使用“完整快照 + 增量事件”的同步模型，与 PC Host 对齐：

- 新客户端或版本缺口过大时，主机发送完整 `gameState`。
- 普通动作成功后，主机广播 `gameEvent`，只包含变化字段和变化玩家。
- 客户端保存当前 `version`，能连续应用事件时就增量更新。
- 客户端断线重连后发送 `sync`；如果本地状态可用，会请求缺失事件，否则回退完整快照。
- `fireGun` 的 `ack.data.penaltyResult` 会立即返回 `{ shot, victimId }`，保证首轮第一次开枪也能在转盘动画结束后显示结果。

这个模型减少了多人局频繁广播完整状态的开销，同时保留了兜底恢复能力。

## 5. 依赖边界

Android 端只需要非常少的运行时依赖：

- Kotlin 标准库
- NanoHTTPD WebSocket
- Android 系统 WebView

这些依赖分别负责：

- Kotlin：原生 Android 代码和游戏主机逻辑。
- NanoHTTPD WebSocket：App 内 HTTP 静态托管与 WebSocket 通信。
- WebView：展示同一套登录、房间、游戏 UI。

Android 端不应该再引入：

- React Native
- Hermes
- nodejs-mobile
- Node.js
- Express
- ws
- 桌面 Chromium 运行时
- Next.js dev server

这些依赖对最终 App 没有必要，还会带来 APK 体积、启动速度、崩溃面、16 KB page size 对齐和调试复杂度问题。

## 6. 为什么不直接复用 PC 的 Node 运行时

PC 端 `packages/host-runtime` 用 TypeScript/Node 实现主机运行时，适合浏览器开发和 PC 调试。

Android 如果直接复用它，就必须把 JavaScript/Node 运行时带进 APK。之前的 `nodejs-mobile` 方案已经暴露出问题：

- APK 内会出现 native `.so`。
- Android 16 KB page size 检查容易失败。
- WebView、Node、React Native 多层运行时容易造成闪退和卡顿。
- 依赖链变长后，排查成本很高。

所以 Android 采用原生 Kotlin 主机。它和 PC/Web 对齐的是协议、状态字段、页面资源和用户流程，不是运行时依赖。

## 7. 目录职责

```txt
apps/android-host/android/
  原生 Kotlin Android 工程，最终 App 内核。

apps/android-host/web-assets/web/
  构建生成的静态页面资源，由 Android App 打包进 assets。
  这个目录由 scripts/sync-web-assets.mjs 生成，不手动维护。

apps/web-client/
  浏览器调试工程和 WebView 页面源码。
  它负责产出静态 UI，不在 Android App 内作为开发服务器运行。
```

## 8. 构建原则

Android 构建前先执行：

```powershell
pnpm run build:hosts
```

这一步会把 `apps/web-client/out` 同步到 `apps/android-host/web-assets/web`。

然后可以执行：

```powershell
pnpm run:android-host
```

或者在 Android Studio 打开 `apps/android-host/android`，手动构建 debug APK。

release APK 手动构建建议使用 JDK 17：

```powershell
cd apps/android-host/android
$env:JAVA_HOME='C:\Program Files\Java\jdk-17.0.18'
$env:Path="$env:JAVA_HOME\bin;$env:Path"
.\gradlew.bat assembleRelease --no-daemon
```

release 产物：

```txt
apps/android-host/android/app/build/outputs/apk/release/app-release.apk
```

当前 `release` 构建类型仍使用 debug keystore 签名，只用于本地安装测试。需要放到项目根目录时，可复制为：

```txt
app-release.apk
```

## 9. 验收标准

Android App 侧至少满足：

1. 启动不闪退。
2. App 内默认进入登录页。
3. 登录页展示局域网加入链接和二维码。
4. 主机本人输入昵称后能进入房间。
5. 同热点或同局域网玩家能用浏览器加入。
6. APK 内不包含 native `.so`。
7. 16 KB alignment 检查通过。
