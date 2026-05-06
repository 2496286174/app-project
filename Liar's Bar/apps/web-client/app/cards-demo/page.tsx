'use client';

import React, { useState } from 'react';
import {
  createFullDeck,
  Deck,
  PlayingCard as PlayingCardType,
  SUIT_NAMES
} from '@liars-bar/shared';
import { PlayingCard } from '@liars-bar/ui';

export default function CardsDemoPage() {
  const [deck] = useState(() => new Deck());
  const [fullDeck] = useState(() => createFullDeck());
  const [hand, setHand] = useState<PlayingCardType[]>([]);
  const [selectedCards, setSelectedCards] = useState<string[]>([]);
  const [shuffledDeck, setShuffledDeck] = useState<PlayingCardType[]>(() => Deck.sortCards(createFullDeck()));

  const handleDeal = () => {
    const newCards = deck.deal(5);
    setHand(prev => [...prev, ...newCards]);
  };

  const handleShuffle = () => {
    const newShuffledDeck = createFullDeck();
    for (let i = newShuffledDeck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [newShuffledDeck[i], newShuffledDeck[j]] = [newShuffledDeck[j], newShuffledDeck[i]];
    }
    setShuffledDeck(newShuffledDeck);
  };

  const handleSort = () => {
    setShuffledDeck(Deck.sortCards([...shuffledDeck]));
  };

  const handleReset = () => {
    deck.reset();
    setHand([]);
    setSelectedCards([]);
    setShuffledDeck(Deck.sortCards(createFullDeck()));
  };

  const toggleCardSelection = (cardId: string) => {
    setSelectedCards(prev =>
      prev.includes(cardId)
        ? prev.filter(id => id !== cardId)
        : [...prev, cardId]
    );
  };

  const groupBySuit = (cards: PlayingCardType[]) => {
    const groups: Record<string, PlayingCardType[]> = {
      spades: [],
      hearts: [],
      diamonds: [],
      clubs: [],
      jokers: []
    };

    cards.forEach(card => {
      if (card.type === 'joker') {
        groups.jokers.push(card);
      } else if (card.suit) {
        groups[card.suit].push(card);
      }
    });

    return groups;
  };

  const groupedCards = groupBySuit(fullDeck);

  return (
    <div className="min-h-dvh bg-[var(--background)] p-4 text-[var(--navy)] sm:p-8 [@media(orientation:landscape)_and_(max-height:500px)]:p-3">
      <div className="mx-auto max-w-7xl">
        <h1 className="mb-8 text-center text-4xl font-semibold text-[var(--navy)] [@media(orientation:landscape)_and_(max-height:500px)]:mb-4 [@media(orientation:landscape)_and_(max-height:500px)]:text-3xl">扑克牌模块演示</h1>

        <div className="mb-8 rounded-[8px] border border-[var(--line)] bg-[var(--surface)] p-6 shadow-[var(--shadow-card)] backdrop-blur-xl [@media(orientation:landscape)_and_(max-height:500px)]:mb-4 [@media(orientation:landscape)_and_(max-height:500px)]:p-4">
          <h2 className="mb-4 text-2xl font-semibold">操作面板</h2>
          <div className="flex flex-wrap gap-4">
            <button
              onClick={handleDeal}
              className="min-h-11 rounded-[8px] border border-[var(--ink)] bg-[var(--ink)] px-6 py-3 font-semibold text-[var(--paper)] transition hover:brightness-110"
            >
              发5张牌
            </button>
            <button
              onClick={handleShuffle}
              className="min-h-11 rounded-[8px] border border-[var(--line-strong)] bg-[var(--surface-strong)] px-6 py-3 font-semibold text-[var(--navy)] transition hover:bg-[var(--muted)]"
            >
              洗牌
            </button>
            <button
              onClick={handleSort}
              className="min-h-11 rounded-[8px] border border-[var(--line-strong)] bg-[var(--surface-strong)] px-6 py-3 font-semibold text-[var(--navy)] transition hover:bg-[var(--muted)]"
            >
              排序
            </button>
            <button
              onClick={handleReset}
              className="min-h-11 rounded-[8px] border border-[var(--ink)] bg-[var(--ink)] px-6 py-3 font-semibold text-[var(--paper)] transition hover:brightness-110"
            >
              重置
            </button>
          </div>
          <div className="mt-4 text-[var(--text-soft)]">
            <p>牌组剩余: {deck.remainingCount} 张</p>
            <p>弃牌堆: {deck.discardCount} 张</p>
          </div>
        </div>

        {hand.length > 0 && (
          <div className="mb-8 rounded-[8px] border border-[var(--line)] bg-[var(--surface)] p-6 shadow-[var(--shadow-card)] backdrop-blur-xl">
            <h2 className="mb-4 text-2xl font-semibold">你的手牌</h2>
            <div className="flex flex-wrap gap-4 justify-center">
              {hand.map((card, index) => (
                <PlayingCard
                  key={`${card.id}-${index}`}
                  card={card}
                  size="medium"
                  selected={selectedCards.includes(card.id)}
                  onClick={() => toggleCardSelection(card.id)}
                />
              ))}
            </div>
            <p className="mt-4 text-[var(--text-soft)]">已选择: {selectedCards.length} 张</p>
          </div>
        )}

        <div className="mb-8 rounded-[8px] border border-[var(--line)] bg-[var(--surface)] p-6 shadow-[var(--shadow-card)] backdrop-blur-xl">
          <h2 className="mb-4 text-2xl font-semibold">完整牌组 (54张)</h2>
          {Object.entries(groupedCards).map(([suit, cards]) => (
            cards.length > 0 && (
              <div key={suit} className="mb-6">
                <h3 className="mb-3 text-xl font-semibold text-[var(--teal)]">
                  {suit === 'jokers' ? '百搭牌 (Jokers)' : SUIT_NAMES[suit as any]}
                </h3>
                <div className="flex flex-wrap gap-3">
                  {Deck.sortCards(cards).map((card) => (
                    <PlayingCard
                      key={card.id}
                      card={card}
                      size="small"
                    />
                  ))}
                </div>
              </div>
            )
          ))}
        </div>

        <div className="rounded-[8px] border border-[var(--line)] bg-[var(--surface)] p-6 shadow-[var(--shadow-card)] backdrop-blur-xl">
          <h2 className="mb-4 text-2xl font-semibold">洗牌演示</h2>
          <div className="flex flex-wrap gap-2 justify-center">
            {shuffledDeck.map((card, index) => (
              <PlayingCard
                key={`${card.id}-${index}`}
                card={card}
                size="small"
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
