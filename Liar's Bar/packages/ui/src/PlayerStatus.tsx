import React from 'react';
import { Player, getCurrentBulletCount, getMaxBullets, getShotProbability } from '@liars-bar/shared';
import { SmallStatusIcon } from './StatusIcon';

type PlayerStatusFields = Pick<
  Player,
  | 'id'
  | 'name'
  | 'isHost'
  | 'isReady'
  | 'isEliminated'
  | 'isActive'
  | 'connectionStatus'
  | 'cards'
  | 'score'
  | 'bulletCount'
  | 'bullets'
  | 'totalChambers'
  | 'texasRoundState'
>;

type PlayerStatusSource = Pick<PlayerStatusFields, 'id' | 'name'> & Partial<PlayerStatusFields>;

interface PlayerPresenceTextProps {
  player: PlayerStatusSource;
  disconnectedText?: string;
}

interface PlayerMetricGridProps {
  player: PlayerStatusSource | null | undefined;
  showCards?: boolean;
  showRisk?: boolean;
  showScore?: boolean;
  showExitState?: boolean;
  variant?: 'compact' | 'wide';
}

interface BulletStatusSquareProps {
  player: PlayerStatusSource | null | undefined;
  variant?: 'tile' | 'pill';
}

interface PlayerCompactStatusProps {
  player: PlayerStatusSource | null | undefined;
}

function formatPercent(value: number): string {
  const percent = value * 100;
  return Number.isInteger(percent) ? `${percent}%` : `${percent.toFixed(1)}%`;
}

function getBulletSnapshot(player: PlayerStatusSource | null | undefined) {
  return {
    bullets: player?.bullets ?? 0,
    bulletCount: player?.bulletCount,
    totalChambers: player?.totalChambers
  };
}

export function getPresenceText(player: PlayerStatusSource, disconnectedText = '离线'): string {
  const role = player.isHost ? '房主' : '玩家';
  const connection = player.connectionStatus === 'disconnected' ? disconnectedText : '在线';
  return `${role} · ${connection}`;
}

export function getReadyText(player: PlayerStatusSource): string {
  if (player.isHost) return '房主';
  return player.isReady ? '已准备' : '未准备';
}

export function getBulletText(player: PlayerStatusSource | null | undefined): string {
  if (!player) return '0/8';
  const bulletSnapshot = getBulletSnapshot(player);
  return `${getCurrentBulletCount(bulletSnapshot)}/${getMaxBullets(bulletSnapshot)}`;
}

export function getShotRiskText(player: PlayerStatusSource | null | undefined): string {
  if (!player) return '0%';
  return formatPercent(getShotProbability(getBulletSnapshot(player)));
}

export function PlayerPresenceText({ player, disconnectedText }: PlayerPresenceTextProps) {
  return <>{getPresenceText(player, disconnectedText)}</>;
}

function MetricTile({
  label,
  value,
  tone = 'neutral',
  iconType
}: {
  label: string;
  value: string;
  tone?: 'neutral' | 'teal' | 'danger';
  iconType?: 'bullet' | 'card';
}) {
  const toneClass =
    tone === 'teal'
      ? 'text-[var(--teal)]'
      : tone === 'danger'
        ? 'text-[var(--destructive)]'
        : 'text-[var(--text-soft)]';

  return (
    <div className="min-w-0 rounded-[8px] border border-[var(--line)] bg-[var(--surface-soft)] px-1.5 py-1 text-center" aria-label={label}>
      {iconType ? (
        <SmallStatusIcon type={iconType} className={`mx-auto h-3 w-3 shrink-0 ${toneClass}`} />
      ) : (
        <div className="truncate text-[10px] font-semibold text-[var(--text-soft)]">{label}</div>
      )}
      <div className={`mt-0.5 truncate text-[11px] font-semibold ${toneClass}`}>{value}</div>
    </div>
  );
}

