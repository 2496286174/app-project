import { BaseGameMode } from './BaseGameMode';
import { Card, CardRank, CardSuit, Player, RoundSettlement, RoundSettlementHand, TexasHoldemStage, TexasRoundResult } from './types';
import { shouldShotHit } from './bullet-system';
import { TexasHandEvaluation, compareTexasHandEvaluations, evaluateTexasHoldemHand } from './texas-holdem';

const TEXAS_STAGE_ROUND: Record<TexasHoldemStage, number> = {
  idle: 0,
  preDraw: 0,
  preFlop: 1,
  flop: 2,
  turn: 3,
  river: 4,
  showdown: 5,
  settlement: 6
};

const ACTION_STAGES: TexasHoldemStage[] = ['preFlop', 'flop', 'turn', 'river'];
const SUITS: CardSuit[] = ['spades', 'hearts', 'diamonds', 'clubs'];
const RANKS: Exclude<CardRank, 'Joker'>[] = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
const ROUND_INITIAL_BULLETS = 1;

export class TexasShowdownGame extends BaseGameMode {
  private lastActivePlayerId: string | null = null;
  private shotExitIds: string[] = [];
  private safeExitIds: string[] = [];
  private pendingTexasExitPlayerId: string | null = null;
  private pendingTexasActionStageAfterPreDraw: TexasHoldemStage | null = null;

  constructor() {
    super('texasHoldem');
  }

  override startGame(): void {
    this.lastActivePlayerId = null;
    this.roundStarterPlayerId = null;
    this.roundSettlement = null;
    this.gameStatus = 'playing';

    for (const player of this.players) {
      if (!player.isEliminated) {
        this.setPlayerPlaying(player);
      }
    }

    this.startNewRound();
  }

  public restartRoundFromSettlement(): boolean {
    if (this.gameStatus !== 'ended') return false;
    if (this.players.length < 2) return false;

    this.gameStatus = 'playing';
    for (const player of this.players) {
      if (this.isSpectatorPlayer(player)) {
        player.cards = [];
        player.hasAddedBullets = false;
        player.isSurvivor = false;
        player.texasRoundState = 'waiting';
        player.texasLastAction = null;
        continue;
      }

      this.setPlayerPlaying(player, { texasRoundState: 'waiting' });
    }
    this.startNewRound();
    return true;
  }

  initializeDeck(): void {
    this.deck = [];

    for (const suit of SUITS) {
      for (const rank of RANKS) {
        this.deck.push({
          id: `${suit}-${rank}`,
          rank,
          suit
        });
      }
    }

    this.shuffleDeck();
  }

  dealCards(): void {
    const alivePlayers = this.getInHandPlayers();

    for (const player of this.players) {
      player.cards = [];
    }

    for (let round = 0; round < 2; round++) {
      for (const player of alivePlayers) {
        const card = this.drawCard();
        if (card) {
          player.cards.push(card);
        }
      }
    }
  }

  addBullets(playerId: string, count: number): boolean {
    if (!this.canActInTexasBulletWindow(playerId)) return false;

    const player = this.getPlayer(playerId);
    if (!player || player.hasAddedBullets) return false;

    if (!this.addBulletsToPlayer(player, count)) return false;
    player.texasLastAction = 'addBullets';
    this.rememberLastActivePlayer(playerId);
    this.advanceAfterAction();
    return true;
  }

  discardTexasCard(playerId: string, cardId: string): boolean {
    if (this.gameStatus !== 'playing') return false;
    if (this.texasStage !== 'preDraw') return false;
    if (this.pendingTexasDiscardPlayerId !== playerId) return false;

    const player = this.getPlayer(playerId);
    if (!player || player.isEliminated || player.texasRoundState !== 'inHand') return false;
    if (player.cards.length !== 3) return false;

    const cardIndex = player.cards.findIndex(card => card.id === cardId);
    if (cardIndex === -1) return false;

    player.cards.splice(cardIndex, 1);
    this.rememberLastActivePlayer(playerId);
    this.currentPlayerIndex = this.players.findIndex(candidate => candidate.id === playerId);
    this.turnActorPlayerId = playerId;
    return true;
  }

