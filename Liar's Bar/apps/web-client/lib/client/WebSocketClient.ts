import {
  StoredHostConfig,
  buildDefaultWebSocketUrl,
  saveHostConfig
} from './hostConfig';

type GameStateCallback = (gameState: any, version: number) => void;
type ErrorCallback = (error: string) => void;
type HostInfoCallback = (hostInfo: any) => void;
type ConnectionStateCallback = (state: ConnectionState) => void;

export type ConnectionState = 'idle' | 'connecting' | 'online' | 'offline' | 'reconnecting';

export type ActionResult = {
  result: boolean;
  replayedCommand: boolean;
  errorCode?: string;
  errorMessage?: string;
  retryable?: boolean;
  data?: Record<string, unknown>;
};

type ConnectOptions = Partial<StoredHostConfig> & {
  url?: string;
  autoReconnect?: boolean;
};

type ClientMessage = {
  type: 'command' | 'sync' | 'ping';
  action?: string;
  roomId?: string;
  playerId: string;
  commandId: string;
  version: number;
  timestamp: number;
  payload?: Record<string, unknown>;
};

type ServerMessage = {
  type: 'gameState' | 'gameEvent' | 'stateChanged' | 'ack' | 'error' | 'pong' | 'hostInfo';
  roomId?: string;
  commandId?: string;
  version?: number;
  timestamp?: number;
  data?: Record<string, unknown>;
  error?: {
    code: string;
    message: string;
    retryable: boolean;
  };
};

type GameEventPatch = {
  set?: Record<string, unknown>;
  players?: Array<Record<string, unknown>>;
  removePlayerIds?: string[];
  playerOrder?: string[];
};

type GameEventData = {
  eventId?: string;
  action?: string;
  actorPlayerId?: string;
  baseVersion?: number;
  version?: number;
  patch?: GameEventPatch;
};

type PendingCommand = {
  resolve: (result: ActionResult) => void;
  timeoutId: ReturnType<typeof setTimeout>;
};

const DEFAULT_COMMAND_TIMEOUT_MS = 8000;
const HEARTBEAT_INTERVAL_MS = 10000;
const RECONNECT_BASE_DELAY_MS = 800;
const RECONNECT_MAX_DELAY_MS = 5000;
const STATE_SYNC_DEBOUNCE_MS = 120;
const STATE_SYNC_JITTER_MS = 160;
const HOST_FORCED_STATE_BROADCAST_ACTIONS = new Set([
  'startGame',
  'dealCards',
  'changeGameMode',
  'returnToRoom'
]);
const URGENT_POLLING_ACTIONS = HOST_FORCED_STATE_BROADCAST_ACTIONS;

type SyncOptions = {
  preferSnapshot?: boolean;
};

type RealtimeSyncOptions = {
  syncOnEnable?: boolean;
};

export class WebSocketClient {
  private gameStateCallbacks = new Set<GameStateCallback>();
  private errorCallbacks = new Set<ErrorCallback>();
  private hostInfoCallbacks = new Set<HostInfoCallback>();
  private connectionStateCallbacks = new Set<ConnectionStateCallback>();
  private pendingCommands = new Map<string, PendingCommand>();

  private commandSeq = 0;
  private readonly clientInstanceId: string;
  private gameStateVersion = 0;
  private currentGameState: Record<string, any> | null = null;
  private connectionState: ConnectionState = 'idle';
  private socket: WebSocket | null = null;
  private connectPromise: Promise<void> | null = null;
  private lastUrl = '';
  private lastPlayerId = '';
  private autoReconnect = true;
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private stateSyncTimer: ReturnType<typeof setTimeout> | null = null;
  private stateSyncInFlight = false;
  private pendingStateSyncVersion = 0;
  private realtimeSyncEnabled = true;
  private manuallyClosed = false;

  constructor() {
    this.clientInstanceId = this.createClientInstanceId();
  }

