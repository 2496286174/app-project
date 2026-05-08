# 运行说明

## 1. 前提环境

- Node.js `>= 20`
- pnpm `>= 10`
- 局域网内设备可互相访问
- Android Studio 或 Android SDK
- Android 构建建议使用 JDK 17。当前项目已验证 `C:\Program Files\Java\jdk-17.0.18` 可正常打包；JDK 25 会触发当前 Kotlin/Gradle 工具链版本解析问题。

## 2. 推荐使用方式

1. 日常 UI 和协议调试：`pnpm dev`
2. PC 辅助验证：`pnpm run:pc-browser` 或 `pnpm run:pc-host`
3. Android 最终验证：`pnpm run:android-host` 或 Android Studio 手动构建

浏览器项目只是方便调试和查看，不是最终 App 内核。最终 App 形态以 Android Host 为准。

## 3. 浏览器开发模式

开发模式用于高频前端调试，Android App 不参与这一步。

```bash
pnpm dev
```

默认端口：

- 前端页面：`WEB_PORT=3000`
- 游戏主机：`HOST_PORT=3001`

打开地址：

- 本机浏览器：`http://127.0.0.1:<WEB_PORT>/`
- 局域网浏览器：`http://<PC主机局域网IP>:<WEB_PORT>/`
- 调试主机页：`http://<PC主机局域网IP>:<WEB_PORT>/host`
- 满玩家 UI 测试页：`http://127.0.0.1:<WEB_PORT>/game?mock=full`

`/host` 是调试页，不是 Android App 最终流程。

`/game?mock=full` 会直接进入 8 人满桌 mock 对局，用来检查桌面布局、移动端手牌高度、HUD 和按钮间距；它不需要登录，也不连接真实 WebSocket 房间。

如果端口冲突，可在启动前设置，例如 PowerShell：

```powershell
$env:WEB_PORT='3100'
$env:HOST_PORT='3101'
pnpm dev
```

## 4. 打包/宿主模式

打包/宿主模式用于接近最终运行形态的测试：

- `apps/web-client` 先构建为静态资源。
- 静态资源同步到 PC/Android 宿主目录。
- 宿主在同一端口同时托管页面和 WebSocket。

常用命令：

```bash
# 构建共享逻辑、UI、前端静态资源，并同步到 Android 宿主目录
pnpm build:android-assets

# 启动 PC Edge/WebView2 候选主机，会先自动执行 build:pc-assets
pnpm run:pc-host

# 启动 PC 浏览器测试主机，不打开桌面壳
pnpm run:pc-browser

# 构建 Android 测试 APK，会先自动执行 build:android-assets
pnpm run:android-host
```

## 5. Android App 联机步骤

1. 确保 Android 开发环境可用，Gradle JDK 使用 JDK 17。
2. 执行 `pnpm run:android-host` 生成测试 APK。
3. 安装并打开 App。
4. App 会启动原生 Kotlin 主机服务，默认尝试 `3000` 端口。
5. 如果 `3000` 被占用，App 会自动尝试 `3001` 到 `3050`。
6. App 内登录页会显示加入链接和二维码。
7. 主机本人输入昵称后进入房间。
8. 其他玩家连接同一热点或局域网后，用浏览器扫码或打开链接加入。

兜底手动地址格式：

```txt
http://<Android设备局域网IP>:<端口>/login?hostAddress=<Android设备局域网IP>&hostPort=<端口>
```

当前 Android Host 不依赖 React Native、Hermes、nodejs-mobile、Node、Express 或 ws。APK 内不包含 native `.so`，因此不会触发 Android 16 KB page size 的 ELF LOAD segment 对齐警告。

## 6. Android 手动打包

### debug APK

`pnpm run:android-host` 会先执行 `pnpm run build:android-assets`，再进入 Android 工程执行 debug 构建：

```powershell
pnpm run:android-host
```

debug APK 默认产物位置：

```txt
apps/android-host/android/app/build/outputs/apk/debug/app-debug.apk
```

### release APK

release 包也必须先同步最新 Web 静态资源：

```powershell
pnpm run build:android-assets
```

然后使用 JDK 17 执行 release 构建：

```powershell
cd apps/android-host/android
$env:JAVA_HOME='C:\Program Files\Java\jdk-17.0.18'
$env:Path="$env:JAVA_HOME\bin;$env:Path"
.\gradlew.bat --stop
.\gradlew.bat assembleRelease --no-daemon
```

release APK 默认产物位置：

```txt
apps/android-host/android/app/build/outputs/apk/release/app-release.apk
```

当前 `release` 构建类型仍使用 debug keystore 签名，适合本地安装测试，不等于应用商店正式签名包。

如果需要把 APK 放到仓库根目录：

```powershell
Copy-Item -LiteralPath "apps/android-host/android/app/build/outputs/apk/release/app-release.apk" -Destination "app-release.apk" -Force
```

根目录 `app-release.apk` 是复制产物，便于传输安装；源产物仍以上面的 Gradle 输出目录为准。

## 7. Android Studio 手动打包

1. 先在仓库根目录执行：

```powershell
pnpm run build:android-assets
```

2. 用 Android Studio 打开：

```txt
apps/android-host/android
```

3. 等待 Gradle Sync 完成。
4. 选择 `Build > Build Bundle(s) / APK(s) > Build APK(s)`。
5. debug APK 默认产物位置：

```txt
apps/android-host/android/app/build/outputs/apk/debug/app-debug.apk
```

这个 APK 用于本地测试即可，不需要正式签名。

## 8. PC 主机联机步骤

PC Host 是基于 Microsoft Edge/WebView2 运行时的辅助验证形态，不再打包独立 Electron。

1. 执行 `pnpm run:pc-host`。
2. 主机启动后默认监听 `3000` 端口，也可通过 `HOST_PORT` 覆盖。
3. 其他玩家在浏览器打开：`http://<PC主机局域网IP>:<端口>/`。

## 9. 生成产物说明

以下目录由安装、开发或构建命令生成，不作为源码维护：

- `node_modules/`
- `apps/*/node_modules/`
- `packages/*/dist/`
- `apps/web-client/.next/`
- `apps/web-client/out/`
- `apps/pc-host/build/`
- `apps/android-host/web-assets/`
- `apps/android-host/android/.gradle/`
- `apps/android-host/android/app/build/`
- `.dev-logs/`
- `app-release.apk`

## 10. 依赖原则

Android App 内核只保留 Kotlin + WebView + NanoHTTPD WebSocket。浏览器和 PC 相关依赖只服务开发、调试、静态资源构建或 PC 辅助验证，不进入 Android 运行时。
