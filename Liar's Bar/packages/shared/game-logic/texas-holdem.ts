import { Card, CardRank } from './types';

export type TexasHandCategory =
  | 'highCard'
  | 'onePair'
  | 'twoPair'
  | 'threeOfAKind'
  | 'straight'
  | 'flush'
  | 'fullHouse'
  | 'fourOfAKind'
  | 'straightFlush'
  | 'royalFlush';

export interface TexasHandEvaluation {
  category: TexasHandCategory;
  categoryRank: number;
  ranks: number[];
  cards: Card[];
}

export interface TexasPlayerHandInput {
  playerId: string;
  cards: Card[];
}

export interface TexasPlayerHandEvaluation extends TexasHandEvaluation {
  playerId: string;
}

export const TEXAS_HAND_CATEGORY_RANKS: Record<TexasHandCategory, number> = {
  highCard: 0,
  onePair: 1,
  twoPair: 2,
  threeOfAKind: 3,
  straight: 4,
  flush: 5,
  fullHouse: 6,
  fourOfAKind: 7,
  straightFlush: 8,
  royalFlush: 9
};

const RANK_VALUES: Record<Exclude<CardRank, 'Joker'>, number> = {
  '2': 2,
  '3': 3,
  '4': 4,
  '5': 5,
  '6': 6,
  '7': 7,
  '8': 8,
  '9': 9,
  '10': 10,
  J: 11,
  Q: 12,
  K: 13,
  A: 14
};

function getRankValue(rank: CardRank): number {
  if (rank === 'Joker') {
    throw new Error('Texas Holdem does not support Joker cards');
  }

  return RANK_VALUES[rank];
}

function assertTexasCards(cards: Card[]): void {
  if (cards.length < 5 || cards.length > 7) {
    throw new Error('Texas Holdem evaluation requires 5 to 7 cards');
  }

  for (const card of cards) {
    if (card.rank === 'Joker') {
      throw new Error('Texas Holdem does not support Joker cards');
    }
    if (!card.suit) {
      throw new Error('Texas Holdem cards must include suits');
    }
  }
}

function getFiveCardCombinations(cards: Card[]): Card[][] {
  const combinations: Card[][] = [];

  for (let a = 0; a < cards.length - 4; a++) {
    for (let b = a + 1; b < cards.length - 3; b++) {
      for (let c = b + 1; c < cards.length - 2; c++) {
        for (let d = c + 1; d < cards.length - 1; d++) {
          for (let e = d + 1; e < cards.length; e++) {
            combinations.push([cards[a], cards[b], cards[c], cards[d], cards[e]]);
          }
        }
      }
    }
  }

  return combinations;
}

function sortRanksDesc(ranks: number[]): number[] {
  return [...ranks].sort((a, b) => b - a);
}

function getStraightHighCard(ranks: number[]): number | null {
  const uniqueRanks = Array.from(new Set(ranks));

  if (uniqueRanks.length !== 5) {
    return null;
  }

  const sorted = sortRanksDesc(uniqueRanks);
  const isWheel = sorted[0] === 14 && sorted[1] === 5 && sorted[2] === 4 && sorted[3] === 3 && sorted[4] === 2;

  if (isWheel) {
    return 5;
  }

  return sorted[0] - sorted[4] === 4 ? sorted[0] : null;
}

function createEvaluation(category: TexasHandCategory, ranks: number[], cards: Card[]): TexasHandEvaluation {
  return {
    category,
    categoryRank: TEXAS_HAND_CATEGORY_RANKS[category],
    ranks,
    cards
  };
}

