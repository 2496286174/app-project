import React from 'react';
import { Player, TexasRoundResult } from '@liars-bar/shared';
import { buttonStyles } from './styles';

interface TexasSettlementPanelProps {
  players: Player[];
  result: TexasRoundResult;
  isHost: boolean;
  isLoading: boolean;
  onRestartRound: () => void;
}

function namesFor(players: Player[], ids: string[]): string {
  if (ids.length === 0) {
    return '无';
  }

  const playerById = new Map(players.map((player) => [player.id, player.name || player.id]));
  return ids.map((id) => playerById.get(id) || id).join('、');
}

const TexasSettlementPanel: React.FC<TexasSettlementPanelProps> = ({
  players,
  result,
  isHost,
  isLoading,
  onRestartRound
}) => {
  const winnerNames = namesFor(players, result.winnerIds);
  const tiedBestIds = result.tiedBestIds || result.winnerIds;
  const hasTie = tiedBestIds.length > 1;

  return (
    <section className="rounded-[8px] border border-[var(--line)] bg-[var(--surface)] p-4 text-[var(--navy)] shadow-[var(--shadow-card)]">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-base font-semibold">本局结算</h3>
          <p className="mt-1 text-xs font-semibold text-[var(--text-soft)]">
            最终摊牌只比大小，积分已同步
          </p>
        </div>
        <div className="rounded-[8px] bg-[var(--surface-tint)] px-3 py-1 text-xs font-semibold text-[var(--teal)]">
          +{result.winnerScoreGain}
        </div>
      </div>

      <div className="grid gap-2 text-sm">
        <div className="rounded-[8px] border border-[var(--line)] bg-[var(--surface-success)] px-3 py-2">
          <span className="font-semibold text-[var(--teal)]">赢家：</span>
          <span className="font-semibold">{winnerNames}</span>
        </div>

        {hasTie ? (
          <div className="rounded-[8px] border border-[var(--line)] bg-[var(--surface-soft)] px-3 py-2 text-[var(--text-soft)]">
            并列最佳：{namesFor(players, tiedBestIds)}；按座位顺序结算给 {winnerNames}
          </div>
        ) : null}

        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-[8px] border border-[var(--line)] bg-[var(--surface-soft)] px-3 py-2">
            <div className="text-xs font-semibold text-[var(--text-soft)]">在场扣分</div>
            <div className="mt-1 font-semibold">{namesFor(players, result.loserIds)}</div>
          </div>
          <div className="rounded-[8px] border border-[var(--line)] bg-[var(--surface-soft)] px-3 py-2">
            <div className="text-xs font-semibold text-[var(--text-soft)]">安全离场</div>
            <div className="mt-1 font-semibold">{namesFor(players, result.safeExitIds)}</div>
          </div>
        </div>

        <div className="rounded-[8px] border border-[var(--line)] bg-[var(--surface-danger)] px-3 py-2">
          <span className="font-semibold text-[var(--destructive)]">中弹离场：</span>
          <span className="font-semibold">{namesFor(players, result.shotExitIds)}</span>
        </div>
      </div>

      {isHost ? (
        <button
          type="button"
          onClick={onRestartRound}
          className={`${buttonStyles.purple} mt-3 w-full ${isLoading ? 'cursor-not-allowed opacity-50' : ''}`}
          disabled={isLoading}
        >
          下一局
        </button>
      ) : (
        <div className="mt-3 rounded-[8px] bg-[var(--surface-tint)] px-3 py-2 text-center text-sm font-semibold text-[var(--teal)]">
          等待房主开始下一局
        </div>
      )}
    </section>
  );
};

export default TexasSettlementPanel;
