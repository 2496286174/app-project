'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { formatJoinAddress } from '@liars-bar/ui';
import { buildHostInfoUrl, getStoredHostConfig } from '../../lib/client/hostConfig';
import { webSocketClient } from '../../lib/client/WebSocketClient';

type HostInfo = {
  platform?: string;
  hostName?: string;
  name?: string;
  lanIp?: string;
  port?: number;
  localUrl?: string;
  joinUrl?: string;
  qrText?: string;
  wsUrl?: string;
  playerCount?: number;
  maxPlayers?: number;
  gameMode?: string;
};

function displayMode(mode?: string) {
  return mode === 'texasHoldem' ? '德州扑克未开放' : '骗子酒馆';
}

export default function HostConsolePage() {
  const router = useRouter();
  const [hostInfo, setHostInfo] = useState<HostInfo | null>(null);
  const [gameState, setGameState] = useState<any>(null);
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [connectionState, setConnectionState] = useState(webSocketClient.getConnectionState());
  const localJoinUrl = useMemo(() => {
    const port = hostInfo?.port || getStoredHostConfig().hostPort || '3000';
    return `/login?hostAddress=127.0.0.1&hostPort=${port}`;
  }, [hostInfo?.port]);

  useEffect(() => {
    const hostname = window.location.hostname.toLowerCase();
    const isLocalHost =
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '::1' ||
      hostname === '[::1]';

    if (!isLocalHost) {
      const port = window.location.port || getStoredHostConfig().hostPort || '3000';
      router.replace(`/login?hostAddress=${encodeURIComponent(window.location.hostname)}&hostPort=${encodeURIComponent(port)}`);
      return;
    }

    let disposed = false;

    const loadHostInfo = async () => {
      try {
        const response = await fetch(buildHostInfoUrl(), { cache: 'no-store' });
        if (!response.ok) return;
        const nextInfo = await response.json();
        if (!disposed) setHostInfo(nextInfo);
      } catch {
        // The websocket hostInfo event below is the fallback in development.
      }
    };

    const unbindHostInfo = webSocketClient.onHostInfo((nextInfo) => {
      setHostInfo(nextInfo);
    });
    const unbindGameState = webSocketClient.onGameState((nextState) => {
      setGameState(nextState);
    });
    const unbindConnectionState = webSocketClient.onConnectionState(setConnectionState);

    loadHostInfo();
    webSocketClient.connect().catch(() => {
      setConnectionState('offline');
    });

    return () => {
      disposed = true;
      unbindHostInfo();
      unbindGameState();
      unbindConnectionState();
    };
  }, [router]);

  useEffect(() => {
    const qrText = hostInfo?.qrText || hostInfo?.joinUrl || '';
    if (!qrText) {
      setQrDataUrl('');
      return;
    }

    let disposed = false;
    import('qrcode')
      .then((QRCode) => QRCode.toDataURL(qrText, { margin: 1, width: 220, color: { dark: '#111111', light: '#ffffff' } }))
      .then((url) => {
        if (!disposed) setQrDataUrl(url);
      })
      .catch(() => setQrDataUrl(''));

    return () => {
      disposed = true;
    };
  }, [hostInfo?.qrText, hostInfo?.joinUrl]);

  const players = Array.isArray(gameState?.players) ? gameState.players : [];
  const joinUrl = hostInfo?.joinUrl || '';
  const displayedJoinUrl = formatJoinAddress(joinUrl);

  return (
    <main className="min-h-dvh bg-[var(--background)] px-4 py-5 text-[var(--navy)] [@media(orientation:landscape)_and_(max-height:500px)]:px-2 [@media(orientation:landscape)_and_(max-height:500px)]:py-2">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 [@media(orientation:landscape)_and_(max-height:500px)]:gap-2">
        <header className="flex flex-col gap-3 rounded-[8px] border border-[var(--line)] bg-[var(--surface)] p-4 shadow-[var(--shadow-card)] backdrop-blur-xl sm:flex-row sm:items-end sm:justify-between [@media(orientation:landscape)]:flex-row [@media(orientation:landscape)]:items-end [@media(orientation:landscape)]:justify-between [@media(orientation:landscape)_and_(max-height:500px)]:p-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--teal)]">LAN Host</p>
            <h1 className="mt-1 text-3xl font-semibold tracking-normal">{hostInfo?.hostName || hostInfo?.name || "Liar's Bar Host"}</h1>
            <p className="mt-2 text-sm text-[var(--text-soft)]">
              {connectionState === 'online' ? '主机在线' : connectionState === 'reconnecting' ? '正在重连' : '等待主机响应'} · {displayMode(hostInfo?.gameMode)}
            </p>
          </div>
          <a
            href={localJoinUrl}
            className="inline-flex min-h-11 items-center justify-center rounded-[8px] border border-[var(--ink)] bg-[var(--ink)] px-5 text-sm font-semibold text-[var(--paper)] shadow-[var(--shadow-pop)] transition active:scale-[0.98]"
          >
            本机加入游戏
          </a>
        </header>

        <section className="grid gap-4 lg:grid-cols-[320px_1fr] [@media(orientation:landscape)]:grid-cols-[280px_minmax(0,1fr)] [@media(orientation:landscape)_and_(max-height:500px)]:grid-cols-[240px_minmax(0,1fr)] [@media(orientation:landscape)_and_(max-height:500px)]:gap-2">
          <div className="rounded-[8px] border border-[var(--line)] bg-[var(--surface)] p-4 text-[var(--navy)] shadow-[var(--shadow-card)] backdrop-blur-xl [@media(orientation:landscape)_and_(max-height:500px)]:p-3">
            <h2 className="text-lg font-semibold">扫码加入</h2>
            <div className="mt-4 flex aspect-square items-center justify-center rounded-[8px] border border-[var(--line)] bg-[var(--surface-strong)] p-3 [@media(orientation:landscape)_and_(max-height:500px)]:mt-2">
              {qrDataUrl ? (
                <img src={qrDataUrl} alt="局域网加入二维码" className="size-full object-contain" />
              ) : (
                <span className="text-sm font-semibold text-[var(--text-soft)]">等待二维码</span>
              )}
            </div>
            <div className="mt-4 rounded-[8px] border border-[var(--line)] bg-[var(--muted)] p-3 [@media(orientation:landscape)_and_(max-height:500px)]:mt-2">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--teal)]">LAN URL</p>
              <p className="mt-2 truncate font-mono text-sm" title={joinUrl || undefined}>{displayedJoinUrl || '等待主机地址'}</p>
            </div>
          </div>

          <div className="flex min-h-0 flex-col gap-4 [@media(orientation:landscape)_and_(max-height:500px)]:gap-2">
            <div className="grid gap-3 sm:grid-cols-3 [@media(orientation:landscape)]:grid-cols-3 [@media(orientation:landscape)_and_(max-height:500px)]:gap-2">
              <div className="rounded-[8px] border border-[var(--line)] bg-[var(--surface-glass)] p-4 shadow-sm backdrop-blur-xl">
                <p className="text-xs text-[var(--text-soft)]">局域网 IP</p>
                <p className="mt-1 font-mono text-xl font-semibold text-[var(--teal)]">{hostInfo?.lanIp || '-'}</p>
              </div>
              <div className="rounded-[8px] border border-[var(--line)] bg-[var(--surface-glass)] p-4 shadow-sm backdrop-blur-xl">
                <p className="text-xs text-[var(--text-soft)]">端口</p>
                <p className="mt-1 font-mono text-xl font-semibold text-[var(--teal)]">{hostInfo?.port || '-'}</p>
              </div>
              <div className="rounded-[8px] border border-[var(--line)] bg-[var(--surface-glass)] p-4 shadow-sm backdrop-blur-xl">
                <p className="text-xs text-[var(--text-soft)]">玩家</p>
                <p className="mt-1 text-xl font-semibold text-[var(--teal)]">{players.length}/{hostInfo?.maxPlayers || 8}</p>
              </div>
            </div>

            <section className="rounded-[8px] border border-[var(--line)] bg-[var(--surface)] p-4 shadow-[var(--shadow-card)] backdrop-blur-xl [@media(orientation:landscape)_and_(max-height:500px)]:p-3">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold">玩家席位</h2>
                <span className="rounded-[8px] bg-[var(--surface-tint)] px-2 py-1 text-xs font-semibold text-[var(--teal)]">
                  {gameState?.gameStatus === 'playing' ? '对局中' : '房间中'}
                </span>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 [@media(orientation:landscape)]:grid-cols-2 [@media(orientation:landscape)_and_(max-height:500px)]:gap-1.5">
                {players.length > 0 ? players.map((player: any) => (
                  <div key={player.id} className="flex min-h-14 items-center justify-between rounded-[8px] border border-[var(--line)] bg-[var(--surface-glass)] px-3 shadow-sm">
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{player.name}</p>
                      <p className="text-xs text-[var(--text-soft)]">{player.isHost ? '房主' : '玩家'} · {player.connectionStatus === 'disconnected' ? '离线' : '在线'}</p>
                    </div>
                    <span className="rounded-[8px] bg-[var(--surface-success)] px-2 py-1 text-xs font-semibold text-[var(--teal)]">
                      {player.isReady ? '已准备' : '未准备'}
                    </span>
                  </div>
                )) : (
                  <div className="rounded-[8px] border border-dashed border-[var(--line)] p-5 text-center text-sm text-[var(--text-soft)] sm:col-span-2">
                    等待玩家扫码加入
                  </div>
                )}
              </div>
            </section>
          </div>
        </section>
      </div>
    </main>
  );
}
