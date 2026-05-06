# Protocol

## 1. 适用范围

本协议用于 `PC/Android Host` 与 `Web Browser Client` 的实时通信。  
目标是让三端使用同一套动作定义、字段语义和错误处理规则。

## 2. 传输层约定

- 传输协议：`WebSocket`
- 编码格式：`JSON (UTF-8)`
- 通信方向：
  - `Client -> Host`：动作请求
  - `Host -> Client`：状态广播、确认、错误

## 3. 消息封包

### 3.1 ClientMessage

```ts
type ClientMessage = {
  type: 'command' | 'sync' | 'ping';
  action?: ActionType;
  roomId?: string;
  playerId: string;
  commandId: string;
  version: number;
  timestamp: number;
  payload?: Record<string, unknown>;
};
```

字段说明：

- `commandId`：客户端生成的唯一命令 ID，用于幂等。
- `version`：客户端已知的最新状态版本。
- `timestamp`：毫秒时间戳，用于排障。

### 3.2 ServerMessage

```ts
type ServerMessage = {
  type: 'gameState' | 'gameEvent' | 'stateChanged' | 'ack' | 'error' | 'pong' | 'hostInfo';
  roomId?: string;
  commandId?: string;
  version: number;
  timestamp: number;
  data?: Record<string, unknown>;
  error?: {
    code: ErrorCode;
    message: string;
    retryable: boolean;
  };
};
```

### 3.3 HostInfo

主机启动、客户端连接、状态变化时会返回 `hostInfo`：

```ts
type HostInfo = {
  platform: 'pc' | 'android' | 'dev' | 'unknown';
  ip: string;
  hostName: string;
  name: string;
  lanIp: string;
  port: number;
  localUrl: string;
  joinUrl: string;
  wsUrl: string;
  qrText: string;
  playerCount: number;
  maxPlayers: number;
  gameMode: 'liarsBar' | 'texasHoldem';
  startedAt: number;
};
```

当前阶段 `joinUrl` / `qrText` 是局域网加入入口，浏览器打开后必须先进入登录页；登录页保存 `hostAddress` 与 `hostPort`，玩家输入昵称后再进入房间页。

`ip` / `name` 是早期字段别名，`lanIp` / `hostName` 是当前推荐字段。两组字段会继续同时返回，方便旧页面兼容。

### 3.4 GameEvent

普通动作成功后，主机优先广播 `gameEvent` 增量补丁，而不是每次广播完整 `gameState`：

```ts
type GameEventData = {
  eventId: string;
  action: string;
  actorPlayerId: string;
  baseVersion: number;
  version: number;
  patch: {
    set?: Record<string, unknown>;
    players?: Player[];
    removePlayerIds?: string[];
    playerOrder?: string[];
  };
};
```

约定：

- `baseVersion` 是补丁应用前版本，`version` 是应用后版本。
- 客户端只有在本地状态版本等于或高于 `baseVersion` 时才应用补丁。
- 如果客户端没有本地状态、版本缺口过大或事件日志已被主机裁剪，必须发起 `sync` 并回退到完整 `gameState`。
- `stateChanged` 是兼容旧客户端的轻量通知；新客户端应优先处理 `gameEvent`。

## 4. 动作定义

`ActionType` 建议固定为以下集合：

```ts
type ActionType =
  | 'joinGame'
  | 'leaveGame'
  | 'toggleReady'
  | 'startGame'
  | 'dealCards'
  | 'addBullets'
  | 'playCards'
  | 'challenge'
  | 'trust'
  | 'refuseBullets'
  | 'fireGun'
  | 'resolvePenalty'
  | 'discardTexasCard'
  | 'exitTexasRound'
  | 'changeGameMode'
  | 'getGameState'
  | 'returnToRoom'
  | 'endGame'
  | 'restartRound';
```

### 4.1 动作载荷（payload）规范

- `joinGame`
  - `{ playerName: string }`
- `toggleReady`
  - `{ isReady: boolean }`
- `addBullets`
  - `{ count: number }`
- `playCards`
  - `{ cardIds: string[]; declaredCount: number }`
- `fireGun`
  - payload 空对象即可；成功 `ack.data.penaltyResult` 会返回 `{ shot: boolean; victimId: string }`
- `discardTexasCard`
  - `{ cardId: string }`
- `changeGameMode`
  - `{ gameMode: 'liarsBar' | 'texasHoldem' }`
- 其他动作
  - 空对象 `{}` 即可

### 4.2 动作权威等级

动作按是否需要主机裁决分为四类：

- A. 必须主机权威裁决：`challenge`、`fireGun`、`trust`、`refuseBullets`、`exitTexasRound`、`restartRound`、`startGame`、`dealCards`、`changeGameMode`、`returnToRoom`、`endGame`。客户端不能本地提交最终公共状态，只能等待主机 `ack` 和广播。
- B. 本地乐观更新 + 主机确认：`addBullets`、`playCards`、`discardTexasCard`、`toggleReady`。客户端可先更新当前玩家可见状态，但主机仍要校验轮次、牌归属、数量、房间状态等条件；失败时客户端回到权威状态。
- C. 轻校验或只读：`leaveGame`、`joinGame`、`sync(preferSnapshot)`、`getGameState`。其中 `sync(preferSnapshot)` 只拉取权威状态，不改变游戏逻辑。
- D. 纯本地交互：规则面板、积分榜弹窗、手牌选择、加/不加子弹弹窗开关、结算弹窗关闭、处决结果“确定”、下拉刷新手势本身。这类交互不应发起会改变公共状态的请求。

## 5. 状态同步

### 5.1 广播规则

