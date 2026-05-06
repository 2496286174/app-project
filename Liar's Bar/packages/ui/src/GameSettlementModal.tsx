import React, { useMemo } from 'react';
import { Card, Player, RoundSettlement, RoundSettlementHand } from '@liars-bar/shared';
import { buttonStyles, modalStyles } from './styles';
import { cardBorderClass, getCardSuitColorClass, getCardSuitSymbol } from './cardVisuals';

interface GameSettlementModalProps {
  isVisible: boolean;
  settlement: RoundSettlement | null | undefined;
  players: Player[];
  currentPlayerId?: string | null;
  isHost: boolean;
  isLoading: boolean;
  onClose: () => void;
  onRestartRound: () => void;
}

const HAND_CATEGORY_LABELS: Record<string, string> = {
  royalFlush: '皇家同花顺',
  straightFlush: '同花顺',
  fourOfAKind: '四条',
  fullHouse: '葫芦',
  flush: '同花',
  straight: '顺子',
  threeOfAKind: '三条',
  twoPair: '两对',
  onePair: '一对',
  highCard: '高牌'
};

const SUIT_LABELS: Record<string, string> = {
  hearts: '红桃',
  diamonds: '方片',
  clubs: '梅花',
  spades: '黑桃'
};

function cardLabel(card: Card): string {
  const suitSymbol = getCardSuitSymbol(card.suit);
  return card.suit ? `${card.rank} ${suitSymbol || SUIT_LABELS[card.suit] || card.suit}` : card.rank;
}

function handCategoryLabel(hand: RoundSettlementHand): string {
  if (hand.handCategory) {
    return HAND_CATEGORY_LABELS[hand.handCategory] || hand.handCategory;
  }

  if (hand.isParticipant) {
    return '未摊牌获胜';
  }

  if (hand.texasLastAction === 'exitShot') return '中弹离场';
  if (hand.texasLastAction === 'exitSafe') return '安全离场';
  return '未参与比牌';
}

function scoreDeltaLabel(delta: number): string {
  return delta > 0 ? `+${delta}` : `${delta}`;
}

function scoreDeltaTone(delta: number): string {
  if (delta > 0) return 'text-[var(--teal)]';
  if (delta < 0) return 'text-[var(--destructive)]';
  return 'text-[var(--text-soft)]';
}

