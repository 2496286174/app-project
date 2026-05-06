import { Player } from './types';

export const DEFAULT_MAX_BULLETS = 8;

export function getMaxBullets(player: Pick<Player, 'totalChambers'>): number {
  const maxBullets = Number(player.totalChambers ?? DEFAULT_MAX_BULLETS);
  return Number.isFinite(maxBullets) && maxBullets > 0 ? maxBullets : DEFAULT_MAX_BULLETS;
}

export function getCurrentBulletCount(player: Pick<Player, 'bulletCount' | 'bullets' | 'totalChambers'>): number {
  const bulletCount = Number(player.bulletCount ?? player.bullets ?? 0);
  if (!Number.isFinite(bulletCount)) {
    return 0;
  }

  return Math.max(0, bulletCount);
}

export function getShotProbability(player: Pick<Player, 'bulletCount' | 'bullets' | 'totalChambers'>): number {
  const maxBullets = getMaxBullets(player);
  return Math.min(1, getCurrentBulletCount(player) / maxBullets);
}

export function shouldShotHit(
  player: Pick<Player, 'bulletCount' | 'bullets' | 'totalChambers'>,
  randomValue = Math.random()
): boolean {
  return randomValue < getShotProbability(player);
}
