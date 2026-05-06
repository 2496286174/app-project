import React, { useMemo } from 'react';
import { buttonStyles, modalStyles } from './styles';

export interface ScoreboardPlayer {
  id: string;
  name: string;
  score?: number;
  isHost?: boolean;
  isEliminated?: boolean;
  isActive?: boolean;
  gameState?: 'playing' | 'eliminated' | 'waiting';
  connectionStatus?: 'connected' | 'disconnected';
  texasRoundState?: 'waiting' | 'inHand' | 'exited';
}

interface ScoreboardModalProps {
  isVisible: boolean;
  players: ScoreboardPlayer[];
  currentPlayerId?: string | null;
  onClose: () => void;
}

function getPlayerStatus(player: ScoreboardPlayer): string {
  if (player.isActive === false) return '历史记录';
  if (player.connectionStatus === 'disconnected') return '离线';
  if (player.isEliminated || player.gameState === 'eliminated') return '已淘汰';
  if (player.texasRoundState === 'exited') return '已离场';
  if (player.texasRoundState === 'inHand') return '局中';
  if (player.isHost) return '房主';
  return '在线';
}

function getRankLabel(index: number, player: ScoreboardPlayer, players: ScoreboardPlayer[]): number {
  const score = player.score ?? 0;
  const previousPlayer = players[index - 1];

  if (previousPlayer && (previousPlayer.score ?? 0) === score) {
    return getRankLabel(index - 1, previousPlayer, players);
  }

  return index + 1;
}

export default function ScoreboardModal({
  isVisible,
  players,
  currentPlayerId,
  onClose
}: ScoreboardModalProps) {
  const rankedPlayers = useMemo(
    () =>
      [...players].sort((a, b) => {
        const scoreDiff = (b.score ?? 0) - (a.score ?? 0);
        if (scoreDiff !== 0) return scoreDiff;
        return a.name.localeCompare(b.name, 'zh-Hans-CN');
      }),
    [players]
  );

  if (!isVisible) {
    return null;
  }

  return (
    <div className={modalStyles.overlay} role="presentation" onClick={onClose}>
      <div className={`${modalStyles.container} max-h-[82dvh] overflow-hidden`} role="dialog" aria-modal="true" aria-labelledby="scoreboard-title" onClick={(event) => event.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--teal)]">Scoreboard</p>
            <h3 id="scoreboard-title" className="mt-1 text-lg font-semibold text-[var(--navy)]">
              排行榜
            </h3>
            <p className="mt-1 text-xs font-semibold text-[var(--text-soft)]">累计积分长期记录</p>
          </div>
          <button type="button" onClick={onClose} className={`${buttonStyles.gray} min-h-10 px-3 py-2`}>
            关闭
          </button>
        </div>

        <div className="max-h-[58dvh] overflow-y-auto pr-1">
          {rankedPlayers.length > 0 ? (
            <div className="grid gap-2">
              {rankedPlayers.map((player, index) => {
                const isCurrentPlayer = player.id === currentPlayerId;
                const status = getPlayerStatus(player);
                return (
                  <div
                    key={player.id}
                    className={`grid min-h-[68px] grid-cols-[44px_1fr_auto] items-center gap-3 rounded-[8px] border px-3 shadow-sm ${
                      isCurrentPlayer ? 'border-[var(--line-bright)] bg-[var(--surface-tint)]' : 'border-[var(--line)] bg-[var(--surface-strong)]'
                    }`}
                  >
                    <div className="flex size-10 items-center justify-center rounded-[8px] bg-[var(--ink)] text-sm font-semibold text-[var(--paper)]">
                      {getRankLabel(index, player, rankedPlayers)}
                    </div>
                    <div className="min-w-0">
                      <div className="flex min-w-0 items-center gap-2">
                        <p className="truncate font-semibold text-[var(--navy)]">{player.name}</p>
                        {isCurrentPlayer ? (
                          <span className="shrink-0 rounded-[8px] bg-[var(--surface-warm)] px-2 py-0.5 text-[11px] font-semibold text-[var(--navy)]">
                            你
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-1 text-xs font-semibold text-[var(--text-soft)]">{status}</p>
                    </div>
                    <div className="text-right">
                      <div className="font-mono text-xl font-semibold text-[var(--navy)]">{player.score ?? 0}</div>
                      <div className="text-[11px] font-semibold text-[var(--text-soft)]">积分</div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-[8px] border border-dashed border-[var(--line)] p-6 text-center text-sm font-semibold text-[var(--text-soft)]">
              暂无排行榜记录
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
