'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { GamePage } from '@liars-bar/ui';
import { GameState } from '@liars-bar/shared';
import { webSocketClient } from '../../lib/client/WebSocketClient';
import { getStoredPlayerIdentity } from '../../lib/client/playerIdentity';
import { useRoomQrCode } from '../../lib/client/useRoomQrCode';
import { useGameStore } from '../../src/store/gameStore';
import { createFullTableMockGameState, createSettlementMockGameState } from './mockGameState';

function cloneGameState(gameState: GameState): GameState {
  return JSON.parse(JSON.stringify(gameState)) as GameState;
}

function gameStatesEqual(left: GameState | null | undefined, right: GameState | null | undefined): boolean {
  if (left === right) {
    return true;
  }
  if (!left || !right) {
    return false;
  }

  return JSON.stringify(left) === JSON.stringify(right);
}

function rollbackOptimisticState(
  previousGameState: GameState | undefined,
  optimisticState: GameState | null,
  setGameState: (gameState: GameState) => void
): void {
  if (!previousGameState || !optimisticState) {
    return;
  }

  const currentGameState = useGameStore.getState().gameState;
  if (gameStatesEqual(currentGameState, optimisticState)) {
    setGameState(previousGameState);
  }
}

function findCurrentPlayer(gameState: GameState, playerId: string) {
  const index = gameState.players.findIndex((player) => player.id === playerId);
  return index === -1 ? null : { player: gameState.players[index], index };
}

function findTurnActorPlayerId(gameState: GameState): string | null {
  return gameState.turnActorPlayerId || gameState.players[gameState.currentPlayerIndex]?.id || null;
}

function findNextTexasDiscardPlayerIndex(gameState: GameState, fromIndex: number): number {
  if (gameState.players.length === 0) {
    return -1;
  }

  for (let offset = 1; offset <= gameState.players.length; offset += 1) {
    const index = (fromIndex + offset) % gameState.players.length;
    const player = gameState.players[index];
    if (!player.isEliminated && player.texasRoundState === 'inHand' && player.cards.length > 2) {
      return index;
    }
  }

  return -1;
}

function applyOptimisticGameAction(
  gameState: GameState | undefined,
  playerId: string,
  action: string,
  data?: Record<string, unknown>
): GameState | null {
  if (!gameState || gameState.gameStatus !== 'playing') {
    return null;
  }

  const nextState = cloneGameState(gameState);
  const current = findCurrentPlayer(nextState, playerId);
  if (!current) {
    return null;
  }

  const turnActorPlayerId = findTurnActorPlayerId(nextState);
  const isTurnActor = turnActorPlayerId === playerId;

  if (action === 'addBullets') {
    const count = Number(data?.count);
    if (!isTurnActor || !Number.isFinite(count) || count <= 0 || current.player.hasAddedBullets) {
      return null;
    }

    if (
      nextState.gameMode === 'texasHoldem' &&
      !(
        (
          ['preFlop', 'flop', 'turn', 'river'].includes(nextState.texasStage || '') ||
          (
            nextState.texasStage === 'preDraw' &&
            nextState.pendingTexasDiscardPlayerId === playerId &&
            current.player.cards.length === 2
          )
        ) &&
        current.player.texasRoundState === 'inHand'
      )
    ) {
      return null;
    }

    current.player.bulletCount = (current.player.bulletCount || 0) + count;
    current.player.hasAddedBullets = true;
    nextState.lastAddedBullets = count;

    if (nextState.gameMode === 'texasHoldem' && nextState.texasStage === 'preDraw') {
      const nextDiscardIndex = findNextTexasDiscardPlayerIndex(nextState, current.index);
      if (nextDiscardIndex !== -1) {
        nextState.currentPlayerIndex = nextDiscardIndex;
        nextState.pendingTexasDiscardPlayerId = nextState.players[nextDiscardIndex].id;
        nextState.turnActorPlayerId = nextState.pendingTexasDiscardPlayerId;
      }
    }

    return nextState;
  }

  if (action === 'playCards') {
    // 骗子酒馆的响应者由房主随机锁定；本地不再按座位顺序预测，避免短暂显示错误玩家可操作。
    return null;
  }

  if (action === 'discardTexasCard') {
    if (nextState.gameMode !== 'texasHoldem' || nextState.pendingTexasDiscardPlayerId !== playerId || current.player.texasRoundState !== 'inHand') {
      return null;
    }

    const cardId = typeof data?.cardId === 'string' ? data.cardId : '';
    if (!cardId) {
      return null;
    }

    current.player.cards = current.player.cards.filter((card) => card.id !== cardId);
    nextState.currentPlayerIndex = current.index;
    nextState.turnActorPlayerId = playerId;
    return nextState;
  }

  return null;
}