- 主机在以下时机广播 `gameState`：
  - 新客户端首次需要完整状态时
  - 客户端版本缺口过大，无法补发连续 `gameEvent` 时
  - 定时保活（可选）
  - 客户端发起 `getGameState` 或 `sync` 后
- 主机在成功处理普通动作后优先广播 `gameEvent`。
- 主机在玩家数、模式、端口或加入信息变化时广播 `hostInfo`。

#### 5.1.1 房主强制状态广播

以下房主动作属于强制状态广播：

- `startGame` / `dealCards`：房主开始游戏或发牌。
- `changeGameMode`：房主切换玩法模式。
- `returnToRoom`：房主把对局带回房间页。
- `endGame`：房主结束当前对局。

规则：

- 主机处理成功后必须立即广播对应 `gameEvent`，不能等待房间页固定轮询。
- 如果动作会影响加入信息、玩家数量、房间状态或模式，同时广播 `hostInfo`。
- 房间页为了降低请求量可以关闭实时增量应用；但收到这些强制动作的 `gameEvent` 时，客户端必须立刻执行一次 `sync(preferSnapshot=true)`，不要等下一次房间状态轮询。
- 这类动作只由房主发起；普通玩家客户端只接收广播并更新页面。

### 5.2 版本规则

- 主机维护全局单调递增 `version`。
- 客户端收到更高版本必须覆盖本地状态。
- 客户端提交旧版本命令时，主机可：
  - 先处理并返回新版本，或
  - 返回冲突错误并附带最新状态。

### 5.3 幂等规则

- 同一 `playerId + commandId` 只处理一次。
- 重复命令必须返回同一结果语义（`ack` 或 `error`），不可重复执行副作用。
- `joinGame` 会把去空格后的 `playerName` 作为稳定 `playerId`，方便同名玩家刷新后恢复原身份。

### 5.4 排行榜与结算字段

`gameState` 可以带以下累计与结算字段：

```ts
type LeaderboardEntry = {
  playerId: string;
  name: string;
  score: number;
  isActive: boolean;
  lastSeen?: number;
};

type RoundSettlement = {
  id: string;
  gameMode: 'liarsBar' | 'texasHoldem';
  round: number;
  scoreDeltas: Array<{
    playerId: string;
    delta: number;
    totalScore: number;
  }>;
  hands: Array<{
    playerId: string;
    cards: Card[];
    source: 'initial' | 'final';
    isParticipant?: boolean;
    isWinner?: boolean;
    isTiedBest?: boolean;
    compareRank?: number;
    handCategory?: string;
    handCategoryRank?: number;
    handRanks?: number[];
    bestCards?: Card[];
  }>;
  winnerIds: string[];
  loserIds?: string[];
  safeExitIds?: string[];
  shotExitIds?: string[];
  communityCards?: Card[];
};
```

约定：

- `scoreboard` 是排行榜累计积分源，回房、下一局、玩家离开不清空。
- 主机应将 `scoreboard` 持久化到本地存储，重启后恢复累计分。
- `roundSettlement` 是单局结束弹窗数据，不负责长期保存积分。
- `restartRound` 从结算态进入下一局时，重置本局淘汰状态并重新发牌，继续沿用 `scoreboard`。
- 骗子酒馆的 `hands.source` 为 `initial`，展示发牌后的初始手牌。
- 德州扑克的 `hands.source` 为 `final`，展示结算时最终手牌和牌型比较。
- 骗子酒馆完成处决后立即广播带 `roundSettlement` 的结束状态。
- 德州扑克多人仍在手时最终轮摊牌广播 `roundSettlement`；处决后只剩 1 个在手玩家时立即广播 `roundSettlement`。

## 6. 错误码

```ts
type ErrorCode =
  | 'INVALID_MESSAGE'
  | 'INVALID_ROOM'
  | 'UNAUTHORIZED_ACTION'
  | 'PLAYER_NOT_FOUND'
  | 'ROOM_FULL'
  | 'GAME_NOT_STARTED'
  | 'NOT_YOUR_TURN'
  | 'INVALID_ACTION_STATE'
  | 'STALE_VERSION'
  | 'INTERNAL_ERROR';
```

建议语义：

- `INVALID_MESSAGE`：字段缺失或类型错误
- `INVALID_ROOM`：请求的 `roomId` 与当前主机房间不一致
- `UNAUTHORIZED_ACTION`：非法身份或权限不足
- `STALE_VERSION`：客户端版本过旧
- `INTERNAL_ERROR`：主机内部异常

## 7. 连接流程

1. 客户端建立 WebSocket 连接。
2. 主机立即发送 `hostInfo`。
3. 客户端发送 `joinGame`。
4. 主机返回 `ack`，并通过 `gameEvent` 或 `gameState` 同步房间状态。
5. 对局期间客户端持续发动作命令，主机返回 `ack` 并广播 `gameEvent`。
6. 连接断开后客户端自动重连，发送 `sync`。如果 payload 中 `hasGameState=true`，主机会优先补发缺失事件；否则发送完整 `gameState`。
7. 如果客户端收到无法应用的 `gameEvent`，应主动 `sync` 获取连续事件或完整快照。

## 8. 兼容与版本演进

- 协议版本建议放在应用配置中（如 `PROTOCOL_VERSION = 1`）。
- 新增字段遵循向后兼容原则：只新增可选字段，不破坏现有字段语义。
- 删除字段前至少经历一个兼容版本窗口。

## 9. 非目标（当前阶段）

- 浏览器直接监听 UDP 广播（Web 平台限制，不在本协议解决范围内）
- 多主机热切换
- 跨公网穿透和 NAT 打洞
- 线上联机和云房间
