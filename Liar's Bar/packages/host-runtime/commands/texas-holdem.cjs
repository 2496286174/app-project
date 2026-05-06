function createTexasHoldemCommandHandlers({ getGame }) {
  return {
    discardTexasCard({ payload, playerId }) {
      if (typeof payload.cardId !== 'string' || payload.cardId.trim() === '') {
        return { ok: false, error: { code: 'INVALID_MESSAGE', message: 'discardTexasCard requires payload.cardId', retryable: false } };
      }
      const game = getGame();
      const success = typeof game.discardTexasCard === 'function' && game.discardTexasCard(playerId, payload.cardId);
      return success
        ? { ok: true, stateChanged: true }
        : { ok: false, error: { code: 'INVALID_ACTION_STATE', message: 'Cannot discard Texas card in current state', retryable: false } };
    },

    exitTexasRound({ playerId }) {
      const game = getGame();
      const success = typeof game.exitTexasRound === 'function' && game.exitTexasRound(playerId);
      return success
        ? { ok: true, stateChanged: true }
        : { ok: false, error: { code: 'INVALID_ACTION_STATE', message: 'Cannot exit Texas round in current state', retryable: false } };
    }
  };
}

module.exports = {
  createTexasHoldemCommandHandlers
};