const GamePageWrapper = () => {
  const router = useRouter();
  const mockMode = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('mock') : null;
  const isMockGame = mockMode === 'full' || mockMode === 'settlement';
  const {
    gameState,
    playerId,
    playerName,
    networkStatus,
    isLoading,
    setGameState,
    setPlayerInfo,
    setNetworkStatus,
    setLoading,
    resetState
  } = useGameStore();
  const reconnectUiTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [displayNetworkStatus, setDisplayNetworkStatus] = useState<'online' | 'offline' | 'reconnecting'>('online');
  const [hasSyncedInitialState, setHasSyncedInitialState] = useState(false);
  const roomQrCode = useRoomQrCode();

  useEffect(() => {
    webSocketClient.setRealtimeSyncEnabled(true, { syncOnEnable: false });
    setHasSyncedInitialState(false);

    if (isMockGame) {
      setPlayerInfo('mock-p1', '你');
      setGameState(mockMode === 'settlement' ? createSettlementMockGameState() : createFullTableMockGameState());
      setNetworkStatus('online');
      setLoading(false);
      setHasSyncedInitialState(true);
      return;
    }

    const storedIdentity = getStoredPlayerIdentity();

    if (!storedIdentity) {
      router.push('/login');
      return;
    }

    const { playerId: savedId, playerName: savedName } = storedIdentity;

    setPlayerInfo(savedId, savedName);
    setNetworkStatus('reconnecting');

    const unbindGameState = webSocketClient.onGameState((nextGameState) => {
      setGameState(nextGameState);
      setNetworkStatus('online');
      setHasSyncedInitialState(true);
    });

    const unbindError = webSocketClient.onError((error) => {
      console.warn('Game socket warning:', error);
      setNetworkStatus(webSocketClient.getIsConnected() ? 'online' : 'offline');
    });

    const unbindConnectionState = webSocketClient.onConnectionState((state) => {
      setNetworkStatus(state === 'online' ? 'online' : state === 'reconnecting' ? 'reconnecting' : 'offline');
    });

    let disposed = false;

    (async () => {
      try {
        setLoading(true);
        await webSocketClient.connect();
        if (disposed) {
          return;
        }

        await webSocketClient.sync(savedId, { preferSnapshot: true });
        setNetworkStatus('online');
      } catch (error) {
        console.warn('同步游戏状态失败:', error);
        setNetworkStatus('offline');
      } finally {
        if (!disposed) {
          setLoading(false);
        }
      }
    })();

    return () => {
      disposed = true;
      unbindGameState();
      unbindError();
      unbindConnectionState();
    };
  }, [isMockGame, router, setGameState, setLoading, setNetworkStatus, setPlayerInfo]);

  useEffect(() => {
    if (reconnectUiTimerRef.current) {
      clearTimeout(reconnectUiTimerRef.current);
      reconnectUiTimerRef.current = null;
    }

    if (networkStatus === 'reconnecting') {
      reconnectUiTimerRef.current = setTimeout(() => {
        setDisplayNetworkStatus('reconnecting');
        reconnectUiTimerRef.current = null;
      }, 1200);
      return;
    }

    setDisplayNetworkStatus(networkStatus);

    return () => {
      if (reconnectUiTimerRef.current) {
        clearTimeout(reconnectUiTimerRef.current);
        reconnectUiTimerRef.current = null;
      }
    };
  }, [networkStatus]);

  const sendAction = useCallback(
    async (action: string, data?: Record<string, unknown>) => {
      if (isMockGame) {
        if (action === 'returnToRoom') {
          router.push('/room');
        }
        if (action === 'leaveGame') {
          localStorage.removeItem('playerName');
          localStorage.removeItem('playerId');
          resetState();
          router.push('/login');
        }
        return { result: true, replayedCommand: false };
      }

      if (!playerId || !playerName) {
        router.push('/login');
        return { result: false, replayedCommand: false };
      }

      const previousGameState = gameState;
      let optimisticState: GameState | null = null;

      try {
        optimisticState = applyOptimisticGameAction(gameState, playerId, action, data);
        if (optimisticState) {
          setGameState(optimisticState);
        } else {
          setLoading(true);
        }

        const result = await webSocketClient.send(action, {
          ...(data || {}),
          playerId
        });

        if (result.result) {
          setNetworkStatus('online');
          if (action === 'returnToRoom') {
            router.push('/room');
          }
          if (action === 'leaveGame') {
            webSocketClient.disconnect({ allowReconnect: false });
            localStorage.removeItem('playerName');
            localStorage.removeItem('playerId');
            resetState();
            router.push('/login');
          }
        } else if (result.errorCode === 'CONNECTION_CLOSED' || result.errorCode === 'OFFLINE') {
          setNetworkStatus('offline');
          rollbackOptimisticState(previousGameState, optimisticState, setGameState);
        } else if (optimisticState && previousGameState) {
          rollbackOptimisticState(previousGameState, optimisticState, setGameState);
        }

        return result;
      } catch (error) {
        console.warn(`执行游戏操作失败: ${action}`, error);
        setNetworkStatus('offline');
        rollbackOptimisticState(previousGameState, optimisticState, setGameState);
        return { result: false, replayedCommand: false };
      } finally {
        setLoading(false);
      }
    },
    [gameState, isMockGame, playerId, playerName, resetState, router, setGameState, setLoading, setNetworkStatus]
  );

  const refreshStatus = useCallback(async () => {
    if (isMockGame) {
      setGameState(createFullTableMockGameState());
      setNetworkStatus('online');
      return;
    }

    const storedIdentity = getStoredPlayerIdentity();
    if (!storedIdentity) {
      router.push('/login');
      return;
    }

    try {
      setLoading(true);
      if (!webSocketClient.getIsConnected()) {
        setNetworkStatus('reconnecting');
        await webSocketClient.connect();
      }

      const result = await webSocketClient.sync(storedIdentity.playerId, { preferSnapshot: true });
      setNetworkStatus(result.result ? 'online' : 'offline');
    } catch (error) {
      console.warn('刷新游戏状态失败:', error);
      setNetworkStatus('offline');
    } finally {
      setLoading(false);
    }
  }, [isMockGame, router, setGameState, setLoading, setNetworkStatus]);

  useEffect(() => {
    if (isMockGame) {
      return;
    }

    if (!hasSyncedInitialState) {
      return;
    }

    if (playerId && gameState?.players) {
      const playerExists = gameState.players.some((player) => player.id === playerId);
      if (!playerExists && gameState.gameStatus !== 'waiting') {
        router.push('/login');
        return;
      }

      if (playerExists && gameState.gameStatus === 'waiting') {
        router.push('/room');
      }
    }
  }, [gameState, hasSyncedInitialState, isMockGame, playerId, router]);

  return (
    <GamePage
      gameState={gameState}
      playerId={playerId}
      playerName={playerName}
      onSendAction={sendAction}
      onRefreshStatus={refreshStatus}
      roomJoinUrl={roomQrCode.joinUrl}
      roomQrDataUrl={roomQrCode.qrDataUrl}
      isRoomQrLoading={roomQrCode.isLoading}
      onRefreshRoomQr={roomQrCode.refresh}
      isLoading={isLoading}
      networkStatus={displayNetworkStatus}
    />
  );
};

export default GamePageWrapper;
