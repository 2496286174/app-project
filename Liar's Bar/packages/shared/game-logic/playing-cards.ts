export type Suit = 'spades' | 'hearts' | 'diamonds' | 'clubs';
export type Rank = 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K';
export type CardType = 'standard' | 'joker';
export type JokerType = 'red' | 'black';

export interface PlayingCard {
  id: string;
  type: CardType;
  suit?: Suit;
  rank?: Rank;
  jokerType?: JokerType;
  value: number;
  displayValue: string;
  color: 'red' | 'black';
}

export const SUITS: Suit[] = ['spades', 'hearts', 'diamonds', 'clubs'];
export const RANKS: Rank[] = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

export const SUIT_SYMBOLS: Record<Suit, string> = {
  spades: '♠',
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣'
};

export const SUIT_NAMES: Record<Suit, string> = {
  spades: '黑桃',
  hearts: '红桃',
  diamonds: '方块',
  clubs: '梅花'
};

export const RANK_VALUES: Record<Rank, number> = {
  'A': 1,
  '2': 2,
  '3': 3,
  '4': 4,
  '5': 5,
  '6': 6,
  '7': 7,
  '8': 8,
  '9': 9,
  '10': 10,
  'J': 11,
  'Q': 12,
  'K': 13
};

function generateCardId(type: CardType, suit?: Suit, rank?: Rank, jokerType?: JokerType): string {
  if (type === 'joker') {
    return `joker-${jokerType}`;
  }
  return `${suit}-${rank}`;
}

export function createStandardCard(suit: Suit, rank: Rank): PlayingCard {
  const isRed = suit === 'hearts' || suit === 'diamonds';
  return {
    id: generateCardId('standard', suit, rank),
    type: 'standard',
    suit,
    rank,
    value: RANK_VALUES[rank],
    displayValue: rank,
    color: isRed ? 'red' : 'black'
  };
}

export function createJokerCard(jokerType: JokerType): PlayingCard {
  return {
    id: generateCardId('joker', undefined, undefined, jokerType),
    type: 'joker',
    jokerType,
    value: jokerType === 'red' ? 15 : 14,
    displayValue: 'Joker',
    color: jokerType === 'red' ? 'red' : 'black'
  };
}

export function createFullDeck(): PlayingCard[] {
  const deck: PlayingCard[] = [];

  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push(createStandardCard(suit, rank));
    }
  }

  deck.push(createJokerCard('black'));
  deck.push(createJokerCard('red'));

  return deck;
}

export function createExtendedDeck(): PlayingCard[] {
  const deck = createFullDeck();
  const extraDeck = createFullDeck();
  return [...deck, ...extraDeck];
}

export function compareCards(card1: PlayingCard, card2: PlayingCard): number {
  if (card1.value !== card2.value) {
    return card1.value - card2.value;
  }

  if (card1.type === 'joker' && card2.type === 'joker') {
    return card1.jokerType === 'red' ? 1 : -1;
  }

  if (card1.type === 'joker') return 1;
  if (card2.type === 'joker') return -1;

  const suitOrder: Suit[] = ['clubs', 'diamonds', 'hearts', 'spades'];
  const suit1Index = suitOrder.indexOf(card1.suit!);
  const suit2Index = suitOrder.indexOf(card2.suit!);
  return suit1Index - suit2Index;
}

export function shuffleDeck<T>(deck: T[]): T[] {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export function getCardSymbol(card: PlayingCard): string {
  if (card.type === 'joker') {
    return '🃏';
  }
  return SUIT_SYMBOLS[card.suit!];
}