  exitTexasRound(playerId: string): boolean {
    if (!this.canActInTexasBulletWindow(playerId)) return false;
    if (this.pendingPenaltyPlayerId || this.penaltyResult) return false;

    const player = this.getPlayer(playerId);
    if (!player || !this.isInHand(player)) return false;

    this.pendingPenaltyPlayerId = playerId;
    this.penaltyAwardPlayerId = null;
    this.pendingTexasExitPlayerId = playerId;
    this.isSpinning = true;
    this.turnActorPlayerId = null;
    this.rememberLastActivePlayer(playerId);
    return true;
  }

  refuseBullets(playerId: string): boolean {
    return this.exitTexasRound(playerId);
  }

  fireGun(playerId: string): { shot: boolean; victimId: string } | null {
    if (!this.pendingPenaltyPlayerId || this.penaltyResult) return null;
    if (this.pendingPenaltyPlayerId !== playerId) return null;
    if (this.pendingTexasExitPlayerId !== playerId) return null;

    const victim = this.getPlayer(playerId);
    if (!victim) return null;

    const shot = shouldShotHit(victim);

    if (shot) {
      this.setPlayerEliminated(victim, { texasRoundState: 'exited' });
      victim.texasLastAction = 'exitShot';
      this.addScore(victim, -1);
      this.texasPendingWinnerScore += 1;
      this.shotExitIds.push(victim.id);
    } else {
      this.resetPlayerTurn(victim, { texasRoundState: 'exited' });
      victim.texasRoundState = 'exited';
      victim.texasLastAction = 'exitSafe';
      victim.isSurvivor = true;
      this.safeExitIds.push(victim.id);
    }

    this.penaltyResult = { shot, victimId: victim.id };
    this.isSpinning = false;
    return this.penaltyResult;
  }

  resolvePenalty(): void {
    if (!this.penaltyResult) return;

    this.pendingPenaltyPlayerId = null;
    this.penaltyResult = null;
    this.penaltyAwardPlayerId = null;
    this.pendingTexasExitPlayerId = null;
    this.isSpinning = false;

    if (this.gameStatus !== 'playing') {
      this.turnActorPlayerId = null;
      return;
    }

    if (this.getInHandPlayers().length <= 1) {
      this.settleRound();
      return;
    }

    this.advanceAfterAction();
  }

  playCards(): boolean {
    return false;
  }

  challenge(): boolean {
    return false;
  }

  trust(): boolean {
    return false;
  }

  checkGameEnd(): void {
    if (this.gameStatus === 'playing' && this.getInHandPlayers().length === 0) {
      this.settleRound();
    }
  }

  private startNewRound(): void {
    this.round += 1;
    this.communityCards = [];
    this.currentPlay = null;
    this.playHistory = [];
    this.lastAddedBullets = 0;
    this.pendingPenaltyPlayerId = null;
    this.penaltyResult = null;
    this.penaltyAwardPlayerId = null;
    this.pendingTexasExitPlayerId = null;
    this.texasRoundResult = null;
    this.roundSettlement = null;
    this.texasPendingWinnerScore = 0;
    this.shotExitIds = [];
    this.safeExitIds = [];
    this.winner = null;
    this.texasStage = 'preDraw';
    this.texasHoldemRound = TEXAS_STAGE_ROUND.preDraw;
    this.pendingTexasActionStageAfterPreDraw = null;

    for (const player of this.players) {
      player.cards = [];
      player.texasLastAction = null;

      if (this.isSpectatorPlayer(player)) {
        player.hasAddedBullets = false;
        player.isSurvivor = false;
        player.texasRoundState = 'waiting';
        continue;
      }

      if (!player.isEliminated) {
        this.setPlayerPlaying(player, {
          bulletCount: ROUND_INITIAL_BULLETS,
          bullets: ROUND_INITIAL_BULLETS,
          initialBullets: ROUND_INITIAL_BULLETS,
          texasRoundState: 'inHand'
        });
      } else {
        this.setPlayerEliminated(player, { texasRoundState: 'waiting' });
        player.texasRoundState = 'waiting';
      }
    }

    this.initializeDeck();
    this.dealCards();
    this.captureRoundScoreBaseline(this.getInHandPlayers().map(player => player.id));

    const starterIndex = this.resolveRoundStarterIndex();
    if (starterIndex === -1) {
      this.settleRound();
      return;
    }

    this.currentPlayerIndex = starterIndex;
    this.rememberRoundStarterByIndex(starterIndex);
    this.startPreDrawStage('flop');
  }

