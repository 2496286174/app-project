export type StoredPlayerIdentity = {
  playerId: string;
  playerName: string;
};

const PLAYER_IDENTITY_SCHEMA_KEY = 'playerIdentitySchemaVersion';
const PLAYER_IDENTITY_SCHEMA_VERSION = 'player-name-id-v1';

function ensurePlayerIdentitySchema(): void {
  if (localStorage.getItem(PLAYER_IDENTITY_SCHEMA_KEY) === PLAYER_IDENTITY_SCHEMA_VERSION) {
    return;
  }

  localStorage.removeItem('playerName');
  localStorage.removeItem('playerId');
  localStorage.setItem(PLAYER_IDENTITY_SCHEMA_KEY, PLAYER_IDENTITY_SCHEMA_VERSION);
}

export function getPlayerIdFromName(name: string): string {
  return name.trim();
}

export function savePlayerIdentity(name: string): StoredPlayerIdentity {
  const playerName = name.trim();
  const playerId = getPlayerIdFromName(playerName);

  localStorage.setItem(PLAYER_IDENTITY_SCHEMA_KEY, PLAYER_IDENTITY_SCHEMA_VERSION);
  localStorage.setItem('playerName', playerName);
  localStorage.setItem('playerId', playerId);

  return { playerId, playerName };
}

export function getStoredPlayerIdentity(): StoredPlayerIdentity | null {
  ensurePlayerIdentitySchema();

  const playerName = (localStorage.getItem('playerName') || '').trim();
  if (!playerName) {
    return null;
  }

  const playerId = getPlayerIdFromName(playerName);
  if (localStorage.getItem('playerId') !== playerId) {
    localStorage.setItem('playerId', playerId);
  }

  return { playerId, playerName };
}
