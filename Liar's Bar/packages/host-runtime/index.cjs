const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');
const express = require('express');
const WebSocket = require('ws');
const { LiarsBarGame, TexasShowdownGame, LANDiscovery, resetPlayerForRoom } = require('@liars-bar/shared');
const { createLiarsBarCommandHandlers } = require('./commands/liars-bar.cjs');
const { createRoomCommandHandlers } = require('./commands/room.cjs');
const { createSharedGameCommandHandlers } = require('./commands/shared-game.cjs');
const { createTexasHoldemCommandHandlers } = require('./commands/texas-holdem.cjs');

const DEFAULT_ROOM_ID = 'default';
const DEFAULT_HOST_PORT = 3000;
const DEFAULT_MAX_PLAYERS = 8;
const DEFAULT_MAX_PROCESSED_COMMANDS = 5000;
const INACTIVE_LOBBY_PLAYER_TIMEOUT_MS = 120000;
const DISCONNECTED_LOBBY_PLAYER_TIMEOUT_MS = 20000;
const DEFAULT_DISCONNECTED_AUTO_ACTION_DELAY_MS = 3000;
const AUTO_RESOLVE_PENALTY_DELAY_MS = 450;
const PLAYER_DATA_SCHEMA_VERSION = 'player-name-id-v1';
const MAX_GAME_EVENT_LOG = 256;
const BROADCAST_FLUSH_MS = 16;
const HOST_FORCED_STATE_BROADCAST_ACTIONS = new Set([
  'startGame',
  'dealCards',
  'changeGameMode',
  'returnToRoom'
]);
const IMMEDIATE_BROADCAST_ACTIONS = new Set([
  ...HOST_FORCED_STATE_BROADCAST_ACTIONS,
  'addBullets',
  'playCards',
  'trust',
  'challenge',
  'refuseBullets',
  'fireGun',
  'restartRound',
  'discardTexasCard',
  'exitTexasRound'
]);

function now() {
  return Date.now();
}

function isPrivateLanAddress(address) {
  if (address.startsWith('10.') || address.startsWith('192.168.')) return true;
  const match = /^172\.(\d+)\./.exec(address);
  if (!match) return false;
  const secondOctet = Number(match[1]);
  return secondOctet >= 16 && secondOctet <= 31;
}

function getLanIp() {
  const candidates = [];
  for (const entries of Object.values(os.networkInterfaces())) {
    for (const entry of entries || []) {
      if (entry.family !== 'IPv4' || entry.internal || entry.address.startsWith('169.254.')) {
        continue;
      }
      candidates.push(entry.address);
    }
  }
  return candidates.find(isPrivateLanAddress) || candidates[0] || '127.0.0.1';
}

function withQuery(url, values) {
  const nextUrl = new URL(url);
  Object.entries(values).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      nextUrl.searchParams.set(key, String(value));
    }
  });
  return nextUrl.toString();
}

function normalizePort(value) {
  const port = Number(value || process.env.HOST_PORT || DEFAULT_HOST_PORT);
  return Number.isFinite(port) && port > 0 ? port : DEFAULT_HOST_PORT;
}

function normalizePlayerNameAsId(name) {
  return typeof name === 'string' ? name.trim() : '';
}

function normalizeIncomingPlayerIdentity(data) {
  if (data?.type !== 'command' || data.action !== 'joinGame') {
    return data;
  }

  const playerName = normalizePlayerNameAsId(data.payload?.playerName);
  if (!playerName) {
    return data;
  }

  data.playerId = playerName;
  data.payload = {
    ...(data.payload || {}),
    playerName
  };
  return data;
}

