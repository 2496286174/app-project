function createLiarsBarCommandHandlers({ getGame }) {
  return {
    playCards({ payload, playerId }) {
      if (!Array.isArray(payload.cardIds) || payload.cardIds.length === 0 || typeof payload.declaredCount !== 'number') {
        return { ok: false, error: { code: 'INVALID_MESSAGE', message: 'playCards requires payload.cardIds and payload.declaredCount', retryable: false } };
      }
      const success = getGame().playCards(playerId, payload.cardIds, payload.declaredCount);
      return success
        ? { ok: true, stateChanged: true }
        : { ok: false, error: { code: 'INVALID_ACTION_STATE', message: 'Cannot play cards in current state', retryable: false } };
    },

    challenge({ playerId }) {
      const success = getGame().challenge(playerId);
      return success
        ? { ok: true, stateChanged: true }
        : { ok: false, error: { code: 'INVALID_ACTION_STATE', message: 'Cannot challenge in current state', retryable: false } };
    },

    trust({ playerId }) {
      const success = getGame().trust(playerId);
      return success
        ? { ok: true, stateChanged: true }
        : { ok: false, error: { code: 'INVALID_ACTION_STATE', message: 'Cannot trust in current state', retryable: false } };
    }
  };
}

module.exports = {
  createLiarsBarCommandHandlers
};
