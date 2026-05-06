import React, { useEffect, useMemo, useState } from 'react';
import { GameState, Player } from '@liars-bar/shared';
import PlayerBox from './PlayerBox';
import RulesPanel from './RulesPanel';
import Header from './Header';
import CommunityCards from './CommunityCards';
import PlayerHand from './PlayerHand';
import BulletExecutionModal from './BulletExecutionModal';
import GameSettlementModal from './GameSettlementModal';
import ScoreboardModal from './ScoreboardModal';
import RoomQrModal from './RoomQrModal';
import PullToRefresh from './PullToRefresh';
import { getBulletText } from './PlayerStatus';
import { SmallStatusIcon } from './StatusIcon';
import { buttonStyles, cardStyles, layoutStyles, modalStyles } from './styles';
import { GAME_LAYOUT_METRICS, PLAYER_SEAT_METRICS } from './cardMetrics';

interface GamePageProps {
  gameState: GameState | undefined;
  playerId: string | null;
  playerName: string;
  onSendAction: (action: string, data?: Record<string, unknown>) => Promise<GameActionResult>;
  onRefreshStatus?: () => Promise<void> | void;
  roomJoinUrl?: string;
  roomQrDataUrl?: string;
  isRoomQrLoading?: boolean;
  onRefreshRoomQr?: () => Promise<void> | void;
  isLoading?: boolean;
  networkStatus?: 'online' | 'offline' | 'reconnecting';
}

type GameActionResult = {
  result: boolean;
  replayedCommand: boolean;
  data?: Record<string, unknown>;
};

type PenaltyResult = {
  shot: boolean;
  victimId: string;
};

const FIRE_SPIN_DURATION_MS = 900;

function waitForSpinMinimum(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, FIRE_SPIN_DURATION_MS);
  });
}

type SeatEntry = {
  player: Player;
  seatNumber: number;
};

type SeatLayout = {
  top: SeatEntry[];
  left: SeatEntry[];
  right: SeatEntry[];
  current: SeatEntry | null;
};

type CompactSeatBands = {
  top: SeatEntry[];
  left: SeatEntry | null;
  right: SeatEntry | null;
};

function getPenaltyResultFromAction(result: GameActionResult): PenaltyResult | null {
  const value = result.data?.penaltyResult;
  if (!value || typeof value !== 'object') return null;

  const penaltyResult = value as Partial<PenaltyResult>;
  if (typeof penaltyResult.shot !== 'boolean' || typeof penaltyResult.victimId !== 'string') {
    return null;
  }

  return {
    shot: penaltyResult.shot,
    victimId: penaltyResult.victimId
  };
}

function createSeatLayout(players: Player[], currentPlayerId: string | null): SeatLayout {
  const entries = players.map((player, index) => ({
    player,
    seatNumber: index + 1,
    index
  }));

  if (entries.length === 0) {
    return { top: [], left: [], right: [], current: null };
  }

  const currentIndex = entries.findIndex((entry) => entry.player.id === currentPlayerId);
  if (currentIndex === -1) {
    const current = entries[0];
    const remote = entries.slice(1);
    return {
      top: remote.slice(2, 5).reverse().map(({ player, seatNumber }) => ({ player, seatNumber })),
      left: remote.slice(5).map(({ player, seatNumber }) => ({ player, seatNumber })),
      right: remote.slice(0, 2).reverse().map(({ player, seatNumber }) => ({ player, seatNumber })),
      current: { player: current.player, seatNumber: current.seatNumber }
    };
  }

  const rotated = entries.map((_, offset) => entries[(currentIndex + offset) % entries.length]);
  const current = rotated[0];
  const remote = rotated.slice(1);

  return {
    top: remote.slice(2, 5).reverse().map(({ player, seatNumber }) => ({ player, seatNumber })),
    left: remote.slice(5).map(({ player, seatNumber }) => ({ player, seatNumber })),
    right: remote.slice(0, 2).reverse().map(({ player, seatNumber }) => ({ player, seatNumber })),
    current: { player: current.player, seatNumber: current.seatNumber }
  };
}

function createCompactSeatBands(players: Player[], currentPlayerId: string | null): CompactSeatBands {
  const entries = players.map((player, index) => ({
    player,
    seatNumber: index + 1
  }));

  if (entries.length <= 1) {
    return { top: [], left: null, right: null };
  }

  const currentIndex = entries.findIndex((entry) => entry.player.id === currentPlayerId);
  const rotated = currentIndex === -1
    ? entries
    : entries.map((_, offset) => entries[(currentIndex + offset) % entries.length]);
  const remote = rotated.slice(1);
  const top = remote.slice(2, 7).reverse().map(({ player, seatNumber }) => ({ player, seatNumber }));
  const rightSeat = remote[0] ? { player: remote[0].player, seatNumber: remote[0].seatNumber } : null;
  const leftSeat = remote[1] ? { player: remote[1].player, seatNumber: remote[1].seatNumber } : null;

  return {
    top,
    left: leftSeat,
    right: rightSeat
  };
}

const LOCAL_FEEDBACK_ACTIONS = new Set([
  'addBullets',
  'playCards',
  'trust',
  'challenge',
  'discardTexasCard'
]);

const TEXAS_STAGE_LABELS: Record<string, string> = {
  preDraw: '摸弃',
  preFlop: '翻牌前',
  flop: '翻牌',
  turn: '转牌',
  river: '河牌',
  settlement: '结算'
};

