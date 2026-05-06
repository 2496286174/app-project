import React, { useMemo, useState } from 'react';
import Header from './Header';
import RulesPanel from './RulesPanel';
import ScoreboardModal from './ScoreboardModal';
import RoomQrModal from './RoomQrModal';
import PullToRefresh from './PullToRefresh';
import { PlayerPresenceText, getReadyText } from './PlayerStatus';
import { GameMode } from '@liars-bar/shared';
import { buttonStyles, layoutStyles } from './styles';

interface Player {
  id: string;
  name: string;
  isHost: boolean;
  isReady: boolean;
  score?: number;
  connectionStatus?: 'connected' | 'disconnected';
}

interface RoomPageProps {
  players: Player[];
  playerId: string;
  isHost: boolean;
  gameMode: GameMode;
  onStartGame: () => void;
  onToggleReady: () => void;
  onExitRoom: () => void;
  onNavigate: (path: string) => void;
  onGameModeChange: (mode: GameMode) => void;
  onRefreshStatus?: () => Promise<void> | void;
  roomJoinUrl?: string;
  roomQrDataUrl?: string;
  isRoomQrLoading?: boolean;
  onRefreshRoomQr?: () => Promise<void> | void;
  isLoading?: boolean;
  isReadyPending?: boolean;
}

