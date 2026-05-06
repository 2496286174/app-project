import { GameMode, GameState, Player } from './types';
import { BaseGameMode } from './BaseGameMode';

// 游戏管理器，负责管理游戏模式和状态
export class GameManager {
  private gameMode: BaseGameMode;
  private static instance: GameManager;

  private constructor(gameMode: BaseGameMode) {
    this.gameMode = gameMode;
  }

  // 单例模式
  static getInstance(gameMode?: BaseGameMode): GameManager {
    if (!GameManager.instance && gameMode) {
      GameManager.instance = new GameManager(gameMode);
    }
    return GameManager.instance;
  }

  // 设置游戏模式
  setGameMode(gameMode: BaseGameMode): void {
    this.gameMode = gameMode;
  }

  // 获取当前游戏模式
  getGameMode(): BaseGameMode {
    return this.gameMode;
  }

  // 添加玩家
  addPlayer(player: Player): boolean {
    return this.gameMode.addPlayer(player);
  }

  // 移除玩家
  removePlayer(playerId: string): void {
    this.gameMode.removePlayer(playerId);
  }

  // 获取玩家
  getPlayer(playerId: string): Player | undefined {
    return this.gameMode.getPlayer(playerId);
  }

  // 开始游戏
  startGame(): void {
    this.gameMode.startGame();
  }

  // 发牌
  dealCards(): void {
    this.gameMode.dealCards();
  }

  // 加子弹
  addBullets(playerId: string, count: number): boolean {
    return this.gameMode.addBullets(playerId, count);
  }

  // 弃牌（德州扑克）
  discardTexasCard(playerId: string, cardId: string): boolean {
    return this.gameMode.discardTexasCard(playerId, cardId);
  }

  // 出牌
  playCards(playerId: string, cardIds: string[], declaredCount: number): boolean {
    return this.gameMode.playCards(playerId, cardIds, declaredCount);
  }

  // 质疑
  challenge(playerId: string): boolean {
    return this.gameMode.challenge(playerId);
  }

  // 相信
  trust(playerId: string): boolean {
    return this.gameMode.trust(playerId);
  }

  // 拒绝加子弹
  refuseBullets(playerId: string): boolean {
    return this.gameMode.refuseBullets(playerId);
  }

  // 开枪
  fireGun(playerId: string): { shot: boolean; victimId: string } | null {
    return this.gameMode.fireGun(playerId);
  }

  // 解决惩罚
  resolvePenalty(): void {
    this.gameMode.resolvePenalty();
  }

  // 检查游戏是否结束
  checkGameEnd(): void {
    this.gameMode.checkGameEnd();
  }

  // 获取游戏状态
  getGameState(): GameState {
    return this.gameMode.getGameState();
  }

  // 重置游戏
  resetGame(): void {
    this.gameMode.resetGame();
  }

  // 切换游戏模式
  changeGameMode(mode: GameMode): void {
    this.gameMode.setGameMode(mode);
  }

  // 重新开始回合
  restartRound(): boolean {
    // 检查游戏模式是否有 restartRoundFromSettlement 方法
    if ('restartRoundFromSettlement' in this.gameMode) {
      return (this.gameMode as any).restartRoundFromSettlement();
    }
    return false;
  }

  // 初始化游戏
  initialize(): void {
    // 这里可以根据游戏模式类型创建不同的游戏模式实例
  }
}
