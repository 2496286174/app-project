import { BaseGameMode } from './BaseGameMode';
import { Card, CardRank, Player, RoundSettlement } from './types';
import { shouldShotHit } from './bullet-system';

const ROUND_INITIAL_BULLETS = 1;

/**
 * 骗子酒馆游戏模式类
 * 实现了骗子酒馆游戏的核心逻辑
 */
export class LiarsBarGame extends BaseGameMode {
  // 上一次活跃玩家ID
  private lastActivePlayerId: string | null = null;
  // 惩罚原因
  private penaltyReason: string | null = null;
  // 本局发牌后的初始手牌快照
  private roundInitialHands: Map<string, Card[]> = new Map();
  // 本局开枪离场/中弹淘汰的顺序；这些玩家不再参与本局名次积分
  private eliminationOrder: string[] = [];
  // 防止结束结算重复发放名次分
  private hasAwardedPlacementScores = false;
  // 当前出牌循环中已经出过牌的玩家；抽下一位时优先避开这些玩家
  private turnCyclePlayedPlayerIds: Set<string> = new Set();
  // 已经出完手牌的玩家名次，越早出完名次越靠前
  private completedPlayerIds: string[] = [];

  /**
   * 构造函数
   */
  constructor() {
    super('liarsBar');
  }

  /**
   * 开始游戏
   */
  override startGame(): void {
    // 全新开局不沿用上一局的回合起手信息
    this.lastActivePlayerId = null;
    this.roundStarterPlayerId = null;
    this.roundSettlement = null;
    this.eliminationOrder = [];
    this.hasAwardedPlacementScores = false;
    this.completedPlayerIds = [];
    this.gameStatus = 'playing';
    
    // 更新所有玩家的游戏状态
    for (const player of this.players) {
      if (!player.isEliminated) {
        this.setPlayerPlaying(player);
      }
    }
    
    // 开始新的一轮，初始化牌组和分发手牌
    this.startNewRound();
  }

  /**
   * 结束游戏
   */
  endGame(): void {
    if (this.gameStatus === 'playing' && !this.roundSettlement && this.roundInitialHands.size > 0) {
      this.roundSettlement = this.createLiarsRoundSettlement();
    }
    this.gameStatus = 'ended';
    this.lastActivePlayerId = null;
    this.turnCyclePlayedPlayerIds.clear();
    this.completedPlayerIds = [];
  }

  /**
   * 返回房间
   */
  returnToRoom(): void {
    this.gameStatus = 'waiting';
    this.lastActivePlayerId = null;
    this.roundStarterPlayerId = null;
    this.roundSettlement = null;
    this.roundInitialHands.clear();
    this.eliminationOrder = [];
    this.hasAwardedPlacementScores = false;
    this.turnCyclePlayedPlayerIds.clear();
    this.completedPlayerIds = [];
  }

  override resetGame(): void {
    super.resetGame();
    this.lastActivePlayerId = null;
    this.penaltyReason = null;
    this.roundInitialHands.clear();
    this.eliminationOrder = [];
    this.hasAwardedPlacementScores = false;
    this.turnCyclePlayedPlayerIds.clear();
    this.completedPlayerIds = [];
  }

  override removePlayer(playerId: string): void {
    super.removePlayer(playerId);
    this.turnCyclePlayedPlayerIds.delete(playerId);
    this.completedPlayerIds = this.completedPlayerIds.filter(completedPlayerId => completedPlayerId !== playerId);
  }

  /**
   * 结算后由房主点击“下一局”：保留排行榜积分，重置本局淘汰状态重新发牌
   * @returns 是否成功重新开始
   */
  public restartRoundFromSettlement(): boolean {
    if (this.gameStatus !== 'ended') return false;
    if (this.players.length < 2) return false;

    this.gameStatus = 'playing';
    for (const player of this.players) {
      if (this.isSpectatorPlayer(player)) {
        player.cards = [];
        player.hasAddedBullets = false;
        player.isSurvivor = false;
        continue;
      }

      this.setPlayerPlaying(player, {
        bulletCount: ROUND_INITIAL_BULLETS,
        bullets: ROUND_INITIAL_BULLETS,
        initialBullets: ROUND_INITIAL_BULLETS
      });
    }
    this.startNewRound();
    return true;
  }

