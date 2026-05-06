/**
 * 卡牌类型定义
 */
// 卡牌点数
export type CardRank = '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A' | 'Joker';
// 卡牌花色（仅德州扑克使用）
export type CardSuit = 'hearts' | 'diamonds' | 'clubs' | 'spades';

/**
 * 卡牌接口
 */
export interface Card {
  rank: CardRank; // 卡牌点数
  suit?: CardSuit; // 花色，仅德州扑克使用
  id: string; // 唯一标识符，用于区分相同牌
}

/**
 * 玩家接口
 */
export interface Player {
  id: string; // 玩家唯一ID
  name: string; // 玩家名称
  cards: Card[]; // 玩家手牌
  isEliminated: boolean; // 是否已被淘汰
  isActive: boolean; // 是否活跃
  bullets: number; // 当前子弹数量
  initialBullets: number; // 初始子弹总数
  score?: number; // 积分
  gameState: 'playing' | 'eliminated' | 'waiting'; // 游戏状态
  isReady?: boolean; // 准备状态
  isHost?: boolean; // 是否为房主
  hasAddedBullets?: boolean; // 本回合是否已增加子弹
  bulletCount?: number; // 当前累积的子弹数（个人风险值）
  totalChambers?: number; // 剩余弹巢总数（分母，初始为8）
  isSurvivor?: boolean; // 本轮是否触发过“处决幸存”
  connectionStatus?: 'connected' | 'disconnected'; // 联机连接状态
  lastSeen?: number; // 最后一次活跃时间戳
  texasRoundState?: 'waiting' | 'inHand' | 'exited'; // 德州扑克本局状态
  texasLastAction?: 'addBullets' | 'exitSafe' | 'exitShot' | null; // 德州扑克最近动作
}

/**
 * 出牌记录接口
 */
export interface PlayRecord {
  playerId: string; // 出牌玩家ID
  cards: Card[]; // 出的牌
  declaredCount: number; // 声明的主牌数量
  isChallenged: boolean; // 是否被质疑
  challengeResult: boolean | null; // 质疑结果：true-质疑成功, false-质疑失败, null-未质疑
}

/**
 * 游戏模式类型
 */
export type GameMode = 'liarsBar' | 'texasHoldem';

/**
 * 游戏状态类型
 */
export type GameStatus = 'waiting' | 'playing' | 'ended';

/**
 * 德州扑克阶段
 */
export type TexasHoldemStage = 'idle' | 'preDraw' | 'preFlop' | 'flop' | 'turn' | 'river' | 'showdown' | 'settlement';

/**
 * 德州扑克单局结算结果
 */
export interface TexasRoundResult {
  winnerIds: string[];
  tiedBestIds?: string[];
  participantIds: string[];
  loserIds: string[];
  safeExitIds: string[];
  shotExitIds: string[];
  winnerScoreGain: number;
}

/**
 * 排行榜累计积分
 */
export interface LeaderboardEntry {
  playerId: string;
  name: string;
  score: number;
  isActive: boolean;
  lastSeen?: number;
}

/**
 * 单局积分变化
 */
export interface RoundScoreDelta {
  playerId: string;
  delta: number;
  totalScore: number;
}

/**
 * 单局手牌快照
 */
export interface RoundSettlementHand {
  playerId: string;
  cards: Card[];
  source: 'initial' | 'final';
  isParticipant?: boolean;
  isWinner?: boolean;
  isTiedBest?: boolean;
  compareRank?: number;
  texasRoundState?: Player['texasRoundState'];
  texasLastAction?: Player['texasLastAction'];
  handCategory?: string;
  handCategoryRank?: number;
  handRanks?: number[];
  bestCards?: Card[];
}

/**
 * 单局结算展示数据
 */
export interface RoundSettlement {
  id: string;
  gameMode: GameMode;
  round: number;
  scoreDeltas: RoundScoreDelta[];
  hands: RoundSettlementHand[];
  winnerIds: string[];
  loserIds?: string[];
  safeExitIds?: string[];
  shotExitIds?: string[];
  communityCards?: Card[];
}

/**
 * 游戏状态返回接口
 */
export interface GameState {
  players: Player[]; // 玩家列表
  gameStatus: GameStatus; // 游戏状态
  mainCard: CardRank; // 主牌（骗子酒馆模式）
  currentPlayerIndex: number; // 当前玩家索引
  currentPlay: PlayRecord | null; // 当前出牌记录
  playHistory: PlayRecord[]; // 出牌历史记录
  round: number; // 回合数
  winner: Player | null; // 获胜者
  lastAddedBullets: number; // 上一次添加的子弹数量
  pendingPenaltyPlayerId: string | null; // 等待惩罚的玩家ID
  penaltyResult: { shot: boolean; victimId: string } | null; // 惩罚结果
  penaltyAwardPlayerId?: string | null; // 惩罚中弹时获得积分的玩家ID
  isSpinning: boolean; // 是否正在旋转（处决动画）
  gameMode: GameMode; // 游戏模式
  communityCards: Card[]; // 公共牌（德州扑克模式）
  texasHoldemRound: number; // 德州扑克回合
  turnActorPlayerId: string | null; // 当前回合行动玩家ID
  turnDeadlineAt: number | null; // 回合截止时间
  turnTimeoutMs: number; // 回合超时时间（毫秒）
  pendingTexasDiscardPlayerId?: string | null; // 等待弃牌的玩家ID（德州扑克模式）
  texasStage?: TexasHoldemStage; // 德州扑克阶段
  texasRoundResult?: TexasRoundResult | null; // 德州扑克本局结算结果
  texasPendingWinnerScore?: number; // 德州扑克提前开枪中弹待结算积分
  roundSettlement?: RoundSettlement | null; // 单局结算弹窗数据
  scoreboard?: LeaderboardEntry[]; // 永久排行榜累计积分
}

/**
 * 游戏模式接口
 */
export interface GameModeInterface {
  initializeDeck(): void; // 初始化牌组
  dealCards(): void; // 分发手牌
  startGame(): void; // 开始游戏
  addBullets(playerId: string, count: number): boolean; // 添加子弹
  discardTexasCard(playerId: string, cardId: string): boolean; // 弃牌（德州扑克模式）
  playCards(playerId: string, cardIds: string[], declaredCount: number): boolean; // 出牌
  challenge(playerId: string): boolean; // 质疑
  trust(playerId: string): boolean; // 相信
  refuseBullets(playerId: string): boolean; // 拒绝加子弹
  fireGun(playerId: string): { shot: boolean; victimId: string } | null; // 开枪
  resolvePenalty(): void; // 结算惩罚
  checkGameEnd(): void; // 检查游戏是否结束
  getGameState(): GameState; // 获取游戏状态
}
