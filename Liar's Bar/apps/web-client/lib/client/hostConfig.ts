const DEFAULT_HOST_PORT = '3000';
const PUBLIC_HOST_PORT = process.env.NEXT_PUBLIC_HOST_PORT?.trim() || '';
const PUBLIC_HOST_ADDRESS = process.env.NEXT_PUBLIC_HOST_ADDRESS?.trim() || '';

export type StoredHostConfig = {
  hostAddress: string;
  hostPort: string;
};

function getStoredValue(key: string): string {
  if (typeof window === 'undefined') {
    return '';
  }

  try {
    return window.localStorage.getItem(key)?.trim() || '';
  } catch {
    return '';
  }
}

export function saveHostConfig(config: Partial<StoredHostConfig>): void {
  if (typeof window === 'undefined') {
    return;
  }

  const hostAddress = config.hostAddress?.trim();
  const hostPort = config.hostPort?.trim();

  try {
    if (hostAddress) {
      window.localStorage.setItem('hostAddress', hostAddress);
    }
    if (hostPort) {
      window.localStorage.setItem('hostPort', hostPort);
    }
  } catch {
    // Local storage can be unavailable in hardened browsers.
  }
}

export function getStoredHostConfig(): StoredHostConfig {
  return {
    hostAddress: getDefaultHostAddress(),
    hostPort: getDefaultHostPort()
  };
}

export function getDefaultHostAddress(): string {
  if (typeof window === 'undefined') {
    return PUBLIC_HOST_ADDRESS || 'localhost';
  }

  return getStoredValue('hostAddress') || PUBLIC_HOST_ADDRESS || window.location.hostname || 'localhost';
}

export function getDefaultHostPort(): string {
  if (typeof window === 'undefined') {
    return PUBLIC_HOST_PORT || DEFAULT_HOST_PORT;
  }

  return getStoredValue('hostPort') || PUBLIC_HOST_PORT || window.location.port || DEFAULT_HOST_PORT;
}

export function buildDefaultWebSocketUrl(): string {
  const protocol = typeof window !== 'undefined' && window.location.protocol === 'https:' ? 'wss' : 'ws';
  return `${protocol}://${getDefaultHostAddress()}:${getDefaultHostPort()}`;
}

export function buildHostInfoUrl(config: Partial<StoredHostConfig> = {}): string {
  const hostAddress = config.hostAddress?.trim() || getDefaultHostAddress();
  const hostPort = config.hostPort?.trim() || getDefaultHostPort();
  const protocol = typeof window !== 'undefined' && window.location.protocol === 'https:' ? 'https' : 'http';
  return `${protocol}://${hostAddress}:${hostPort}/host-info`;
}