  /**
   * 记录最后活跃玩家
   * @param playerId 玩家ID
   */
  private rememberLastActivePlayer(playerId: string): void {
    if (!playerId) return;
    this.lastActivePlayerId = playerId;
  }

  private getPlacementOrder(winnerId: string): string[] {
    const participantIds = Array.from(this.roundScoreBaseline.keys());
    const participantSet = new Set(participantIds);
    const completedIds = this.completedPlayerIds.filter(playerId => participantSet.has(playerId));
    const winnerIds = completedIds.length > 0
      ? completedIds
      : participantSet.has(winnerId) ? [winnerId] : [];
    const eliminatedIdSet = new Set(this.eliminationOrder.filter(playerId => participantSet.has(playerId)));
    const placedIds = new Set(winnerIds);
    const remainingIds = participantIds
      .filter(playerId => !placedIds.has(playerId) && !eliminatedIdSet.has(playerId))
      .sort((a, b) => {
        const playerA = this.getPlayer(a);
        const playerB = this.getPlayer(b);
        const cardsA = playerA?.cards.length ?? Number.MAX_SAFE_INTEGER;
        const cardsB = playerB?.cards.length ?? Number.MAX_SAFE_INTEGER;

        if (cardsA !== cardsB) return cardsA - cardsB;
        return participantIds.indexOf(a) - participantIds.indexOf(b);
      });

    return [
      ...winnerIds,
      ...remainingIds
    ];
  }

  private awardPlacementScores(winnerId: string): void {
    if (this.hasAwardedPlacementScores) return;

    const placementOrder = this.getPlacementOrder(winnerId);
    const participantCount = this.roundScoreBaseline.size;

    placementOrder.forEach((playerId, index) => {
      this.addScoreToPlayer(playerId, participantCount - index);
    });

    this.hasAwardedPlacementScores = true;
  }

  private getRandomActivePlayerIndex(excludePlayerId?: string): number {
    const eligibleIndices = this.players
      .map((player, index) => (
        !player.isEliminated &&
        player.isActive &&
        player.id !== excludePlayerId
          ? index
          : -1
      ))
      .filter((index) => index !== -1);

    if (eligibleIndices.length === 0) return -1;

    const randomIndex = Math.min(
      eligibleIndices.length - 1,
      Math.floor(Math.random() * eligibleIndices.length)
    );
    return eligibleIndices[randomIndex];
  }

  private getRandomIndex(indices: number[]): number {
    if (indices.length === 0) return -1;
    const randomIndex = Math.min(
      indices.length - 1,
      Math.floor(Math.random() * indices.length)
    );
    return indices[randomIndex];
  }

  private getUnplayedActivePlayerIndices(excludePlayerId?: string): number[] {
    return this.players
      .map((player, index) => (
        !player.isEliminated &&
        player.isActive &&
        player.id !== excludePlayerId &&
        !this.turnCyclePlayedPlayerIds.has(player.id)
          ? index
          : -1
      ))
      .filter((index) => index !== -1);
  }

  private getRandomUnplayedActivePlayerIndex(excludePlayerId?: string): number {
    let eligibleIndices = this.getUnplayedActivePlayerIndices(excludePlayerId);

    if (eligibleIndices.length === 0) {
      this.turnCyclePlayedPlayerIds.clear();
      if (excludePlayerId) {
        this.turnCyclePlayedPlayerIds.add(excludePlayerId);
      }
      eligibleIndices = this.getUnplayedActivePlayerIndices(excludePlayerId);
    }

    return this.getRandomIndex(eligibleIndices);
  }