function evaluateFiveCardHand(cards: Card[]): TexasHandEvaluation {
  const ranks = cards.map(card => getRankValue(card.rank));
  const sortedRanks = sortRanksDesc(ranks);
  const isFlush = cards.every(card => card.suit === cards[0].suit);
  const straightHighCard = getStraightHighCard(ranks);

  if (isFlush && straightHighCard === 14) {
    return createEvaluation('royalFlush', [14], cards);
  }

  if (isFlush && straightHighCard !== null) {
    return createEvaluation('straightFlush', [straightHighCard], cards);
  }

  const rankCounts = new Map<number, number>();
  for (const rank of ranks) {
    rankCounts.set(rank, (rankCounts.get(rank) || 0) + 1);
  }

  const groups = Array.from(rankCounts.entries())
    .map(([rank, count]) => ({ rank, count }))
    .sort((a, b) => b.count - a.count || b.rank - a.rank);

  if (groups[0].count === 4) {
    const kicker = groups.find(group => group.count === 1)!.rank;
    return createEvaluation('fourOfAKind', [groups[0].rank, kicker], cards);
  }

  if (groups[0].count === 3 && groups[1].count === 2) {
    return createEvaluation('fullHouse', [groups[0].rank, groups[1].rank], cards);
  }

  if (isFlush) {
    return createEvaluation('flush', sortedRanks, cards);
  }

  if (straightHighCard !== null) {
    return createEvaluation('straight', [straightHighCard], cards);
  }

  if (groups[0].count === 3) {
    const kickers = groups
      .filter(group => group.count === 1)
      .map(group => group.rank)
      .sort((a, b) => b - a);
    return createEvaluation('threeOfAKind', [groups[0].rank, ...kickers], cards);
  }

  if (groups[0].count === 2 && groups[1].count === 2) {
    const pairs = groups
      .filter(group => group.count === 2)
      .map(group => group.rank)
      .sort((a, b) => b - a);
    const kicker = groups.find(group => group.count === 1)!.rank;
    return createEvaluation('twoPair', [...pairs, kicker], cards);
  }

  if (groups[0].count === 2) {
    const kickers = groups
      .filter(group => group.count === 1)
      .map(group => group.rank)
      .sort((a, b) => b - a);
    return createEvaluation('onePair', [groups[0].rank, ...kickers], cards);
  }

  return createEvaluation('highCard', sortedRanks, cards);
}

export function compareTexasHandEvaluations(a: TexasHandEvaluation, b: TexasHandEvaluation): number {
  if (a.categoryRank !== b.categoryRank) {
    return Math.sign(a.categoryRank - b.categoryRank);
  }

  const maxLength = Math.max(a.ranks.length, b.ranks.length);
  for (let i = 0; i < maxLength; i++) {
    const aRank = a.ranks[i] || 0;
    const bRank = b.ranks[i] || 0;
    if (aRank !== bRank) {
      return Math.sign(aRank - bRank);
    }
  }

  return 0;
}

export function evaluateTexasHoldemHand(cards: Card[]): TexasHandEvaluation {
  assertTexasCards(cards);

  let bestHand: TexasHandEvaluation | null = null;

  for (const combination of getFiveCardCombinations(cards)) {
    const evaluated = evaluateFiveCardHand(combination);
    if (!bestHand || compareTexasHandEvaluations(evaluated, bestHand) > 0) {
      bestHand = evaluated;
    }
  }

  return bestHand!;
}

export function compareTexasHoldemHands(aCards: Card[], bCards: Card[]): number {
  return compareTexasHandEvaluations(
    evaluateTexasHoldemHand(aCards),
    evaluateTexasHoldemHand(bCards)
  );
}

export function rankTexasHoldemPlayers(players: TexasPlayerHandInput[]): TexasPlayerHandEvaluation[] {
  return players
    .map(player => ({
      playerId: player.playerId,
      ...evaluateTexasHoldemHand(player.cards)
    }))
    .sort((a, b) => compareTexasHandEvaluations(b, a));
}

export function getTexasHoldemWinners(players: TexasPlayerHandInput[]): TexasPlayerHandEvaluation[] {
  if (players.length === 0) {
    return [];
  }

  const rankedPlayers = rankTexasHoldemPlayers(players);
  const bestHand = rankedPlayers[0];
  return rankedPlayers.filter(player => compareTexasHandEvaluations(player, bestHand) === 0);
}