export default function RoomPage({
  players,
  playerId,
  isHost,
  gameMode,
  onStartGame,
  onToggleReady,
  onExitRoom,
  onGameModeChange,
  onRefreshStatus,
  roomJoinUrl = '',
  roomQrDataUrl = '',
  isRoomQrLoading = false,
  onRefreshRoomQr,
  isLoading = false,
  isReadyPending = false
}: RoomPageProps) {
  const [showRules, setShowRules] = useState(false);
  const [showScores, setShowScores] = useState(false);
  const [showRoomQr, setShowRoomQr] = useState(false);
  const currentPlayer = players.find((player) => player.id === playerId);
  const guestPlayers = players.filter((player) => !player.isHost);
  const allReady = players.length >= 2 && guestPlayers.every((player) => player.isReady);
  const startBlockedReason = useMemo(() => {
    if (players.length < 2) return '至少需要 2 名玩家';
    if (!players.filter((player) => !player.isHost).every((player) => player.isReady)) return '等待其他玩家准备';
    return '';
  }, [players]);

  return (
    <div className={layoutStyles.container}>
      <div className={layoutStyles.shell}>
        <Header
          isLoading={isLoading}
          onToggleRules={() => setShowRules((value) => !value)}
          onViewScores={() => setShowScores(true)}
          onShowRoomQr={() => {
            setShowRoomQr(true);
            void onRefreshRoomQr?.();
          }}
          showRules={showRules}
          type="room"
          onExitRoom={onExitRoom}
        />

        <PullToRefresh className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-3 py-4 [@media(orientation:landscape)]:grid [@media(orientation:landscape)]:grid-cols-[minmax(0,1fr)_280px] [@media(orientation:landscape)]:items-start [@media(orientation:landscape)_and_(max-height:500px)]:gap-2 [@media(orientation:landscape)_and_(max-height:500px)]:px-2 [@media(orientation:landscape)_and_(max-height:500px)]:py-2" onRefresh={onRefreshStatus}>
          <section className="min-h-0 rounded-[8px] border border-[var(--line)] bg-[var(--surface)] p-4 shadow-[var(--shadow-card)] backdrop-blur-xl [@media(orientation:landscape)_and_(max-height:500px)]:p-3">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-[var(--navy)]">玩家列表</h2>
              <span className="font-mono text-sm font-semibold text-[var(--teal)]">{players.length}/8</span>
            </div>
            <div className="grid gap-2 [@media(orientation:landscape)]:grid-cols-2 [@media(orientation:landscape)_and_(max-height:500px)]:gap-1.5">
              {players.map((player, index) => {
                const isSelf = player.id === playerId;
                return (
                  <div
                    key={player.id}
                    className={`flex min-h-[64px] items-center justify-between gap-3 rounded-[8px] border px-3 shadow-sm [@media(orientation:landscape)_and_(max-height:500px)]:min-h-[52px] [@media(orientation:landscape)_and_(max-height:500px)]:px-2 ${
                      isSelf ? 'border-[var(--line-bright)] bg-[var(--surface-tint)]' : 'border-[var(--line)] bg-[var(--surface-glass)]'
                    }`}
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-[8px] bg-[var(--surface-tint)] text-base font-semibold text-[var(--teal)]">
                        {index + 1}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-[var(--navy)]">{player.name}</p>
                        <p className="text-xs text-[var(--text-soft)]">
                          <PlayerPresenceText player={player} />
                        </p>
                      </div>
                    </div>
                    <span className={`rounded-[8px] px-2 py-1 text-xs font-semibold ${player.isReady ? 'bg-[var(--surface-success)] text-[var(--teal)]' : 'bg-[var(--muted)] text-[var(--text-soft)]'}`}>
                      {getReadyText(player)}
                    </span>
                  </div>
                );
              })}
              {players.length === 0 ? (
                <div className="rounded-[8px] border border-dashed border-[var(--line)] p-5 text-center text-sm text-[var(--text-soft)]">
                  正在同步房间
                </div>
              ) : null}
            </div>
          </section>

          <section className="rounded-[8px] border border-[var(--line)] bg-[var(--surface)] p-4 shadow-[var(--shadow-card)] backdrop-blur-xl [@media(orientation:landscape)_and_(max-height:500px)]:p-3">
            <h2 className="text-lg font-semibold text-[var(--navy)]">游戏模式</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--text-soft)]">
              房主可以在开局前切换玩法，其他玩家准备后开始。
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => onGameModeChange('liarsBar')}
                disabled={!isHost || isLoading}
                className={`rounded-[8px] border px-3 py-3 text-center text-sm font-semibold transition active:scale-[0.98] ${
                  gameMode === 'liarsBar'
                    ? 'border-[var(--ink)] bg-[var(--ink)] text-[var(--paper)]'
                    : 'border-transparent bg-transparent text-[var(--navy)]'
                } ${!isHost ? 'cursor-default opacity-70' : ''}`}
              >
                骗子酒馆
              </button>
              <button
                type="button"
                onClick={() => onGameModeChange('texasHoldem')}
                disabled={!isHost || isLoading}
                className={`rounded-[8px] border px-3 py-3 text-center text-sm font-semibold transition active:scale-[0.98] ${
                  gameMode === 'texasHoldem'
                    ? 'border-[var(--ink)] bg-[var(--ink)] text-[var(--paper)]'
                    : 'border-transparent bg-transparent text-[var(--navy)]'
                } ${!isHost ? 'cursor-default opacity-70' : ''}`}
              >
                德州扑克
              </button>
            </div>
          </section>
        </PullToRefresh>

        <footer className={layoutStyles.bottomDock}>
          <div className="grid gap-2">
            {!isHost ? (
              <button
                type="button"
                onClick={onToggleReady}
                className={`${currentPlayer?.isReady ? buttonStyles.secondary : buttonStyles.success} w-full`}
                disabled={isLoading}
                aria-busy={isReadyPending}
              >
                {currentPlayer?.isReady ? '取消准备' : '准备'}
              </button>
            ) : null}
            {isHost ? (
              <button
                type="button"
                onClick={onStartGame}
                disabled={!allReady || isLoading}
                className={`${buttonStyles.primary} w-full`}
                title={startBlockedReason}
              >
                {startBlockedReason || '开始游戏'}
              </button>
            ) : null}
          </div>
        </footer>

        <RulesPanel isVisible={showRules} gameMode={gameMode} onClose={() => setShowRules(false)} />
        <ScoreboardModal
          isVisible={showScores}
          players={players}
          currentPlayerId={playerId}
          onClose={() => setShowScores(false)}
        />
        <RoomQrModal
          isVisible={showRoomQr}
          joinUrl={roomJoinUrl}
          qrDataUrl={roomQrDataUrl}
          isLoading={isRoomQrLoading}
          onClose={() => setShowRoomQr(false)}
        />
      </div>
    </div>
  );
}
