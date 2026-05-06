function createSharedGameCommandHandlers({
  canStartGame,
  ensureHostAction,
  getGame
}) {
  function startGameFromRoom(playerId, command) {
    const startable = canStartGame(playerId, command);
    if (!startable.ok) return startable;
    getGame().startGame();
    return { ok: true, stateChanged: true };
  }

  return {
    startGame({ command, playerId }) {
      return startGameFromRoom(playerId, command);
    },

    dealCards({ command, playerId }) {
      return startGameFromRoom(playerId, command);
    },

    addBullets({ payload, playerId }) {
      if (typeof payload.count !== 'number' || !Number.isFinite(payload.count)) {
        return { ok: false, error: { code: 'INVALID_MESSAGE', message: 'addBullets requires payload.count', retryable: false } };
      }
      const success = getGame().addBullets(playerId, payload.count);
      return success
        ? { ok: true, stateChanged: true }
        : { ok: false, error: { code: 'INVALID_ACTION_STATE', message: 'Cannot add bullets in current state', retryable: false } };
    },

    refuseBullets({ playerId }) {
      const success = getGame().refuseBullets(playerId);
      return success
        ? { ok: true, stateChanged: true }
        : { ok: false, error: { code: 'INVALID_ACTION_STATE', message: 'Cannot refuse bullets in current state', retryable: false } };
    },

    fireGun({ playerId }) {
      const result = getGame().fireGun(playerId);
      return result
        ? { ok: true, stateChanged: true, data: { penaltyResult: result } }
        : { ok: false, error: { code: 'INVALID_ACTION_STATE', message: 'Cannot fire gun in current state', retryable: false } };
    },

    resolvePenalty() {
      return { ok: true, stateChanged: false };
    },

    restartRound({ command, playerId }) {
      const hostLookup = ensureHostAction(playerId, command);
      if (!hostLookup.ok) return hostLookup;
      const game = getGame();
      const restarted =
        typeof game.restartRoundFromSettlement === 'function'
          ? game.restartRoundFromSettlement()
          : false;
      return restarted
        ? { ok: true, stateChanged: true }
        : { ok: false, error: { code: 'INVALID_ACTION_STATE', message: 'Cannot restart round in current state', retryable: false } };
    }
  };
}

module.exports = {
  createSharedGameCommandHandlers
};