  private startPreDrawStage(nextActionStage: TexasHoldemStage): void {
    this.texasStage = 'preDraw';
    this.texasHoldemRound = TEXAS_STAGE_ROUND.preDraw;
    this.pendingTexasActionStageAfterPreDraw = nextActionStage;
    this.pendingTexasDiscardPlayerId = null;
    this.turnActorPlayerId = null;
    this.lastAddedBullets = 0;

    for (const player of this.players) {
      if (!this.isInHand(player)) continue;
      this.resetPlayerTurn(player);
      player.isSurvivor = false;
    }

    const starterIndex = this.resolvePreDrawStarterIndex();
    if (starterIndex === -1) {
      this.startActionStage(nextActionStage);
      return;
    }

    this.preparePreDrawTurn(starterIndex);
  }

  private startActionStage(stage: TexasHoldemStage): void {
    this.texasStage = stage;
    this.texasHoldemRound = TEXAS_STAGE_ROUND[stage];
    this.pendingTexasActionStageAfterPreDraw = null;
    this.lastAddedBullets = 0;

    this.revealCommunityCardsForStage(stage);

    for (const player of this.players) {
      if (this.isInHand(player)) {
        this.resetPlayerTurn(player);
      }
    }

    const starterIndex = this.resolveActionStageStarterIndex();
    if (starterIndex === -1) {
      this.settleRound();
      return;
    }

    this.currentPlayerIndex = starterIndex;
    this.turnActorPlayerId = this.players[starterIndex].id;
    this.advanceIfStageHasNoActors();
  }

  private advanceAfterAction(): void {
    if (this.pendingPenaltyPlayerId) return;

    if (this.getInHandPlayers().length <= 1) {
      this.settleRound();
      return;
    }

    if (this.texasStage === 'preDraw') {
      this.advancePreDrawTurn();
      return;
    }

    if (!ACTION_STAGES.includes(this.texasStage)) {
      this.turnActorPlayerId = null;
      return;
    }

    const nextActorIndex = this.findNextPlayerIndex(
      this.currentPlayerIndex + 1,
      candidate => this.isInHand(candidate) && !candidate.hasAddedBullets
    );

    if (nextActorIndex !== -1) {
      this.currentPlayerIndex = nextActorIndex;
      this.turnActorPlayerId = this.players[nextActorIndex].id;
      return;
    }

    this.advanceToNextStage();
  }

  private advanceIfStageHasNoActors(): void {
    if (!ACTION_STAGES.includes(this.texasStage)) return;

    const actorIndex = this.findNextPlayerIndex(
      this.currentPlayerIndex,
      candidate => this.isInHand(candidate) && !candidate.hasAddedBullets
    );

    if (actorIndex !== -1) {
      this.currentPlayerIndex = actorIndex;
      this.turnActorPlayerId = this.players[actorIndex].id;
      return;
    }

    this.advanceToNextStage();
  }

  private advanceToNextStage(): void {
    if (this.texasStage === 'preFlop') {
      this.startPreDrawStage('flop');
      return;
    }

    if (this.texasStage === 'flop') {
      this.startPreDrawStage('turn');
      return;
    }

    if (this.texasStage === 'turn') {
      this.startPreDrawStage('river');
      return;
    }

    this.settleRound();
  }

  private advancePreDrawTurn(): void {
    const nextDiscardIndex = this.findNextPlayerIndex(
      this.currentPlayerIndex + 1,
      candidate => this.isInHand(candidate) && !candidate.hasAddedBullets
    );

    if (nextDiscardIndex !== -1) {
      this.preparePreDrawTurn(nextDiscardIndex);
      return;
    }

    this.pendingTexasDiscardPlayerId = null;
    this.completePreDrawStage();
  }

  private preparePreDrawTurn(playerIndex: number): void {
    const player = this.players[playerIndex];
    if (!player || !this.isInHand(player)) return;

    if (player.cards.length <= 2) {
      const card = this.drawCard();
      if (card) {
        player.cards.push(card);
      }
    }

    this.currentPlayerIndex = playerIndex;
    this.pendingTexasDiscardPlayerId = player.id;
    this.turnActorPlayerId = player.id;
  }

