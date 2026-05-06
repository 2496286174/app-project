import { LiarsBarGame } from '../game-logic/LiarsBarGame';
import { TexasShowdownGame } from '../game-logic/TexasShowdownGame';
import { GameManager } from '../game-logic/GameManager';
import { Card, CardRank, CardSuit, Player } from '../game-logic/types';
import {
  compareTexasHoldemHands,
  evaluateTexasHoldemHand,
  getTexasHoldemWinners
} from '../game-logic/texas-holdem';
import { getCurrentBulletCount, getShotProbability, shouldShotHit } from '../game-logic/bullet-system';

// Simple test framework
let activeBeforeEach: (() => void) | null = null;

function describe(description: string, testFn: () => void) {
  const previousBeforeEach = activeBeforeEach;
  activeBeforeEach = null;
  console.log(`\n=== ${description} ===`);
  testFn();
  activeBeforeEach = previousBeforeEach;
}

function test(description: string, testFn: () => void) {
  try {
    activeBeforeEach?.();
    testFn();
    console.log(`✓ ${description}`);
  } catch (error) {
    console.log(`✗ ${description}`);
    console.error(error);
    process.exitCode = 1;
  }
}

function expect(value: any) {
  return {
    toEqual: (expected: any) => {
      if (JSON.stringify(value) !== JSON.stringify(expected)) {
        throw new Error(`Expected ${JSON.stringify(expected)}, but got ${JSON.stringify(value)}`);
      }
    },
    toHaveLength: (length: number) => {
      if (value.length !== length) {
        throw new Error(`Expected length ${length}, but got ${value.length}`);
      }
    },
    toBe: (expected: any) => {
      if (value !== expected) {
        throw new Error(`Expected ${expected}, but got ${value}`);
      }
    },
    toBeDefined: () => {
      if (value === undefined || value === null) {
        throw new Error('Expected value to be defined, but got ' + value);
      }
    },
    not: {
      toThrow: () => {
        try {
          value();
        } catch (error) {
          throw new Error(`Expected not to throw, but got ${error}`);
        }
      }
    }
  };
}

function beforeEach(fn: () => void) {
  activeBeforeEach = fn;
}

