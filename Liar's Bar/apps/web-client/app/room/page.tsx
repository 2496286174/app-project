'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { RoomPage } from '@liars-bar/ui';
import { webSocketClient } from '../../lib/client/WebSocketClient';
import { getStoredPlayerIdentity } from '../../lib/client/playerIdentity';
import { useRoomQrCode } from '../../lib/client/useRoomQrCode';

interface Player {
  id: string;
  name: string;
  isHost: boolean;
  isReady: boolean;
  score?: number;
  connectionStatus?: 'connected' | 'disconnected';
}

export default function RoomPageWrapper() {
  const router = useRouter();
  const [players, setPlayers] = useState<Player[]>([]);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [isHost, setIsHost] = useState(false);
  const [isRoomFull, setIsRoomFull] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isReadyPending, setIsReadyPending] = useState(false);
  const [gameMode, setGameMode] = useState<'liarsBar' | 'texasHoldem'>('liarsBar');
  const roomQrCode = useRoomQrCode();
  const pendingReadyStateRef = useRef<boolean | null>(null);
  const readyRequestInFlightRef = useRef(false);
  const joinedRoomRef = useRef(false);
  const roomSyncInFlightRef = useRef(false);

  const applyPendingReadyState = useCallback((nextPlayers: Player[], currentPlayerId: string) => {
    const pendingReadyState = pendingReadyStateRef.current;
    if (pendingReadyState === null) {
      return nextPlayers;
    }

    return nextPlayers.map((player) =>
      player.id === currentPlayerId ? { ...player, isReady: pendingReadyState } : player
    );
  }, []);

  const flushReadyIntent = useCallback(async (targetPlayerId?: string | null) => {
    const readyPlayerId = targetPlayerId || null;
    const readyState = pendingReadyStateRef.current;
    if (!readyPlayerId || readyState === null || readyRequestInFlightRef.current) {
      return;
    }

    if (!webSocketClient.getIsConnected()) {
      setIsReadyPending(true);
      return;
    }

    readyRequestInFlightRef.current = true;
    setIsReadyPending(true);

    try {
      const result = await webSocketClient.send('toggleReady', {
        playerId: readyPlayerId,
        isReady: readyState
      });

      if (!result.result) {
        console.warn('toggleReady retry failed:', result.errorCode, result.errorMessage);
      }
    } catch (error) {
      console.warn('重试同步准备状态失败:', error);
    } finally {
      readyRequestInFlightRef.current = false;
      setIsReadyPending(pendingReadyStateRef.current !== null);
    }
  }, []);

  const applyGameState = useCallback(
    (gameState: any, currentPlayerId: string) => {
      if (!gameState || !Array.isArray(gameState.players)) {
        return;
      }

      const mappedPlayers = gameState.players.map((p: any) => ({
        id: p.id,
        name: p.name,
        isHost: p.isHost || false,
        isReady: p.isReady || false,
        score: p.score ?? 0,
        connectionStatus: p.connectionStatus || 'connected'
      }));

      const currentPlayer = gameState.players.find((p: any) => p.id === currentPlayerId);
      const pendingReadyState = pendingReadyStateRef.current;

      if (pendingReadyState !== null && Boolean(currentPlayer?.isReady) === pendingReadyState) {
        pendingReadyStateRef.current = null;
        setIsReadyPending(false);
      } else {
        setIsReadyPending(pendingReadyState !== null);
      }

      setPlayers(applyPendingReadyState(mappedPlayers, currentPlayerId));
      setGameMode(gameState.gameMode === 'texasHoldem' ? 'texasHoldem' : 'liarsBar');

      setIsHost(Boolean(currentPlayer?.isHost));

      if (gameState.gameStatus === 'playing') {
        router.push('/game');
      }
    },
    [applyPendingReadyState, router]
  );

  useEffect(() => {
    const storedIdentity = getStoredPlayerIdentity();

    if (!storedIdentity) {
      router.push('/login');
      return;
    }

    webSocketClient.setRealtimeSyncEnabled(true, { syncOnEnable: false });

    const { playerId: savedId, playerName: savedName } = storedIdentity;

    setPlayerId(savedId);
    setIsHost(false);

    const unbindGameState = webSocketClient.onGameState((gameState) => {
      applyGameState(gameState, savedId);
    });

    const unbindError = webSocketClient.onError((error) => {
      console.warn('Room socket warning:', error);
    });

    let disposed = false;

    const syncRoomSnapshot = async () => {
      if (!webSocketClient.getIsConnected() || roomSyncInFlightRef.current) {
        return;
      }

      roomSyncInFlightRef.current = true;
      try {
        await flushReadyIntent(savedId);
        const result = await webSocketClient.sync(savedId, { preferSnapshot: true });
        if (!result.result) {
          console.warn('room sync failed:', result.errorCode, result.errorMessage);
        }
      } finally {
        roomSyncInFlightRef.current = false;
      }
    };

    const unbindConnectionState = webSocketClient.onConnectionState((state) => {
      if (disposed || state !== 'online' || !joinedRoomRef.current) {
        return;
      }

      void syncRoomSnapshot();
    });

    (async () => {
      try {
        setIsLoading(true);
        await webSocketClient.connect();
        if (disposed) return;

        const joinResult = await webSocketClient.send('joinGame', {
          playerId: savedId,
          playerName: savedName
        });

        if (!joinResult.result && joinResult.errorCode === 'ROOM_FULL') {
          setIsRoomFull(true);
          alert('房间已满，无法加入');
        } else {
          joinedRoomRef.current = true;
          setIsRoomFull(false);
          await syncRoomSnapshot();
        }
      } catch (error) {
        console.warn('加入房间失败:', error);
        alert('加入游戏失败，请重试');
      } finally {
        if (!disposed) {
          setIsLoading(false);
        }
      }
    })();

    return () => {
      disposed = true;
      joinedRoomRef.current = false;
      roomSyncInFlightRef.current = false;
      unbindGameState();
      unbindError();
      unbindConnectionState();
    };
  }, [applyGameState, flushReadyIntent, router]);

  const toggleReady = async () => {
    if (!playerId) return;

    const currentPlayer = players.find((p) => p.id === playerId);
    const newReadyState = !Boolean(currentPlayer?.isReady);
    pendingReadyStateRef.current = newReadyState;
    setPlayers((currentPlayers) => currentPlayers.map((player) =>
      player.id === playerId ? { ...player, isReady: newReadyState } : player
    ));
    setIsReadyPending(true);
    void flushReadyIntent(playerId);
  };

  const startGame = async () => {
    if (!playerId) return;

    try {
      setIsLoading(true);
      const result = await webSocketClient.send('startGame', {
        playerId
      });

      if (result.result) {
        router.push('/game');
      }
    } catch (error) {
      console.warn('开始游戏失败:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const exitRoom = async () => {
    if (playerId) {
      try {
        await webSocketClient.send('leaveGame', { playerId });
      } catch {
        // Ignore socket errors on leave.
      }
    }

    webSocketClient.disconnect({ allowReconnect: false });
    localStorage.removeItem('playerName');
    localStorage.removeItem('playerId');
    router.push('/login');
  };

  const handleGameModeChange = async (mode: 'liarsBar' | 'texasHoldem') => {
    if (!playerId) return;

    try {
      setIsLoading(true);
      const result = await webSocketClient.send('changeGameMode', {
        playerId,
        gameMode: mode
      });

      if (result.result) {
        setGameMode(mode);
      }
    } catch (error) {
      console.warn('切换游戏模式失败:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const refreshStatus = useCallback(async () => {
    const storedIdentity = getStoredPlayerIdentity();
    if (!storedIdentity) {
      router.push('/login');
      return;
    }

    try {
      setIsLoading(true);
      if (!webSocketClient.getIsConnected()) {
        await webSocketClient.connect();
      }

      await webSocketClient.sync(storedIdentity.playerId, { preferSnapshot: true });
    } catch (error) {
      console.warn('刷新房间状态失败:', error);
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  const handleNavigate = (path: string) => {
    router.push(path);
  };

  return (
    <RoomPage
      players={players}
      playerId={playerId || ''}
      isHost={isHost}
      gameMode={gameMode}
      onStartGame={startGame}
      onToggleReady={toggleReady}
      onExitRoom={exitRoom}
      onNavigate={handleNavigate}
      onGameModeChange={handleGameModeChange}
      onRefreshStatus={refreshStatus}
      roomJoinUrl={roomQrCode.joinUrl}
      roomQrDataUrl={roomQrCode.qrDataUrl}
      isRoomQrLoading={roomQrCode.isLoading}
      onRefreshRoomQr={roomQrCode.refresh}
      isLoading={isLoading || isRoomFull}
      isReadyPending={isReadyPending}
    />
  );
}
