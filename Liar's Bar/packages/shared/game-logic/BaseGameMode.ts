import { Card, CardRank, GameMode, GameState, GameStatus, LeaderboardEntry, Player, PlayRecord, RoundScoreDelta, RoundSettlement, TexasHoldemStage, TexasRoundResult } from './types';
import { getCurrentBulletCount } from './bullet-system';
import {
  PlayerEliminatedStateOptions,
  PlayerPlayingStateOptions,
  addPlayerScore,
  ensureSharedPlayerState,
  resetPlayerForRoom,
  resetPlayerTurnState,
  setPlayerEliminatedState,
  setPlayerPlayingState
} from './player-state';

/**
 * 基础游戏模式抽象类
 * 定义了所有游戏模式共有的属性和方法
 */
export abstract class BaseGameMode {
  // 玩家列表
  protected players: Player[] = [];
  // 游戏状态
  protected gameStatus: GameStatus = 'waiting';
  // 主牌（骗子酒馆模式）
  protected mainCard: CardRank = 'Q';
  // 当前玩家索引
  protected currentPlayerIndex: number = 0;
  // 当前出牌记录
  protected currentPlay: PlayRecord | null = null;
  // 出牌历史记录
  protected playHistory: PlayRecord[] = [];
  // 回合数
  protected round: number = 0;
  // 当前局的首位出牌玩家ID，用于新局轮换
  protected roundStarterPlayerId: string | null = null;
  // 获胜者
  protected winner: Player | null = null;
  // 上一次添加的子弹数量
  protected lastAddedBullets: number = 0;
  // 等待惩罚的玩家ID
  protected pendingPenaltyPlayerId: string | null = null;
  // 惩罚结果
  protected penaltyResult: { shot: boolean; victimId: string } | null = null;
  protected penaltyAwardPlayerId: string | null = null;
  // 是否正在旋转（处决动画）
  protected isSpinning: boolean = false;
  // 游戏模式
  protected gameMode: GameMode;
  // 公共牌（德州扑克模式）
  protected communityCards: Card[] = [];
  // 德州扑克回合
  protected texasHoldemRound: number = 0;
  // 当前回合行动玩家ID
  protected turnActorPlayerId: string | null = null;
  // 回合截止时间
  protected turnDeadlineAt: number | null = null;
  // 回合超时时间（毫秒）
  protected turnTimeoutMs: number = 60000;
  // 等待弃牌的玩家ID（德州扑克模式）
  protected pendingTexasDiscardPlayerId: string | null = null;
  // 德州扑克阶段
  protected texasStage: TexasHoldemStage = 'idle';
  // 德州扑克结算结果
  protected texasRoundResult: TexasRoundResult | null = null;
  // 德州扑克提前开枪中弹待结算积分
  protected texasPendingWinnerScore: number = 0;
  // 单局结算展示数据
  protected roundSettlement: RoundSettlement | null = null;
  // 本局开始时的积分快照
  protected roundScoreBaseline: Map<string, number> = new Map();
  // 排行榜累计积分，玩家离开或回房后仍保留
  protected scoreboard: Map<string, LeaderboardEntry> = new Map();
  // 牌组
  protected deck: Card[] = [];

  /**
   * 构造函数
   * @param gameMode 游戏模式
   */
  constructor(gameMode: GameMode) {
    this.gameMode = gameMode;
  }

  // 抽象方法，子类必须实现
  abstract initializeDeck(): void;
  abstract dealCards(): void;
  abstract startGame(): void;
  abstract addBullets(playerId: string, count: number): boolean;
  abstract discardTexasCard(playerId: string, cardId: string): boolean;
  abstract playCards(playerId: string, cardIds: string[], declaredCount: number): boolean;
  abstract challenge(playerId: string): boolean;
  abstract trust(playerId: string): boolean;
  abstract refuseBullets(playerId: string): boolean;
  abstract fireGun(playerId: string): { shot: boolean; victimId: string } | null;
  abstract resolvePenalty(): void;
  abstract checkGameEnd(): void;

  /**
   * 获取游戏状态
   * @returns 游戏状态对象
   */
  getGameState(): GameState {
    this.syncActivePlayersToScoreboard();

    return {
      players: this.players,
      gameStatus: this.gameStatus,
      mainCard: this.mainCard,
      currentPlayerIndex: this.currentPlayerIndex,
      currentPlay: this.currentPlay,
      playHistory: this.playHistory,
      round: this.round,
      winner: this.winner,
      lastAddedBullets: this.lastAddedBullets,
      pendingPenaltyPlayerId: this.pendingPenaltyPlayerId,
      penaltyResult: this.penaltyResult,
      penaltyAwardPlayerId: this.penaltyAwardPlayerId,
      isSpinning: this.isSpinning,
      gameMode: this.gameMode,
      communityCards: this.communityCards,
      texasHoldemRound: this.texasHoldemRound,
      turnActorPlayerId: this.turnActorPlayerId,
      turnDeadlineAt: this.turnDeadlineAt,
      turnTimeoutMs: this.turnTimeoutMs,
      pendingTexasDiscardPlayerId: this.pendingTexasDiscardPlayerId,
      texasStage: this.texasStage,
      texasRoundResult: this.texasRoundResult,
      texasPendingWinnerScore: this.texasPendingWinnerScore,
      roundSettlement: this.roundSettlement,
      scoreboard: this.getScoreboard()
    };
  }

