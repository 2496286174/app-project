import type { GameState, HostInfo } from '@liars-bar/shared';
import type { Server as HttpServer } from 'http';

export type HostPlatform = 'pc' | 'android' | 'dev' | 'unknown';

export interface CreateHostRuntimeOptions {
  roomId?: string;
  platform?: HostPlatform;
  hostName?: string;
  maxPlayers?: number;
  maxProcessedCommands?: number;
  port?: number;
  listenHost?: string;
  lanIp?: string;
  webRoot?: string;
  disableStaticWeb?: boolean;
  devInstructions?: string;
  devJoinUrl?: string;
  fallbackPorts?: number[];
  onStatus?: (status: string) => void;
  onHostInfo?: (hostInfo: HostInfo) => void;
}

export interface HostRuntime {
  close(): Promise<void>;
  getGameState(): GameState;
  getHostInfo(): HostInfo;
  port: number;
  ready: Promise<HostInfo>;
  server: HttpServer;
  wss: unknown;
}

export function createHostRuntime(options?: CreateHostRuntimeOptions): HostRuntime;
export function getLanIp(): string;
