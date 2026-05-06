import React from 'react';
import { Card, CardRank, GameMode } from '@liars-bar/shared';
import { COMMUNITY_CARD_METRICS, type CommunityCardMetrics, GAME_LAYOUT_METRICS } from './cardMetrics';
import { cardBorderClass, cardSelectedBorderClass, getCardSuitColorClass, getCardSuitSymbol } from './cardVisuals';

interface CommunityCardsProps {
  gameMode: GameMode;
  communityCards: Card[];
  currentPlay: {
    playerId?: string;
    cards?: Card[];
    declaredCount?: number;
    isChallenged?: boolean;
  } | null;
  mainCard: CardRank | { rank?: CardRank } | null;
  texasHoldemRound: number;
  texasStage?: string;
  gameStatus: string;
  compact?: boolean;
}

function getMainCardRank(mainCard: CommunityCardsProps['mainCard']): string {
  if (!mainCard) {
    return '';
  }

  if (typeof mainCard === 'string') {
    return mainCard;
  }

  return mainCard.rank || '';
}

function renderSizedCard(
  card: Card | { rank?: string; suit?: string } | null,
  key: React.Key,
  metrics: CommunityCardMetrics,
  options?: { declared?: boolean }
) {
  if (!card?.rank) {
    return null;
  }

  const suitSymbol = getCardSuitSymbol(card.suit);
  const suitColor = getCardSuitColorClass(card.suit);
  const isJoker = `${card.rank}`.toLowerCase() === 'joker';

  return (
    <div
      key={key}
      className={`relative flex shrink-0 flex-col items-center justify-center rounded-[8px] border px-1.5 text-[var(--navy)] shadow-[var(--card-shadow)] ${
        options?.declared
          ? `${cardSelectedBorderClass} bg-[linear-gradient(180deg,var(--surface-strong),var(--sky-surface))]`
          : `${cardBorderClass} bg-[var(--card-face)]`
      }`}
      style={{ width: `${metrics.width}px`, height: `${metrics.height}px` }}
    >
      {options?.declared ? (
        <span className={`absolute bg-[var(--surface-glass)] font-semibold text-[var(--teal)] ${metrics.declaredBadgeClass}`}>
          声明
        </span>
      ) : null}
      {isJoker ? (
        <div className={`flex flex-col items-center justify-center font-bold leading-none ${metrics.jokerClass} ${suitColor}`}>
          {`${card.rank}`.split('').map((letter, index) => (
            <span key={`${String(key)}-${index}`} className="block">
              {letter}
            </span>
          ))}
        </div>
      ) : (
        <>
          <div className={`font-bold leading-none ${metrics.rankClass} ${suitColor}`}>{card.rank}</div>
          {suitSymbol ? <div className={`leading-none ${metrics.suitClass} ${suitColor}`}>{suitSymbol}</div> : null}
        </>
      )}
    </div>
  );
}

function renderCard(card: Card | { rank?: string; suit?: string } | null, key: React.Key, options?: { declared?: boolean }) {
  return renderSizedCard(card, key, COMMUNITY_CARD_METRICS.regular, options);
}

function renderCompactCard(card: Card | { rank?: string; suit?: string } | null, key: React.Key, options?: { declared?: boolean }) {
  return renderSizedCard(card, key, COMMUNITY_CARD_METRICS.compact, options);
}

const CommunityCards: React.FC<CommunityCardsProps> = ({
  gameMode,
  communityCards,
  currentPlay,
  mainCard,
  compact = false
}) => {
  const activeMetrics = compact ? COMMUNITY_CARD_METRICS.compact : COMMUNITY_CARD_METRICS.regular;
  const activeLayoutMetrics = compact ? GAME_LAYOUT_METRICS.compact : GAME_LAYOUT_METRICS.regular;
  const playedCards = Array.isArray(currentPlay?.cards) ? currentPlay.cards : [];
  const mainCardRank = getMainCardRank(mainCard);
  const shouldHideActualPlayedCards = gameMode === 'liarsBar' && Boolean(currentPlay) && !currentPlay?.isChallenged;
  const displayedPlayedCards = shouldHideActualPlayedCards && mainCardRank
    ? Array.from({ length: currentPlay?.declaredCount || playedCards.length }, (_, index) => ({
        id: `declared-${currentPlay?.playerId || 'play'}-${index}`,
        rank: mainCardRank as CardRank
      }))
    : playedCards;
  const hasPlayedCards = displayedPlayedCards.length > 0;
  const wellClass = `flex flex-wrap items-center justify-center rounded-[8px] bg-[linear-gradient(180deg,rgba(255,255,255,0.72),var(--table-slot-glow))] ${compact ? 'px-1.5 py-1.5' : 'px-2 py-2 sm:px-3'}`;

  return (
    <div className="w-full">
      {gameMode === 'liarsBar' ? (
        <div
          className={wellClass}
          style={{ minHeight: `${activeLayoutMetrics.communityWellMinHeight}px`, gap: `${activeMetrics.gap}px` }}
        >
          {hasPlayedCards
            ? displayedPlayedCards.map((card: Card, index: number) => compact ? renderCompactCard(card, card.id || index, { declared: shouldHideActualPlayedCards }) : renderCard(card, card.id || index, { declared: shouldHideActualPlayedCards }))
            : <div className={`w-full text-center text-[var(--text-soft)] ${compact ? 'text-[12px]' : 'text-sm'}`}>等待玩家出牌</div>}
        </div>
      ) : (
        <div
          className={wellClass}
          style={{ minHeight: `${activeLayoutMetrics.communityWellMinHeight}px`, gap: `${activeMetrics.gap}px` }}
        >
          {communityCards.length > 0
            ? communityCards.map((card, index) => compact ? renderCompactCard(card, card.id || index) : renderCard(card, card.id || index))
            : <div className={`w-full text-center text-[var(--text-soft)] ${compact ? 'text-[12px]' : 'text-sm'}`}>等待公共牌发出</div>}
        </div>
      )}
    </div>
  );
};

export default CommunityCards;