  /**
   * 添加玩家
   * @param player 玩家对象
   * @returns 是否添加成功
   */
  addPlayer(player: Player): boolean {
    if (this.players.length >= 8) {
      return false;
    }
    const preparedPlayer = ensureSharedPlayerState(player);
    if (this.gameStatus === 'playing') {
      // Mid-game joins are spectators by default and must not block round flow.
      preparedPlayer.cards = [];
      preparedPlayer.isActive = false;
      preparedPlayer.gameState = 'waiting';
      preparedPlayer.hasAddedBullets = false;
      preparedPlayer.texasRoundState = 'waiting';
      preparedPlayer.texasLastAction = null;
      preparedPlayer.isSurvivor = false;
    }
    const existingEntry = this.scoreboard.get(preparedPlayer.id);
    if (existingEntry) {
      preparedPlayer.score = existingEntry.score;
    }
    this.players.push(preparedPlayer);
    this.syncScoreboardForPlayer(preparedPlayer, true);
    return true;
  }

  /**
   * 移除玩家
   * @param playerId 玩家ID
   */
  removePlayer(playerId: string): void {
    const player = this.getPlayer(playerId);
    if (player) {
      this.syncScoreboardForPlayer(player, false);
    }
    this.players = this.players.filter(p => p.id !== playerId);
  }

  /**
   * 获取玩家
   * @param playerId 玩家ID
   * @returns 玩家对象或undefined
   */
  getPlayer(playerId: string): Player | undefined {
    return this.players.find(p => p.id === playerId);
  }

  /**
   * 设置游戏模式
   * @param mode 游戏模式
   */
  setGameMode(mode: GameMode): void {
    this.gameMode = mode;
  }

  /**
   * 重置游戏
   */
  resetGame(): void {
    this.gameStatus = 'waiting';
    this.currentPlayerIndex = 0;
    this.currentPlay = null;
    this.playHistory = [];
    this.round = 0;
    this.roundStarterPlayerId = null;
    this.winner = null;
    this.lastAddedBullets = 0;
    this.pendingPenaltyPlayerId = null;
    this.penaltyResult = null;
    this.penaltyAwardPlayerId = null;
    this.isSpinning = false;
    this.communityCards = [];
    this.texasHoldemRound = 0;
    this.turnActorPlayerId = null;
    this.turnDeadlineAt = null;
    this.pendingTexasDiscardPlayerId = null;
    this.texasStage = 'idle';
    this.texasRoundResult = null;
    this.texasPendingWinnerScore = 0;
    this.roundSettlement = null;
    this.roundScoreBaseline.clear();
    
    // 重置玩家状态，排行榜积分不清零
    this.players.forEach(player => {
      this.resetPlayerForRoom(player);
      this.syncScoreboardForPlayer(player, true);
    });
  }

  protected ensurePlayerState(player: Player): Player {
    return ensureSharedPlayerState(player);
  }

  protected resetPlayerForRoom(player: Player): Player {
    return resetPlayerForRoom(player);
  }

  protected setPlayerPlaying(player: Player, options?: PlayerPlayingStateOptions): Player {
    return setPlayerPlayingState(player, options);
  }

  protected setPlayerEliminated(player: Player, options?: PlayerEliminatedStateOptions): Player {
    return setPlayerEliminatedState(player, options);
  }

  protected resetPlayerTurn(player: Player, options?: PlayerPlayingStateOptions): Player {
    return resetPlayerTurnState(player, options);
  }

  protected addScore(player: Player, delta: number): Player {
    const updatedPlayer = addPlayerScore(player, delta);
    this.syncScoreboardForPlayer(updatedPlayer, true);
    return updatedPlayer;
  }

  protected addScoreToPlayer(playerId: string, delta: number): Player | null {
    const player = this.getPlayer(playerId);
    return player ? this.addScore(player, delta) : null;
  }

  protected syncScoreboardForPlayer(player: Player, isActive: boolean = true): void {
    this.scoreboard.set(player.id, {
      playerId: player.id,
      name: player.name,
      score: player.score ?? 0,
      isActive,
      lastSeen: player.lastSeen
    });
  }

  protected syncActivePlayersToScoreboard(): void {
    for (const player of this.players) {
      this.syncScoreboardForPlayer(player, true);
    }
  }