function createHostRuntime(options = {}) {
  const roomId = options.roomId || DEFAULT_ROOM_ID;
  const platform = options.platform || 'unknown';
  const hostName = options.hostName || "Liar's Bar Host";
  const listenHost = options.listenHost || '0.0.0.0';
  const maxPlayers = Number(options.maxPlayers || DEFAULT_MAX_PLAYERS);
  const maxProcessedCommands = Number(options.maxProcessedCommands || DEFAULT_MAX_PROCESSED_COMMANDS);
  const disconnectedAutoActionDelayMs = Number(
    options.disconnectedAutoActionDelayMs || DEFAULT_DISCONNECTED_AUTO_ACTION_DELAY_MS
  );
  const initialPort = normalizePort(options.port);
  const fallbackPorts = Array.isArray(options.fallbackPorts)
    ? options.fallbackPorts.map(normalizePort).filter((candidate) => candidate !== initialPort)
    : initialPort === DEFAULT_HOST_PORT
      ? [3001]
      : [];
  let port = initialPort;
  const startedAt = now();
  const lanIp = options.lanIp || getLanIp();
  const disableStaticWeb = Boolean(options.disableStaticWeb);
  const webRoot = disableStaticWeb ? null : options.webRoot || path.join(process.cwd(), 'build');
  const webEntry = webRoot ? path.join(webRoot, 'index.html') : null;
  const devInstructions =
    options.devInstructions ||
    'Static web hosting is disabled in development mode. Start the frontend dev server separately.';
  const scoreboardPath =
    options.scoreboardPath === false
      ? null
      : options.scoreboardPath || path.join(os.homedir(), '.liars-bar', 'scoreboard.json');
  const scoreboardSchemaPath = scoreboardPath ? `${scoreboardPath}.schema` : null;

  let game = new LiarsBarGame();
  ensurePlayerDataSchema();
  hydrateGameScoreboard(game);
  const playerJoinTimes = new Map();
  const disconnectedAutoActionTimers = new Map();
  const autoResolvePenaltyTimers = new Set();
  const processedCommands = new Map();
  const gameEventLog = [];
  const expressApp = express();
  const socketPlayers = new Map();
  const pendingBroadcastEvents = [];

  let closed = false;
  let closingPromise = null;
  let gameVersion = 0;
  let pendingBroadcastHostInfo = false;
  let broadcastFlushTimer = null;
  let server = http.createServer(expressApp);
  let wss = null;
  let readyResolve = null;
  let readyReject = null;
  const ready = new Promise((resolve, reject) => {
    readyResolve = resolve;
    readyReject = reject;
  });

  function getGameState() {
    return game.getGameState();
  }

  function createGameForMode(gameMode) {
    return gameMode === 'texasHoldem' ? new TexasShowdownGame() : new LiarsBarGame();
  }

  function readPersistedScoreboard() {
    if (!scoreboardPath) return [];
    try {
      const raw = fs.readFileSync(scoreboardPath, 'utf8');
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed
        .filter(entry => entry && typeof entry.playerId === 'string' && typeof entry.name === 'string')
        .map(entry => ({
          playerId: entry.playerId,
          name: entry.name,
          score: Number(entry.score) || 0,
          isActive: false,
          lastSeen: Number(entry.lastSeen) || undefined
        }));
    } catch {
      return [];
    }
  }

  function ensurePlayerDataSchema() {
    if (!scoreboardPath || !scoreboardSchemaPath) return;
    try {
      const schema = fs.existsSync(scoreboardSchemaPath)
        ? fs.readFileSync(scoreboardSchemaPath, 'utf8').trim()
        : '';
      if (schema === PLAYER_DATA_SCHEMA_VERSION) return;

      fs.mkdirSync(path.dirname(scoreboardPath), { recursive: true });
      fs.rmSync(scoreboardPath, { force: true });
      fs.writeFileSync(scoreboardSchemaPath, PLAYER_DATA_SCHEMA_VERSION);
    } catch (error) {
      console.warn('Unable to reset legacy player data:', error);
    }
  }

  function hydrateGameScoreboard(targetGame) {
    if (typeof targetGame.hydrateScoreboard === 'function') {
      targetGame.hydrateScoreboard(readPersistedScoreboard());
    }
  }

  function persistScoreboard() {
    if (!scoreboardPath || typeof game.getScoreboard !== 'function') return;
    try {
      fs.mkdirSync(path.dirname(scoreboardPath), { recursive: true });
      fs.writeFileSync(scoreboardPath, JSON.stringify(game.getScoreboard(), null, 2));
    } catch (error) {
      console.warn('Unable to persist scoreboard:', error);
    }
  }

  function clonePlayerForLobby(player) {
    return resetPlayerForRoom({ ...player });
  }

  function switchGameMode(gameMode) {
    const previousPlayers = getGameState().players.map(clonePlayerForLobby);
    const previousScoreboard = typeof game.getScoreboard === 'function' ? game.getScoreboard() : [];
    const nextGame = createGameForMode(gameMode);
    if (typeof nextGame.hydrateScoreboard === 'function') {
      nextGame.hydrateScoreboard(previousScoreboard);
    }
    previousPlayers.forEach((player) => nextGame.addPlayer(player));
    game = nextGame;
  }

  function buildHostInfo() {
    const state = getGameState();
    const currentLanIp = options.lanIp || getLanIp() || lanIp;
    const localUrl = `http://127.0.0.1:${port}/`;
    const packagedJoinBase = `http://${currentLanIp}:${port}/login`;
    const joinBase = options.devJoinUrl || packagedJoinBase;
    const joinUrl = withQuery(joinBase, {
      hostAddress: currentLanIp,
      hostPort: port
    });
    const wsUrl = `ws://${currentLanIp}:${port}`;

    return {
      platform,
      ip: currentLanIp,
      lanIp: currentLanIp,
      port,
      name: hostName,
      hostName,
      localUrl,
      joinUrl,
      wsUrl,
      qrText: joinUrl,
      gameMode: state.gameMode,
      playerCount: state.players.length,
      maxPlayers,
      startedAt
    };
  }

  function emitStatus(status) {
    if (typeof options.onStatus === 'function') {
      options.onStatus(status);
    }
  }

  function emitHostInfo() {
    const hostInfo = buildHostInfo();
    if (typeof options.onHostInfo === 'function') {
      options.onHostInfo(hostInfo);
    }
    return hostInfo;
  }

  function createMessage(type, extras = {}) {
    return {
      type,
      roomId,
      version: gameVersion,
      timestamp: now(),
      ...extras
    };
  }

  function send(ws, message) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  function broadcast(message) {
    wss.clients.forEach((client) => send(client, message));
  }

  function createHiddenCards(playerId, cards) {
    return (cards || []).map((_, index) => ({
      id: `hidden-${playerId}-${index}`,
      rank: 'Joker'
    }));
  }

  function getMainCardRank(state) {
    return typeof state.mainCard === 'string' ? state.mainCard : state.mainCard?.rank || 'Q';
  }

  function maskPlayRecord(state, record) {
    if (!record) {
      return record;
    }

    if (record.isChallenged) {
      return record;
    }

    const count = Number(record.declaredCount) || record.cards?.length || 0;
    return {
      ...record,
      cards: Array.from({ length: count }, (_, index) => ({
        id: `declared-${record.playerId}-${index}`,
        rank: getMainCardRank(state)
      }))
    };
  }

  function cloneJson(value) {
    return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
  }

  function jsonEquals(left, right) {
    return JSON.stringify(left ?? null) === JSON.stringify(right ?? null);
  }

  function createClientGameStateFromState(state, viewerPlayerId) {
    return {
      ...state,
      players: state.players.map((player) => ({
        ...player,
        cards: player.id === viewerPlayerId ? player.cards : createHiddenCards(player.id, player.cards)
      })),
      currentPlay: maskPlayRecord(state, state.currentPlay),
      playHistory: state.playHistory.map((record) => maskPlayRecord(state, record))
    };
  }

  function createClientGameState(viewerPlayerId) {
    return createClientGameStateFromState(getGameState(), viewerPlayerId);
  }

  function createGamePatch(beforeState, afterState) {
    const patch = {};
    const set = {};
    const keys = new Set([...Object.keys(beforeState || {}), ...Object.keys(afterState || {})]);
    keys.delete('players');

    keys.forEach((key) => {
      if (!jsonEquals(beforeState?.[key], afterState?.[key])) {
        set[key] = afterState?.[key] ?? null;
      }
    });

    if (Object.keys(set).length > 0) {
      patch.set = set;
    }

    const beforePlayers = Array.isArray(beforeState?.players) ? beforeState.players : [];
    const afterPlayers = Array.isArray(afterState?.players) ? afterState.players : [];
    const beforeById = new Map(beforePlayers.map((player) => [player.id, player]));
    const afterById = new Map(afterPlayers.map((player) => [player.id, player]));
    const changedPlayers = [];
    const removedPlayerIds = [];

    afterById.forEach((player, playerId) => {
      if (!jsonEquals(beforeById.get(playerId), player)) {
        changedPlayers.push(player);
      }
    });

    beforeById.forEach((_, playerId) => {
      if (!afterById.has(playerId)) {
        removedPlayerIds.push(playerId);
      }
    });

    const beforeOrder = beforePlayers.map((player) => player.id);
    const afterOrder = afterPlayers.map((player) => player.id);

    if (changedPlayers.length > 0) {
      patch.players = changedPlayers;
    }
    if (removedPlayerIds.length > 0) {
      patch.removePlayerIds = removedPlayerIds;
    }
    if (!jsonEquals(beforeOrder, afterOrder)) {
      patch.playerOrder = afterOrder;
    }

    return patch;
  }

  function rememberGameEvent(baseVersion, action, actorPlayerId, beforeState, afterState) {
    const entry = {
      eventId: `${roomId}:${gameVersion}`,
      baseVersion,
      version: gameVersion,
      action,
      actorPlayerId,
      beforeState: cloneJson(beforeState),
      afterState: cloneJson(afterState)
    };

    gameEventLog.push(entry);
    if (gameEventLog.length > MAX_GAME_EVENT_LOG) {
      gameEventLog.splice(0, gameEventLog.length - MAX_GAME_EVENT_LOG);
    }
    return entry;
  }

  function createGameEventPayload(entry, viewerPlayerId) {
    const beforeState = createClientGameStateFromState(entry.beforeState, viewerPlayerId);
    const afterState = createClientGameStateFromState(entry.afterState, viewerPlayerId);

    return {
      eventId: entry.eventId,
      action: entry.action,
      actorPlayerId: entry.actorPlayerId,
      baseVersion: entry.baseVersion,
      version: entry.version,
      patch: createGamePatch(beforeState, afterState)
    };
  }

  function sendGameState(ws) {
    const viewerPlayerId = socketPlayers.get(ws) || null;
    send(ws, createMessage('gameState', { data: createClientGameState(viewerPlayerId) }));
  }

  function sendGameEvent(ws, entry) {
    const viewerPlayerId = socketPlayers.get(ws) || null;
    send(ws, createMessage('gameEvent', {
      version: entry.version,
      data: createGameEventPayload(entry, viewerPlayerId)
    }));
  }

  function broadcastGameEventNow(entry) {
    wss.clients.forEach((client) => {
      sendGameEvent(client, entry);
    });
  }

  function flushBroadcastQueue() {
    if (broadcastFlushTimer) {
      clearTimeout(broadcastFlushTimer);
      broadcastFlushTimer = null;
    }

    const events = pendingBroadcastEvents.splice(0);
    const includeHostInfo = pendingBroadcastHostInfo;
    pendingBroadcastHostInfo = false;

    events.forEach((entry) => broadcastGameEventNow(entry));
    if (includeHostInfo) {
      broadcastHostInfoNow();
    }
  }

  function scheduleBroadcastFlush() {
    if (broadcastFlushTimer || closed) {
      return;
    }

    broadcastFlushTimer = setTimeout(flushBroadcastQueue, BROADCAST_FLUSH_MS);
  }

  function broadcastGameEvent(entry, includeHostInfo = false) {
    pendingBroadcastEvents.push(entry);
    pendingBroadcastHostInfo = pendingBroadcastHostInfo || includeHostInfo;
    scheduleBroadcastFlush();
  }

  function broadcastGameEventImmediately(entry, includeHostInfo = false) {
    flushBroadcastQueue();
    broadcastGameEventNow(entry);
    if (includeHostInfo) {
      broadcastHostInfoNow();
    }
  }

  function createReplayEventsSince(version, viewerPlayerId) {
    if (version >= gameVersion) {
      return { ok: true, events: [] };
    }

    const firstEvent = gameEventLog[0];
    if (!firstEvent || version < firstEvent.baseVersion) {
      return { ok: false, events: [] };
    }

    return {
      ok: true,
      events: gameEventLog
        .filter((entry) => entry.version > version)
        .map((entry) => createGameEventPayload(entry, viewerPlayerId))
    };
  }

  function sendReplayEventsOrSnapshot(ws, playerId, version, hasGameState) {
    if (hasGameState) {
      const replay = createReplayEventsSince(version, playerId);
      if (replay.ok) {
        replay.events.forEach((event) => {
          send(ws, createMessage('gameEvent', { version: event.version, data: event }));
        });
        return;
      }
    }

    sendGameState(ws);
  }

  function broadcastHostInfoNow() {
    broadcast(createMessage('hostInfo', { data: emitHostInfo() }));
  }

  function broadcastHostInfo() {
    pendingBroadcastHostInfo = true;
    scheduleBroadcastFlush();
  }

  function shouldBroadcastHostInfo(action) {
    return action === 'joinGame' ||
      action === 'leaveGame' ||
      action === 'changeGameMode' ||
      action === 'returnToRoom';
  }

  function shouldBroadcastImmediately(action) {
    return IMMEDIATE_BROADCAST_ACTIONS.has(action);
  }

  function scheduleAutoResolvePenalty(actorPlayerId) {
    const state = getGameState();
    if (!state.penaltyResult) {
      return;
    }

    const timer = setTimeout(() => {
      autoResolvePenaltyTimers.delete(timer);
      if (closed) {
        return;
      }

      const beforeState = cloneJson(getGameState());
      if (!beforeState?.penaltyResult) {
        return;
      }

      game.resolvePenalty();
      const afterState = getGameState();
      if (jsonEquals(beforeState, afterState)) {
        return;
      }

      const baseVersion = gameVersion;
      gameVersion += 1;
      persistScoreboard();
      const event = rememberGameEvent(baseVersion, 'autoResolvePenalty', actorPlayerId, beforeState, afterState);
      broadcastGameEventImmediately(event, false);
      scheduleDisconnectedActorAutoActions();
    }, AUTO_RESOLVE_PENALTY_DELAY_MS);

    autoResolvePenaltyTimers.add(timer);
  }

  function sendAck(ws, commandId, data = {}) {
    const message = createMessage('ack', { commandId, data });
    send(ws, message);
    return message;
  }

  function sendError(ws, commandId, code, message, retryable = false, data = undefined) {
    const payload = createMessage('error', {
      commandId,
      error: { code, message, retryable }
    });
    if (data !== undefined) {
      payload.data = data;
    }
    send(ws, payload);
    return payload;
  }

  function rememberProcessedCommand(key, response) {
    processedCommands.set(key, response);
    if (processedCommands.size > maxProcessedCommands) {
      const oldestKey = processedCommands.keys().next().value;
      if (oldestKey) processedCommands.delete(oldestKey);
    }
  }

  function parseIncoming(rawMessage) {
    let data;
    try {
      data = JSON.parse(rawMessage.toString());
    } catch {
      return { ok: false, error: { code: 'INVALID_MESSAGE', message: 'Message must be valid JSON', retryable: false } };
    }

    if (!data || typeof data !== 'object') {
      return { ok: false, error: { code: 'INVALID_MESSAGE', message: 'Message must be an object', retryable: false } };
    }
    const commandId = typeof data.commandId === 'string' ? data.commandId : undefined;
    if (typeof data.type !== 'string') {
      return { ok: false, commandId, error: { code: 'INVALID_MESSAGE', message: 'Missing message type', retryable: false } };
    }
    if (data.roomId !== undefined && data.roomId !== roomId) {
      return { ok: false, commandId, error: { code: 'INVALID_ROOM', message: 'Host only supports the default room', retryable: false } };
    }
    data = normalizeIncomingPlayerIdentity(data);
    if (typeof data.playerId !== 'string' || data.playerId.trim() === '') {
      return { ok: false, commandId, error: { code: 'INVALID_MESSAGE', message: 'Missing playerId', retryable: false } };
    }
    if (typeof data.commandId !== 'string' || data.commandId.trim() === '') {
      return { ok: false, error: { code: 'INVALID_MESSAGE', message: 'Missing commandId', retryable: false } };
    }
    if (typeof data.version !== 'number' || !Number.isFinite(data.version) || data.version < 0) {
      return { ok: false, commandId, error: { code: 'INVALID_MESSAGE', message: 'Invalid version', retryable: false } };
    }
    if (typeof data.timestamp !== 'number' || !Number.isFinite(data.timestamp) || data.timestamp <= 0) {
      return { ok: false, commandId, error: { code: 'INVALID_MESSAGE', message: 'Invalid timestamp', retryable: false } };
    }
    if (data.type === 'command' && (typeof data.action !== 'string' || data.action.trim() === '')) {
      return { ok: false, commandId, error: { code: 'INVALID_MESSAGE', message: 'Missing action for command message', retryable: false } };
    }
    if (data.payload !== undefined && (typeof data.payload !== 'object' || data.payload === null || Array.isArray(data.payload))) {
      return { ok: false, commandId, error: { code: 'INVALID_MESSAGE', message: 'Payload must be an object', retryable: false } };
    }

    return { ok: true, data };
  }

  function touchPlayer(playerId, connectionStatus = 'connected') {
    const player = game.getPlayer(playerId);
    if (!player) return null;
    player.connectionStatus = connectionStatus;
    player.lastSeen = now();
    if (connectionStatus === 'connected') {
      clearDisconnectedAutoAction(playerId);
      player.isActive = !player.isEliminated;
    } else {
      scheduleDisconnectedAutoAction(playerId);
    }
    return player;
  }

  function clearDisconnectedAutoAction(playerId) {
    const timer = disconnectedAutoActionTimers.get(playerId);
    if (!timer) {
      return;
    }

    clearTimeout(timer);
    disconnectedAutoActionTimers.delete(playerId);
  }

  function getMinimumBulletAdd(state) {
    return Math.max(1, Number(state.lastAddedBullets || 0));
  }

  function hasAnotherSocketForPlayer(currentSocket, playerId) {
    for (const [socket, nextPlayerId] of socketPlayers.entries()) {
      if (socket !== currentSocket && nextPlayerId === playerId && socket.readyState === WebSocket.OPEN) {
        return true;
      }
    }
    return false;
  }

  function scheduleDisconnectedAutoAction(playerId) {
    if (disconnectedAutoActionTimers.has(playerId)) {
      return;
    }

    const timer = setTimeout(() => {
      disconnectedAutoActionTimers.delete(playerId);
      const beforeState = cloneJson(getGameState());
      const changed = autoOperateDisconnectedPlayer(playerId);
      if (changed) {
        const baseVersion = gameVersion;
        gameVersion += 1;
        const event = rememberGameEvent(
          baseVersion,
          'autoOperateDisconnectedPlayer',
          playerId,
          beforeState,
          getGameState()
        );
        broadcastGameEvent(event);
        scheduleDisconnectedActorAutoActions();
      }
    }, disconnectedAutoActionDelayMs);

    disconnectedAutoActionTimers.set(playerId, timer);
  }

  function scheduleDisconnectedActorAutoActions() {
    const state = getGameState();
    if (state.gameStatus !== 'playing') {
      return;
    }

    const actorId = state.pendingPenaltyPlayerId || state.turnActorPlayerId;
    if (!actorId) {
      return;
    }

    const actor = game.getPlayer(actorId);
    if (actor?.connectionStatus === 'disconnected') {
      scheduleDisconnectedAutoAction(actorId);
    }
  }

  function autoOperateDisconnectedPlayer(playerId) {
    const state = getGameState();
    const player = game.getPlayer(playerId);
    if (!player || player.connectionStatus !== 'disconnected' || state.gameStatus !== 'playing') {
      return false;
    }

    if (state.pendingPenaltyPlayerId === playerId && !state.penaltyResult) {
      const fired = game.fireGun(playerId);
      if (!fired) {
        return false;
      }
      game.resolvePenalty();
      return true;
    }

    if (state.turnActorPlayerId !== playerId) {
      return false;
    }

    return getAutoActionStrategy(state.gameMode).takeTurn(playerId);
  }

  function autoAddMinimumBulletsOrRefuse(playerId) {
    const state = getGameState();
    const player = game.getPlayer(playerId);
    if (!player || player.hasAddedBullets) {
      return true;
    }

    const count = getMinimumBulletAdd(state);
    return game.addBullets(playerId, count);
  }

  function hasStateChanged(before) {
    return JSON.stringify(getGameState()) !== before;
  }

  function getAutoActionStrategy(gameMode) {
    return gameMode === 'texasHoldem' ? texasHoldemAutoActionStrategy : liarsBarAutoActionStrategy;
  }

  const liarsBarAutoActionStrategy = {
    takeTurn(playerId) {
      const state = getGameState();
      return state.currentPlay ? autoRespondToLiarsBarPlay(playerId) : autoTakeLiarsBarTurn(playerId);
    }
  };

  const texasHoldemAutoActionStrategy = {
    takeTurn(playerId) {
      return autoTakeTexasHoldemTurn(playerId);
    }
  };

  function autoRespondToLiarsBarPlay(playerId) {
    const before = JSON.stringify(getGameState());
    const player = game.getPlayer(playerId);
    if (!player) {
      return false;
    }

    if (!player.hasAddedBullets) {
      const prepared = autoAddMinimumBulletsOrRefuse(playerId);
      if (!prepared) {
        return false;
      }

      if (getGameState().pendingPenaltyPlayerId === playerId) {
        return hasStateChanged(before);
      }
    }

    if (game.trust(playerId)) {
      return true;
    }

    return hasStateChanged(before);
  }

  function autoTakeLiarsBarTurn(playerId) {
    const before = JSON.stringify(getGameState());
    const player = game.getPlayer(playerId);
    if (!player) {
      return false;
    }

    if (!player.hasAddedBullets) {
      const prepared = autoAddMinimumBulletsOrRefuse(playerId);
      if (!prepared) {
        return false;
      }

      if (getGameState().pendingPenaltyPlayerId === playerId) {
        return hasStateChanged(before);
      }
    }

    const nextCard = game.getPlayer(playerId)?.cards?.[0];
    if (nextCard && game.playCards(playerId, [nextCard.id], 1)) {
      return true;
    }

    return hasStateChanged(before);
  }

  function autoTakeTexasHoldemTurn(playerId) {
    const before = JSON.stringify(getGameState());
    const state = getGameState();
    const player = game.getPlayer(playerId);
    if (!player) {
      return false;
    }

    if (state.pendingTexasDiscardPlayerId === playerId && Array.isArray(player.cards) && player.cards.length > 2) {
      const discardCard = player.cards?.[0];
      return discardCard ? game.discardTexasCard(playerId, discardCard.id) : false;
    }

    if (!player.hasAddedBullets) {
      const prepared = autoAddMinimumBulletsOrRefuse(playerId);
      return prepared || hasStateChanged(before);
    }

    return hasStateChanged(before);
  }

  function ensurePlayerExists(playerId) {
    const player = game.getPlayer(playerId);
    if (!player) {
      return { ok: false, error: { code: 'PLAYER_NOT_FOUND', message: 'Player not found', retryable: false } };
    }
    touchPlayer(playerId);
    return { ok: true, player };
  }

  function maybeRejectStaleCommand(command) {
    const nonStrictActions = new Set(['joinGame', 'getGameState']);
    if (nonStrictActions.has(command.action)) return null;

    if (command.version < gameVersion) {
      const replay = createReplayEventsSince(command.version, command.playerId);
      return {
        code: 'STALE_VERSION',
        message: `Stale version: client=${command.version}, server=${gameVersion}`,
        retryable: true,
        data: replay.ok
          ? { events: replay.events }
          : { gameState: createClientGameState(command.playerId) }
      };
    }

    return null;
  }

  function ensureHostAction(playerId, command) {
    const lookup = ensurePlayerExists(playerId);
    if (!lookup.ok) return lookup;
    if (!lookup.player.isHost) {
      return { ok: false, error: { code: 'UNAUTHORIZED_ACTION', message: 'Only the host can perform this action', retryable: false } };
    }
    return lookup;
  }

  function removePlayerAndPromoteHost(playerId) {
    const wasHost = Boolean(game.getPlayer(playerId)?.isHost);
    game.removePlayer(playerId);
    playerJoinTimes.delete(playerId);
    clearDisconnectedAutoAction(playerId);
    if (wasHost && !getGameState().players.some((player) => player.isHost)) {
      const nextHost = getGameState().players.find((player) => player.connectionStatus !== 'disconnected') ||
        getGameState().players[0];
      if (nextHost) {
        const promotedPlayer = game.getPlayer(nextHost.id);
        if (promotedPlayer) {
          promotedPlayer.isHost = true;
          playerJoinTimes.delete(promotedPlayer.id);
        }
      }
    }
  }

  function canStartGame(playerId, command) {
    const hostLookup = ensureHostAction(playerId, command);
    if (!hostLookup.ok) return hostLookup;
    const players = getGameState().players;
    if (getGameState().gameStatus !== 'waiting') {
      return { ok: false, error: { code: 'INVALID_ACTION_STATE', message: 'Game can only start from the room', retryable: false } };
    }
    if (players.length < 2) {
      return { ok: false, error: { code: 'INVALID_ACTION_STATE', message: 'At least 2 players are required', retryable: false } };
    }
    if (!players.filter((player) => !player.isHost).every((player) => player.isReady)) {
      return { ok: false, error: { code: 'INVALID_ACTION_STATE', message: 'All guest players must be ready', retryable: false } };
    }
    return { ok: true };
  }

  const getGame = () => game;

  const roomCommandHandlers = createRoomCommandHandlers({
    createClientGameState,
    ensureHostAction,
    ensurePlayerExists,
    getGame,
    getGameState,
    maxPlayers,
    now,
    playerJoinTimes,
    removePlayerAndPromoteHost,
    switchGameMode,
    touchPlayer
  });

  const sharedGameCommandHandlers = createSharedGameCommandHandlers({
    canStartGame,
    ensureHostAction,
    getGame
  });

  const texasHoldemCommandHandlers = createTexasHoldemCommandHandlers({ getGame });
  const liarsBarCommandHandlers = createLiarsBarCommandHandlers({ getGame });

  function getModeCommandHandlers(gameMode) {
    return gameMode === 'texasHoldem' ? texasHoldemCommandHandlers : liarsBarCommandHandlers;
  }

  function getKnownCommandHandler(action) {
    return (
      roomCommandHandlers[action] ||
      sharedGameCommandHandlers[action] ||
      texasHoldemCommandHandlers[action] ||
      liarsBarCommandHandlers[action] ||
      null
    );
  }

  function applyCommand(command) {
    const action = command.action;
    const context = {
      action,
      command,
      payload: command.payload || {},
      playerId: command.playerId
    };
    const handler =
      roomCommandHandlers[action] ||
      sharedGameCommandHandlers[action] ||
      getModeCommandHandlers(getGameState().gameMode)[action];

    if (!handler) {
      if (getKnownCommandHandler(action)) {
        return { ok: false, error: { code: 'INVALID_ACTION_STATE', message: `Cannot use ${action} in current game mode`, retryable: false } };
      }
      return { ok: false, error: { code: 'INVALID_ACTION_STATE', message: `Unknown action: ${action}`, retryable: false } };
    }

    return handler(context);
  }

  function getLobbyInactiveSince(player) {
    if (player.connectionStatus === 'disconnected') return player.lastSeen || null;
    if (player.isHost) return null;
    if (!player.isReady) return playerJoinTimes.get(player.id) || player.lastSeen || null;
    return null;
  }

  function cleanupInactiveLobbyPlayers() {
    const currentTime = now();
    const beforeState = cloneJson(getGameState());
    const gameState = getGameState();
    if (gameState.gameStatus !== 'waiting') {
      return;
    }

    const inactivePlayers = gameState.players.filter((player) => {
      const inactiveSince = getLobbyInactiveSince(player);
      const inactiveTimeout = player.connectionStatus === 'disconnected'
        ? DISCONNECTED_LOBBY_PLAYER_TIMEOUT_MS
        : INACTIVE_LOBBY_PLAYER_TIMEOUT_MS;
      return inactiveSince && currentTime - inactiveSince > inactiveTimeout;
    });
    let removedAny = false;

    inactivePlayers.forEach((player) => {
      removePlayerAndPromoteHost(player.id);
      removedAny = true;
    });

    if (removedAny) {
      const baseVersion = gameVersion;
      gameVersion += 1;
      const event = rememberGameEvent(baseVersion, 'cleanupInactivePlayers', '', beforeState, getGameState());
      broadcastGameEvent(event);
      broadcastHostInfo();
      scheduleDisconnectedActorAutoActions();
    }
  }

  expressApp.get('/host-info', (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.json(emitHostInfo());
  });

  if (webRoot) {
    expressApp.use(express.static(webRoot, { extensions: ['html'] }));
  }

  expressApp.use((req, res) => {
    if (webEntry && fs.existsSync(webEntry)) {
      res.sendFile(webEntry);
      return;
    }

    if (disableStaticWeb) {
      res.status(503).type('text/plain').send(devInstructions);
      return;
    }

    res.status(503).type('text/plain').send(
      'Web bundle not found. Run "pnpm build:hosts" in repository root before starting host.'
    );
  });

  server.on('error', (error) => {
    if (!closed && error?.code === 'EADDRINUSE' && fallbackPorts.length > 0) {
      port = fallbackPorts.shift();
      server.listen(port, listenHost);
      return;
    }

    emitStatus('Error');
    readyReject?.(error);
  });

  server.listen(port, listenHost, () => {
    emitStatus('Running');
    const hostInfo = emitHostInfo();
    try {
      LANDiscovery.broadcastPresence(port, hostName);
    } catch (error) {
      console.warn('LAN UDP broadcast unavailable:', error.message);
    }
    readyResolve?.(hostInfo);
  });

  wss = new WebSocket.Server({ noServer: true });
  server.on('upgrade', (request, socket, head) => {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  });
  const cleanupTimer = setInterval(cleanupInactiveLobbyPlayers, 5000);

  wss.on('connection', (ws) => {
    send(ws, createMessage('hostInfo', { data: emitHostInfo() }));

    ws.on('message', (message) => {
      const parsed = parseIncoming(message);
      if (!parsed.ok) {
        sendError(ws, parsed.commandId, parsed.error.code, parsed.error.message, parsed.error.retryable);
        return;
      }

      const incoming = parsed.data;
      const dedupeKey = `${incoming.playerId}:${incoming.commandId}`;
      socketPlayers.set(ws, incoming.playerId);
      touchPlayer(incoming.playerId);

      if (processedCommands.has(dedupeKey)) {
        send(ws, processedCommands.get(dedupeKey));
        if (incoming.type !== 'ping') {
          sendReplayEventsOrSnapshot(
            ws,
            incoming.playerId,
            incoming.version,
            incoming.type === 'command' || incoming.payload?.hasGameState === true
          );
        }
        return;
      }

      if (incoming.type === 'ping') {
        const response = createMessage('pong', { commandId: incoming.commandId });
        send(ws, response);
        rememberProcessedCommand(dedupeKey, response);
        return;
      }

      if (incoming.type === 'sync') {
        const response = sendAck(ws, incoming.commandId, { synced: true });
        rememberProcessedCommand(dedupeKey, response);
        send(ws, createMessage('hostInfo', { data: emitHostInfo() }));
        sendReplayEventsOrSnapshot(
          ws,
          incoming.playerId,
          incoming.version,
          incoming.payload?.hasGameState === true
        );
        return;
      }

      if (incoming.type !== 'command') {
        const response = sendError(ws, incoming.commandId, 'INVALID_MESSAGE', 'Unsupported message type', false);
        rememberProcessedCommand(dedupeKey, response);
        return;
      }

      const stale = maybeRejectStaleCommand(incoming);
      if (stale) {
        const response = sendError(ws, incoming.commandId, stale.code, stale.message, stale.retryable, stale.data);
        rememberProcessedCommand(dedupeKey, response);
        return;
      }

      try {
        const beforeState = cloneJson(getGameState());
        const result = applyCommand(incoming);
        if (!result.ok) {
          const response = sendError(
            ws,
            incoming.commandId,
            result.error.code,
            result.error.message,
            result.error.retryable,
            result.error.data
          );
          rememberProcessedCommand(dedupeKey, response);
          return;
        }

        let event = null;
        if (result.stateChanged) {
          const baseVersion = gameVersion;
          gameVersion += 1;
          persistScoreboard();
          event = rememberGameEvent(baseVersion, incoming.action, incoming.playerId, beforeState, getGameState());
        }

        const response = sendAck(ws, incoming.commandId, {
          replayedCommand: false,
          ...(result.data || {})
        });
        rememberProcessedCommand(dedupeKey, response);
        if (event) {
          const includeHostInfo = shouldBroadcastHostInfo(incoming.action);
          if (shouldBroadcastImmediately(incoming.action)) {
            broadcastGameEventImmediately(event, includeHostInfo);
          } else {
            broadcastGameEvent(event, includeHostInfo);
          }
          if (incoming.action === 'fireGun' && result.data?.penaltyResult) {
            scheduleAutoResolvePenalty(incoming.playerId);
          }
        } else if (incoming.action === 'getGameState') {
          sendGameState(ws);
        }
        scheduleDisconnectedActorAutoActions();
      } catch (error) {
        console.error('Error processing command:', error);
        const response = sendError(ws, incoming.commandId, 'INTERNAL_ERROR', 'Server failed to process command', true);
        rememberProcessedCommand(dedupeKey, response);
      }
    });

    ws.on('close', () => {
      const playerId = socketPlayers.get(ws);
      socketPlayers.delete(ws);
      if (!playerId || hasAnotherSocketForPlayer(ws, playerId)) {
        return;
      }
      const beforeState = cloneJson(getGameState());
      if (touchPlayer(playerId, 'disconnected')) {
        const baseVersion = gameVersion;
        gameVersion += 1;
        const event = rememberGameEvent(baseVersion, 'playerDisconnected', playerId, beforeState, getGameState());
        broadcastGameEvent(event);
        broadcastHostInfo();
        scheduleDisconnectedActorAutoActions();
      }
    });
  });

  function close() {
    if (closed) {
      return closingPromise || Promise.resolve();
    }

    closed = true;
    emitStatus('Stopping');
    closingPromise = new Promise((resolve) => {
      clearInterval(cleanupTimer);
      flushBroadcastQueue();
      disconnectedAutoActionTimers.forEach((timer) => clearTimeout(timer));
      disconnectedAutoActionTimers.clear();
      autoResolvePenaltyTimers.forEach((timer) => clearTimeout(timer));
      autoResolvePenaltyTimers.clear();
      try {
        LANDiscovery.stopBroadcast();
      } catch {}

      let pending = 2;
      const done = () => {
        pending -= 1;
        if (pending <= 0) {
          emitStatus('Stopped');
          resolve();
        }
      };

      const forceCloseTimer = setTimeout(() => {
        wss.clients.forEach((client) => {
          try {
            client.terminate();
          } catch {}
        });
      }, 250);

      wss.clients.forEach((client) => {
        try {
          client.close();
        } catch {}
      });

      wss.close(() => {
        clearTimeout(forceCloseTimer);
        done();
      });

      server.close(() => {
        done();
      });
    });

    return closingPromise;
  }

  return {
    app: expressApp,
    close,
    getGameState,
    getHostInfo: emitHostInfo,
    get port() {
      return port;
    },
    ready,
    server,
    wss
  };
}

module.exports = {
  createHostRuntime,
  getLanIp
};
