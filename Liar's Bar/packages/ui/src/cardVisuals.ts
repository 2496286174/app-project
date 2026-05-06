export type CardSuitName = 'spades' | 'hearts' | 'diamonds' | 'clubs';

export const CARD_SUIT_SYMBOLS: Record<CardSuitName, string> = {
  spades: '♠',
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣'
};

const CARD_SUIT_COLOR_CLASSES: Record<CardSuitName, string> = {
  spades: 'text-[var(--card-spades)]',
  hearts: 'text-[var(--card-hearts)]',
  diamonds: 'text-[var(--card-diamonds)]',
  clubs: 'text-[var(--card-clubs)]'
};

export const cardBorderClass = 'border-[var(--card-border)]';
export const cardSelectedBorderClass = 'border-[var(--card-border-selected)]';

function isCardSuitName(suit: string | null | undefined): suit is CardSuitName {
  return suit === 'spades' || suit === 'hearts' || suit === 'diamonds' || suit === 'clubs';
}

export function getCardSuitSymbol(suit: string | null | undefined): string {
  return isCardSuitName(suit) ? CARD_SUIT_SYMBOLS[suit] : '';
}

export function getCardSuitColorClass(
  suit: string | null | undefined,
  fallbackColor?: 'red' | 'black'
): string {
  if (isCardSuitName(suit)) {
    return CARD_SUIT_COLOR_CLASSES[suit];
  }

  return fallbackColor === 'red'
    ? 'text-[var(--card-joker-red)]'
    : 'text-[var(--card-joker-black)]';
}
