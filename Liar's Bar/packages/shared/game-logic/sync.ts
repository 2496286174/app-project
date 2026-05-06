import { GameState, Player } from './types';

export class GameSync {
  // 序列化游戏状态
  static serialize(state: GameState): string {
    return JSON.stringify(state);
  }
  
  // 反序列化游戏状态
  static deserialize(data: string): GameState {
    return JSON.parse(data);
  }
  
  // 验证玩家操作
  static validateAction(action: any): boolean {
    if (!action || typeof action !== 'object') {
      return false;
    }

    if (typeof action.type !== 'string') {
      return false;
    }

    if (!action.playerId || typeof action.playerId !== 'string') {
      return false;
    }

    if (!action.commandId || typeof action.commandId !== 'string') {
      return false;
    }

    if (typeof action.version !== 'number' || !Number.isFinite(action.version) || action.version < 0) {
      return false;
    }

    if (typeof action.timestamp !== 'number' || !Number.isFinite(action.timestamp) || action.timestamp <= 0) {
      return false;
    }

    return true;
  }
  
  // 验证玩家是否可以执行操作
  static canPlayerAct(player: Player): boolean {
    return player.isActive && !player.isEliminated && player.gameState === 'playing';
  }
  
  // 验证出牌操作
  static validatePlayAction(action: {
    playerId: string;
    cardIds: string[];
    declaredCount: number;
  }): boolean {
    if (!action.cardIds || !Array.isArray(action.cardIds) || action.cardIds.length === 0) {
      return false;
    }
    
    if (action.declaredCount <= 0) {
      return false;
    }
    
    return true;
  }
  
  // 验证加子弹操作
  static validateAddBulletsAction(action: {
    playerId: string;
    count: number;
  }): boolean {
    if (action.count <= 0 || action.count > 8) {
      return false;
    }
    
    return true;
  }
}
