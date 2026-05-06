import {
  PlayingCard,
  createFullDeck,
  createExtendedDeck,
  shuffleDeck,
  compareCards
} from './playing-cards';

export class Deck {
  private cards: PlayingCard[];
  private discardPile: PlayingCard[];

  constructor(useExtendedDeck: boolean = false) {
    this.cards = useExtendedDeck ? createExtendedDeck() : createFullDeck();
    this.discardPile = [];
    this.shuffle();
  }

  shuffle(): void {
    this.cards = shuffleDeck(this.cards);
  }

  deal(count: number = 1): PlayingCard[] {
    if (count <= 0) return [];
    if (this.cards.length < count) {
      this.reshuffleDiscardPile();
    }
    const dealt = this.cards.splice(0, Math.min(count, this.cards.length));
    return dealt;
  }

  dealOne(): PlayingCard | null {
    const cards = this.deal(1);
    return cards.length > 0 ? cards[0] : null;
  }

  discard(card: PlayingCard): void {
    this.discardPile.push(card);
  }

  discardMany(cards: PlayingCard[]): void {
    this.discardPile.push(...cards);
  }

  private reshuffleDiscardPile(): void {
    if (this.discardPile.length > 0) {
      const shuffledDiscards = shuffleDeck(this.discardPile);
      this.cards = [...this.cards, ...shuffledDiscards];
      this.discardPile = [];
    }
  }

  get remainingCount(): number {
    return this.cards.length;
  }

  get discardCount(): number {
    return this.discardPile.length;
  }

  reset(useExtendedDeck: boolean = false): void {
    this.cards = useExtendedDeck ? createExtendedDeck() : createFullDeck();
    this.discardPile = [];
    this.shuffle();
  }

  static sortCards(cards: PlayingCard[]): PlayingCard[] {
    return [...cards].sort(compareCards);
  }

  static compare(card1: PlayingCard, card2: PlayingCard): number {
    return compareCards(card1, card2);
  }
}
