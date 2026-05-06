import React from 'react';
import { Card } from '@liars-bar/shared';
import { HAND_CARD_METRICS } from './cardMetrics';
import { cardBorderClass, cardSelectedBorderClass, getCardSuitColorClass, getCardSuitSymbol } from './cardVisuals';

interface PlayerHandProps {
  cards: Card[];
  selectedCardIds: string[];
  onCardSelect: (cardId: string) => void;
  gameStatus: string;
  canSelect?: boolean;
  maxSelectable?: number;
  compact?: boolean;
}

const PlayerHand: React.FC<PlayerHandProps> = ({ cards, selectedCardIds, onCardSelect, gameStatus, canSelect, compact = false }) => {
  const isPlayable = canSelect ?? gameStatus === 'playing';
  const metrics = compact ? HAND_CARD_METRICS.compact : HAND_CARD_METRICS.regular;
  const handRowWidth = cards.length * metrics.width + Math.max(0, cards.length - 1) * metrics.gap;
  const gapTotal = Math.max(0, cards.length - 1) * metrics.gap;
  const cardWidth = cards.length > 0
    ? `min(${metrics.width}px, calc((100% - ${gapTotal}px) / ${cards.length}))`
    : `${metrics.width}px`;

  if (cards.length === 0) {
    return (
      <div className={`flex items-center justify-center px-2 text-[var(--text-soft)] ${compact ? 'min-h-[72px] text-[12px]' : 'min-h-[96px] text-sm'}`}>
        暂无手牌
      </div>
    );
  }

  return (
    <div className={`flex w-full justify-center overflow-visible ${compact ? 'px-0.5 py-0.5' : 'px-1 py-1'}`}>
      <div className="mx-auto flex w-full max-w-full items-start justify-center overflow-visible" style={{ gap: `${metrics.gap}px`, maxWidth: `${handRowWidth}px` }}>
        {cards.map((card) => {
          const isSelected = selectedCardIds.includes(card.id);
          const suitColor = getCardSuitColorClass(card.suit);
          const isJoker = `${card.rank}`.toLowerCase() === 'joker';
          const suitSymbol = getCardSuitSymbol(card.suit);

          return (
            <div
              key={card.id}
              onClick={() => isPlayable && onCardSelect(card.id)}
              className={`relative flex shrink-0 cursor-pointer flex-col items-center justify-center overflow-hidden rounded-[8px] border bg-[var(--card-face)] ${compact ? 'px-1' : 'px-2'} text-[var(--navy)] shadow-[var(--card-shadow)] transition-all ${
                isSelected
                  ? `${metrics.selectedOffsetClass} ${cardSelectedBorderClass} bg-[linear-gradient(180deg,var(--card-face),var(--surface-warm))] shadow-[var(--card-selected-shadow)]`
                  : cardBorderClass
              } ${isPlayable ? 'active:scale-[0.98]' : 'cursor-default opacity-80'}`}
              style={{ width: cardWidth, aspectRatio: `${metrics.width} / ${metrics.height}` }}
              aria-disabled={!isPlayable}
              aria-pressed={isSelected}
            >
              {suitSymbol ? (
                <span className={`absolute left-1 top-1 font-semibold leading-none ${metrics.cornerSuitClass} ${suitColor}`}>
                  {suitSymbol}
                </span>
              ) : null}
              {isSelected ? (
                <span aria-hidden="true" className={`absolute right-1 top-1 rounded-full bg-[var(--peach)] shadow-[0_0_0_2px_var(--surface-strong)] ${compact ? 'size-2' : 'size-2.5'}`} />
              ) : null}
              {isJoker ? (
                <div className={`flex flex-col items-center justify-center font-bold leading-none ${metrics.jokerClass} ${suitColor}`}>
                  {`${card.rank}`.split('').map((letter, index) => (
                    <span key={`${card.id}-${index}`} className="block">
                      {letter}
                    </span>
                  ))}
                </div>
              ) : (
                <>
                  <div className={`${metrics.rankClass} font-bold leading-none ${suitColor}`}>{card.rank}</div>
                  {suitSymbol ? <div className={`${metrics.suitClass} leading-none ${suitColor}`}>{suitSymbol}</div> : null}
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default PlayerHand;