  private rememberTurnCyclePlayedPlayer(playerId: string): void {
    if (playerId) {
      this.turnCyclePlayedPlayerIds.add(playerId);
    }
  }

  private ensureCurrentTurnPlayerIndex(): number {
    const currentPlayer = this.players[this.currentPlayerIndex];
    if (currentPlayer && !currentPlayer.isEliminated && currentPlayer.isActive) {
      return this.currentPlayerIndex;
    }

    let nextIndex = this.getRandomUnplayedActivePlayerIndex();
    if (nextIndex === -1) {
      nextIndex = this.getRandomActivePlayerIndex();
    }

    if (nextIndex !== -1) {
      this.currentPlayerIndex = nextIndex;
    }

    return nextIndex;
  }

  private registerCompletedPlayer(playerId: string | null | undefined): boolean {
    if (!playerId) return false;

    const completedPlayer = this.players.find(player => player.id === playerId);
    if (
      !completedPlayer ||
      completedPlayer.cards.length !== 0 ||
      completedPlayer.isEliminated ||
      !completedPlayer.isActive
    ) {
      return false;
    }

    if (!this.completedPlayerIds.includes(completedPlayer.id)) {
      this.completedPlayerIds.push(completedPlayer.id);
    }
    completedPlayer.isActive = false;
    completedPlayer.gameState = 'waiting';
    completedPlayer.hasAddedBullets = false;
    this.turnCyclePlayedPlayerIds.delete(completedPlayer.id);
    return true;
  }

  /**
   * 解析新一轮的起始玩家索引
   * @returns 起始玩家索引
   */
  private resolveRoundStarterIndex(): number {
    return this.getRandomActivePlayerIndex();
  }

  /**
   * 初始化牌组：根据玩家数量动态调整牌组大小
   */
  initializeDeck(): void {
    this.deck = [];
    
    // 计算存活玩家数量（未被淘汰且活跃的玩家）
    const playerCount = this.players.filter(player => !player.isEliminated && player.isActive).length;
    
    // 基础配置：Q、K、A各6张，2张Joker
    let baseRankCount = 6;
    let jokerCount = 2;
    
    // 扩展配置：每增加1名玩家（超过4人），增加Q、K、A各2张和1张Joker
    if (playerCount > 4) {
      const extraPlayers = playerCount - 4;
      baseRankCount += extraPlayers * 2; // 每种点数牌增加2张/人
      jokerCount += extraPlayers; // 增加1张Joker/人
    }
    
    // 添加点数牌
    const ranks: CardRank[] = ['Q', 'K', 'A'];
    for (const rank of ranks) {
      for (let i = 0; i < baseRankCount; i++) {
        this.deck.push({
          rank,
          id: `${rank}-${i}`
        });
      }
    }
    
    // 添加Joker
    for (let i = 0; i < jokerCount; i++) {
      this.deck.push({
        rank: 'Joker',
        id: `Joker-${i}`
      });
    }
    
    // 洗牌
    this.shuffleDeck();
    
    console.log(`骗子酒馆牌组初始化完成：Q、K、A各${baseRankCount}张，Joker ${jokerCount}张，总共${this.deck.length}张牌`);
  }