describe('LiarsBarGame', () => {
  function getCurrentTurnPlayer(targetGame: LiarsBarGame): Player {
    const state = targetGame.getGameState();
    return state.players[state.currentPlayerIndex];
  }

  function getTurnActorPlayer(targetGame: LiarsBarGame): Player {
    const state = targetGame.getGameState();
    const actorId = state.turnActorPlayerId;
    const actor = state.players.find(player => player.id === actorId);
    if (!actor) {
      throw new Error(`Expected current turn actor, got ${actorId}`);
    }
    return actor;
  }

  function createLiarsPlayer(id: string): Player {
    return {
      id,
      name: id,
      cards: [],
      isEliminated: false,
      isActive: true,
      bullets: 0,
      initialBullets: 0,
      score: 0,
      gameState: 'waiting'
    };
  }

  test('should initialize with empty players', () => {
    const localGame = new LiarsBarGame();
    expect(localGame.getPlayers()).toEqual([]);
  });

  test('should add a player', () => {
    const localGame = new LiarsBarGame();
    const player: Player = {
      id: '1',
      name: 'Player 1',
      cards: [],
      isEliminated: false,
      isActive: true,
      bullets: 0,
      initialBullets: 0,
      gameState: 'waiting'
    };
    localGame.addPlayer(player);
    expect(localGame.getPlayers()).toHaveLength(1);
    expect(localGame.getPlayers()[0].name).toBe('Player 1');
  });

  test('should remove a player', () => {
    const localGame = new LiarsBarGame();
    const player1: Player = {
      id: '1',
      name: 'Player 1',
      cards: [],
      isEliminated: false,
      isActive: true,
      bullets: 0,
      initialBullets: 0,
      gameState: 'waiting'
    };
    const player2: Player = {
      id: '2',
      name: 'Player 2',
      cards: [],
      isEliminated: false,
      isActive: true,
      bullets: 0,
      initialBullets: 0,
      gameState: 'waiting'
    };
    localGame.addPlayer(player1);
    localGame.addPlayer(player2);
    localGame.removePlayer('1');
    expect(localGame.getPlayers()).toHaveLength(1);
    expect(localGame.getPlayers()[0].name).toBe('Player 2');
  });

  test('should start game', () => {
    const localGame = new LiarsBarGame();
    const player1: Player = {
      id: '1',
      name: 'Player 1',
      cards: [],
      isEliminated: false,
      isActive: true,
      bullets: 0,
      initialBullets: 0,
      gameState: 'waiting'
    };
    const player2: Player = {
      id: '2',
      name: 'Player 2',
      cards: [],
      isEliminated: false,
      isActive: true,
      bullets: 0,
      initialBullets: 0,
      gameState: 'waiting'
    };
    localGame.addPlayer(player1);
    localGame.addPlayer(player2);
    expect(() => localGame.startGame()).not.toThrow();
    expect(localGame.getPlayers().every(player => player.bulletCount === 1)).toBe(true);
    expect(localGame.getPlayers().every(player => player.bullets === 1)).toBe(true);
    expect(localGame.getPlayers().every(player => player.initialBullets === 1)).toBe(true);
  });

  test('should start at round 1 and pick an opening player on the next round', () => {
    const rotationGame = new LiarsBarGame();
    const originalRandom = Math.random;

    try {
      Math.random = () => 0.9;

      rotationGame.addPlayer({
        id: 'rotate-1',
        name: 'Player 1',
        cards: [],
        isEliminated: false,
        isActive: true,
        bullets: 0,
        initialBullets: 0,
        score: 0,
        gameState: 'waiting'
      });
      rotationGame.addPlayer({
        id: 'rotate-2',
        name: 'Player 2',
        cards: [],
        isEliminated: false,
        isActive: true,
        bullets: 0,
        initialBullets: 0,
        score: 0,
        gameState: 'waiting'
      });
      rotationGame.startGame();

      const firstState = rotationGame.getGameState();
      const firstStarter = firstState.players[firstState.currentPlayerIndex];

      expect(firstState.round).toBe(1);
      firstStarter.cards = [firstStarter.cards[0]];

      expect(rotationGame.addBullets(firstStarter.id, 1)).toBe(true);
      expect(rotationGame.playCards(firstStarter.id, [firstStarter.cards[0].id], 1)).toBe(true);
      const responder = getTurnActorPlayer(rotationGame);
      expect(rotationGame.addBullets(responder.id, 1)).toBe(true);
      expect(rotationGame.trust(responder.id)).toBe(true);
      expect(rotationGame.getGameState().roundSettlement?.round).toBe(1);

      expect(rotationGame.restartRoundFromSettlement()).toBe(true);
      const restartedState = rotationGame.getGameState();
      const restartedStarter = restartedState.players[restartedState.currentPlayerIndex];

      expect(restartedState.round).toBe(2);
      expect(restartedStarter).toBeDefined();
    } finally {
      Math.random = originalRandom;
    }
  });

  test('should not require adding bullets twice after trusting', () => {
    const localGame = new LiarsBarGame();
    const player1: Player = {
      id: '1',
      name: 'Player 1',
      cards: [],
      isEliminated: false,
      isActive: true,
      bullets: 0,
      initialBullets: 0,
      gameState: 'waiting'
    };
    const player2: Player = {
      id: '2',
      name: 'Player 2',
      cards: [],
      isEliminated: false,
      isActive: true,
      bullets: 0,
      initialBullets: 0,
      gameState: 'waiting'
    };

    localGame.addPlayer(player1);
    localGame.addPlayer(player2);
    localGame.startGame();

    const currentPlayer = getCurrentTurnPlayer(localGame);
    expect(localGame.addBullets(currentPlayer.id, 1)).toBe(true);
    expect(localGame.playCards(currentPlayer.id, [currentPlayer.cards[0].id], 1)).toBe(true);
    const responder = getTurnActorPlayer(localGame);

    expect(localGame.addBullets(responder.id, 2)).toBe(true);
    expect(localGame.trust(responder.id)).toBe(true);

    const stateAfterTrust = localGame.getGameState();
    const nextPlayer = stateAfterTrust.players[stateAfterTrust.currentPlayerIndex];

    expect(nextPlayer.id).toBe(responder.id);
    expect(nextPlayer.hasAddedBullets).toBe(true);
    expect(localGame.addBullets(responder.id, 1)).toBe(false);
    expect(localGame.playCards(responder.id, [nextPlayer.cards[0].id], 1)).toBe(true);
  });

  test('should allow matching the previous bullet add but reject lower adds', () => {
    const matchingGame = new LiarsBarGame();
    const player1: Player = {
      id: 'match-add-1',
      name: 'Player 1',
      cards: [],
      isEliminated: false,
      isActive: true,
      bullets: 0,
      initialBullets: 0,
      gameState: 'waiting'
    };
    const player2: Player = {
      id: 'match-add-2',
      name: 'Player 2',
      cards: [],
      isEliminated: false,
      isActive: true,
      bullets: 0,
      initialBullets: 0,
      gameState: 'waiting'
    };

    matchingGame.addPlayer(player1);
    matchingGame.addPlayer(player2);
    matchingGame.startGame();

    const currentPlayer = getCurrentTurnPlayer(matchingGame);
    expect(matchingGame.addBullets(currentPlayer.id, 2)).toBe(true);
    expect(matchingGame.playCards(currentPlayer.id, [currentPlayer.cards[0].id], 1)).toBe(true);
    const responder = getTurnActorPlayer(matchingGame);
    expect(matchingGame.addBullets(responder.id, 1)).toBe(false);
    expect(matchingGame.addBullets(responder.id, 2)).toBe(true);
    expect(matchingGame.getGameState().lastAddedBullets).toBe(2);
  });

  test('should choose the next Liars Bar player from players who have not played in the current turn cycle', () => {
    const cycleGame = new LiarsBarGame();
    const originalRandom = Math.random;

    try {
      Math.random = () => 0;

      cycleGame.addPlayer(createLiarsPlayer('cycle-1'));
      cycleGame.addPlayer(createLiarsPlayer('cycle-2'));
      cycleGame.addPlayer(createLiarsPlayer('cycle-3'));
      cycleGame.startGame();

      const firstPlayer = getCurrentTurnPlayer(cycleGame);
      expect(firstPlayer.id).toBe('cycle-1');
      expect(cycleGame.addBullets(firstPlayer.id, 1)).toBe(true);
      expect(cycleGame.playCards(firstPlayer.id, [firstPlayer.cards[0].id], 1)).toBe(true);

      const secondPlayer = getTurnActorPlayer(cycleGame);
      expect(secondPlayer.id).toBe('cycle-2');
      expect(cycleGame.addBullets(secondPlayer.id, 1)).toBe(true);
      expect(cycleGame.trust(secondPlayer.id)).toBe(true);
      expect(cycleGame.playCards(secondPlayer.id, [secondPlayer.cards[0].id], 1)).toBe(true);

      const thirdPlayer = getTurnActorPlayer(cycleGame);
      expect(thirdPlayer.id).toBe('cycle-3');
      expect(cycleGame.addBullets(thirdPlayer.id, 1)).toBe(true);
      expect(cycleGame.trust(thirdPlayer.id)).toBe(true);
      expect(cycleGame.playCards(thirdPlayer.id, [thirdPlayer.cards[0].id], 1)).toBe(true);

      const nextCyclePlayer = getTurnActorPlayer(cycleGame);
      expect(nextCyclePlayer.id).toBe('cycle-1');
    } finally {
      Math.random = originalRandom;
    }
  });

  test('should keep playing after a last-card play claims first place while others remain active', () => {
    const scoringGame = new LiarsBarGame();
    const originalRandom = Math.random;

    try {
      Math.random = () => 0;

      scoringGame.addPlayer(createLiarsPlayer('finish-truth-1'));
      scoringGame.addPlayer(createLiarsPlayer('finish-truth-2'));
      scoringGame.addPlayer(createLiarsPlayer('finish-truth-3'));
      scoringGame.addPlayer(createLiarsPlayer('finish-truth-4'));
      scoringGame.startGame();

      const completedPlayer = getCurrentTurnPlayer(scoringGame);
      const mainCard = scoringGame.getGameState().mainCard;
      completedPlayer.cards = [{ rank: mainCard, id: 'last-truth-card' }];

      expect(scoringGame.addBullets(completedPlayer.id, 1)).toBe(true);
      expect(scoringGame.playCards(completedPlayer.id, ['last-truth-card'], 1)).toBe(true);

      const challenger = getTurnActorPlayer(scoringGame);
      expect(scoringGame.addBullets(challenger.id, 1)).toBe(true);
      expect(scoringGame.challenge(challenger.id)).toBe(true);

      Math.random = () => 0.999;
      const penalty = scoringGame.fireGun(challenger.id);
      expect(penalty?.shot).toBe(false);
      scoringGame.resolvePenalty();

      expect(scoringGame.getGameState().gameStatus).toBe('playing');
      expect(scoringGame.getGameState().roundSettlement).toBe(null);
      expect(scoringGame.getPlayer(completedPlayer.id)?.isActive).toBe(false);
      expect(scoringGame.getPlayer(challenger.id)?.isActive).toBe(false);
      expect(scoringGame.getGameState().turnActorPlayerId === completedPlayer.id).toBe(false);
      expect(scoringGame.getGameState().players[scoringGame.getGameState().currentPlayerIndex].id === completedPlayer.id).toBe(false);

      const secondFinisher = getTurnActorPlayer(scoringGame);
      const finalPlayer = scoringGame.getPlayers().find(player =>
        player.id !== completedPlayer.id &&
        player.id !== challenger.id &&
        player.id !== secondFinisher.id
      )!;
      const secondWinningCard = secondFinisher.cards[0];
      secondFinisher.cards = [secondWinningCard];
      expect(scoringGame.addBullets(secondFinisher.id, 1)).toBe(true);
      expect(scoringGame.playCards(secondFinisher.id, [secondWinningCard.id], 1)).toBe(true);
      expect(getTurnActorPlayer(scoringGame).id).toBe(finalPlayer.id);
      expect(scoringGame.addBullets(finalPlayer.id, 1)).toBe(true);
      expect(scoringGame.trust(finalPlayer.id)).toBe(true);

      const settlement = scoringGame.getGameState().roundSettlement;
      expect(scoringGame.getGameState().gameStatus).toBe('ended');
      expect(settlement?.winnerIds[0]).toBe(completedPlayer.id);
      expect(scoringGame.getPlayer(completedPlayer.id)?.score).toBe(4);
      expect(scoringGame.getPlayer(secondFinisher.id)?.score).toBe(3);
      expect(scoringGame.getPlayer(finalPlayer.id)?.score).toBe(2);
      expect(scoringGame.getPlayer(challenger.id)?.score).toBe(0);
    } finally {
      Math.random = originalRandom;
    }
  });

  test('should allow accumulated bullets above chamber count and cap shot risk at 100%', () => {
    const overLimitGame = new LiarsBarGame();
    const player1: Player = {
      id: 'over-limit-1',
      name: 'Player 1',
      cards: [],
      isEliminated: false,
      isActive: true,
      bullets: 0,
      initialBullets: 0,
      gameState: 'waiting'
    };
    const player2: Player = {
      id: 'over-limit-2',
      name: 'Player 2',
      cards: [],
      isEliminated: false,
      isActive: true,
      bullets: 0,
      initialBullets: 0,
      gameState: 'waiting'
    };

    overLimitGame.addPlayer(player1);
    overLimitGame.addPlayer(player2);
    overLimitGame.startGame();

    const currentPlayer = getCurrentTurnPlayer(overLimitGame);
    expect(overLimitGame.addBullets(currentPlayer.id, 9)).toBe(true);
    expect(getCurrentBulletCount(currentPlayer)).toBe(10);
    expect(getShotProbability(currentPlayer)).toBe(1);
    expect(shouldShotHit(currentPlayer, 0.999)).toBe(true);
  });

  test('should keep leaderboard scores after room reset and player leave', () => {
    const leaderboardGame = new LiarsBarGame();
    const player1: Player = {
      id: 'leaderboard-1',
      name: 'Player 1',
      cards: [],
      isEliminated: false,
      isActive: true,
      bullets: 0,
      initialBullets: 0,
      score: 4,
      gameState: 'waiting'
    };
    const player2: Player = {
      id: 'leaderboard-2',
      name: 'Player 2',
      cards: [],
      isEliminated: false,
      isActive: true,
      bullets: 0,
      initialBullets: 0,
      score: -1,
      gameState: 'waiting'
    };

    leaderboardGame.addPlayer(player1);
    leaderboardGame.addPlayer(player2);
    leaderboardGame.resetGame();
    leaderboardGame.removePlayer(player1.id);

    const entry = leaderboardGame.getGameState().scoreboard?.find(score => score.playerId === player1.id);
    expect(entry?.score).toBe(4);
    expect(entry?.isActive).toBe(false);
  });

  test('should exclude a shot victim from placement scores when the hand ends', () => {
    const scoringGame = new LiarsBarGame();
    const player1: Player = {
      id: 'score-hit-1',
      name: 'Player 1',
      cards: [],
      isEliminated: false,
      isActive: true,
      bullets: 0,
      initialBullets: 0,
      score: 0,
      gameState: 'waiting'
    };
    const player2: Player = {
      id: 'score-hit-2',
      name: 'Player 2',
      cards: [],
      isEliminated: false,
      isActive: true,
      bullets: 0,
      initialBullets: 0,
      score: 0,
      gameState: 'waiting'
    };

    const originalRandom = Math.random;

    try {
      scoringGame.addPlayer(player1);
      scoringGame.addPlayer(player2);
      scoringGame.startGame();

      const currentPlayer = getCurrentTurnPlayer(scoringGame);
      const liarCard = currentPlayer.cards[0];

      expect(scoringGame.addBullets(currentPlayer.id, 1)).toBe(true);
      expect(scoringGame.playCards(currentPlayer.id, [liarCard.id], 3)).toBe(true);
      const challenger = getTurnActorPlayer(scoringGame);
      expect(scoringGame.addBullets(challenger.id, 2)).toBe(true);
      expect(scoringGame.challenge(challenger.id)).toBe(true);

      Math.random = () => 0;
      const penalty = scoringGame.fireGun(currentPlayer.id);
      expect(penalty?.shot).toBe(true);
      expect(scoringGame.getPlayer(currentPlayer.id)?.score).toBe(-1);
      expect(scoringGame.getPlayer(challenger.id)?.score).toBe(0);

      scoringGame.resolvePenalty();

      expect(scoringGame.getPlayer(currentPlayer.id)?.score).toBe(-1);
      expect(scoringGame.getPlayer(challenger.id)?.score).toBe(2);

      const settlement = scoringGame.getGameState().roundSettlement;
      expect(settlement?.gameMode).toBe('liarsBar');
      expect(settlement?.hands.find(hand => hand.playerId === currentPlayer.id)?.cards.length).toBe(5);
      expect(settlement?.scoreDeltas.find(score => score.playerId === currentPlayer.id)?.delta).toBe(-1);
      expect(settlement?.scoreDeltas.find(score => score.playerId === challenger.id)?.totalScore).toBe(2);
      expect(scoringGame.restartRoundFromSettlement()).toBe(true);
      expect(scoringGame.getGameState().gameStatus).toBe('playing');
      expect(scoringGame.getPlayers().every(player => !player.isEliminated && player.cards.length === 5)).toBe(true);
      expect(scoringGame.getPlayer(currentPlayer.id)?.score).toBe(-1);
    } finally {
      Math.random = originalRandom;
    }
  });

  test('should continue a three-player hand after one player is eliminated by penalty', () => {
    const scoringGame = new LiarsBarGame();
    const player1: Player = {
      id: 'continue-after-shot-1',
      name: 'Player 1',
      cards: [],
      isEliminated: false,
      isActive: true,
      bullets: 0,
      initialBullets: 0,
      score: 0,
      gameState: 'waiting'
    };
    const player2: Player = {
      id: 'continue-after-shot-2',
      name: 'Player 2',
      cards: [],
      isEliminated: false,
      isActive: true,
      bullets: 0,
      initialBullets: 0,
      score: 0,
      gameState: 'waiting'
    };
    const player3: Player = {
      id: 'continue-after-shot-3',
      name: 'Player 3',
      cards: [],
      isEliminated: false,
      isActive: true,
      bullets: 0,
      initialBullets: 0,
      score: 0,
      gameState: 'waiting'
    };

    const originalRandom = Math.random;

    try {
      scoringGame.addPlayer(player1);
      scoringGame.addPlayer(player2);
      scoringGame.addPlayer(player3);
      scoringGame.startGame();

      const currentPlayer = getCurrentTurnPlayer(scoringGame);
      const currentInitialHand = currentPlayer.cards.map(card => card.id);
      const liarCard = currentPlayer.cards[0];

      expect(scoringGame.addBullets(currentPlayer.id, 1)).toBe(true);
      expect(scoringGame.playCards(currentPlayer.id, [liarCard.id], 3)).toBe(true);
      const challenger = getTurnActorPlayer(scoringGame);
      const thirdPlayer = scoringGame.getPlayers().find(player => player.id !== currentPlayer.id && player.id !== challenger.id)!;
      const challengerInitialHand = challenger.cards.map(card => card.id);
      const thirdInitialHand = thirdPlayer.cards.map(card => card.id);
      expect(scoringGame.addBullets(challenger.id, 1)).toBe(true);
      expect(scoringGame.challenge(challenger.id)).toBe(true);

      Math.random = () => 0;
      const penalty = scoringGame.fireGun(currentPlayer.id);
      expect(penalty?.shot).toBe(true);
      scoringGame.resolvePenalty();

      const state = scoringGame.getGameState();
      expect(state.gameStatus).toBe('playing');
      expect(state.roundSettlement).toBe(null);
      expect(state.turnActorPlayerId).toBe(challenger.id);
      expect(scoringGame.getPlayer(currentPlayer.id)?.isEliminated).toBe(true);
      expect(scoringGame.getPlayer(challenger.id)?.isEliminated).toBe(false);
      expect(scoringGame.getPlayer(thirdPlayer.id)?.isEliminated).toBe(false);
      expect(scoringGame.getPlayer(currentPlayer.id)?.score).toBe(-1);
      expect(scoringGame.getPlayer(challenger.id)?.score).toBe(0);
      expect(scoringGame.getPlayer(thirdPlayer.id)?.score).toBe(0);
      expect(scoringGame.getPlayer(challenger.id)?.hasAddedBullets).toBe(true);
      expect(scoringGame.getPlayer(currentPlayer.id)?.cards.map(card => card.id)).toEqual(currentInitialHand.filter(cardId => cardId !== liarCard.id));
      expect(scoringGame.getPlayer(challenger.id)?.cards.map(card => card.id)).toEqual(challengerInitialHand);
      expect(scoringGame.getPlayer(thirdPlayer.id)?.cards.map(card => card.id)).toEqual(thirdInitialHand);

      const winningCard = challenger.cards[0];
      challenger.cards = [winningCard];
      expect(scoringGame.addBullets(challenger.id, 1)).toBe(false);
      expect(scoringGame.playCards(challenger.id, [winningCard.id], 1)).toBe(true);
      expect(scoringGame.addBullets(thirdPlayer.id, 1)).toBe(true);
      expect(scoringGame.trust(thirdPlayer.id)).toBe(true);

      const settlement = scoringGame.getGameState().roundSettlement;
      expect(scoringGame.getGameState().gameStatus).toBe('ended');
      expect(scoringGame.getPlayer(currentPlayer.id)?.score).toBe(-1);
      expect(scoringGame.getPlayer(challenger.id)?.score).toBe(3);
      expect(scoringGame.getPlayer(thirdPlayer.id)?.score).toBe(2);
      expect(settlement?.scoreDeltas.find(score => score.playerId === currentPlayer.id)?.delta).toBe(-1);
      expect(settlement?.scoreDeltas.find(score => score.playerId === challenger.id)?.delta).toBe(3);
      expect(settlement?.scoreDeltas.find(score => score.playerId === thirdPlayer.id)?.delta).toBe(2);
    } finally {
      Math.random = originalRandom;
    }
  });

  test('should not deduct score when a penalty shot misses', () => {
    const scoringGame = new LiarsBarGame();
    const player1: Player = {
      id: 'score-miss-1',
      name: 'Player 1',
      cards: [],
      isEliminated: false,
      isActive: true,
      bullets: 0,
      initialBullets: 0,
      score: 0,
      gameState: 'waiting'
    };
    const player2: Player = {
      id: 'score-miss-2',
      name: 'Player 2',
      cards: [],
      isEliminated: false,
      isActive: true,
      bullets: 0,
      initialBullets: 0,
      score: 0,
      gameState: 'waiting'
    };

    const originalRandom = Math.random;

    try {
      scoringGame.addPlayer(player1);
      scoringGame.addPlayer(player2);
      scoringGame.startGame();

      const currentPlayer = getCurrentTurnPlayer(scoringGame);
      const liarCard = currentPlayer.cards[0];

      expect(scoringGame.addBullets(currentPlayer.id, 1)).toBe(true);
      expect(scoringGame.playCards(currentPlayer.id, [liarCard.id], 3)).toBe(true);
      const challenger = getTurnActorPlayer(scoringGame);
      expect(scoringGame.addBullets(challenger.id, 2)).toBe(true);
      expect(scoringGame.challenge(challenger.id)).toBe(true);

      Math.random = () => 0.999;
      const penalty = scoringGame.fireGun(currentPlayer.id);
      expect(penalty?.shot).toBe(false);

      expect(scoringGame.getPlayer(currentPlayer.id)?.score).toBe(0);
      expect(scoringGame.getPlayer(challenger.id)?.score).toBe(0);
    } finally {
      Math.random = originalRandom;
    }
  });

  test('should remove a missed penalty shooter from the active hand and placement scoring', () => {
    const scoringGame = new LiarsBarGame();
    const player1: Player = {
      id: 'miss-exit-1',
      name: 'Player 1',
      cards: [],
      isEliminated: false,
      isActive: true,
      bullets: 0,
      initialBullets: 0,
      score: 0,
      gameState: 'waiting'
    };
    const player2: Player = {
      id: 'miss-exit-2',
      name: 'Player 2',
      cards: [],
      isEliminated: false,
      isActive: true,
      bullets: 0,
      initialBullets: 0,
      score: 0,
      gameState: 'waiting'
    };
    const player3: Player = {
      id: 'miss-exit-3',
      name: 'Player 3',
      cards: [],
      isEliminated: false,
      isActive: true,
      bullets: 0,
      initialBullets: 0,
      score: 0,
      gameState: 'waiting'
    };

    const originalRandom = Math.random;

    try {
      scoringGame.addPlayer(player1);
      scoringGame.addPlayer(player2);
      scoringGame.addPlayer(player3);
      scoringGame.startGame();

      const currentPlayer = getCurrentTurnPlayer(scoringGame);
      const mainCard = scoringGame.getGameState().mainCard;

      currentPlayer.cards = [
        { rank: mainCard, id: 'truthful-main-card' },
        currentPlayer.cards[0]
      ];

      expect(scoringGame.addBullets(currentPlayer.id, 1)).toBe(true);
      expect(scoringGame.playCards(currentPlayer.id, ['truthful-main-card'], 1)).toBe(true);
      const challenger = getTurnActorPlayer(scoringGame);
      expect(scoringGame.addBullets(challenger.id, 1)).toBe(true);
      expect(scoringGame.challenge(challenger.id)).toBe(true);

      Math.random = () => 0.999;
      const penalty = scoringGame.fireGun(challenger.id);
      expect(penalty?.shot).toBe(false);
      expect(scoringGame.getPlayer(challenger.id)?.score).toBe(0);
      expect(scoringGame.getPlayer(challenger.id)?.isEliminated).toBe(false);
      expect(scoringGame.getPlayer(challenger.id)?.isActive).toBe(false);

      scoringGame.resolvePenalty();

      const nextActor = getTurnActorPlayer(scoringGame);
      const runnerUp = scoringGame.getPlayers().find(player => player.id !== challenger.id && player.id !== nextActor.id)!;
      expect(scoringGame.getGameState().gameStatus).toBe('playing');
      expect(scoringGame.addBullets(challenger.id, 1)).toBe(false);
      expect(scoringGame.playCards(challenger.id, [challenger.cards[0].id], 1)).toBe(false);

      const winningCard = nextActor.cards[0];
      nextActor.cards = [winningCard];
      expect(scoringGame.addBullets(nextActor.id, 1)).toBe(true);
      expect(scoringGame.playCards(nextActor.id, [winningCard.id], 1)).toBe(true);
      const responder = getTurnActorPlayer(scoringGame);
      expect(scoringGame.addBullets(responder.id, 1)).toBe(true);
      expect(scoringGame.trust(responder.id)).toBe(true);

      const settlement = scoringGame.getGameState().roundSettlement;
      expect(scoringGame.getGameState().gameStatus).toBe('ended');
      expect(scoringGame.getPlayer(challenger.id)?.score).toBe(0);
      expect(scoringGame.getPlayer(nextActor.id)?.score).toBe(3);
      expect(scoringGame.getPlayer(runnerUp.id)?.score).toBe(2);
      expect(settlement?.scoreDeltas.find(score => score.playerId === challenger.id)?.delta).toBe(0);
      expect(settlement?.scoreDeltas.find(score => score.playerId === nextActor.id)?.delta).toBe(3);
      expect(settlement?.scoreDeltas.find(score => score.playerId === runnerUp.id)?.delta).toBe(2);
    } finally {
      Math.random = originalRandom;
    }
  });

  test('should award Liars Bar placement scores by in-round player count', () => {
    const scoringGame = new LiarsBarGame();
    const winner: Player = {
      id: 'hand-win-1',
      name: 'Winner',
      cards: [],
      isEliminated: false,
      isActive: true,
      bullets: 0,
      initialBullets: 0,
      score: 0,
      gameState: 'waiting'
    };
    const player2: Player = {
      id: 'hand-win-2',
      name: 'Player 2',
      cards: [],
      isEliminated: false,
      isActive: true,
      bullets: 0,
      initialBullets: 0,
      score: 0,
      gameState: 'waiting'
    };
    const player3: Player = {
      id: 'hand-win-3',
      name: 'Player 3',
      cards: [],
      isEliminated: false,
      isActive: true,
      bullets: 0,
      initialBullets: 0,
      score: 0,
      gameState: 'waiting'
    };

    scoringGame.addPlayer(winner);
    scoringGame.addPlayer(player2);
    scoringGame.addPlayer(player3);
    scoringGame.startGame();

    const currentPlayer = getCurrentTurnPlayer(scoringGame);
    const loserIds = scoringGame.getPlayers().filter(player => player.id !== currentPlayer.id).map(player => player.id);
    currentPlayer.cards = [currentPlayer.cards[0]];

    expect(scoringGame.addBullets(currentPlayer.id, 1)).toBe(true);
    expect(scoringGame.playCards(currentPlayer.id, [currentPlayer.cards[0].id], 1)).toBe(true);
    const responder = getTurnActorPlayer(scoringGame);
    expect(scoringGame.addBullets(responder.id, 1)).toBe(true);
    expect(scoringGame.trust(responder.id)).toBe(true);

    expect(scoringGame.getGameState().gameStatus).toBe('playing');
    expect(scoringGame.getGameState().roundSettlement).toBe(null);

    const runnerUpCard = responder.cards[0];
    responder.cards = [runnerUpCard];
    expect(scoringGame.playCards(responder.id, [runnerUpCard.id], 1)).toBe(true);
    const finalResponder = getTurnActorPlayer(scoringGame);
    expect(scoringGame.addBullets(finalResponder.id, 1)).toBe(true);
    expect(scoringGame.trust(finalResponder.id)).toBe(true);

    const settlement = scoringGame.getGameState().roundSettlement;
    const loserScores = loserIds
      .map(playerId => scoringGame.getPlayer(playerId)?.score)
      .sort();
    const loserDeltas = loserIds
      .map(playerId => settlement?.scoreDeltas.find(score => score.playerId === playerId)?.delta)
      .sort();

    expect(scoringGame.getPlayer(currentPlayer.id)?.score).toBe(3);
    expect(loserScores).toEqual([1, 2]);
    expect(settlement?.scoreDeltas.find(score => score.playerId === currentPlayer.id)?.delta).toBe(3);
    expect(loserDeltas).toEqual([1, 2]);
  });

  test('should use bullet count divided by max bullets for penalty shots', () => {
    const scoringGame = new LiarsBarGame();
    const player1: Player = {
      id: 'probability-1',
      name: 'Player 1',
      cards: [],
      isEliminated: false,
      isActive: true,
      bullets: 0,
      initialBullets: 0,
      score: 0,
      gameState: 'waiting'
    };
    const player2: Player = {
      id: 'probability-2',
      name: 'Player 2',
      cards: [],
      isEliminated: false,
      isActive: true,
      bullets: 0,
      initialBullets: 0,
      score: 0,
      gameState: 'waiting'
    };

    const originalRandom = Math.random;

    try {
      scoringGame.addPlayer(player1);
      scoringGame.addPlayer(player2);
      scoringGame.startGame();

      const currentPlayer = getCurrentTurnPlayer(scoringGame);
      const liarCard = currentPlayer.cards[0];

      expect(getShotProbability(currentPlayer)).toBe(0.125);
      expect(scoringGame.addBullets(currentPlayer.id, 1)).toBe(true);
      expect(getShotProbability(currentPlayer)).toBe(0.25);
      expect(scoringGame.playCards(currentPlayer.id, [liarCard.id], 3)).toBe(true);
      const challenger = getTurnActorPlayer(scoringGame);
      expect(scoringGame.addBullets(challenger.id, 2)).toBe(true);
      expect(scoringGame.challenge(challenger.id)).toBe(true);

      Math.random = () => 0.3;
      const penalty = scoringGame.fireGun(currentPlayer.id);
      expect(penalty?.shot).toBe(false);
    } finally {
      Math.random = originalRandom;
    }
  });

  test('should mark mid-game joins as spectators in Liars Bar', () => {
    const game = new LiarsBarGame();
    game.addPlayer(createLiarsPlayer('spectator-liars-1'));
    game.addPlayer(createLiarsPlayer('spectator-liars-2'));
    game.startGame();

    expect(game.addPlayer(createLiarsPlayer('spectator-liars-join'))).toBe(true);
    const spectator = game.getPlayer('spectator-liars-join')!;

    expect(spectator.isActive).toBe(false);
    expect(spectator.gameState).toBe('waiting');
    expect(spectator.cards.length).toBe(0);
    expect(game.getPlayers().filter(player => !player.isEliminated && player.isActive).length).toBe(2);
  });
});

