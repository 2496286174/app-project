import React from 'react';
import { PlayingCard as PlayingCardType, SUIT_SYMBOLS } from '@liars-bar/shared';
import { cardBorderClass, cardSelectedBorderClass, getCardSuitColorClass } from './cardVisuals';

interface PlayingCardProps {
  card: PlayingCardType;
  size?: 'small' | 'medium' | 'large';
  faceDown?: boolean;
  onClick?: () => void;
  selected?: boolean;
  disabled?: boolean;
}

const PlayingCard: React.FC<PlayingCardProps> = ({
  card,
  size = 'medium',
  faceDown = false,
  onClick,
  selected = false,
  disabled = false
}) => {
  const sizeClasses = {
    small: 'w-12 h-18',
    medium: 'w-20 h-28',
    large: 'w-28 h-40'
  };

  const textSizes = {
    small: 'text-xs',
    medium: 'text-sm',
    large: 'text-lg'
  };

  const symbolSizes = {
    small: 'text-lg',
    medium: 'text-2xl',
    large: 'text-4xl'
  };

  const colorClasses = getCardSuitColorClass(card.suit, card.color);

  if (faceDown) {
    return (
      <div
        className={`
          ${sizeClasses[size]}
          rounded-[8px] border ${cardBorderClass}
          bg-[linear-gradient(135deg,var(--sky-blue),var(--sky-surface)_58%,var(--sun-wash))]
          flex items-center justify-center
          cursor-pointer transition-all duration-200
          shadow-[var(--card-shadow)]
          ${selected ? `ring-4 ring-[var(--ring-sun)] transform -translate-y-2 shadow-[var(--card-selected-shadow)] ${cardSelectedBorderClass}` : ''}
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:shadow-lg hover:-translate-y-1'}
        `}
        onClick={!disabled ? onClick : undefined}
      >
        <div className="flex h-3/4 w-3/4 items-center justify-center rounded-[8px] border border-[var(--line-warm)] bg-[var(--surface-glass)]">
          <div className="h-1/2 w-1/2 rounded-[8px] border border-[var(--line-bright)]" />
        </div>
      </div>
    );
  }

  if (card.type === 'joker') {
    return (
      <div
        className={`
          ${sizeClasses[size]}
          rounded-[8px] border ${cardBorderClass}
          bg-[var(--card-face)]
          flex flex-col items-center justify-between p-1
          cursor-pointer transition-all duration-200
          shadow-[var(--card-shadow)]
          ${selected ? `ring-4 ring-[var(--ring-sun)] transform -translate-y-2 shadow-[var(--card-selected-shadow)] ${cardSelectedBorderClass}` : ''}
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:shadow-lg hover:-translate-y-1'}
          relative overflow-hidden
        `}
        onClick={!disabled ? onClick : undefined}
      >
        <div className={`self-start ${textSizes[size]} font-bold ${colorClasses}`}>
          🃏
        </div>
        <div className={`${symbolSizes[size]}`}>
          🃏
        </div>
        <div className={`self-end transform rotate-180 ${textSizes[size]} font-bold ${colorClasses}`}>
          🃏
        </div>
        <div className={`absolute inset-0 flex items-center justify-center ${textSizes[size]} font-bold ${colorClasses} opacity-10`}>
          JOKER
        </div>
      </div>
    );
  }

  const suitSymbol = SUIT_SYMBOLS[card.suit!];

  return (
    <div
      className={`
        ${sizeClasses[size]}
        rounded-[8px] border ${cardBorderClass}
        bg-[var(--card-face)]
        flex flex-col items-center justify-between p-1
        cursor-pointer transition-all duration-200
        shadow-[var(--card-shadow)]
        ${selected ? `ring-4 ring-[var(--ring-sun)] transform -translate-y-2 shadow-[var(--card-selected-shadow)] ${cardSelectedBorderClass}` : ''}
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:shadow-lg hover:-translate-y-1'}
        relative overflow-hidden
      `}
      onClick={!disabled ? onClick : undefined}
    >
      <div className="self-start flex flex-col items-center">
        <span className={`${textSizes[size]} font-bold ${colorClasses}`}>
          {card.displayValue}
        </span>
        <span className={`${textSizes[size]} ${colorClasses}`}>
          {suitSymbol}
        </span>
      </div>

      <div className={`${symbolSizes[size]} ${colorClasses}`}>
        {suitSymbol}
      </div>

      <div className="self-end transform rotate-180 flex flex-col items-center">
        <span className={`${textSizes[size]} font-bold ${colorClasses}`}>
          {card.displayValue}
        </span>
        <span className={`${textSizes[size]} ${colorClasses}`}>
          {suitSymbol}
        </span>
      </div>
    </div>
  );
};

export default PlayingCard;