export function PlayerMetricGrid({
  player,
  showCards = true,
  showRisk = true,
  showScore = true,
  showExitState = true,
  variant = 'compact'
}: PlayerMetricGridProps) {
  const isEliminated = Boolean(player?.isEliminated);
  const isExited = player?.texasRoundState === 'exited' || player?.isActive === false;
  const metricCount = 1 + (showRisk ? 1 : 0) + (showCards ? 1 : 0) + (showScore ? 1 : 0);
  const columns = metricCount >= 3 ? 'grid-cols-3' : metricCount === 2 ? 'grid-cols-2' : 'grid-cols-1';

  return (
    <div className={`grid w-full ${columns} gap-1 ${variant === 'wide' ? 'text-sm' : ''}`}>
      <MetricTile label="子弹" value={getBulletText(player)} tone="teal" iconType="bullet" />
      {showRisk ? <MetricTile label="中弹率" value={getShotRiskText(player)} tone={getShotProbability(getBulletSnapshot(player)) >= 0.5 ? 'danger' : 'neutral'} /> : null}
      {showCards ? <MetricTile label="手牌" value={`${player?.cards?.length || 0}张`} iconType="card" /> : null}
      {showScore ? <MetricTile label="积分" value={`${player?.score ?? 0}`} tone="teal" /> : null}
      {showExitState && (isExited || isEliminated) ? (
        <div className={`${columns === 'grid-cols-3' ? 'col-span-3' : 'col-span-2'} rounded-[8px] border border-[var(--line)] bg-[var(--surface-soft)] px-1.5 py-1 text-center text-[11px] font-semibold text-[var(--text-soft)]`}>
          {isEliminated ? '已淘汰' : '已离场'}
        </div>
      ) : null}
    </div>
  );
}

export function BulletStatusSquare({ player, variant = 'tile' }: BulletStatusSquareProps) {
  if (variant === 'pill') {
    return (
      <div className="relative inline-flex min-h-8 shrink-0 items-center gap-1.5 overflow-hidden rounded-[8px] border border-[var(--line-bright)] bg-[linear-gradient(135deg,var(--surface-strong),var(--surface-tint)_52%,var(--surface-success))] px-2.5 pr-3 text-sm font-semibold text-[var(--teal)] shadow-[var(--chip-shadow)]">
        <span aria-hidden="true" className="absolute inset-0 bg-[linear-gradient(180deg,var(--surface-glass),transparent_48%)]" />
        <span className="relative z-10 inline-flex size-5 items-center justify-center rounded-[6px] bg-[var(--surface-success)] text-[var(--teal)] shadow-[inset_0_0_0_1px_var(--line-bright)]">
          <SmallStatusIcon type="bullet" />
        </span>
        <span className="relative z-10 font-bold tabular-nums tracking-[0.03em]">{getBulletText(player)}</span>
      </div>
    );
  }

  return (
    <div className="flex min-h-[52px] w-16 shrink-0 flex-col items-center justify-center gap-1 rounded-[8px] border border-[var(--line-bright)] bg-[var(--surface-strong)] text-center text-[var(--teal)] shadow-[var(--shadow-card)]">
      <SmallStatusIcon type="bullet" />
      <div className="text-base font-semibold leading-none text-[var(--teal)]">{getBulletText(player)}</div>
    </div>
  );
}

export function PlayerCompactStatus({ player }: PlayerCompactStatusProps) {
  const isEliminated = Boolean(player?.isEliminated);
  const isExited = player?.texasRoundState === 'exited' || player?.isActive === false;

  return (
    <div className="flex w-full min-w-0 flex-col items-center gap-1 text-[9px] font-semibold leading-none">
      <div className="flex min-h-6 w-14 min-w-0 items-center justify-between overflow-hidden rounded-[7px] border border-[var(--line)] bg-[var(--surface-soft)] px-1">
        <span className="inline-flex min-w-0 items-center gap-px text-[var(--teal)]">
          <SmallStatusIcon type="bullet" className="h-2.5 w-2.5 shrink-0" />
          <span className="whitespace-nowrap tabular-nums">{getBulletText(player)}</span>
        </span>
        <span className="mx-0.5 h-3 w-px shrink-0 bg-[var(--line)]" />
        <span className="inline-flex min-w-0 items-center gap-px text-[var(--text-soft)]">
          <SmallStatusIcon type="card" className="h-2.5 w-2.5 shrink-0" />
          <span className="whitespace-nowrap tabular-nums">{player?.cards?.length || 0}</span>
        </span>
      </div>
      {isExited || isEliminated ? (
        <div className="inline-flex min-h-5 w-14 items-center justify-center rounded-[7px] border border-[var(--line)] bg-[var(--surface-soft)] px-1.5 text-[9px] text-[var(--text-soft)]">
          {isEliminated ? '淘汰' : '离场'}
        </div>
      ) : null}
    </div>
  );
}
