import { create } from 'zustand';
import { GameState } from '@liars-bar/shared';

interface GameStore {
  // 游戏状态
  gameState: GameState | undefined;
  playerId: string | null;
  playerName: string;
  networkStatus: 'online' | 'offline' | 'reconnecting';
  isLoading: boolean;
  
  // 操作
  setGameState: (gameState: GameState) => void;
  setPlayerInfo: (playerId: string, playerName: string) => void;
  setNetworkStatus: (status: 'online' | 'offline' | 'reconnecting') => void;
  setLoading: (loading: boolean) => void;
  resetState: () => void;
}

export const useGameStore = create<GameStore>((set) => ({
  // 初始状态
  gameState: undefined,
  playerId: null,
  playerName: '',
  networkStatus: 'online',
  isLoading: false,
  
  // 操作
  setGameState: (gameState) => set({ gameState }),
  setPlayerInfo: (playerId, playerName) => set({ playerId, playerName }),
  setNetworkStatus: (networkStatus) => set({ networkStatus }),
  setLoading: (isLoading) => set({ isLoading }),
  resetState: () => set({
    gameState: undefined,
    playerId: null,
    playerName: '',
    networkStatus: 'online',
    isLoading: false
  })
}));