  private createClientInstanceId(): string {
    try {
      const randomValues = new Uint32Array(2);
      crypto.getRandomValues(randomValues);
      return `${randomValues[0].toString(36)}${randomValues[1].toString(36)}`;
    } catch {
      return `${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
    }
  }

  private createCommandId(): string {
    this.commandSeq += 1;
    return `${this.clientInstanceId}:${Date.now()}:${this.commandSeq}`;
  }

  private setConnectionState(nextState: ConnectionState): void {
    if (this.connectionState === nextState) {
      return;
    }
    this.connectionState = nextState;
    this.connectionStateCallbacks.forEach((callback) => {
      try {
        callback(nextState);
      } catch (error) {
        console.error('Error in connection state callback:', error);
      }
    });
  }

  private resolveUrl(options?: ConnectOptions): string {
    if (options?.hostAddress || options?.hostPort) {
      saveHostConfig({
        hostAddress: options.hostAddress,
        hostPort: options.hostPort
      });
    }
    return options?.url || buildDefaultWebSocketUrl();
  }

  public setHostConfig(config: Partial<StoredHostConfig>): void {
    saveHostConfig(config);
    this.lastUrl = buildDefaultWebSocketUrl();
  }

  public getCurrentVersion(): number {
    return this.gameStateVersion;
  }

  public getConnectionState(): ConnectionState {
    return this.connectionState;
  }

  public setRealtimeSyncEnabled(enabled: boolean, options: RealtimeSyncOptions = {}): void {
    if (this.realtimeSyncEnabled === enabled) {
      if (enabled && options.syncOnEnable === false) {
        this.clearScheduledStateSync();
      }
      return;
    }

    this.realtimeSyncEnabled = enabled;
    if (!enabled) {
      this.clearStateSyncTimer();
    } else if (options.syncOnEnable === false) {
      this.clearScheduledStateSync();
    } else if (this.lastPlayerId && this.getIsConnected()) {
      this.scheduleStateSync(this.gameStateVersion + 1);
    }
  }

  public connect(options?: ConnectOptions): Promise<void> {
    if (this.socket?.readyState === WebSocket.OPEN) {
      return Promise.resolve();
    }

    if (this.connectPromise) {
      return this.connectPromise;
    }

    const targetUrl = this.resolveUrl(options);
    this.lastUrl = targetUrl;
    this.autoReconnect = options?.autoReconnect ?? true;
    this.manuallyClosed = false;
    this.setConnectionState(this.reconnectAttempts > 0 ? 'reconnecting' : 'connecting');

    this.connectPromise = new Promise((resolve, reject) => {
      const socket = new WebSocket(targetUrl);
      this.socket = socket;

      socket.onopen = () => {
        if (this.socket !== socket) {
          return;
        }
        this.reconnectAttempts = 0;
        this.connectPromise = null;
        this.setConnectionState('online');
        this.startHeartbeat();
        if (this.lastPlayerId) {
          this.scheduleStateSync(this.gameStateVersion + 1);
        }
        resolve();
      };

      socket.onmessage = (event) => {
        if (this.socket !== socket) {
          return;
        }
        this.handleMessage(event.data);
      };

      socket.onerror = (error) => {
        if (this.socket !== socket) {
          return;
        }
        const message = error instanceof Error ? error.message : 'WebSocket connection error';
        this.emitError(message);

        if (socket.readyState !== WebSocket.OPEN) {
          this.connectPromise = null;
          reject(new Error(message));
        }
      };

      socket.onclose = () => {
        if (this.socket !== socket) {
          return;
        }
        if (this.socket === socket) {
          this.socket = null;
        }
        this.connectPromise = null;
        this.stopHeartbeat();
        this.failAllPending('Connection closed');
        this.clearStateSyncTimer();

        if (this.manuallyClosed || !this.autoReconnect) {
          this.setConnectionState('offline');
          return;
        }

        this.scheduleReconnect();
      };
    });

    return this.connectPromise;
  }

  public reconnect(): Promise<void> {
    this.disconnect({ allowReconnect: false });
    this.reconnectAttempts = 0;
    return this.connect({ url: this.lastUrl || undefined, autoReconnect: this.autoReconnect });
  }

  public disconnect(options: { allowReconnect?: boolean } = {}): void {
    this.manuallyClosed = options.allowReconnect !== true;
    this.clearReconnectTimer();
    this.stopHeartbeat();

    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }

    this.connectPromise = null;
    this.failAllPending('Disconnected');
    this.clearStateSyncTimer();
    this.setConnectionState('offline');
  }

  public getIsConnected(): boolean {
    return this.socket?.readyState === WebSocket.OPEN;
  }

  public onGameState(callback: GameStateCallback): () => void {
    this.gameStateCallbacks.add(callback);
    return () => {
      this.gameStateCallbacks.delete(callback);
    };
  }

  public onError(callback: ErrorCallback): () => void {
    this.errorCallbacks.add(callback);
    return () => {
      this.errorCallbacks.delete(callback);
    };
  }

  public onHostInfo(callback: HostInfoCallback): () => void {
    this.hostInfoCallbacks.add(callback);
    return () => {
      this.hostInfoCallbacks.delete(callback);
    };
  }

  public onConnectionState(callback: ConnectionStateCallback): () => void {
    this.connectionStateCallbacks.add(callback);
    callback(this.connectionState);
    return () => {
      this.connectionStateCallbacks.delete(callback);
    };
  }

  public send(action: string, data?: Record<string, unknown>): Promise<ActionResult> {
    return this.sendCommand(action, data, true);
  }

  private async sendCommand(action: string, data?: Record<string, unknown>, retryStaleCommand = false): Promise<ActionResult> {
    if (!this.getIsConnected() || !this.socket) {
      return Promise.resolve({ result: false, replayedCommand: false, errorCode: 'OFFLINE', errorMessage: 'Socket is not connected' });
    }

    const playerId = typeof data?.playerId === 'string' ? data.playerId : this.lastPlayerId;
    if (!playerId) {
      return Promise.resolve({ result: false, replayedCommand: false, errorCode: 'INVALID_MESSAGE', errorMessage: 'Missing playerId' });
    }
    this.setActivePlayer(playerId);

    const commandId = this.createCommandId();
    const payload = { ...(data || {}) };
    delete (payload as Record<string, unknown>).playerId;

    const message: ClientMessage = {
      type: 'command',
      action,
      playerId,
      commandId,
      version: this.gameStateVersion,
      timestamp: Date.now(),
      payload
    };

    const result = await this.sendMessageWithAck(commandId, message, 'Command timeout');
    if (
      retryStaleCommand &&
      result.errorCode === 'STALE_VERSION' &&
      result.retryable !== false &&
      this.getIsConnected()
    ) {
      return this.sendCommand(action, data, false);
    }

    return result;
  }

  public sync(playerId: string, options: SyncOptions = {}): Promise<ActionResult> {
    if (!this.getIsConnected() || !this.socket) {
      return Promise.resolve({ result: false, replayedCommand: false, errorCode: 'OFFLINE', errorMessage: 'Socket is not connected' });
    }

    this.setActivePlayer(playerId);
    const commandId = this.createCommandId();
    const message: ClientMessage = {
      type: 'sync',
      playerId,
      commandId,
      version: this.gameStateVersion,
      timestamp: Date.now(),
      payload: {
        hasGameState: !options.preferSnapshot && Boolean(this.currentGameState)
      }
    };

    return this.sendMessageWithAck(commandId, message, 'Sync timeout');
  }

  private sendPing(): void {
    if (!this.getIsConnected() || !this.socket || !this.lastPlayerId) {
      return;
    }

    const message: ClientMessage = {
      type: 'ping',
      playerId: this.lastPlayerId,
      commandId: this.createCommandId(),
      version: this.gameStateVersion,
      timestamp: Date.now()
    };

    try {
      this.socket.send(JSON.stringify(message));
    } catch (error) {
      this.emitError(error instanceof Error ? error.message : String(error));
    }
  }

  private setActivePlayer(playerId: string): void {
    if (this.lastPlayerId && this.lastPlayerId !== playerId) {
      this.currentGameState = null;
      this.gameStateVersion = 0;
      this.clearStateSyncTimer();
    }
    this.lastPlayerId = playerId;
  }

  private sendMessageWithAck(commandId: string, message: ClientMessage, timeoutMessage: string): Promise<ActionResult> {
    return new Promise((resolve) => {
      const timeoutId = setTimeout(() => {
        this.pendingCommands.delete(commandId);
        resolve({
          result: false,
          replayedCommand: false,
          errorCode: 'TIMEOUT',
          errorMessage: timeoutMessage
        });
      }, DEFAULT_COMMAND_TIMEOUT_MS);

      this.pendingCommands.set(commandId, { resolve, timeoutId });

      try {
        this.socket?.send(JSON.stringify(message));
      } catch (error) {
        clearTimeout(timeoutId);
        this.pendingCommands.delete(commandId);
        resolve({
          result: false,
          replayedCommand: false,
          errorCode: 'SEND_FAILED',
          errorMessage: error instanceof Error ? error.message : String(error)
        });
      }
    });
  }

  private handleMessage(rawData: unknown): void {
    if (typeof rawData !== 'string') {
      return;
    }

    let data: ServerMessage;
    try {
      data = JSON.parse(rawData);
    } catch {
      this.emitError('Invalid server message JSON');
      return;
    }

    if (data.type === 'stateChanged') {
      if (!this.realtimeSyncEnabled) {
        return;
      }
      this.scheduleStateSync(data.version);
      return;
    }

    if (data.type === 'gameEvent') {
      if (!this.realtimeSyncEnabled) {
        const eventData = data.data as GameEventData | undefined;
        if (eventData?.action && URGENT_POLLING_ACTIONS.has(eventData.action) && this.lastPlayerId && this.getIsConnected()) {
          void this.sync(this.lastPlayerId, { preferSnapshot: true });
        }
        return;
      }
      this.applyGameEvent(data.data as GameEventData | undefined, data.version);
      return;
    }

    if (data.type === 'gameState') {
      if (typeof data.version === 'number') {
        this.gameStateVersion = Math.max(this.gameStateVersion, data.version);
      }
      if (data.data && typeof data.data === 'object') {
        this.currentGameState = data.data as Record<string, any>;
      }
      this.gameStateCallbacks.forEach((callback) => {
        try {
          callback(data.data, this.gameStateVersion);
        } catch (error) {
          console.error('Error in gameState callback:', error);
        }
      });
      return;
    }

    if (data.type === 'hostInfo') {
      this.hostInfoCallbacks.forEach((callback) => {
        try {
          callback(data.data);
        } catch (error) {
          console.error('Error in hostInfo callback:', error);
        }
      });
      return;
    }

    if (data.type === 'ack') {
      if (data.commandId) {
        const ackData = data.data as Record<string, unknown> | undefined;
        this.resolvePending(data.commandId, {
          result: true,
          replayedCommand: Boolean(ackData?.replayedCommand),
          data: ackData
        });
      }
      return;
    }

    if (data.type === 'error') {
      const code = data.error?.code || 'UNKNOWN_ERROR';
      const message = data.error?.message || 'Server error';
      const staleState = (data.data as Record<string, unknown> | undefined)?.gameState;
      const staleEvents = (data.data as Record<string, unknown> | undefined)?.events;

      if (staleState) {
        if (typeof data.version === 'number') {
          this.gameStateVersion = Math.max(this.gameStateVersion, data.version);
        }
        this.currentGameState = staleState as Record<string, any>;
        this.gameStateCallbacks.forEach((callback) => callback(this.currentGameState, this.gameStateVersion));
      } else if (Array.isArray(staleEvents)) {
        staleEvents.forEach((event) => {
          this.applyGameEvent(event as GameEventData | undefined);
        });
      }

      if (data.commandId) {
        this.resolvePending(data.commandId, {
          result: false,
          replayedCommand: false,
          errorCode: code,
          errorMessage: message,
          retryable: Boolean(data.error?.retryable),
          data: data.data
        });
        // Command errors are delivered to the caller through send()/sync().
        // Re-emitting them globally makes Next dev show expected game-rule
        // failures as a red console-error overlay.
        return;
      }

      this.emitError(`${code}: ${message}`);
    }
  }

  private applyGameEvent(event: GameEventData | undefined, messageVersion?: number): void {
    const eventVersion = typeof event?.version === 'number' ? event.version : messageVersion;
    if (typeof eventVersion !== 'number') {
      return;
    }

    if (eventVersion <= this.gameStateVersion) {
      return;
    }

    if (!this.currentGameState || !event?.patch) {
      this.scheduleStateSync(eventVersion);
      return;
    }

    if (typeof event.baseVersion === 'number' && this.gameStateVersion < event.baseVersion) {
      this.scheduleStateSync(eventVersion);
      return;
    }

    this.currentGameState = this.applyGamePatch(this.currentGameState, event.patch);
    this.gameStateVersion = eventVersion;

    this.gameStateCallbacks.forEach((callback) => {
      try {
        callback(this.currentGameState, this.gameStateVersion);
      } catch (error) {
        console.error('Error in gameEvent callback:', error);
      }
    });
  }

  private applyGamePatch(currentState: Record<string, any>, patch: GameEventPatch): Record<string, any> {
    const nextState: Record<string, any> = {
      ...currentState,
      ...(patch.set || {})
    };

    const currentPlayers = Array.isArray(currentState.players) ? currentState.players : [];
    const playersById = new Map<string, Record<string, unknown>>();

    currentPlayers.forEach((player) => {
      if (player && typeof player.id === 'string') {
        playersById.set(player.id, player);
      }
    });

    patch.removePlayerIds?.forEach((playerId) => {
      playersById.delete(playerId);
    });

    patch.players?.forEach((player) => {
      if (player && typeof player.id === 'string') {
        playersById.set(player.id, player);
      }
    });

    if (patch.players || patch.removePlayerIds || patch.playerOrder) {
      const orderedPlayers: Record<string, unknown>[] = [];
      const usedIds = new Set<string>();

      patch.playerOrder?.forEach((playerId) => {
        const player = playersById.get(playerId);
        if (player) {
          orderedPlayers.push(player);
          usedIds.add(playerId);
        }
      });

      currentPlayers.forEach((player) => {
        if (player && typeof player.id === 'string' && playersById.has(player.id) && !usedIds.has(player.id)) {
          orderedPlayers.push(playersById.get(player.id)!);
          usedIds.add(player.id);
        }
      });

      playersById.forEach((player, playerId) => {
        if (!usedIds.has(playerId)) {
          orderedPlayers.push(player);
        }
      });

      nextState.players = orderedPlayers;
    }

    return nextState;
  }

  private scheduleStateSync(version?: number): void {
    if (!this.realtimeSyncEnabled) {
      return;
    }

    if (!this.lastPlayerId || !this.getIsConnected()) {
      return;
    }

    const nextVersion = typeof version === 'number' ? version : this.gameStateVersion;
    this.pendingStateSyncVersion = Math.max(this.pendingStateSyncVersion, nextVersion);

    if (this.stateSyncTimer || this.stateSyncInFlight) {
      return;
    }

    const jitter = Math.floor(Math.random() * STATE_SYNC_JITTER_MS);
    this.stateSyncTimer = setTimeout(() => {
      this.stateSyncTimer = null;
      void this.flushStateSync();
    }, STATE_SYNC_DEBOUNCE_MS + jitter);
  }

  private async flushStateSync(): Promise<void> {
    if (this.stateSyncInFlight || !this.lastPlayerId || !this.getIsConnected()) {
      return;
    }

    if (this.pendingStateSyncVersion > 0 && this.pendingStateSyncVersion <= this.gameStateVersion) {
      this.pendingStateSyncVersion = 0;
      return;
    }

    const requestedVersion = this.pendingStateSyncVersion;
    this.pendingStateSyncVersion = 0;
    this.stateSyncInFlight = true;

    try {
      await this.sync(this.lastPlayerId);
    } finally {
      this.stateSyncInFlight = false;
      if (this.pendingStateSyncVersion > Math.max(requestedVersion, this.gameStateVersion)) {
        this.scheduleStateSync(this.pendingStateSyncVersion);
      }
    }
  }

  private resolvePending(commandId: string, result: ActionResult): void {
    const pending = this.pendingCommands.get(commandId);
    if (!pending) return;

    clearTimeout(pending.timeoutId);
    this.pendingCommands.delete(commandId);
    pending.resolve(result);
  }

  private failAllPending(message: string): void {
    this.pendingCommands.forEach((pending, commandId) => {
      clearTimeout(pending.timeoutId);
      pending.resolve({
        result: false,
        replayedCommand: false,
        errorCode: 'CONNECTION_CLOSED',
        errorMessage: message
      });
      this.pendingCommands.delete(commandId);
    });
  }

  private emitError(message: string): void {
    this.errorCallbacks.forEach((callback) => {
      try {
        callback(message);
      } catch (error) {
        console.error('Error in error callback:', error);
      }
    });
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => this.sendPing(), HEARTBEAT_INTERVAL_MS);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private clearStateSyncTimer(): void {
    if (this.stateSyncTimer) {
      clearTimeout(this.stateSyncTimer);
      this.stateSyncTimer = null;
    }
    this.pendingStateSyncVersion = 0;
    this.stateSyncInFlight = false;
  }

  private clearScheduledStateSync(): void {
    if (this.stateSyncTimer) {
      clearTimeout(this.stateSyncTimer);
      this.stateSyncTimer = null;
    }
    this.pendingStateSyncVersion = 0;
  }

  private scheduleReconnect(): void {
    this.clearReconnectTimer();
    this.reconnectAttempts += 1;
    this.setConnectionState('reconnecting');

    const delay = Math.min(
      RECONNECT_MAX_DELAY_MS,
      RECONNECT_BASE_DELAY_MS * Math.max(1, this.reconnectAttempts)
    );

    this.reconnectTimer = setTimeout(() => {
      this.connect({ url: this.lastUrl || undefined, autoReconnect: true }).catch((error) => {
        this.emitError(error instanceof Error ? error.message : String(error));
        this.scheduleReconnect();
      });
    }, delay);
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }
}

export const webSocketClient = new WebSocketClient();
