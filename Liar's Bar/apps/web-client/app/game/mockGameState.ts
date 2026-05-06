import { Card, GameState, Player } from '@liars-bar/shared';

function card(id: string, rank: Card['rank'], suit?: Card['suit']): Card {
  return { id, rank, suit };
}

function mockPlayer(index: number, overrides: Partial<Player> = {}): Player {
  const names = ['你', '阿泽', '小满', 'Nina', '老周', 'Mika', 'Leo', '安安'];
  const bulletCount = [2, 1, 3, 0, 4, 2, 1, 5][index - 1] ?? 0;

  return {
    id: `mock-p${index}`,
    name: names[index - 1] || `玩家${index}`,
    cards: [],
    isEliminated: false,
    isActive: true,
    bullets: bulletCount,
    initialBullets: 0,
    score: [18, 12, 9, 7, 6, 4, 2, -1][index - 1] ?? 0,
    gameState: 'playing',
    isReady: true,
    isHost: index === 1,
    hasAddedBullets: index !== 4,
    bulletCount,
    totalChambers: 8,
    connectionStatus: index === 6 ? 'disconnected' : 'connected',
    ...overrides
  };
}

export function createFullTableMockGameState(): GameState {
  const players: Player[] = [
    mockPlayer(1, {
      cards: [
        card('mock-hand-1', 'Q', 'hearts'),
        card('mock-hand-2', 'Q', 'clubs'),
        card('mock-hand-3', '7', 'diamonds'),
        card('mock-hand-4', 'Joker'),
        card('mock-hand-5', '4', 'spades')
      ],
      hasAddedBullets: true
    }),
    mockPlayer(2, { cards: [card('mock-p2-1', '9', 'hearts'), card('mock-p2-2', 'K', 'spades')] }),
    mockPlayer(3, { cards: [card('mock-p3-1', 'Q', 'diamonds'), card('mock-p3-2', '6', 'clubs')] }),
    mockPlayer(4, { cards: [card('mock-p4-1', 'A', 'spades'), card('mock-p4-2', '2', 'clubs')], hasAddedBullets: false }),
    mockPlayer(5, { cards: [card('mock-p5-1', '8', 'hearts')] }),
    mockPlayer(6, { cards: [card('mock-p6-1', '5', 'clubs')], connectionStatus: 'disconnected' }),
    mockPlayer(7, { cards: [card('mock-p7-1', 'J', 'diamonds'), card('mock-p7-2', '3', 'spades')] }),
    mockPlayer(8, { cards: [card('mock-p8-1', '10', 'hearts')] })
  ];

  return {
    players,
    gameStatus: 'playing',
    mainCard: 'Q',
    currentPlayerIndex: 0,
    currentPlay: {
      playerId: 'mock-p3',
      cards: [card('mock-play-1', 'Q', 'diamonds'), card('mock-play-2', '6', 'clubs')],
      declaredCount: 2,
      isChallenged: false,
      challengeResult: null
    },
    playHistory: [],
    round: 3,
    winner: null,
    lastAddedBullets: 1,
    pendingPenaltyPlayerId: null,
    penaltyResult: null,
    penaltyAwardPlayerId: null,
    isSpinning: false,
    gameMode: 'liarsBar',
    communityCards: [],
    texasHoldemRound: 0,
    turnActorPlayerId: 'mock-p1',
    turnDeadlineAt: null,
    turnTimeoutMs: 30000,
    pendingTexasDiscardPlayerId: null,
    texasStage: 'idle',
    texasRoundResult: null,
    texasPendingWinnerScore: 0,
    roundSettlement: null,
    scoreboard: players.map((player) => ({
      playerId: player.id,
      name: player.name,
      score: player.score ?? 0,
      isActive: player.connectionStatus !== 'disconnected'
    }))
  };
}

function mockSettlementCards(index: number): Card[] {
  const rankSets: Card['rank'][][] = [
    ['Q', 'Q', 'Joker', 'A', 'K'],
    ['K', 'K', 'Q', 'A', 'Joker'],
    ['A', 'A', 'Q', 'K', 'Joker'],
    ['Q', 'K', 'A', 'Q', 'K'],
    ['K', 'A', 'Joker', 'Q', 'A'],
    ['A', 'Q', 'K', 'Joker', 'Q'],
    ['Q', 'A', 'K', 'K', 'Q'],
    ['Joker', 'A', 'Q', 'K', 'A']
  ];

  return (rankSets[index - 1] || rankSets[0]).map((rank, cardIndex) =>
    card(`mock-settlement-${index}-${cardIndex + 1}`, rank)
  );
}

export function createSettlementMockGameState(): GameState {
  const state = createFullTableMockGameState();
  const deltas = [8, 7, 6, 5, 4, 3, -1, 0];
  const players = state.players.map((player, index) => ({
    ...player,
    cards: mockSettlementCards(index + 1),
    score: (player.score ?? 0) + deltas[index],
    isEliminated: index === 6,
    isActive: index !== 6,
    gameState: index === 6 ? 'eliminated' as const : 'playing' as const
  }));

  return {
    ...state,
    players,
    gameStatus: 'ended',
    currentPlay: null,
    winner: players[0],
    turnActorPlayerId: null,
    pendingPenaltyPlayerId: null,
    roundSettlement: {
      id: 'liarsBar-mock-settlement-3',
      gameMode: 'liarsBar',
      round: 3,
      scoreDeltas: players.map((player, index) => ({
        playerId: player.id,
        delta: deltas[index],
        totalScore: player.score ?? 0
      })),
      hands: players.map((player, index) => ({
        playerId: player.id,
        cards: mockSettlementCards(index + 1),
        source: 'initial',
        isWinner: index === 0
      })),
      winnerIds: [players[0].id]
    },
    scoreboard: players.map((player) => ({
      playerId: player.id,
      name: player.name,
      score: player.score ?? 0,
      isActive: player.connectionStatus !== 'disconnected'
    }))
  };
}