export default function GameSettlementModal({
  isVisible,
  settlement,
  players,
  currentPlayerId,
  isHost,
  isLoading,
  onClose,
  onRestartRound
}: GameSettlementModalProps) {
  const playerById = useMemo(() => new Map(players.map(player => [player.id, player])), [players]);
  const scoreByPlayerId = useMemo(
    () => new Map((settlement?.scoreDeltas || []).map(score => [score.playerId, score])),
    [settlement?.scoreDeltas]
  );

  const sortedHands = useMemo(() => {
    if (!settlement) return [];
    return [...settlement.hands].sort((a, b) => {
      if (a.isWinner !== b.isWinner) return a.isWinner ? -1 : 1;

      if (settlement.gameMode === 'texasHoldem') {
        if (a.isParticipant !== b.isParticipant) return a.isParticipant ? -1 : 1;
        const rankA = a.compareRank ?? 99;
        const rankB = b.compareRank ?? 99;
        if (rankA !== rankB) return rankA - rankB;
        if (a.isWinner !== b.isWinner) return a.isWinner ? -1 : 1;
      }

      const scoreA = scoreByPlayerId.get(a.playerId);
      const scoreB = scoreByPlayerId.get(b.playerId);
      if (scoreA && scoreB && scoreB.delta !== scoreA.delta) return scoreB.delta - scoreA.delta;
      if (scoreA && scoreB && scoreB.totalScore !== scoreA.totalScore) return scoreB.totalScore - scoreA.totalScore;

      const aName = playerById.get(a.playerId)?.name || a.playerId;
      const bName = playerById.get(b.playerId)?.name || b.playerId;
      return aName.localeCompare(bName, 'zh-Hans-CN');
    });
  }, [playerById, scoreByPlayerId, settlement]);

  if (!isVisible || !settlement) {
    return null;
  }

  const isTexasHoldem = settlement.gameMode === 'texasHoldem';
  const modeLabel = isTexasHoldem ? '德州扑克' : '骗子酒馆';
  const handSectionTitle = isTexasHoldem ? '最终手牌与比牌' : '初始手牌';
  const playerCountLabel = `${sortedHands.length} 人`;

  return (
    <div className={modalStyles.overlay} role="presentation" onClick={onClose}>
      <div
        className={`${modalStyles.container} flex max-h-[88dvh] flex-col overflow-hidden p-0 [@media(orientation:landscape)]:h-[calc(100dvh-12px)] [@media(orientation:landscape)]:max-h-[calc(100dvh-12px)] [@media(orientation:landscape)]:max-w-[min(98vw,1120px)] [@media(orientation:landscape)_and_(max-height:500px)]:h-[calc(100dvh-8px)] [@media(orientation:landscape)_and_(max-height:500px)]:max-h-[calc(100dvh-8px)]`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="settlement-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="shrink-0 border-b border-[var(--line)] px-5 py-4 [@media(orientation:landscape)]:px-4 [@media(orientation:landscape)]:py-3 [@media(orientation:landscape)_and_(max-height:500px)]:px-3 [@media(orientation:landscape)_and_(max-height:500px)]:py-2">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--teal)] [@media(orientation:landscape)_and_(max-height:500px)]:hidden">Round Result</p>
              <h3 id="settlement-title" className="mt-1 text-lg font-semibold text-[var(--navy)] [@media(orientation:landscape)_and_(max-height:500px)]:mt-0 [@media(orientation:landscape)_and_(max-height:500px)]:text-base">
                本局结算
              </h3>
              <p className="mt-1 text-sm font-semibold text-[var(--text-soft)] [@media(orientation:landscape)_and_(max-height:500px)]:text-xs">
                {modeLabel} · 第 {settlement.round} 局
              </p>
            </div>
            <button type="button" onClick={onClose} className={`${buttonStyles.gray} min-h-9 px-3 py-1.5 [@media(orientation:landscape)_and_(max-height:500px)]:min-h-8 [@media(orientation:landscape)_and_(max-height:500px)]:px-2.5`}>
              关闭
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-hidden px-5 py-3 [@media(orientation:landscape)]:px-3 [@media(orientation:landscape)]:py-2 [@media(orientation:landscape)_and_(max-height:500px)]:px-2 [@media(orientation:landscape)_and_(max-height:500px)]:py-1.5">
          <section className="flex h-full min-h-0 flex-col">
            <div className="mb-2 flex shrink-0 items-center justify-between gap-3 [@media(orientation:landscape)_and_(max-height:500px)]:mb-1.5">
              <h4 className="text-sm font-semibold text-[var(--navy)] [@media(orientation:landscape)_and_(max-height:500px)]:text-xs">{handSectionTitle}</h4>
              <span className="rounded-[8px] bg-[var(--muted)] px-2.5 py-1 text-xs font-semibold text-[var(--text-soft)] [@media(orientation:landscape)_and_(max-height:500px)]:px-2 [@media(orientation:landscape)_and_(max-height:500px)]:py-0.5 [@media(orientation:landscape)_and_(max-height:500px)]:text-[10px]">
                {playerCountLabel} · 左右滑动
              </span>
            </div>
            <div className="flex h-full min-h-0 flex-1 snap-x snap-mandatory gap-2 overflow-x-auto overflow-y-hidden overscroll-x-contain pb-1 pr-1 [-webkit-overflow-scrolling:touch]">
              {sortedHands.map(hand => {
                const player = playerById.get(hand.playerId);
                const score = scoreByPlayerId.get(hand.playerId);
                const isCurrent = hand.playerId === currentPlayerId;
                const compareLabel = isTexasHoldem && hand.compareRank ? `第 ${hand.compareRank}` : null;
                return (
                  <div
                    key={hand.playerId}
                    className={`flex h-full min-h-0 w-[164px] shrink-0 snap-start flex-col rounded-[8px] border px-2.5 py-2.5 [@media(orientation:landscape)_and_(max-height:500px)]:w-[144px] [@media(orientation:landscape)_and_(max-height:500px)]:px-2 [@media(orientation:landscape)_and_(max-height:500px)]:py-1.5 ${
                      hand.isWinner
                        ? 'border-[var(--line-bright)] bg-[var(--surface-success)]'
                        : isCurrent
                          ? 'border-[var(--line)] bg-[var(--surface-warm)]'
                          : 'border-[var(--line)] bg-[var(--surface-strong)]'
                    }`}
                  >
                    <div className="mb-2 flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex min-w-0 items-center gap-2">
                          <p className="truncate text-sm font-semibold text-[var(--navy)] [@media(orientation:landscape)_and_(max-height:500px)]:text-xs">{player?.name || hand.playerId}</p>
                          {hand.isWinner ? (
                            <span className="shrink-0 rounded-[8px] bg-[var(--ink)] px-2 py-0.5 text-[11px] font-semibold text-[var(--paper)] [@media(orientation:landscape)_and_(max-height:500px)]:px-1.5 [@media(orientation:landscape)_and_(max-height:500px)]:text-[10px]">
                              赢家
                            </span>
                          ) : null}
                        </div>
                        {isTexasHoldem ? (
                          <p className="mt-1 text-xs font-semibold text-[var(--text-soft)] [@media(orientation:landscape)_and_(max-height:500px)]:text-[10px]">
                            {compareLabel ? `${compareLabel} · ` : ''}{handCategoryLabel(hand)}
                          </p>
                        ) : null}
                      </div>
                      {score ? (
                        <div className="shrink-0 text-right">
                          <div className={`font-mono text-sm font-semibold [@media(orientation:landscape)_and_(max-height:500px)]:text-xs ${scoreDeltaTone(score.delta)}`}>{scoreDeltaLabel(score.delta)}</div>
                          <div className="font-mono text-[11px] font-semibold text-[var(--text-soft)] [@media(orientation:landscape)_and_(max-height:500px)]:text-[10px]">{score.totalScore}</div>
                        </div>
                      ) : null}
                    </div>

                    <div className="flex min-h-0 flex-1 content-start flex-wrap gap-1.5 overflow-hidden [@media(orientation:landscape)_and_(max-height:500px)]:gap-1">
                      {hand.cards.length > 0 ? (
                        hand.cards.map(card => (
                          <span key={card.id} className={`rounded-[8px] border ${cardBorderClass} bg-[var(--card-face)] px-2 py-1 font-mono text-xs font-semibold leading-none ${getCardSuitColorClass(card.suit)} [@media(orientation:landscape)_and_(max-height:500px)]:px-1.5 [@media(orientation:landscape)_and_(max-height:500px)]:py-0.5 [@media(orientation:landscape)_and_(max-height:500px)]:text-[11px]`}>
                            {cardLabel(card)}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs font-semibold text-[var(--text-soft)] [@media(orientation:landscape)_and_(max-height:500px)]:text-[10px]">无手牌记录</span>
                      )}
                    </div>

                    {isTexasHoldem && hand.bestCards && hand.bestCards.length > 0 ? (
                      <div className="mt-2 shrink-0 border-t border-[var(--line)] pt-2 [@media(orientation:landscape)_and_(max-height:500px)]:mt-1.5 [@media(orientation:landscape)_and_(max-height:500px)]:pt-1.5">
                        <p className="mb-1 text-[11px] font-semibold text-[var(--text-soft)] [@media(orientation:landscape)_and_(max-height:500px)]:text-[10px]">最佳五张</p>
                        <div className="flex flex-wrap gap-1.5 [@media(orientation:landscape)_and_(max-height:500px)]:gap-1">
                          {hand.bestCards.map(card => (
                            <span key={card.id} className={`rounded-[8px] border ${cardBorderClass} bg-[var(--card-face)] px-2 py-1 font-mono text-xs font-semibold leading-none ${getCardSuitColorClass(card.suit)} [@media(orientation:landscape)_and_(max-height:500px)]:px-1.5 [@media(orientation:landscape)_and_(max-height:500px)]:py-0.5 [@media(orientation:landscape)_and_(max-height:500px)]:text-[11px]`}>
                              {cardLabel(card)}
                            </span>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </section>
        </div>

        <div className="shrink-0 border-t border-[var(--line)] p-3 [@media(orientation:landscape)_and_(max-height:500px)]:p-2">
          {isHost ? (
            <button
              type="button"
              onClick={onRestartRound}
              className={`${buttonStyles.primary} w-full [@media(orientation:landscape)_and_(max-height:500px)]:min-h-8 ${isLoading ? 'cursor-not-allowed opacity-50' : ''}`}
              disabled={isLoading}
            >
              下一局
            </button>
          ) : (
            <div className="rounded-[8px] bg-[var(--surface-tint)] px-3 py-2 text-center text-sm font-semibold text-[var(--teal)] [@media(orientation:landscape)_and_(max-height:500px)]:py-1.5 [@media(orientation:landscape)_and_(max-height:500px)]:text-xs">
              等待房主开始下一局
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