  getScoreboard(): LeaderboardEntry[] {
    return Array.from(this.scoreboard.values()).sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.name.localeCompare(b.name, 'zh-Hans-CN');
    });
  }

  hydrateScoreboard(entries: LeaderboardEntry[]): void {
    this.scoreboard.clear();
    for (const entry of entries) {
      this.scoreboard.set(entry.playerId, { ...entry });
    }
  }

  protected cloneCards(cards: Card[]): Card[] {
    return cards.map(card => ({ ...card }));
  }

  protected captureRoundScoreBaseline(playerIds?: string[]): void {
    const allowedIds = playerIds ? new Set(playerIds) : null;
    this.roundScoreBaseline.clear();

    for (const player of this.players) {
      if (!allowedIds || allowedIds.has(player.id)) {
        this.roundScoreBaseline.set(player.id, player.score ?? 0);
      }
    }
  }

  protected createScoreDeltas(playerIds?: string[]): RoundScoreDelta[] {
    const orderedIds = playerIds || Array.from(this.roundScoreBaseline.keys());

    return orderedIds
      .map(playerId => {
        const player = this.getPlayer(playerId);
        if (!player) return null;

        const totalScore = player.score ?? 0;
        const baseline = this.roundScoreBaseline.get(playerId) ?? totalScore;
        return {
          playerId,
          delta: totalScore - baseline,
          totalScore
        };
      })
      .filter((delta): delta is RoundScoreDelta => Boolean(delta));
  }

  protected getMinimumBulletAdd(): number {
    return Math.max(1, this.lastAddedBullets);
  }

  protected addBulletsToPlayer(player: Player, count: number): boolean {
    this.ensurePlayerState(player);
    if (player.hasAddedBullets) return false;

    const minAdd = this.getMinimumBulletAdd();
    const currentBullets = getCurrentBulletCount(player);

    if (count < minAdd) return false;

    player.bulletCount = currentBullets + count;
    player.hasAddedBullets = true;
    this.lastAddedBullets = count;
    return true;
  }

  protected getPlayersByLife(options?: { alive?: boolean; activeOnly?: boolean }): Player[] {
    const alive = options?.alive ?? true;
    const activeOnly = options?.activeOnly ?? false;

    return this.players.filter(player => {
      if (alive && player.isEliminated) return false;
      if (!alive && !player.isEliminated) return false;
      if (activeOnly && !player.isActive) return false;
      return true;
    });
  }

  /**
   * 获取玩家列表
   * @returns 玩家列表
   */
  getPlayers(): Player[] {
    return this.players;
  }

  protected findNextMatchingPlayerIndex(startIndex: number, predicate: (player: Player) => boolean): number {
    if (this.players.length === 0) return -1;
    const normalizedStart = ((startIndex % this.players.length) + this.players.length) % this.players.length;

    for (let offset = 0; offset < this.players.length; offset += 1) {
      const index = (normalizedStart + offset) % this.players.length;
      if (predicate(this.players[index])) {
        return index;
      }
    }

    return -1;
  }

  protected resolveNextRoundStarterIndex(predicate: (player: Player) => boolean): number {
    const eligibleIndices = this.players
      .map((player, index) => (predicate(player) ? index : -1))
      .filter((index) => index !== -1);

    if (eligibleIndices.length === 0) return -1;

    if (!this.roundStarterPlayerId) {
      const randomIndex = Math.floor(Math.random() * eligibleIndices.length);
      return eligibleIndices[randomIndex];
    }

    const previousStarterIndex = this.players.findIndex(player => player.id === this.roundStarterPlayerId);
    if (previousStarterIndex !== -1) {
      const rotatedStarterIndex = this.findNextMatchingPlayerIndex(previousStarterIndex + 1, predicate);
      if (rotatedStarterIndex !== -1) {
        return rotatedStarterIndex;
      }
    }

    return eligibleIndices[0];
  }

  protected resolveCurrentRoundStarterIndex(predicate: (player: Player) => boolean): number {
    if (this.players.length === 0) return -1;

    if (this.roundStarterPlayerId) {
      const starterIndex = this.players.findIndex(player => player.id === this.roundStarterPlayerId);
      if (starterIndex !== -1) {
        if (predicate(this.players[starterIndex])) {
          return starterIndex;
        }

        const fallbackStarterIndex = this.findNextMatchingPlayerIndex(starterIndex + 1, predicate);
        if (fallbackStarterIndex !== -1) {
          return fallbackStarterIndex;
        }
      }
    }

    return this.findNextMatchingPlayerIndex(this.currentPlayerIndex, predicate);
  }

  protected rememberRoundStarterByIndex(index: number): void {
    this.roundStarterPlayerId = index >= 0 && index < this.players.length
      ? this.players[index].id
      : null;
  }
}