describe('GameManager', () => {
  let gameManager: GameManager;

  beforeEach(() => {
    const game = new LiarsBarGame();
    gameManager = GameManager.getInstance(game);
  });

  test('should get the game mode', () => {
    const gameMode = gameManager.getGameMode();
    expect(gameMode).toBeDefined();
  });

  test('should add a player', () => {
    const player: Player = {
      id: '1',
      name: 'Player 1',
      cards: [],
      isEliminated: false,
      isActive: true,
      bullets: 0,
      initialBullets: 0,
      gameState: 'waiting'
    };
    gameManager.addPlayer(player);
    const gameMode = gameManager.getGameMode();
    expect(gameMode.getPlayers()).toHaveLength(1);
  });

  test('should remove a player', () => {
    const player: Player = {
      id: '1',
      name: 'Player 1',
      cards: [],
      isEliminated: false,
      isActive: true,
      bullets: 0,
      initialBullets: 0,
      gameState: 'waiting'
    };
    gameManager.addPlayer(player);
    gameManager.removePlayer('1');
    const gameMode = gameManager.getGameMode();
    expect(gameMode.getPlayers()).toHaveLength(0);
  });
});

describe('Texas Holdem hand evaluator', () => {
  function card(rank: CardRank, suit: CardSuit): Card {
    return {
      id: `${suit}-${rank}`,
      rank,
      suit
    };
  }

  test('should choose a royal flush from seven cards', () => {
    const hand = evaluateTexasHoldemHand([
      card('A', 'hearts'),
      card('K', 'hearts'),
      card('Q', 'hearts'),
      card('J', 'hearts'),
      card('10', 'hearts'),
      card('9', 'clubs'),
      card('2', 'diamonds')
    ]);

    expect(hand.category).toBe('royalFlush');
    expect(hand.ranks).toEqual([14]);
  });

  test('should rank a full house above a flush', () => {
    const fullHouse = [
      card('A', 'spades'),
      card('A', 'hearts'),
      card('A', 'clubs'),
      card('K', 'diamonds'),
      card('K', 'clubs')
    ];
    const flush = [
      card('A', 'hearts'),
      card('J', 'hearts'),
      card('9', 'hearts'),
      card('7', 'hearts'),
      card('3', 'hearts')
    ];

    expect(compareTexasHoldemHands(fullHouse, flush)).toBe(1);
  });

  test('should handle A-2-3-4-5 as a five-high straight', () => {
    const hand = evaluateTexasHoldemHand([
      card('A', 'spades'),
      card('2', 'hearts'),
      card('3', 'clubs'),
      card('4', 'diamonds'),
      card('5', 'spades')
    ]);

    expect(hand.category).toBe('straight');
    expect(hand.ranks).toEqual([5]);
  });

  test('should compare two-pair kickers', () => {
    const queenKicker = [
      card('A', 'spades'),
      card('A', 'hearts'),
      card('K', 'clubs'),
      card('K', 'diamonds'),
      card('Q', 'spades')
    ];
    const jackKicker = [
      card('A', 'clubs'),
      card('A', 'diamonds'),
      card('K', 'spades'),
      card('K', 'hearts'),
      card('J', 'clubs')
    ];

    expect(compareTexasHoldemHands(queenKicker, jackKicker)).toBe(1);
  });

  test('should return all tied winners', () => {
    const board = [
      card('A', 'spades'),
      card('K', 'hearts'),
      card('Q', 'clubs'),
      card('J', 'diamonds'),
      card('10', 'spades')
    ];

    const winners = getTexasHoldemWinners([
      {
        playerId: 'p1',
        cards: [...board, card('2', 'clubs'), card('3', 'diamonds')]
      },
      {
        playerId: 'p2',
        cards: [...board, card('4', 'clubs'), card('5', 'diamonds')]
      }
    ]);

    expect(winners.map(winner => winner.playerId)).toEqual(['p1', 'p2']);
  });
});