  /**
   * 洗牌
   */
  private shuffleDeck(): void {
    for (let i = this.deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.deck[i], this.deck[j]] = [this.deck[j], this.deck[i]];
    }
  }

  /**
   * 分发手牌：每位存活玩家5张牌
   */
  dealCards(): void {
    // 获取存活玩家列表
    const alivePlayers = this.players.filter(player => !player.isEliminated && player.isActive);
    const alivePlayerCount = alivePlayers.length;
    
    // 计算需要的牌数
    const requiredCards = alivePlayerCount * 5;
    if (this.deck.length < requiredCards) {
      this.initializeDeck();
      if (this.deck.length < requiredCards) {
        console.error(`牌组不足：需要${requiredCards}张牌，实际只有${this.deck.length}张`);
        return;
      }
    }
    
    // 重置所有玩家的手牌
    for (const player of this.players) {
      player.cards = [];
    }
    
    // 只为存活玩家分配5张牌
    for (let i = 0; i < 5; i++) {
      for (const player of alivePlayers) {
        const randomIndex = Math.floor(Math.random() * this.deck.length);
        const card = this.deck[randomIndex];
        player.cards.push(card);
        this.deck.splice(randomIndex, 1);
      }
    }
  }

  /**
   * 玩家出牌
   * @param playerId 玩家ID
   * @param cardIds 出牌ID列表
   * @param declaredCount 声明的主牌数量
   * @returns 是否出牌成功
   */
  playCards(playerId: string, cardIds: string[], declaredCount: number): boolean {
    // 检查游戏状态和当前玩家
    if (this.gameStatus !== 'playing') return false;
    const currentPlayer = this.players[this.currentPlayerIndex];
    if (currentPlayer.id !== playerId) return false;

    // 检查是否已增加子弹
    if (!currentPlayer.hasAddedBullets) return false;
    
    // 检查出牌数量（1-3张）
    if (cardIds.length < 1 || cardIds.length > 3) return false;
    
    // 检查声明数量是否合理
    if (declaredCount < 1 || declaredCount > 3) return false;
    
    // 获取要出的牌
    const player = this.players.find(p => p.id === playerId);
    if (!player) return false;
    
    const cardsToPlay = player.cards.filter(card => cardIds.includes(card.id));
    if (cardsToPlay.length !== cardIds.length) return false;
    
    // 从玩家手牌中移除这些牌
    player.cards = player.cards.filter(card => !cardIds.includes(card.id));
    
    // 创建出牌记录
    this.currentPlay = {
      playerId,
      cards: cardsToPlay,
      declaredCount,
      isChallenged: false,
      challengeResult: null
    };

    this.rememberTurnCyclePlayedPlayer(playerId);

    // 进入响应阶段时，从本轮还没出过牌的玩家里随机锁定一位响应者。
    const responderIndex = this.getRandomUnplayedActivePlayerIndex(playerId);
    this.turnActorPlayerId = responderIndex === -1 ? null : this.players[responderIndex].id;
    if (responderIndex !== -1) {
      this.players[responderIndex].hasAddedBullets = false;
    }

    this.rememberLastActivePlayer(playerId);
    this.updateGameState();
    
    return true;
  }

  private ensureCurrentResponderIndex(): number {
    if (!this.currentPlay) return -1;

    const currentResponderIndex = this.players.findIndex(player => player.id === this.turnActorPlayerId);
    if (currentResponderIndex !== -1) {
      const currentResponder = this.players[currentResponderIndex];
      if (
        currentResponder.id !== this.currentPlay.playerId &&
        !currentResponder.isEliminated &&
        currentResponder.isActive
      ) {
        return currentResponderIndex;
      }
    }

    const responderIndex = this.getRandomUnplayedActivePlayerIndex(this.currentPlay.playerId);
    this.turnActorPlayerId = responderIndex === -1 ? null : this.players[responderIndex].id;
    return responderIndex;
  }

  /**
   * 获取当前行动玩家ID
   * @returns 当前行动玩家ID
   */
  private getCurrentActorPlayerId(): string | null {
    if (this.gameStatus !== 'playing') return null;

    if (this.currentPlay) {
      const responderIndex = this.ensureCurrentResponderIndex();
      if (responderIndex !== -1) {
        const responder = this.players[responderIndex];
        if (responder && !responder.isEliminated && responder.isActive) {
          return responder.id;
        }
      }
    }

    const currentIndex = this.ensureCurrentTurnPlayerIndex();
    return currentIndex === -1 ? null : this.players[currentIndex]?.id || null;
  }

  /**
   * 骗子酒馆模式：允许下家在质疑/相信前先加子弹
   * @param playerId 玩家ID
   * @param count 子弹数量
   * @returns 是否添加成功
   */
  addBullets(playerId: string, count: number): boolean {
    if (this.gameStatus !== 'playing') return false;

    // 常规阶段：当前玩家回合中加子弹（用于出牌）
    if (!this.currentPlay) {
      const player = this.players.find(p => p.id === playerId);
      if (!player || player.id !== this.players[this.currentPlayerIndex].id) return false;
      if (player.hasAddedBullets) return false;

      if (!this.addBulletsToPlayer(player, count)) return false;

      // 统一更新状态
      this.updateGameState();
      return true;
    }

    // 响应阶段：仅允许本手牌随机锁定的响应者加子弹（用于质疑/相信）
    const responderIndex = this.ensureCurrentResponderIndex();
    if (responderIndex === -1) return false;

    const responder = this.players[responderIndex];
    if (responder.id !== playerId) return false;
    if (responder.hasAddedBullets) return false;

    if (!this.addBulletsToPlayer(responder, count)) return false;

    // 统一更新状态
    this.updateGameState();
    return true;
  }

  /**
   * 统一更新游戏状态
   */
  private updateGameState(): void {
    this.checkGameEnd();

    if (this.gameStatus !== 'playing' || this.pendingPenaltyPlayerId) {
      this.turnActorPlayerId = null;
      return;
    }

    this.turnActorPlayerId = this.getCurrentActorPlayerId();
  }

  /**
   * 玩家质疑
   * @param playerId 玩家ID
   * @returns 是否质疑成功
   */
  challenge(playerId: string): boolean {
    // 检查游戏状态和当前是否有待质疑的出牌
    if (this.gameStatus !== 'playing' || !this.currentPlay) return false;
    
    const responderIndex = this.ensureCurrentResponderIndex();
    if (responderIndex === -1) return false;
    const challengerIndex = this.players.findIndex(p => p.id === playerId);
    
    // 只有本手牌随机锁定的响应者才能质疑
    if (responderIndex !== challengerIndex) return false;

    // 必须先加子弹，才能执行质疑
    const challenger = this.players[challengerIndex];
    if (!challenger?.hasAddedBullets) return false;
    
    // 标记为已质疑
    this.currentPlay.isChallenged = true;
    
    // 验证出牌是否真实（是否是谎言）
    // 真实出牌：所有牌都是主牌或Joker
    const actualMainCardCount = this.currentPlay.cards.filter(card => 
      card.rank === this.mainCard || card.rank === 'Joker'
    ).length;
    
    // 如果实际主牌数量小于声明数量，则为说谎（质疑成功）
    const isLiar = actualMainCardCount < this.currentPlay.declaredCount;
    const challengeSuccess = isLiar;
    this.currentPlay.challengeResult = challengeSuccess;
    
    // 确定谁进行左轮判定
    // 如果是谎言(isLiar)，则出牌者(currentPlay.playerId)进行判定
    // 如果是真话(!isLiar)，则质疑者(playerId)进行判定
    const victimId = isLiar ? this.currentPlay.playerId : playerId;
    const awardPlayerId = playerId;
    
    // 设置等待惩罚状态
    this.pendingPenaltyPlayerId = victimId;
    this.penaltyAwardPlayerId = awardPlayerId;
    this.penaltyReason = 'challenge';
    
    // 添加到历史记录
    this.playHistory.push({ ...this.currentPlay });
    this.rememberLastActivePlayer(playerId);
    this.updateGameState();
    
    return true;
  }

  /**
   * 玩家相信
   * @param playerId 玩家ID
   * @returns 是否相信成功
   */
  trust(playerId: string): boolean {
    // 检查游戏状态和当前是否有待处理的出牌
    if (this.gameStatus !== 'playing' || !this.currentPlay) return false;
    
    const responderIndex = this.ensureCurrentResponderIndex();
    if (responderIndex === -1) return false;
    const trusterIndex = this.players.findIndex(p => p.id === playerId);
    
    // 只有本手牌随机锁定的响应者才能选择相信
    if (responderIndex !== trusterIndex) return false;

    // 必须先加子弹，才能执行相信
    const truster = this.players[trusterIndex];
    if (!truster?.hasAddedBullets) return false;
    
    // 未质疑，添加到历史记录
    this.playHistory.push({ ...this.currentPlay });
    
    const completedPlayerId = this.currentPlay.playerId;
    const completed = this.registerCompletedPlayer(completedPlayerId);

    this.currentPlay = null;
    this.turnActorPlayerId = null;
    if (completed) {
      this.endRoundForSettlementIfReady();
      if (this.gameStatus !== 'playing') {
        this.rememberLastActivePlayer(playerId);
        return true;
      }
    }
    if (!completed || (truster && !truster.isEliminated && truster.isActive)) {
      this.currentPlayerIndex = trusterIndex;
    }
    this.updateGameState();
    this.rememberLastActivePlayer(playerId);
    
    return true;
  }

  /**
   * 拒绝加子弹也视为本轮最后有效操作，触发处决
   * @param playerId 玩家ID
   * @returns 是否拒绝成功
   */
  refuseBullets(playerId: string): boolean {
    if (this.gameStatus !== 'playing') return false;

    if (!this.currentPlay) {
      const player = this.players.find(p => p.id === playerId);
      if (!player || player.id !== this.players[this.currentPlayerIndex].id) return false;
      if (player.hasAddedBullets) return false;

      this.pendingPenaltyPlayerId = playerId;
      this.penaltyAwardPlayerId = null;
      this.penaltyReason = 'refuseBullets';
      this.rememberLastActivePlayer(playerId);
      this.updateGameState();
      return true;
    }

    const responderIndex = this.ensureCurrentResponderIndex();
    if (responderIndex === -1) return false;

    const responder = this.players[responderIndex];
    if (responder.id !== playerId) return false;
    if (responder.hasAddedBullets) return false;

    // 设置等待惩罚状态，触发处决
    this.pendingPenaltyPlayerId = playerId;
    this.penaltyAwardPlayerId = null;
    this.penaltyReason = 'refuseBullets';

    this.rememberLastActivePlayer(playerId);
    this.updateGameState();
    return true;
  }

  /**
   * 检查游戏是否结束
   */
  checkGameEnd(): void {
    // 统计仍在本局参与的玩家数量；开枪幸存但已离场的玩家不再参与胜负判断
    const activePlayers = this.getPlayersByLife({ activeOnly: true });

    // 如果只剩1人存活（总游戏结束）
    if (activePlayers.length <= 1) {
      this.gameStatus = 'ended';
      const placementOrder = this.getPlacementOrder(activePlayers[0]?.id || '');
      const winnerId = placementOrder[0] || activePlayers[0]?.id;
      this.winner = winnerId ? this.players.find(player => player.id === winnerId) || null : null;
      
      // 更新所有玩家状态
      for (const player of this.players) {
        if (
          (this.winner && player.id === this.winner.id) ||
          this.completedPlayerIds.includes(player.id) ||
          (activePlayers.length === 1 && player.id === activePlayers[0].id)
        ) {
          this.setPlayerPlaying(player);
        } else {
          this.setPlayerEliminated(player);
        }
      }
      return;
    }
  }

  private endRoundForSettlementIfReady(): boolean {
    const activePlayers = this.getPlayersByLife({ activeOnly: true });
    if (activePlayers.length > 1) return false;

    this.endRoundForSettlement();
    return true;
  }

  /**
   * 开始新的一轮
   */
  protected startNewRound(): void {
    // 重置当前出牌和历史记录
    this.currentPlay = null;
    this.playHistory = [];
    this.round += 1;
    this.winner = null;
    this.lastAddedBullets = 0;
    this.roundSettlement = null;
    this.roundInitialHands.clear();
    this.eliminationOrder = [];
    this.hasAwardedPlacementScores = false;
    this.turnCyclePlayedPlayerIds.clear();
    this.completedPlayerIds = [];
    
    // 随机选择新的主牌
    const mainCardOptions: CardRank[] = ['Q', 'K', 'A'];
    this.mainCard = mainCardOptions[Math.floor(Math.random() * mainCardOptions.length)];
    
    // 仅重置存活玩家回合状态，不在这里处理弹巢上限重置
    this.resetAlivePlayersForNewRound();
    this.captureRoundScoreBaseline(this.getPlayersByLife().map(player => player.id));

    // 重新洗牌并分发手牌
    this.initializeDeck();
    this.dealCards();
    this.captureInitialHands();

    // 新一轮随机选择起始玩家
    const starterIndex = this.resolveRoundStarterIndex();
    if (starterIndex !== -1) {
      this.currentPlayerIndex = starterIndex;
      this.rememberRoundStarterByIndex(starterIndex);
      this.currentPlay = null;
      this.players[this.currentPlayerIndex].hasAddedBullets = false;
      this.updateGameState();
      return;
    }

    // 兜底
    this.nextPlayer();
    this.updateGameState();
  }

  /**
   * 重置存活玩家的回合状态
   */
  private resetAlivePlayersForNewRound(): void {
    for (const player of this.players) {
      if (!player.isEliminated && player.isActive) {
        this.setPlayerPlaying(player, {
          bulletCount: ROUND_INITIAL_BULLETS,
          bullets: ROUND_INITIAL_BULLETS,
          initialBullets: ROUND_INITIAL_BULLETS
        });
      }
    }
  }

  private isSpectatorPlayer(player: Player): boolean {
    return !player.isEliminated &&
      !player.isActive &&
      player.gameState === 'waiting' &&
      player.texasRoundState === 'waiting' &&
      !this.roundScoreBaseline.has(player.id);
  }

  /**
   * 处决结束后进入结算态，等待房主手动重开
   */
  private endRoundForSettlement(): void {
    this.checkGameEnd();
    if (this.winner) {
      this.awardPlacementScores(this.winner.id);
    }

    if (!this.roundSettlement) {
      this.roundSettlement = this.createLiarsRoundSettlement();
    }
    this.gameStatus = 'ended';
    this.currentPlay = null;
    this.playHistory = [];
    this.turnCyclePlayedPlayerIds.clear();

    for (const player of this.players) {
      if (this.isSpectatorPlayer(player)) {
        player.cards = [];
        player.hasAddedBullets = false;
        player.isSurvivor = false;
        continue;
      }

      if (player.isEliminated) {
        this.setPlayerEliminated(player);
      } else {
        this.setPlayerPlaying(player);
      }
    }

    this.updateGameState();
  }

  /**
   * 处决结算后继续当前手牌，不重新发牌。
   */
  private continueAfterPenalty(preservePreparedPlayerId?: string | null): void {
    const completedPlayerId = this.currentPlay?.challengeResult === false
      ? this.currentPlay.playerId
      : null;

    this.currentPlay = null;
    this.playHistory = [...this.playHistory];

    this.registerCompletedPlayer(completedPlayerId);

    const alivePlayers = this.getPlayersByLife({ activeOnly: true });
    if (alivePlayers.length <= 1) {
      this.endRoundForSettlement();
      return;
    }

    const preparedPlayerIndex = preservePreparedPlayerId
      ? this.players.findIndex(player =>
          player.id === preservePreparedPlayerId &&
          !player.isEliminated &&
          player.isActive
        )
      : -1;
    const nextIndex = preparedPlayerIndex !== -1 ? preparedPlayerIndex : this.getRandomUnplayedActivePlayerIndex();
    if (nextIndex !== -1) {
      this.currentPlayerIndex = nextIndex;
      if (this.players[this.currentPlayerIndex].id !== preservePreparedPlayerId) {
        this.players[this.currentPlayerIndex].hasAddedBullets = false;
      }
    }

    this.updateGameState();
  }

  /**
   * 结算惩罚
   */
  resolvePenalty(): void {
    if (!this.penaltyResult) return;

    const shouldContinue = this.gameStatus === 'playing';
    const preservePreparedPlayerId = this.penaltyAwardPlayerId;
    this.clearPenaltyContext();

    if (shouldContinue) {
      this.continueAfterPenalty(preservePreparedPlayerId);
      return;
    }

    this.updateGameState();
  }

  /**
   * 清理惩罚上下文
   */
  private clearPenaltyContext(): void {
    this.pendingPenaltyPlayerId = null;
    this.penaltyResult = null;
    this.penaltyAwardPlayerId = null;
    this.penaltyReason = null;
    this.isSpinning = false;
  }

  /**
   * 保存本局发牌后的初始手牌
   */
  private captureInitialHands(): void {
    this.roundInitialHands.clear();

    for (const player of this.getPlayersByLife()) {
      this.roundInitialHands.set(player.id, this.cloneCards(player.cards));
    }
  }

  /**
   * 生成骗子酒馆结算数据
   */
  private createLiarsRoundSettlement(): RoundSettlement {
    const playerIds = Array.from(this.roundScoreBaseline.keys());
    const placementOrder = this.getPlacementOrder(this.winner?.id || this.getPlayersByLife({ activeOnly: true })[0]?.id || '');
    const winnerIds = placementOrder[0] ? [placementOrder[0]] : [];

    return {
      id: `${this.gameMode}-${this.round}`,
      gameMode: this.gameMode,
      round: this.round,
      scoreDeltas: this.createScoreDeltas(playerIds),
      hands: playerIds.map(playerId => ({
        playerId,
        cards: this.cloneCards(this.roundInitialHands.get(playerId) || []),
        source: 'initial' as const,
        isWinner: winnerIds.includes(playerId)
      })),
      winnerIds
    };
  }

  /**
   * 开枪
   * @returns 开枪结果
   */
  fireGun(playerId: string): { shot: boolean; victimId: string } | null {
    if (!this.pendingPenaltyPlayerId || this.penaltyResult) return null;
    if (this.pendingPenaltyPlayerId !== playerId) return null;

    const victim = this.players.find(p => p.id === this.pendingPenaltyPlayerId);
    if (!victim) return null;

    const shot = shouldShotHit(victim);

    if (shot) {
      this.setPlayerEliminated(victim);
      this.addScore(victim, -1);
      if (!this.eliminationOrder.includes(victim.id)) {
        this.eliminationOrder.push(victim.id);
      }
    } else {
      this.resetPlayerTurn(victim);
      victim.isActive = false;
      victim.gameState = 'waiting';
      victim.isSurvivor = true;
      if (!this.eliminationOrder.includes(victim.id)) {
        this.eliminationOrder.push(victim.id);
      }
    }

    this.penaltyResult = { shot, victimId: victim.id };
    this.isSpinning = false;

    return this.penaltyResult;
  }

  /**
   * 下一个玩家
   */
  private nextPlayer(options?: { preservePreparedState?: boolean }): void {
    const preservePreparedState = options?.preservePreparedState ?? false;

    const currentPlayerId = this.players[this.currentPlayerIndex]?.id;
    let nextIndex = this.getRandomUnplayedActivePlayerIndex(currentPlayerId);
    if (nextIndex === -1) {
      nextIndex = this.getRandomActivePlayerIndex();
    }
    if (nextIndex === -1) return;

    this.currentPlayerIndex = nextIndex;

    if (!preservePreparedState) {
      this.players[this.currentPlayerIndex].hasAddedBullets = false;
    }
  }

  /**
   * 弃牌（德州扑克）
   * @param playerId 玩家ID
   * @param cardId 卡牌ID
   * @returns 是否弃牌成功
   */
  discardTexasCard(): boolean {
    return false; // 骗子酒馆模式不支持弃牌
  }
}
