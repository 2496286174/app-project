'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LoginPage } from '@liars-bar/ui';
import { StoredHostConfig, buildHostInfoUrl, getStoredHostConfig, saveHostConfig } from '../../lib/client/hostConfig';
import { savePlayerIdentity } from '../../lib/client/playerIdentity';
import { webSocketClient } from '../../lib/client/WebSocketClient';

type LoginEntryProps = {
  initialHostConfig?: Partial<StoredHostConfig>;
};

const HYDRATION_SAFE_HOST_CONFIG: StoredHostConfig = {
  hostAddress: 'localhost',
  hostPort: '3000'
};

function createInitialHostConfig(initialHostConfig?: Partial<StoredHostConfig>): StoredHostConfig {
  return {
    hostAddress: initialHostConfig?.hostAddress?.trim() || HYDRATION_SAFE_HOST_CONFIG.hostAddress,
    hostPort: initialHostConfig?.hostPort?.trim() || HYDRATION_SAFE_HOST_CONFIG.hostPort
  };
}

export default function LoginEntry({ initialHostConfig }: LoginEntryProps) {
  const router = useRouter();
  const [hostConfig, setHostConfig] = useState<StoredHostConfig>(() => createInitialHostConfig(initialHostConfig));
  const [isHostConfigReady, setIsHostConfigReady] = useState(() => Boolean(initialHostConfig?.hostAddress || initialHostConfig?.hostPort));
  const [joinUrl, setJoinUrl] = useState('');
  const [joinQrDataUrl, setJoinQrDataUrl] = useState('');

  useEffect(() => {
    webSocketClient.setRealtimeSyncEnabled(false);
    webSocketClient.disconnect({ allowReconnect: false });
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const queryHostAddress = params.get('hostAddress')?.trim();
    const queryHostPort = params.get('hostPort')?.trim();
    if (queryHostAddress || queryHostPort) {
      const nextConfig = {
        hostAddress: queryHostAddress || getStoredHostConfig().hostAddress,
        hostPort: queryHostPort || getStoredHostConfig().hostPort
      };
      saveHostConfig(nextConfig);
      setHostConfig(nextConfig);
      setIsHostConfigReady(true);
      return;
    }

    setHostConfig(getStoredHostConfig());
    setIsHostConfigReady(true);
  }, [initialHostConfig?.hostAddress, initialHostConfig?.hostPort]);

  useEffect(() => {
    if (!isHostConfigReady) {
      return;
    }

    let disposed = false;
    const controller = new AbortController();

    const fallbackJoinUrl = (() => {
      if (typeof window === 'undefined') return '';
      const url = new URL('/login', window.location.origin);
      url.searchParams.set('hostAddress', hostConfig.hostAddress);
      url.searchParams.set('hostPort', hostConfig.hostPort);
      return url.toString();
    })();

    setJoinUrl(fallbackJoinUrl);

    (async () => {
      try {
        const response = await fetch(buildHostInfoUrl(hostConfig), {
          cache: 'no-store',
          signal: controller.signal
        });
        if (!response.ok) return;
        const hostInfo = await response.json();
        if (!disposed && typeof hostInfo?.joinUrl === 'string' && hostInfo.joinUrl.trim()) {
          setJoinUrl(hostInfo.joinUrl.trim());
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          console.warn('读取主机加入链接失败:', error);
        }
      }
    })();

    return () => {
      disposed = true;
      controller.abort();
    };
  }, [hostConfig, isHostConfigReady]);

  useEffect(() => {
    let disposed = false;
    if (!joinUrl) {
      setJoinQrDataUrl('');
      return;
    }

    import('qrcode')
      .then((QRCode) => QRCode.toDataURL(joinUrl, { margin: 1, width: 220, color: { dark: '#111111', light: '#ffffff' } }))
      .then((url) => {
        if (!disposed) setJoinQrDataUrl(url);
      })
      .catch(() => {
        if (!disposed) setJoinQrDataUrl('');
      });

    return () => {
      disposed = true;
    };
  }, [joinUrl]);

  const handleLogin = (name: string) => {
    savePlayerIdentity(name);
    router.push('/room');
  };

  return (
    <LoginPage
      hostConfig={hostConfig}
      joinUrl={joinUrl}
      joinQrDataUrl={joinQrDataUrl}
      onLogin={handleLogin}
    />
  );
}
