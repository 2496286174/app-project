import { DEFAULT_MAX_BULLETS } from './bullet-system';
import { Player } from './types';

export interface PlayerPlayingStateOptions {
  bulletCount?: number;
  bullets?: number;
  initialBullets?: number;
  texasRoundState?: Player['texasRoundState'];
}

export interface PlayerEliminatedStateOptions {
  texasRoundState?: Player['texasRoundState'];
}

export function ensureSharedPlayerState(player: Player): Player {
  if (player.score === undefined) player.score = 0;
  if (player.bulletCount === undefined) player.bulletCount = 0;
  if (player.totalChambers === undefined) player.totalChambers = DEFAULT_MAX_BULLETS;
  if (player.texasRoundState === undefined) player.texasRoundState = 'waiting';
  if (player.texasLastAction === undefined) player.texasLastAction = null;
  return player;
}

export function resetPlayerForRoom(player: Player): Player {
  ensureSharedPlayerState(player);
  player.cards = [];
  player.isEliminated = false;
  player.isActive = true;
  player.gameState = 'waiting';
  player.hasAddedBullets = false;
  player.bulletCount = 0;
  player.totalChambers = DEFAULT_MAX_BULLETS;
  player.isSurvivor = false;
  player.texasRoundState = 'waiting';
  player.texasLastAction = null;
  return player;
}

export function setPlayerPlayingState(player: Player, options: PlayerPlayingStateOptions = {}): Player {
  ensureSharedPlayerState(player);
  player.isEliminated = false;
  player.isActive = true;
  player.gameState = 'playing';
  player.hasAddedBullets = false;

  if (options.bulletCount !== undefined) {
    player.bulletCount = options.bulletCount;
  }

  if (options.bullets !== undefined) {
    player.bullets = options.bullets;
  }

  if (options.initialBullets !== undefined) {
    player.initialBullets = options.initialBullets;
  }

  if (options.texasRoundState !== undefined) {
    player.texasRoundState = options.texasRoundState;
  }

  return player;
}

export function setPlayerEliminatedState(player: Player, options: PlayerEliminatedStateOptions = {}): Player {
  ensureSharedPlayerState(player);
  player.isEliminated = true;
  player.isActive = false;
  player.gameState = 'eliminated';
  player.hasAddedBullets = false;

  if (options.texasRoundState !== undefined) {
    player.texasRoundState = options.texasRoundState;
  }

  return player;
}

export function resetPlayerTurnState(player: Player, options: PlayerPlayingStateOptions = {}): Player {
  ensureSharedPlayerState(player);
  player.hasAddedBullets = false;
  player.isSurvivor = false;

  if (options.bulletCount !== undefined) {
    player.bulletCount = options.bulletCount;
  }

  if (options.bullets !== undefined) {
    player.bullets = options.bullets;
  }

  if (options.initialBullets !== undefined) {
    player.initialBullets = options.initialBullets;
  }

  if (options.texasRoundState !== undefined) {
    player.texasRoundState = options.texasRoundState;
  }

  return player;
}

export function addPlayerScore(player: Player, delta: number): Player {
  ensureSharedPlayerState(player);
  player.score = (player.score || 0) + delta;
  return player;
}