describe('TexasShowdownGame', () => {
  function player(id: string): Player {
    return {
      id,
      name: id,
      cards: [],
      isEliminated: false,
      isActive: true,
      bullets: 0,
      initialBullets: 0,
      score: 0,
      gameState: 'waiting'
    };
  }

  function finishInitialTexasPhase(game: TexasShowdownGame) {
    const startCommunityCardCount = game.getGameState().communityCards.length;
    let guard = 0;
    while (
      game.getGameState().gameStatus === 'playing' &&
      game.getGameState().texasStage === 'preDraw' &&
      game.getGameState().communityCards.length === startCommunityCardCount &&
      guard < 20
    ) {
      const pendingPlayerId = game.getGameState().pendingTexasDiscardPlayerId!;
      const pendingPlayer = game.getPlayer(pendingPlayerId)!;
      if (pendingPlayer.cards.length > 2) {
        expect(game.discardTexasCard(pendingPlayerId, pendingPlayer.cards[0].id)).toBe(true);
      } else {
        expect(game.addBullets(pendingPlayerId, 1)).toBe(true);
      }
      guard += 1;
    }
  }

  function finishTexasByAddingBullets(game: TexasShowdownGame) {
    let guard = 0;
    while (game.getGameState().gameStatus === 'playing' && guard < 80) {
      const state = game.getGameState();
      const actorId = state.pendingTexasDiscardPlayerId || state.turnActorPlayerId!;
      expect(actorId).toBeDefined();

      const actor = game.getPlayer(actorId)!;
      if (state.texasStage === 'preDraw' && state.pendingTexasDiscardPlayerId === actorId && actor.cards.length > 2) {
        expect(game.discardTexasCard(actorId, actor.cards[0].id)).toBe(true);
      } else {
        expect(game.addBullets(actorId, 1)).toBe(true);
      }
      guard += 1;
    }
  }

  test('should let each player add bullets immediately after discarding during pre-draw', () => {
    const game = new TexasShowdownGame();
    game.addPlayer(player('p1'));
    game.addPlayer(player('p2'));
    game.startGame();

    expect(game.getGameState().gameMode).toBe('texasHoldem');
    expect(game.getGameState().texasStage).toBe('preDraw');
    expect(game.getPlayers().every(player => player.bulletCount === 1)).toBe(true);
    expect(game.getPlayers().every(player => player.bullets === 1)).toBe(true);
    expect(game.getPlayers().every(player => player.initialBullets === 1)).toBe(true);

    const firstActorId = game.getGameState().pendingTexasDiscardPlayerId!;
    const firstActor = game.getPlayer(firstActorId)!;
    const waitingActor = game.getPlayers().find(player => player.id !== firstActorId)!;
    expect(firstActor.cards.length).toBe(3);
    expect(waitingActor.cards.length).toBe(2);
    expect(game.discardTexasCard(firstActorId, firstActor.cards[0].id)).toBe(true);

    expect(game.getGameState().texasStage).toBe('preDraw');
    expect(game.getGameState().turnActorPlayerId).toBe(firstActorId);
    expect(game.getPlayer(firstActorId)?.cards.length).toBe(2);
    expect(game.addBullets(firstActorId, 1)).toBe(true);

    const secondActorId = game.getGameState().pendingTexasDiscardPlayerId!;
    expect(secondActorId === firstActorId).toBe(false);
    expect(game.getPlayer(secondActorId)?.cards.length).toBe(3);

    finishInitialTexasPhase(game);

    expect(game.getGameState().texasStage).toBe('preDraw');
    expect(game.getGameState().communityCards.length).toBe(3);
    expect(game.getPlayers()[0].cards.length).toBe(2);
    expect((game.getPlayers()[1].cards.length || 0) >= 2).toBe(true);
    expect(game.getGameState().turnActorPlayerId).toBeDefined();
  });

  test('should award pending shot score to the last in-hand winner', () => {
    const game = new TexasShowdownGame();
    const originalRandom = Math.random;

    try {
      game.addPlayer(player('p1'));
      game.addPlayer(player('p2'));
      game.startGame();
      finishInitialTexasPhase(game);

      const actorId = game.getGameState().pendingTexasDiscardPlayerId!;
      const otherId = actorId === 'p1' ? 'p2' : 'p1';
      const actor = game.getPlayer(actorId)!;
      if (actor.cards.length > 2) {
        expect(game.discardTexasCard(actorId, actor.cards[0].id)).toBe(true);
      }

      expect(game.exitTexasRound(actorId)).toBe(true);
      Math.random = () => 0;
      const result = game.fireGun(actorId);
      expect(result?.shot).toBe(true);
      game.resolvePenalty();

      expect(game.getGameState().gameStatus).toBe('ended');
      expect(game.getPlayer(actorId)?.score).toBe(-1);
      expect(game.getPlayer(otherId)?.score).toBe(1);
      expect(game.getGameState().texasRoundResult?.winnerIds[0]).toBe(otherId);
      expect(game.restartRoundFromSettlement()).toBe(true);
      expect(game.getGameState().gameStatus).toBe('playing');
      expect(game.getPlayers().every(player => !player.isEliminated)).toBe(true);
      expect(game.getPlayer(actorId)?.score).toBe(-1);
    } finally {
      Math.random = originalRandom;
    }
  });

  test('should allow matching the previous Texas bullet add but reject lower adds', () => {
    const game = new TexasShowdownGame();
    game.addPlayer(player('texas-match-1'));
    game.addPlayer(player('texas-match-2'));
    game.startGame();
    const firstActorId = game.getGameState().pendingTexasDiscardPlayerId!;
    const firstActor = game.getPlayer(firstActorId)!;
    expect(game.discardTexasCard(firstActorId, firstActor.cards[0].id)).toBe(true);
    expect(game.addBullets(firstActorId, 2)).toBe(true);
    expect(game.getGameState().lastAddedBullets).toBe(2);

    const secondActorId = game.getGameState().pendingTexasDiscardPlayerId!;
    expect(secondActorId).toBeDefined();
    const secondActor = game.getPlayer(secondActorId)!;
    expect(game.discardTexasCard(secondActorId, secondActor.cards[0].id)).toBe(true);
    expect(game.addBullets(secondActorId, 1)).toBe(false);
    expect(game.addBullets(secondActorId, 2)).toBe(true);
  });

  test('should create Texas settlement with final hands and hand categories', () => {
    const game = new TexasShowdownGame();
    game.addPlayer(player('texas-settle-1'));
    game.addPlayer(player('texas-settle-2'));
    game.startGame();
    finishInitialTexasPhase(game);

    finishTexasByAddingBullets(game);

    const settlement = game.getGameState().roundSettlement;
    const comparedHands = settlement?.hands.filter(hand => hand.isParticipant) || [];

    expect(game.getGameState().gameStatus).toBe('ended');
    expect(settlement?.gameMode).toBe('texasHoldem');
    expect(settlement?.communityCards?.length).toBe(5);
    expect(comparedHands.length).toBe(2);
    expect(comparedHands.every(hand => hand.cards.length === 2)).toBe(true);
    expect(comparedHands.every(hand => Boolean(hand.handCategory))).toBe(true);
  });

  test('should settle immediately after the river card is revealed', () => {
    const game = new TexasShowdownGame();
    game.addPlayer(player('texas-river-1'));
    game.addPlayer(player('texas-river-2'));
    game.startGame();

    finishInitialTexasPhase(game);
    expect(game.getGameState().communityCards.length).toBe(3);
    expect(game.getGameState().gameStatus).toBe('playing');

    finishInitialTexasPhase(game);
    expect(game.getGameState().communityCards.length).toBe(4);
    expect(game.getGameState().gameStatus).toBe('playing');

    finishInitialTexasPhase(game);
    expect(game.getGameState().communityCards.length).toBe(5);
    expect(game.getGameState().gameStatus).toBe('ended');
    expect(game.getGameState().texasStage).toBe('settlement');
    expect(game.getGameState().turnActorPlayerId).toBe(null);
    expect(game.getGameState().pendingTexasDiscardPlayerId).toBe(null);
  });

  test('should start at round 1 and rotate the Texas opening player on restart', () => {
    const game = new TexasShowdownGame();
    const originalRandom = Math.random;

    try {
      Math.random = () => 0.9;
      game.addPlayer(player('texas-rotate-1'));
      game.addPlayer(player('texas-rotate-2'));
      game.startGame();

      const firstStarterId = game.getGameState().pendingTexasDiscardPlayerId!;
      expect(game.getGameState().round).toBe(1);

      finishInitialTexasPhase(game);
      finishTexasByAddingBullets(game);

      expect(game.getGameState().roundSettlement?.round).toBe(1);
      expect(game.restartRoundFromSettlement()).toBe(true);
      expect(game.getGameState().round).toBe(2);
      expect(game.getGameState().pendingTexasDiscardPlayerId).toBe(firstStarterId === 'texas-rotate-1' ? 'texas-rotate-2' : 'texas-rotate-1');
    } finally {
      Math.random = originalRandom;
    }
  });

  test('should mark mid-game joins as spectators in Texas and keep them out of settlement participants', () => {
    const game = new TexasShowdownGame();
    game.addPlayer(player('spectator-texas-1'));
    game.addPlayer(player('spectator-texas-2'));
    game.startGame();

    expect(game.addPlayer(player('spectator-texas-join'))).toBe(true);
    const spectator = game.getPlayer('spectator-texas-join')!;
    expect(spectator.isActive).toBe(false);
    expect(spectator.gameState).toBe('waiting');
    expect(spectator.texasRoundState).toBe('waiting');
    expect(spectator.cards.length).toBe(0);

    finishInitialTexasPhase(game);
    finishTexasByAddingBullets(game);

    const participantIds = game.getGameState().texasRoundResult?.participantIds || [];
    expect(participantIds.includes('spectator-texas-join')).toBe(false);
  });
});