  private completePreDrawStage(): void {
    const completedStage = this.pendingTexasActionStageAfterPreDraw || 'flop';
    this.pendingTexasDiscardPlayerId = null;
    this.turnActorPlayerId = null;
    this.pendingTexasActionStageAfterPreDraw = null;

    this.revealCommunityCardsForStage(completedStage);

    if (completedStage === 'flop') {
      this.startPreDrawStage('turn');
      return;
    }

    if (completedStage === 'turn') {
      this.startPreDrawStage('river');
      return;
    }

    this.settleRound();
  }

  private settleRound(): void {
    const participants = this.getInHandPlayers();
    const safeExitIds = [...new Set(this.safeExitIds)];
    const shotExitIds = [...new Set(this.shotExitIds)];

    if (participants.length === 0) {
      const result: TexasRoundResult = {
        winnerIds: [],
        tiedBestIds: [],
        participantIds: [],
        loserIds: [],
        safeExitIds,
        shotExitIds,
        winnerScoreGain: 0
      };
      this.gameStatus = 'ended';
      this.texasStage = 'settlement';
      this.texasHoldemRound = TEXAS_STAGE_ROUND.settlement;
      this.turnActorPlayerId = null;
      this.pendingTexasDiscardPlayerId = null;
      this.texasRoundResult = result;
      this.roundSettlement = this.createTexasRoundSettlement(result, []);
      return;
    }

    const showdown = participants.length === 1
      ? { winner: participants[0], tiedBestIds: [participants[0].id], evaluatedHands: [] }
      : this.resolveShowdownWinner(participants);
    const winner = showdown.winner;
    const loserIds = participants
      .filter(player => player.id !== winner.id)
      .map(player => player.id);
    const winnerScoreGain = loserIds.length + this.texasPendingWinnerScore;

    this.addScore(winner, winnerScoreGain);
    for (const loserId of loserIds) {
      const loser = this.getPlayer(loserId);
      if (loser) {
        this.addScore(loser, -1);
      }
    }

    this.winner = winner;
    this.gameStatus = 'ended';
    this.texasStage = 'settlement';
    this.texasHoldemRound = TEXAS_STAGE_ROUND.settlement;
    this.turnActorPlayerId = null;
    this.pendingTexasDiscardPlayerId = null;
    const result: TexasRoundResult = {
      winnerIds: [winner.id],
      tiedBestIds: showdown.tiedBestIds,
      participantIds: participants.map(player => player.id),
      loserIds,
      safeExitIds,
      shotExitIds,
      winnerScoreGain
    };
    this.texasRoundResult = result;
    this.roundSettlement = this.createTexasRoundSettlement(result, showdown.evaluatedHands);
  }

  private resolveShowdownWinner(participants: Player[]): { winner: Player; tiedBestIds: string[]; evaluatedHands: Array<{ player: Player; evaluation: TexasHandEvaluation }> } {
    let bestPlayer = participants[0];
    let bestEvaluation: TexasHandEvaluation | null = null;
    const evaluatedHands: Array<{ player: Player; evaluation: TexasHandEvaluation }> = [];

    for (const player of participants) {
      const evaluation = evaluateTexasHoldemHand([...player.cards, ...this.communityCards]);
      evaluatedHands.push({ player, evaluation });

      if (!bestEvaluation || compareTexasHandEvaluations(evaluation, bestEvaluation) > 0) {
        bestPlayer = player;
        bestEvaluation = evaluation;
      }
    }

    const tiedBestIds = evaluatedHands
      .filter(hand => compareTexasHandEvaluations(hand.evaluation, bestEvaluation!) === 0)
      .map(hand => hand.player.id);

    return {
      // 完全同牌型时按座位顺序取最靠前者，保持积分结算为单一赢家。
      winner: bestPlayer,
      tiedBestIds,
      evaluatedHands
    };
  }