const GamePage = ({
  gameState,
  playerId,
  onSendAction,
  onRefreshStatus,
  roomJoinUrl = '',
  roomQrDataUrl = '',
  isRoomQrLoading = false,
  onRefreshRoomQr,
  isLoading = false,
  networkStatus = 'online'
}: GamePageProps) => {
  const [showRules, setShowRules] = useState(false);
  const [selectedCardIds, setSelectedCardIds] = useState<string[]>([]);
  const [addBulletInput, setAddBulletInput] = useState('1');
  const [showAddBulletModal, setShowAddBulletModal] = useState(false);
  const [showExecutionModal, setShowExecutionModal] = useState(false);
  const [executionVictimId, setExecutionVictimId] = useState<string | null>(null);
  const [executionShot, setExecutionShot] = useState<boolean | null>(null);
  const [isSpinning, setIsSpinning] = useState(false);
  const [showRefuseBulletsModal, setShowRefuseBulletsModal] = useState(false);
  const [showScores, setShowScores] = useState(false);
  const [showRoomQr, setShowRoomQr] = useState(false);
  const [closedSettlementId, setClosedSettlementId] = useState<string | null>(null);
  const [localLoading, setLocalLoading] = useState(false);
  const [isCompactLandscape, setIsCompactLandscape] = useState(false);

  const currentPlayer = gameState?.players.find((player) => player.id === playerId) || null;
  const isHost = Boolean(currentPlayer?.isHost);
  const isTexasHoldem = gameState?.gameMode === 'texasHoldem';
  const texasStage = gameState?.texasStage || 'idle';
  const isTexasActionStage = ['preFlop', 'flop', 'turn', 'river'].includes(texasStage);
  const activePlayerId = gameState?.turnActorPlayerId || gameState?.players?.[gameState.currentPlayerIndex]?.id || null;
  const activePlayer = gameState?.players.find((player) => player.id === activePlayerId) || null;
  const minBulletAdd = Math.max(1, gameState?.lastAddedBullets ?? 0);
  const isTurnActor = activePlayerId === playerId;
  const penaltyResult = gameState?.penaltyResult || null;
  const executionTargetId = gameState?.pendingPenaltyPlayerId || penaltyResult?.victimId || null;
  const isExecutionVictim = Boolean(playerId && executionTargetId && playerId === executionTargetId);
  const selectionLimit = isTexasHoldem ? 1 : 3;
  const settlement = gameState?.roundSettlement || null;
  const settlementId = settlement?.id || null;
  const isTexasPendingDiscardTurn = Boolean(
    isTexasHoldem &&
    gameState?.pendingTexasDiscardPlayerId &&
    activePlayer?.id === gameState.pendingTexasDiscardPlayerId &&
    activePlayer?.cards?.length === 3
  );
  const isTexasPendingBulletTurn = Boolean(
    isTexasHoldem &&
    gameState?.pendingTexasDiscardPlayerId &&
    activePlayer?.id === gameState.pendingTexasDiscardPlayerId &&
    activePlayer?.cards?.length === 2
  );
  const isSelfTexasDiscardTurn = Boolean(
    isTexasHoldem &&
    gameState?.pendingTexasDiscardPlayerId === playerId &&
    currentPlayer?.cards?.length === 3
  );
  const isSelfTexasBulletTurn = Boolean(
    isTexasHoldem &&
    gameState?.pendingTexasDiscardPlayerId === playerId &&
    currentPlayer?.cards?.length === 2
  );
  const scoreboardPlayers = useMemo(() => {
    if (gameState?.scoreboard?.length) {
      return gameState.scoreboard.map(entry => ({
        id: entry.playerId,
        name: entry.name,
        score: entry.score,
        isActive: entry.isActive,
        connectionStatus: entry.isActive ? 'connected' as const : 'disconnected' as const
      }));
    }

    return gameState?.players || [];
  }, [gameState]);
  const seatLayout = useMemo(
    () => createSeatLayout(gameState?.players || [], playerId),
    [gameState?.players, playerId]
  );
  const currentSeatPlayerId = seatLayout.current?.player.id || currentPlayer?.id || null;
  const isMainPlayerTurn = gameState?.gameStatus === 'playing' && Boolean(activePlayerId && currentSeatPlayerId === activePlayerId);
  const compactSeatBands = useMemo(
    () => createCompactSeatBands(gameState?.players || [], playerId),
    [gameState?.players, playerId]
  );
  const currentTotalScore = scoreboardPlayers.find((player) => player.id === playerId)?.score ?? currentPlayer?.score ?? 0;

  const canAddBullets = Boolean(
    gameState?.gameStatus === 'playing' &&
    isTurnActor &&
    !currentPlayer?.hasAddedBullets &&
    (!isTexasHoldem || ((isTexasActionStage || isSelfTexasBulletTurn) && currentPlayer?.texasRoundState === 'inHand'))
  );
  const canConfirmAddBullets = canAddBullets;
  const canExitTexasRound = Boolean(
    isTexasHoldem &&
    gameState?.gameStatus === 'playing' &&
    isTurnActor &&
    (isTexasActionStage || isSelfTexasBulletTurn) &&
    currentPlayer?.texasRoundState === 'inHand'
  );
  const canDiscardTexasCard = Boolean(
    isTexasHoldem &&
    gameState?.gameStatus === 'playing' &&
    isSelfTexasDiscardTurn &&
    selectedCardIds.length === 1
  );

  const canPlayCards = Boolean(
    !isTexasHoldem &&
    gameState?.gameStatus === 'playing' &&
    isTurnActor &&
    !gameState?.currentPlay &&
    currentPlayer?.hasAddedBullets &&
    selectedCardIds.length > 0
    && selectedCardIds.length <= 3
  );

  const isSelectingCards = Boolean(
    gameState?.gameStatus === 'playing' &&
    (
      isTexasHoldem
        ? isSelfTexasDiscardTurn
        : isTurnActor && !gameState?.currentPlay && currentPlayer?.hasAddedBullets
    )
  );

  const canRespondToPlay = Boolean(
    !isTexasHoldem &&
    gameState?.gameStatus === 'playing' &&
    isTurnActor &&
    gameState?.currentPlay &&
    gameState.currentPlay.playerId !== playerId &&
    currentPlayer?.hasAddedBullets
  );

  const canRestartRound = Boolean(isHost && gameState?.gameStatus === 'ended');
  const canViewSettlement = Boolean(gameState?.gameStatus === 'ended' && settlement);
  const showSettlementModal = Boolean(canViewSettlement && settlementId && closedSettlementId !== settlementId);
  const showCardSelectionPrompt = isSelectingCards && selectedCardIds.length === 0;
  const cardSelectionPrompt = isTexasHoldem ? '到你弃牌' : '到你出牌';
  const showWaitingState = !canAddBullets && !canExitTexasRound && !canDiscardTexasCard && !canPlayCards && !canRespondToPlay && !canRestartRound && !canViewSettlement && !isSelectingCards;

  const waitingMessage = (() => {
    if (!gameState || gameState.gameStatus !== 'playing' || !activePlayer) {
      return '等待其他玩家操作';
    }

    if (isTexasHoldem) {
      if (isTexasPendingDiscardTurn) {
        return `当前 ${activePlayer.name} 玩家摸1弃1`;
      }

      if (isTexasPendingBulletTurn) {
        return `当前 ${activePlayer.name} 玩家加子弹或提前离场`;
      }

      if (isTexasActionStage) {
        return `当前 ${activePlayer.name} 玩家加子弹或提前离场`;
      }

      return '等待德州扑克结算';
    }

    if (gameState.currentPlay) {
      return activePlayer.hasAddedBullets
        ? `当前 ${activePlayer.name} 玩家进行质疑或相信`
        : `当前 ${activePlayer.name} 玩家进行加子弹`;
    }

    return activePlayer.hasAddedBullets
      ? `当前 ${activePlayer.name} 玩家进行出牌`
      : `当前 ${activePlayer.name} 玩家进行加子弹`;
  })();
  const gameProgress = (() => {
    if (networkStatus === 'offline') {
      return {
        actor: '网络',
        action: '已离线',
        detail: '检查主机地址或局域网'
      };
    }

    if (networkStatus === 'reconnecting') {
      return {
        actor: '网络',
        action: '重连中',
        detail: '等待主机响应'
      };
    }

    if (!gameState) {
      return {
        actor: '进程',
        action: '同步中',
        detail: '正在读取最新状态'
      };
    }

    if (gameState.gameStatus === 'waiting') {
      return {
        actor: '房间',
        action: '待开始',
        detail: '等待房主开局'
      };
    }

    if (gameState.gameStatus === 'ended') {
      return {
        actor: '结算',
        action: isHost ? '可开下一局' : '等待下一局',
        detail: settlement ? '本局已结束' : '等待结算'
      };
    }

    if (executionTargetId) {
      const victim = gameState.players.find((player) => player.id === executionTargetId);
      return {
        actor: victim?.name || '玩家',
        action: '处决',
        detail: penaltyResult ? '查看处决结果' : '等待开枪'
      };
    }

    if (isTexasHoldem) {
      if (isTexasPendingDiscardTurn) {
        const pendingPlayer = gameState.players.find((player) => player.id === gameState.pendingTexasDiscardPlayerId);
        return {
          actor: pendingPlayer?.name || activePlayer?.name || '玩家',
          action: '摸1弃1',
          detail: '选择弃掉一张牌'
        };
      }

      if (isTexasPendingBulletTurn) {
        const pendingPlayer = gameState.players.find((player) => player.id === gameState.pendingTexasDiscardPlayerId);
        return {
          actor: pendingPlayer?.name || activePlayer?.name || '玩家',
          action: '加子弹/离场',
          detail: '弃牌后立即决策'
        };
      }

      if (isTexasActionStage) {
        return {
          actor: activePlayer?.name || '玩家',
          action: '加子弹/离场',
          detail: TEXAS_STAGE_LABELS[texasStage] || '德州扑克'
        };
      }

      return {
        actor: '牌局',
        action: TEXAS_STAGE_LABELS[texasStage] || '等待',
        detail: '等待阶段推进'
      };
    }

    if (gameState.currentPlay) {
      return activePlayer?.hasAddedBullets
        ? {
            actor: activePlayer.name,
            action: '质疑/相信',
            detail: '回应上一手牌'
          }
        : {
            actor: activePlayer?.name || '玩家',
            action: '加子弹',
            detail: '回应前先加子弹'
          };
    }

    return activePlayer?.hasAddedBullets
      ? {
          actor: activePlayer.name,
          action: '出牌',
          detail: showCardSelectionPrompt ? '选择 1-3 张手牌' : '等待出牌'
        }
      : {
          actor: activePlayer?.name || '玩家',
          action: '加子弹',
          detail: `至少加 ${minBulletAdd} 发`
        };
  })();

  const networkPrompt = networkStatus === 'offline' ? '已离线，请检查主机地址或网络' : '';
  const statusPromptMessage = networkPrompt || (showWaitingState ? waitingMessage : showCardSelectionPrompt ? cardSelectionPrompt : '');
  const showStatusPrompt = Boolean(statusPromptMessage);
  const activeLayoutMetrics = isCompactLandscape ? GAME_LAYOUT_METRICS.compact : GAME_LAYOUT_METRICS.regular;
  const activeSeatMetrics = isCompactLandscape ? PLAYER_SEAT_METRICS.compact : PLAYER_SEAT_METRICS.regular;
  const hasDualActionRow = canRespondToPlay;
  const hasMultipleActionStates = Boolean(
    (canAddBullets || canExitTexasRound) ||
    canRestartRound
  );
  const hasActionButtons = Boolean(
    canDiscardTexasCard ||
    canAddBullets ||
    canExitTexasRound ||
    canPlayCards ||
    canRespondToPlay ||
    canRestartRound ||
    canViewSettlement
  );
  const showCompactActionPrompt = isCompactLandscape && Boolean(networkPrompt || (showCardSelectionPrompt && !hasActionButtons));
  const showHandStatusPrompt = false;
  const mainCardRank = (() => {
    const nextMainCard = gameState?.mainCard as string | { rank?: string } | null | undefined;
    if (!nextMainCard) {
      return '';
    }

    if (typeof nextMainCard === 'string') {
      return nextMainCard;
    }

    return typeof nextMainCard.rank === 'string' ? nextMainCard.rank : '';
  })();
  const roundStatusText = (gameState?.round ?? 0) > 0 ? `第 ${gameState?.round} 局` : '';
  const modeStatusText = isTexasHoldem
    ? (gameState?.texasStage ? TEXAS_STAGE_LABELS[gameState.texasStage] || '德州扑克' : '')
    : mainCardRank
      ? `主牌 ${mainCardRank}`
      : '';
  const topStatusText = [roundStatusText, modeStatusText].filter(Boolean).join(' · ');
  const statusPromptBoxClass = networkStatus === 'offline'
    ? 'border-[var(--destructive)] bg-[var(--surface-danger)]'
    : networkStatus === 'reconnecting'
      ? 'border-[var(--line-bright)] bg-[var(--surface-tint)]'
      : showCardSelectionPrompt
        ? 'border-[var(--line-warm)] bg-[linear-gradient(135deg,var(--surface-warm),var(--surface-tint))]'
        : 'border-[var(--line-bright)] bg-[linear-gradient(135deg,var(--surface-tint),var(--surface-warm))]';
  const statusPromptTextClass = networkStatus === 'offline'
    ? 'text-[var(--destructive)]'
    : networkStatus === 'reconnecting'
      ? 'text-[var(--teal)]'
      : 'text-[var(--navy)]';
  const tablePanelClass = 'relative w-full shrink-0 overflow-hidden rounded-[8px] bg-[var(--panel-stage-c)] p-1.5 sm:p-2 [@media(orientation:landscape)_and_(max-height:500px)]:p-1';
  const seatSlotStyle = { width: `${activeSeatMetrics.slotWidth}px` };
  const actionControlsWidth = hasDualActionRow
    ? Math.min(activeLayoutMetrics.actionControlsMaxWidth, isCompactLandscape ? 216 : 260)
    : hasMultipleActionStates
      ? Math.min(activeLayoutMetrics.actionControlsMaxWidth, isCompactLandscape ? 216 : 204)
      : Math.min(activeLayoutMetrics.actionControlsMaxWidth, isCompactLandscape ? 152 : 180);
  const actionButtonInlineStyle = isCompactLandscape ? { minHeight: 30, paddingTop: 4, paddingBottom: 4 } : undefined;

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return;
    }

    const mediaQuery = window.matchMedia('(orientation: landscape) and (max-height: 500px)');
    const updateCompactLandscape = () => setIsCompactLandscape(mediaQuery.matches);

    updateCompactLandscape();
    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', updateCompactLandscape);
      return () => mediaQuery.removeEventListener('change', updateCompactLandscape);
    }

    mediaQuery.addListener(updateCompactLandscape);
    return () => mediaQuery.removeListener(updateCompactLandscape);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return;
    }

    const root = document.documentElement;
    const previousBodyOverflow = document.body.style.overflow;
    root.classList.add('game-interaction-locked');
    document.body.style.overflow = 'hidden';

    const preventGesture = (event: Event) => {
      event.preventDefault();
    };

    const preventPinchTouch = (event: TouchEvent) => {
      if (event.touches.length > 1) {
        event.preventDefault();
      }
    };

    const preventZoomWheel = (event: WheelEvent) => {
      if (event.ctrlKey || event.metaKey) {
        event.preventDefault();
      }
    };

    const preventZoomKey = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey)) {
        return;
      }

      if (['+', '-', '=', '0'].includes(event.key)) {
        event.preventDefault();
      }
    };

    const listenerOptions: AddEventListenerOptions = { passive: false };
    window.addEventListener('gesturestart', preventGesture, listenerOptions);
    window.addEventListener('gesturechange', preventGesture, listenerOptions);
    window.addEventListener('gestureend', preventGesture, listenerOptions);
    window.addEventListener('wheel', preventZoomWheel, listenerOptions);
    window.addEventListener('keydown', preventZoomKey);
    document.addEventListener('touchmove', preventPinchTouch, listenerOptions);

    return () => {
      root.classList.remove('game-interaction-locked');
      document.body.style.overflow = previousBodyOverflow;
      window.removeEventListener('gesturestart', preventGesture);
      window.removeEventListener('gesturechange', preventGesture);
      window.removeEventListener('gestureend', preventGesture);
      window.removeEventListener('wheel', preventZoomWheel);
      window.removeEventListener('keydown', preventZoomKey);
      document.removeEventListener('touchmove', preventPinchTouch);
    };
  }, []);

  useEffect(() => {
    if (!executionTargetId) {
      if (executionShot !== null) {
        return;
      }

      setShowExecutionModal(false);
      setExecutionVictimId(null);
      setExecutionShot(null);
      setIsSpinning(false);
      return;
    }

    setExecutionVictimId(executionTargetId);
    setShowExecutionModal(true);
  }, [executionTargetId, executionShot]);

  useEffect(() => {
    if (!executionTargetId) {
      return;
    }

    if (penaltyResult) {
      setExecutionShot(penaltyResult.shot);
      setIsSpinning(false);
      return;
    }

    setExecutionShot(null);
  }, [executionTargetId, penaltyResult]);

  useEffect(() => {
    if (!settlementId) {
      setClosedSettlementId(null);
    }
  }, [settlementId]);

  useEffect(() => {
    if (
      gameState?.gameStatus === 'ended' ||
      (gameState?.gameStatus === 'playing' && !gameState?.currentPlay) ||
      (isTexasHoldem && !isSelfTexasDiscardTurn)
    ) {
      setSelectedCardIds([]);
      setAddBulletInput('1');
      setShowAddBulletModal(false);
      setShowRefuseBulletsModal(false);
    }
  }, [gameState?.currentPlay, gameState?.gameStatus, isSelfTexasDiscardTurn, isTexasHoldem]);

  const handleViewScores = () => {
    setShowScores(true);
  };

  const handleGameAction = async (action: string, data?: Record<string, unknown>, onSuccess?: () => void) => {
    setLocalLoading(true);
    const usesLocalFeedback = LOCAL_FEEDBACK_ACTIONS.has(action);
    try {
      const resultPromise = onSendAction(action, data);
      if (usesLocalFeedback) {
        onSuccess?.();
        setLocalLoading(false);
      }

      const result = await resultPromise;
      if (result.result) {
        if (!usesLocalFeedback) {
          onSuccess?.();
        }
      } else if (usesLocalFeedback) {
        setLocalLoading(false);
      }
    } catch (error) {
      console.error(`处理游戏操作 ${action} 失败:`, error);
    } finally {
      if (!usesLocalFeedback) {
        setLocalLoading(false);
      }
    }
  };

  const handleFireGun = async () => {
    if (!isExecutionVictim || executionShot !== null || isSpinning) {
      return;
    }

    setIsSpinning(true);
    try {
      const [result] = await Promise.all([
        onSendAction('fireGun'),
        waitForSpinMinimum()
      ]);
      const penaltyResultFromAck = getPenaltyResultFromAction(result);
      if (penaltyResultFromAck) {
        setExecutionVictimId(penaltyResultFromAck.victimId);
        setExecutionShot(penaltyResultFromAck.shot);
        setShowExecutionModal(true);
        setIsSpinning(false);
        return;
      }

      if (result.result) {
        await onRefreshStatus?.();
      }

      setIsSpinning(false);
    } catch (error) {
      console.error('开枪操作失败:', error);
      setIsSpinning(false);
    }
  };

  const handleCloseExecutionModal = () => {
    setShowExecutionModal(false);
    setExecutionVictimId(null);
    setExecutionShot(null);
  };

  const actionControls = hasActionButtons ? (
    <div
      className={`mx-auto flex max-w-full flex-col items-stretch justify-center ${isCompactLandscape ? 'gap-1.5' : 'gap-2'}`}
      style={{ width: `${actionControlsWidth}px` }}
    >
      {canDiscardTexasCard ? (
        <button
          type="button"
          onClick={() => handleGameAction('discardTexasCard', { cardId: selectedCardIds[0] })}
          className={`${buttonStyles.success} w-full ${localLoading ? 'cursor-not-allowed opacity-50' : ''}`}
          disabled={localLoading}
        >
          弃掉选牌
        </button>
      ) : null}

      {canAddBullets || canExitTexasRound ? (
        <div className={canConfirmAddBullets ? 'grid grid-cols-2 gap-1.5' : `flex flex-col ${isCompactLandscape ? 'gap-1.5' : 'gap-2'}`}>
          {canConfirmAddBullets ? (
            <button
              type="button"
              onClick={() => {
                setAddBulletInput(String(minBulletAdd));
                setShowAddBulletModal(true);
              }}
              className={`${buttonStyles.primary} w-full`}
              style={actionButtonInlineStyle}
            >
              加子弹
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => setShowRefuseBulletsModal(true)}
            className={`${buttonStyles.secondary} w-full`}
            style={actionButtonInlineStyle}
          >
            {isTexasHoldem ? '提前离场' : '不加子弹'}
          </button>
        </div>
      ) : null}

      {canPlayCards ? (
        <button
          type="button"
          onClick={() => handleGameAction('playCards', { cardIds: selectedCardIds, declaredCount: selectedCardIds.length })}
          className={`${buttonStyles.success} w-full ${localLoading ? 'cursor-not-allowed opacity-50' : ''}`}
          disabled={localLoading}
        >
          出牌
        </button>
      ) : null}

      {canRespondToPlay ? (
        <div className="grid grid-cols-2 gap-1.5">
          <button
            type="button"
            onClick={() => handleGameAction('challenge')}
            className={`${buttonStyles.danger} w-full ${localLoading ? 'cursor-not-allowed opacity-50' : ''}`}
            disabled={localLoading}
          >
            质疑
          </button>
          <button
            type="button"
            onClick={() => handleGameAction('trust')}
            className={`${buttonStyles.info} w-full ${localLoading ? 'cursor-not-allowed opacity-50' : ''}`}
            disabled={localLoading}
          >
            相信
          </button>
        </div>
      ) : null}

      {canRestartRound ? (
        <div className={isCompactLandscape && canViewSettlement ? 'grid grid-cols-2 gap-1.5' : `flex flex-col ${isCompactLandscape ? 'gap-1.5' : 'gap-2'}`}>
          {canViewSettlement ? (
            <button type="button" onClick={() => setClosedSettlementId(null)} className={`${buttonStyles.secondary} w-full`}>
              查看结算
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => handleGameAction('restartRound')}
            className={`${buttonStyles.primary} w-full ${localLoading ? 'cursor-not-allowed opacity-50' : ''}`}
            disabled={localLoading}
          >
            下一局
          </button>
        </div>
      ) : null}

      {!canRestartRound && canViewSettlement ? (
        <button type="button" onClick={() => setClosedSettlementId(null)} className={`${buttonStyles.secondary} w-full`}>
          查看结算
        </button>
      ) : null}
    </div>
  ) : null;
  const compactActionPrompt = showCompactActionPrompt ? (
    <div
      className={`mx-auto flex max-w-full items-center justify-center overflow-hidden rounded-[8px] px-3 py-1.5 ${statusPromptBoxClass}`}
      style={{
        width: `${Math.min(activeLayoutMetrics.actionControlsMaxWidth, 320)}px`,
        minHeight: `${activeLayoutMetrics.statusPromptMinHeight}px`
      }}
      role={networkStatus === 'offline' ? 'status' : undefined}
    >
      <div className={`min-w-0 truncate text-center text-[12px] font-semibold ${statusPromptTextClass}`}>{statusPromptMessage}</div>
    </div>
  ) : null;
  const actionRowContent = compactActionPrompt || actionControls;

  return (
    <div className={`${layoutStyles.container} touch-none select-none overscroll-none`}>
      <div className={`${layoutStyles.shell} md:min-h-0 md:h-[calc(100dvh-40px)] [@media(orientation:landscape)_and_(max-height:500px)]:h-dvh`}>
        <Header
          isLoading={isLoading || localLoading}
          onToggleRules={() => setShowRules((visible) => !visible)}
          onViewScores={handleViewScores}
          onShowRoomQr={() => {
            setShowRoomQr(true);
            void onRefreshRoomQr?.();
          }}
          showRules={showRules}
          type="game"
          isHost={isHost}
          networkStatus={networkStatus}
          onExitRoom={() => handleGameAction('leaveGame')}
          onReturnToRoom={isHost ? () => handleGameAction('returnToRoom') : undefined}
          onDealCards={isHost ? () => handleGameAction('dealCards') : undefined}
          showNetworkStatus={networkStatus !== 'offline'}
          topStatusText={topStatusText}
        />

        <PullToRefresh className={layoutStyles.main} onRefresh={onRefreshStatus}>
          <div className={`${layoutStyles.content} flex min-h-0 w-full flex-col overflow-hidden md:px-1.5 md:py-1.5 [@media(orientation:landscape)_and_(max-height:500px)]:px-1 [@media(orientation:landscape)_and_(max-height:500px)]:py-1`}>
            <div className={`${tablePanelClass} flex min-h-0 flex-1 flex-col`}>
              {isCompactLandscape ? (
                <div className="relative z-10 flex min-h-0 flex-1 flex-col gap-1">
                  {compactSeatBands.top.length > 0 ? (
                    <div className="grid w-full grid-cols-5 justify-items-center" style={{ gap: `${activeSeatMetrics.trackGap}px` }}>
                      {compactSeatBands.top.map(({ player, seatNumber }) => (
                        <div key={player.id} style={seatSlotStyle}>
                          <PlayerBox
                            player={player}
                            seatNumber={seatNumber}
                            isCurrentPlayer={gameState?.turnActorPlayerId === player.id}
                            gameStatus={gameState?.gameStatus}
                            compact
                          />
                        </div>
                      ))}
                    </div>
                  ) : null}

                  <div
                    className="grid min-h-0 flex-1 items-center"
                    style={{
                      gridTemplateColumns: `${activeSeatMetrics.slotWidth}px minmax(0,1fr) ${activeSeatMetrics.slotWidth}px`,
                      gap: `${activeSeatMetrics.trackGap}px`
                    }}
                  >
                    <div className="flex items-center">
                      {compactSeatBands.left ? (
                        <PlayerBox
                          key={compactSeatBands.left.player.id}
                          player={compactSeatBands.left.player}
                          seatNumber={compactSeatBands.left.seatNumber}
                          isCurrentPlayer={gameState?.turnActorPlayerId === compactSeatBands.left.player.id}
                          gameStatus={gameState?.gameStatus}
                          compact
                        />
                      ) : null}
                    </div>

                    <div className="flex min-h-0 flex-col justify-center gap-1">
                      <div className="min-w-0">
                        <CommunityCards
                          gameMode={gameState?.gameMode || 'liarsBar'}
                          communityCards={gameState?.communityCards || []}
                          currentPlay={gameState?.currentPlay || null}
                          mainCard={gameState?.mainCard || null}
                          texasHoldemRound={gameState?.texasHoldemRound || 0}
                          texasStage={gameState?.texasStage}
                          gameStatus={gameState?.gameStatus || 'waiting'}
                          compact
                        />
                      </div>
                    </div>

                    <div className="flex items-center">
                      {compactSeatBands.right ? (
                        <PlayerBox
                          key={compactSeatBands.right.player.id}
                          player={compactSeatBands.right.player}
                          seatNumber={compactSeatBands.right.seatNumber}
                          isCurrentPlayer={gameState?.turnActorPlayerId === compactSeatBands.right.player.id}
                          gameStatus={gameState?.gameStatus}
                          compact
                        />
                      ) : null}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="relative z-10 flex min-h-0 flex-1 flex-col">
                  {seatLayout.top.length > 0 ? (
                    <div className="mx-auto flex max-w-full justify-center" style={{ gap: `${activeSeatMetrics.trackGap}px` }}>
                      {seatLayout.top.map(({ player, seatNumber }) => (
                        <div key={player.id} style={seatSlotStyle}>
                          <PlayerBox
                            player={player}
                            seatNumber={seatNumber}
                            isCurrentPlayer={gameState?.turnActorPlayerId === player.id}
                            gameStatus={gameState?.gameStatus}
                          />
                        </div>
                      ))}
                    </div>
                  ) : null}

                  <div
                    className="mt-1.5 grid flex-1 items-center"
                    style={{
                      gridTemplateColumns: `${activeSeatMetrics.slotWidth}px minmax(0,1fr) ${activeSeatMetrics.slotWidth}px`,
                      gap: `${activeSeatMetrics.trackGap}px`
                    }}
                  >
                    <div className="flex flex-col" style={{ gap: `${activeSeatMetrics.trackGap}px` }}>
                      {seatLayout.left.map(({ player, seatNumber }) => (
                        <div key={player.id} style={seatSlotStyle}>
                          <PlayerBox
                            player={player}
                            seatNumber={seatNumber}
                            isCurrentPlayer={gameState?.turnActorPlayerId === player.id}
                            gameStatus={gameState?.gameStatus}
                          />
                        </div>
                      ))}
                    </div>

                    <div className="min-w-0">
                      <CommunityCards
                        gameMode={gameState?.gameMode || 'liarsBar'}
                        communityCards={gameState?.communityCards || []}
                        currentPlay={gameState?.currentPlay || null}
                        mainCard={gameState?.mainCard || null}
                        texasHoldemRound={gameState?.texasHoldemRound || 0}
                        texasStage={gameState?.texasStage}
                        gameStatus={gameState?.gameStatus || 'waiting'}
                      />
                    </div>

                    <div className="flex flex-col" style={{ gap: `${activeSeatMetrics.trackGap}px` }}>
                      {seatLayout.right.map(({ player, seatNumber }) => (
                        <div key={player.id} style={seatSlotStyle}>
                          <PlayerBox
                            player={player}
                            seatNumber={seatNumber}
                            isCurrentPlayer={gameState?.turnActorPlayerId === player.id}
                            gameStatus={gameState?.gameStatus}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {actionRowContent ? (
                <div
                  className={`relative z-20 mt-1 flex shrink-0 items-center justify-center ${isCompactLandscape ? 'px-1' : 'px-2'}`}
                  style={{ minHeight: `${activeLayoutMetrics.actionRowMinHeight}px`, maxHeight: isCompactLandscape ? 34 : undefined }}
                >
                  {actionRowContent}
                </div>
              ) : null}

              <div className={`relative z-0 mt-1.5 grid shrink-0 items-stretch gap-1.5 sm:grid-cols-[minmax(0,1fr)_148px] [@media(orientation:landscape)_and_(max-height:500px)]:mt-1 [@media(orientation:landscape)_and_(max-height:500px)]:gap-1 ${isCompactLandscape ? 'grid-cols-[minmax(0,1fr)_112px]' : 'grid-cols-[minmax(0,1fr)_136px]'}`}>
                <div
                  className={`grid min-w-0 items-center rounded-[8px] bg-[var(--panel-hand)] ${isCompactLandscape ? 'grid-cols-[116px_minmax(0,1fr)] gap-1 px-1.5 py-1.5' : 'grid-cols-[150px_minmax(0,1fr)] gap-2 px-2 py-2'} [@media(orientation:landscape)_and_(max-height:500px)]:grid-cols-[116px_minmax(0,1fr)] [@media(orientation:landscape)_and_(max-height:500px)]:gap-1 [@media(orientation:landscape)_and_(max-height:500px)]:px-1.5 [@media(orientation:landscape)_and_(max-height:500px)]:py-1.5`}
                  style={{ minHeight: `${activeLayoutMetrics.handPanelMinHeight}px` }}
                >
                  <div className={`flex h-full min-w-0 flex-col justify-center border-l-2 border-[var(--ink)] ${isCompactLandscape ? 'pl-2 pr-1' : 'pl-2.5 pr-2'} [@media(orientation:landscape)_and_(max-height:500px)]:pl-2 [@media(orientation:landscape)_and_(max-height:500px)]:pr-1`}>
                    <div className={`font-semibold leading-none text-[var(--text-soft)] ${isCompactLandscape ? 'text-[9px]' : 'text-[10px]'}`}>
                      进程
                    </div>
                    <div className={`mt-1 truncate font-semibold leading-tight text-[var(--navy)] ${isCompactLandscape ? 'text-[12px]' : 'text-sm'}`}>
                      {gameState?.gameStatus === 'playing' && networkStatus === 'online' ? `轮到 ${gameProgress.actor}` : gameProgress.actor}
                    </div>
                    <div className={`mt-0.5 truncate font-medium leading-tight text-[var(--navy)] ${isCompactLandscape ? 'text-[11px]' : 'text-[12px]'}`}>
                      {gameState?.gameStatus === 'playing' && networkStatus === 'online' ? `进行 ${gameProgress.action}` : gameProgress.action}
                    </div>
                    <div className={`mt-0.5 truncate leading-tight text-[var(--text-soft)] ${isCompactLandscape ? 'text-[9px]' : 'text-[10px]'}`}>
                      {gameProgress.detail}
                    </div>
                  </div>

                  {showHandStatusPrompt ? (
                    <div className="relative px-0 pb-1 pt-0">
                      <div
                        className={`relative flex items-center justify-center overflow-hidden rounded-[8px] px-3 ${isCompactLandscape ? 'py-1.5' : 'py-2'} ${statusPromptBoxClass}`}
                        style={{ minHeight: `${activeLayoutMetrics.statusPromptMinHeight}px` }}
                        role={networkStatus === 'offline' ? 'status' : undefined}
                      >
                          <div className={`min-w-0 text-center text-sm font-semibold [@media(orientation:landscape)_and_(max-height:500px)]:text-[12px] ${statusPromptTextClass}`}>{statusPromptMessage}</div>
                      </div>
                    </div>
                  ) : null}

                  <div className={`${showHandStatusPrompt ? 'mt-1' : 'mt-0'} flex min-w-0 items-center justify-center px-1 py-0.5`}>
                    <PlayerHand
                      cards={currentPlayer?.cards || []}
                      selectedCardIds={selectedCardIds}
                      onCardSelect={(cardId) => {
                        setSelectedCardIds((currentSelected) => {
                          if (currentSelected.includes(cardId)) {
                            return currentSelected.filter((id) => id !== cardId);
                          }

                          if (selectionLimit <= 1) {
                            return [cardId];
                          }

                          if (currentSelected.length >= selectionLimit) {
                            return [...currentSelected.slice(1), cardId];
                          }

                          return [...currentSelected, cardId];
                        });
                      }}
                      gameStatus={gameState?.gameStatus || 'waiting'}
                      canSelect={isSelectingCards}
                      maxSelectable={selectionLimit}
                      compact={isCompactLandscape}
                    />
                  </div>
                </div>

                <div
                  className={`flex h-full flex-col rounded-[8px] ${isMainPlayerTurn ? 'border-2 border-[#EF4444] bg-[linear-gradient(145deg,rgba(255,246,246,0.98),rgba(255,222,222,0.92))]' : 'bg-[var(--panel-player)]'} ${isCompactLandscape ? 'p-1.5' : 'p-2'} [@media(orientation:landscape)_and_(max-height:500px)]:p-1.5`}
                  style={{ minHeight: `${activeLayoutMetrics.playerInfoPanelMinHeight}px` }}
                >
                  <div className="flex min-w-0 items-start justify-between gap-1.5">
                      <div className="min-w-0">
                        <div className={`truncate font-semibold leading-tight text-[var(--navy)] ${isCompactLandscape ? 'text-[12px]' : 'text-sm'}`}>
                          {seatLayout.current?.player.name || currentPlayer?.name || '当前玩家'}
                        </div>
                        <div className={`mt-0.5 font-medium leading-none text-[var(--text-soft)] ${isCompactLandscape ? 'text-[9px]' : 'text-[10px]'}`}>
                          主位
                        </div>
                      </div>
                      <span className={`shrink-0 rounded-[7px] bg-[var(--muted)] font-semibold leading-none text-[var(--teal)] ${isCompactLandscape ? 'px-1.5 py-1 text-[9px]' : 'px-2 py-1 text-[10px]'}`}>
                        {seatLayout.current ? `席位 ${seatLayout.current.seatNumber}` : '席位'}
                      </span>
                  </div>

                  <div
                    className={`mt-1 flex min-w-0 items-center justify-between rounded-[7px] bg-[var(--surface-soft)] text-center font-semibold ${isCompactLandscape ? 'min-h-5 px-1.5 text-[10px]' : 'min-h-6 px-2 text-[11px]'}`}
                    aria-label="总积分"
                  >
                    <span className="whitespace-nowrap text-[var(--text-soft)]">总积分</span>
                    <span className="min-w-0 truncate font-mono tabular-nums text-[var(--navy)]">{currentTotalScore}</span>
                  </div>

                  <div className={`mt-auto grid grid-cols-[repeat(2,minmax(0,1fr))] gap-1 ${isCompactLandscape ? 'pt-1' : ''}`}>
                    <div
                      className={`flex flex-col items-center justify-center rounded-[8px] bg-[var(--panel-metric-bullet)] text-center ${isCompactLandscape ? 'px-1.5 py-1.5' : 'px-2 py-2'}`}
                      aria-label="子弹"
                    >
                      <SmallStatusIcon type="bullet" className={`${isCompactLandscape ? 'h-3 w-3' : 'h-3.5 w-3.5'} shrink-0 text-[var(--teal)]`} />
                      <div className={`whitespace-nowrap font-semibold text-[var(--teal)] ${isCompactLandscape ? 'mt-0.5 text-[12px]' : 'mt-1 text-sm'}`}>{getBulletText(currentPlayer)}</div>
                    </div>
                    <div
                      className={`flex flex-col items-center justify-center rounded-[8px] bg-[var(--panel-metric-hand)] text-center ${isCompactLandscape ? 'px-1.5 py-1.5' : 'px-2 py-2'}`}
                      aria-label="手牌"
                    >
                      <SmallStatusIcon type="card" className={`${isCompactLandscape ? 'h-3 w-3' : 'h-3.5 w-3.5'} shrink-0 text-[var(--teal)]`} />
                      <div className={`whitespace-nowrap font-semibold text-[var(--navy)] ${isCompactLandscape ? 'mt-0.5 text-[12px]' : 'mt-1 text-sm'}`}>{currentPlayer?.cards?.length || 0}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

        </PullToRefresh>

        <RulesPanel isVisible={showRules} gameMode={gameState?.gameMode || 'liarsBar'} onClose={() => setShowRules(false)} />

        <ScoreboardModal
          isVisible={showScores}
          players={scoreboardPlayers}
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

        <GameSettlementModal
          isVisible={showSettlementModal}
          settlement={settlement}
          players={gameState?.players || []}
          currentPlayerId={playerId}
          isHost={isHost}
          isLoading={localLoading}
          onClose={() => setClosedSettlementId(settlementId)}
          onRestartRound={() => handleGameAction('restartRound')}
        />

        {showAddBulletModal ? (
          <div className={modalStyles.overlay}>
            <div className={modalStyles.container}>
              <h3 className={cardStyles.title}>添加子弹</h3>
              <div className={cardStyles.content}>
                <label className={cardStyles.label}>子弹数量</label>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={addBulletInput}
                  onChange={(event) => setAddBulletInput(event.target.value.replace(/\D/g, ''))}
                  className={cardStyles.input}
                />
                <p className="mt-2 text-xs font-semibold text-[var(--text-soft)]">本次至少添加 {minBulletAdd} 颗，可超过弹仓上限。</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button type="button" onClick={() => setShowAddBulletModal(false)} className={`${buttonStyles.gray} w-full`}>
                  取消
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const parsedCount = parseInt(addBulletInput, 10);
                    const nextCount = Number.isFinite(parsedCount) ? Math.max(minBulletAdd, parsedCount) : minBulletAdd;
                    setAddBulletInput(String(nextCount));
                    handleGameAction('addBullets', { count: nextCount }, () => setShowAddBulletModal(false));
                  }}
                  className={`${buttonStyles.primary} w-full ${localLoading ? 'cursor-not-allowed opacity-50' : ''}`}
                  disabled={localLoading || addBulletInput.trim() === ''}
                >
                  确认添加
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {showRefuseBulletsModal ? (
          <div className={modalStyles.overlay}>
            <div className={modalStyles.container}>
              <h3 className={cardStyles.title}>警告</h3>
              <p className="mb-6 text-center text-sm font-semibold text-[var(--text-soft)]">
                {isTexasHoldem ? '确定要提前开枪离场吗？未中弹可安全退出本局。' : '确定要选择不加子弹吗？这将触发处决！'}
              </p>
              <div className="grid grid-cols-2 gap-3">
                <button type="button" onClick={() => setShowRefuseBulletsModal(false)} className={`${buttonStyles.gray} w-full`}>
                  取消
                </button>
                <button
                  type="button"
                  onClick={() => {
                    handleGameAction(isTexasHoldem ? 'exitTexasRound' : 'refuseBullets', undefined, () => setShowRefuseBulletsModal(false));
                  }}
                  className={`${buttonStyles.danger} w-full ${localLoading ? 'cursor-not-allowed opacity-50' : ''}`}
                  disabled={localLoading}
                >
                  {isTexasHoldem ? '确认离场' : '确定不加'}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        <BulletExecutionModal
          isOpen={showExecutionModal}
          victimName={gameState?.players.find((player) => player.id === executionVictimId)?.name || '未知玩家'}
          onFire={handleFireGun}
          onClose={handleCloseExecutionModal}
          shot={executionShot}
          isSpinning={isSpinning}
          canFire={isExecutionVictim && executionShot === null}
          waitingMessage={executionVictimId ? `等待 ${gameState?.players.find((player) => player.id === executionVictimId)?.name || '该玩家'} 开枪` : undefined}
        />
      </div>
    </div>
  );
};

export default GamePage;
