import React from 'react';
import { Player } from '@liars-bar/shared';
import { getBulletText } from './PlayerStatus';
import { SmallStatusIcon } from './StatusIcon';

interface PlayerBoxProps {
  player: Player;
  isCurrentPlayer: boolean;
  gameStatus: string | undefined;
  seatNumber?: number;
  compact?: boolean;
}

const PlayerBox: React.FC<PlayerBoxProps> = ({ player, isCurrentPlayer, gameStatus, seatNumber, compact = false }) => {
  const isAlive = !player.isEliminated;
  const isOutOfHand = player.isEliminated || !player.isActive || player.texasRoundState === 'exited';
  const isDisconnected = player.connectionStatus === 'disconnected';
  const statusDotClass = player.isEliminated ? 'bg-[var(--destructive)]' : (isOutOfHand || isDisconnected) ? 'bg-[var(--text-soft)]' : 'bg-[var(--sky-blue)]';

  return (
    <div
      className={`relative aspect-square w-full min-w-0 overflow-hidden rounded-[8px] border text-[var(--navy)] transition ${compact ? 'p-1.5' : 'p-2'} ${
        isAlive
          ? isCurrentPlayer
            ? 'border-2 border-[#EF4444] bg-[linear-gradient(145deg,rgba(255,246,246,0.98),rgba(255,222,222,0.92))]'
            : 'border-[var(--seat-border)] bg-[var(--seat-surface)]'
          : 'border-[var(--line)] bg-[var(--surface-disabled)]'
      } ${isDisconnected ? 'opacity-60' : ''}`}
    >
      {isCurrentPlayer && gameStatus === 'playing' && !compact ? (
        <span className="absolute right-1.5 top-6 inline-flex min-h-5 min-w-8 items-center justify-center rounded-[6px] bg-[#EF4444] px-1.5 text-[9px] font-semibold leading-none text-white">
          行动
        </span>
      ) : null}

      <div className={`flex h-full flex-col justify-between ${compact ? 'gap-1' : 'gap-2'}`}>
        <div className="min-w-0">
          <div className={`flex min-w-0 items-center gap-1 ${compact ? 'text-[11px]' : 'text-sm'}`}>
            {seatNumber ? (
              <span className="shrink-0 font-medium text-[var(--teal)]">{seatNumber}</span>
            ) : null}
            <div className="truncate font-semibold leading-tight text-[var(--navy)]">{player.name}</div>
            <span
              aria-label={player.isEliminated ? '已淘汰' : isOutOfHand ? '已离场' : (isDisconnected ? '离线' : '在线')}
              className={`ml-auto shrink-0 rounded-full ${compact ? 'size-2' : 'size-2.5'} ${statusDotClass}`}
            />
          </div>
        </div>

        <div className={`grid grid-cols-[repeat(2,minmax(0,1fr))] ${compact ? 'gap-0.5' : 'gap-1'}`}>
          <div
            className={`flex aspect-square flex-col items-center justify-center rounded-[8px] bg-[var(--panel-metric-bullet)] px-1 text-[var(--teal)] ${compact ? 'py-0.5' : ''}`}
            aria-label="子弹"
          >
            <SmallStatusIcon type="bullet" className={`${compact ? 'h-2.5 w-2.5' : 'h-3 w-3'} shrink-0 text-[var(--teal)]`} />
            <span className={`whitespace-nowrap font-semibold leading-none tabular-nums ${compact ? 'mt-0.5 text-[11px]' : 'mt-1 text-sm'}`}>{getBulletText(player)}</span>
          </div>
          <div
            className={`flex aspect-square flex-col items-center justify-center rounded-[8px] bg-[var(--panel-metric-hand)] px-1 text-[var(--navy)] ${compact ? 'py-0.5' : ''}`}
            aria-label="手牌"
          >
            <SmallStatusIcon type="card" className={`${compact ? 'h-2.5 w-2.5' : 'h-3 w-3'} shrink-0 text-[var(--teal)]`} />
            <span className={`whitespace-nowrap font-semibold leading-none tabular-nums ${compact ? 'mt-0.5 text-[11px]' : 'mt-1 text-sm'}`}>{player.cards?.length || 0}</span>
          </div>
        </div>

        {isOutOfHand ? (
          <div className={`inline-flex items-center justify-center rounded-[7px] bg-[var(--surface-soft)] px-2 font-medium text-[var(--text-soft)] ${compact ? 'min-h-4 text-[8px]' : 'min-h-6 text-[10px]'}`}>
            {player.isEliminated ? '淘汰' : '离场'}
          </div>
        ) : (
          <span aria-hidden="true" className={`block ${compact ? 'min-h-4' : 'min-h-6'}`} />
        )}
      </div>
    </div>
  );
};

export default PlayerBox;
