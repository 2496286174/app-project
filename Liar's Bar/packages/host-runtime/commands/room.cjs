function createRoomCommandHandlers({
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
}) {
  function resetGameToRoom(playerId, command) {
    const hostLookup = ensureHostAction(playerId, command);
    if (!hostLookup.ok) return hostLookup;
    getGame().resetGame();
    return { ok: true, stateChanged: true };
  }

  return {
    joinGame({ command, payload }) {
      const playerName = typeof payload.playerName === 'string' ? payload.playerName.trim() : '';
      if (!playerName) {
        return { ok: false, error: { code: 'INVALID_MESSAGE', message: 'joinGame requires payload.playerName', retryable: false } };
      }

      const canonicalPlayerId = playerName;
      const game = getGame();
      const currentPlayers = getGameState().players;
      const currentHost = currentPlayers.find((player) => player.isHost);
      const joinsAsHost = !currentHost;
      const existing = game.getPlayer(canonicalPlayerId);
      if (existing) {
        existing.name = playerName;
        existing.isHost = existing.isHost || joinsAsHost;
        touchPlayer(canonicalPlayerId);
        if (existing.isHost || existing.isReady) {
          playerJoinTimes.delete(canonicalPlayerId);
        } else {
          playerJoinTimes.set(canonicalPlayerId, now());
        }
        return { ok: true, stateChanged: true, data: { alreadyJoined: true, playerId: canonicalPlayerId } };
      }

      if (currentPlayers.length >= maxPlayers) {
        return { ok: false, error: { code: 'ROOM_FULL', message: 'Room is full', retryable: false } };
      }

      const added = game.addPlayer({
        id: canonicalPlayerId,
        name: playerName,
        cards: [],
        isEliminated: false,
        isActive: true,
        bullets: 0,
        initialBullets: 0,
        score: 0,
        gameState: 'waiting',
        isReady: false,
        isHost: joinsAsHost,
        connectionStatus: 'connected',
        lastSeen: now()
      });

      if (!added) {
        return { ok: false, error: { code: 'ROOM_FULL', message: 'Unable to add player', retryable: false } };
      }

      if (joinsAsHost) {
        playerJoinTimes.delete(canonicalPlayerId);
      } else {
        playerJoinTimes.set(canonicalPlayerId, now());
      }
      return { ok: true, stateChanged: true, data: { playerId: canonicalPlayerId } };
    },

    leaveGame({ playerId }) {
      const existing = getGame().getPlayer(playerId);
      if (!existing) return { ok: true, stateChanged: false };
      if (getGameState().gameStatus === 'playing' && !existing.isHost) {
        touchPlayer(playerId, 'disconnected');
        return { ok: true, stateChanged: true };
      }
      removePlayerAndPromoteHost(playerId);
      return { ok: true, stateChanged: true };
    },

    toggleReady({ payload, playerId }) {
      if (typeof payload.isReady !== 'boolean') {
        return { ok: false, error: { code: 'INVALID_MESSAGE', message: 'toggleReady requires payload.isReady', retryable: false } };
      }
      const lookup = ensurePlayerExists(playerId);
      if (!lookup.ok) return lookup;
      if (getGameState().gameStatus !== 'waiting') {
        return { ok: false, error: { code: 'INVALID_ACTION_STATE', message: 'Ready state can only be changed in the room', retryable: false } };
      }
      lookup.player.isReady = payload.isReady;
      if (payload.isReady) {
        playerJoinTimes.delete(playerId);
      } else {
        playerJoinTimes.set(playerId, now());
      }
      return { ok: true, stateChanged: true };
    },

    changeGameMode({ command, payload, playerId }) {
      const hostLookup = ensureHostAction(playerId, command);
      if (!hostLookup.ok) return hostLookup;
      if (payload.gameMode !== 'liarsBar' && payload.gameMode !== 'texasHoldem') {
        return { ok: false, error: { code: 'INVALID_MESSAGE', message: 'Unsupported game mode', retryable: false } };
      }
      if (getGameState().gameStatus !== 'waiting') {
        return { ok: false, error: { code: 'INVALID_ACTION_STATE', message: 'Game mode can only be changed in the room', retryable: false } };
      }
      if (getGameState().gameMode !== payload.gameMode) {
        switchGameMode(payload.gameMode);
      }
      return { ok: true, stateChanged: true };
    },

    getGameState({ playerId }) {
      return { ok: true, stateChanged: false, data: { gameState: createClientGameState(playerId) } };
    },

    returnToRoom({ command, playerId }) {
      return resetGameToRoom(playerId, command);
    }
  };
}

module.exports = {
  createRoomCommandHandlers
};
