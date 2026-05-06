'use client';

import { useCallback, useEffect, useState } from 'react';
import { buildHostInfoUrl, getStoredHostConfig } from './hostConfig';

type RoomQrCodeState = {
  joinUrl: string;
  qrDataUrl: string;
  isLoading: boolean;
  refresh: () => Promise<void>;
};

function buildFallbackJoinUrl(): string {
  if (typeof window === 'undefined') {
    return '';
  }

  const { hostAddress, hostPort } = getStoredHostConfig();
  const protocol = window.location.protocol === 'https:' ? 'https' : 'http';
  const url = new URL('/login', `${protocol}://${hostAddress}:${hostPort}`);
  url.searchParams.set('hostAddress', hostAddress);
  url.searchParams.set('hostPort', hostPort);
  return url.toString();
}

async function resolveRoomJoinUrl(): Promise<string> {
  const fallbackJoinUrl = buildFallbackJoinUrl();

  try {
    const response = await fetch(buildHostInfoUrl(), { cache: 'no-store' });
    if (!response.ok) {
      return fallbackJoinUrl;
    }

    const hostInfo = await response.json();
    const hostJoinUrl = typeof hostInfo?.joinUrl === 'string' ? hostInfo.joinUrl.trim() : '';
    const qrText = typeof hostInfo?.qrText === 'string' ? hostInfo.qrText.trim() : '';
    return qrText || hostJoinUrl || fallbackJoinUrl;
  } catch {
    return fallbackJoinUrl;
  }
}

export function useRoomQrCode(): RoomQrCodeState {
  const [joinUrl, setJoinUrl] = useState('');
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      const nextJoinUrl = await resolveRoomJoinUrl();
      setJoinUrl(nextJoinUrl);

      if (!nextJoinUrl) {
        setQrDataUrl('');
        return;
      }

      const QRCode = await import('qrcode');
      const nextQrDataUrl = await QRCode.toDataURL(nextJoinUrl, {
        margin: 1,
        width: 260,
        color: { dark: '#122536', light: '#ffffff' }
      });
      setQrDataUrl(nextQrDataUrl);
    } catch (error) {
      console.warn('生成房间二维码失败:', error);
      setQrDataUrl('');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return {
    joinUrl,
    qrDataUrl,
    isLoading,
    refresh
  };
}