  private createTexasRoundSettlement(
    result: TexasRoundResult,
    evaluatedHands: Array<{ player: Player; evaluation: TexasHandEvaluation }>
  ): RoundSettlement {
    const playerIds = Array.from(this.roundScoreBaseline.keys());
    const evaluationByPlayerId = new Map(evaluatedHands.map(hand => [hand.player.id, hand.evaluation]));
    const rankedEvaluations = [...evaluatedHands].sort((a, b) => compareTexasHandEvaluations(b.evaluation, a.evaluation));
    const compareRankByPlayerId = new Map<string, number>();

    rankedEvaluations.forEach((hand, index) => {
      const previous = rankedEvaluations[index - 1];
      const rank = previous && compareTexasHandEvaluations(hand.evaluation, previous.evaluation) === 0
        ? compareRankByPlayerId.get(previous.player.id) || index
        : index + 1;
      compareRankByPlayerId.set(hand.player.id, rank);
    });

    if (result.participantIds.length === 1) {
      compareRankByPlayerId.set(result.participantIds[0], 1);
    }

    const hands: RoundSettlementHand[] = playerIds.map(playerId => {
      const player = this.getPlayer(playerId);
      const evaluation = evaluationByPlayerId.get(playerId);

      return {
        playerId,
        cards: this.cloneCards(player?.cards || []),
        source: 'final',
        isParticipant: result.participantIds.includes(playerId),
        isWinner: result.winnerIds.includes(playerId),
        isTiedBest: (result.tiedBestIds || result.winnerIds).includes(playerId),
        compareRank: compareRankByPlayerId.get(playerId),
        texasRoundState: player?.texasRoundState,
        texasLastAction: player?.texasLastAction,
        handCategory: evaluation?.category,
        handCategoryRank: evaluation?.categoryRank,
        handRanks: evaluation?.ranks ? [...evaluation.ranks] : undefined,
        bestCards: evaluation?.cards ? this.cloneCards(evaluation.cards) : undefined
      };
    });

    return {
      id: `${this.gameMode}-${this.round}`,
      gameMode: this.gameMode,
      round: this.round,
      scoreDeltas: this.createScoreDeltas(playerIds),
      hands,
      winnerIds: result.winnerIds,
      loserIds: result.loserIds,
      safeExitIds: result.safeExitIds,
      shotExitIds: result.shotExitIds,
      communityCards: this.cloneCards(this.communityCards)
    };
  }

  private revealCommunityCardsForStage(stage: TexasHoldemStage): void {
    const targetCount = stage === 'flop' ? 3 : stage === 'turn' ? 4 : stage === 'river' ? 5 : this.communityCards.length;

    while (this.communityCards.length < targetCount) {
      const card = this.drawCard();
      if (!card) return;
      this.communityCards.push(card);
    }
  }

  private canActInTexasBulletWindow(playerId: string): boolean {
    if (this.gameStatus !== 'playing') return false;
    if (this.pendingPenaltyPlayerId) return false;

    const player = this.getPlayer(playerId);
    if (!player || !this.isInHand(player)) return false;

    if (this.texasStage === 'preDraw') {
      return this.pendingTexasDiscardPlayerId === playerId &&
        this.turnActorPlayerId === playerId &&
        player.cards.length === 2;
    }

    if (!ACTION_STAGES.includes(this.texasStage)) return false;
    return this.turnActorPlayerId === playerId;
  }

  private getInHandPlayers(): Player[] {
    return this.players.filter(player => this.isInHand(player));
  }

  private isInHand(player: Player): boolean {
    return !player.isEliminated && player.texasRoundState === 'inHand';
  }

  private isSpectatorPlayer(player: Player): boolean {
    return !player.isEliminated &&
      !player.isActive &&
      player.gameState === 'waiting' &&
      player.texasRoundState === 'waiting' &&
      !this.roundScoreBaseline.has(player.id);
  }

  private resolveRoundStarterIndex(): number {
    return this.resolveNextRoundStarterIndex(player => this.isInHand(player));
  }

  private resolveActionStageStarterIndex(): number {
    return this.resolveCurrentRoundStarterIndex(player => this.isInHand(player));
  }

  private resolvePreDrawStarterIndex(): number {
    return this.resolveCurrentRoundStarterIndex(player => this.isInHand(player) && !player.hasAddedBullets);
  }

  private findNextPlayerIndex(startIndex: number, predicate: (player: Player) => boolean): number {
    if (this.players.length === 0) return -1;
    const normalizedStart = ((startIndex % this.players.length) + this.players.length) % this.players.length;

    for (let offset = 0; offset < this.players.length; offset++) {
      const index = (normalizedStart + offset) % this.players.length;
      if (predicate(this.players[index])) {
        return index;
      }
    }

    return -1;
  }

  private rememberLastActivePlayer(playerId: string): void {
    if (playerId) {
      this.lastActivePlayerId = playerId;
    }
  }

  private drawCard(): Card | null {
    return this.deck.shift() || null;
  }

  private shuffleDeck(): void {
    for (let i = this.deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.deck[i], this.deck[j]] = [this.deck[j], this.deck[i]];
    }
  }
}
