'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { saveHostConfig } from '../../lib/client/hostConfig';
import { webSocketClient } from '../../lib/client/WebSocketClient';

export default function JoinPage() {
  const router = useRouter();
  const [message, setMessage] = useState('正在读取局域网房间地址');

  const target = useMemo(() => {
    if (typeof window === 'undefined') {
      return { hostAddress: '', hostPort: '' };
    }
    const params = new URLSearchParams(window.location.search);
    return {
      hostAddress: params.get('hostAddress') || window.location.hostname,
      hostPort: params.get('hostPort') || window.location.port || '3000'
    };
  }, []);

  useEffect(() => {
    if (!target.hostAddress || !target.hostPort) {
      setMessage('房间地址不完整，请回到主机页重新扫码');
      return;
    }

    saveHostConfig(target);
    webSocketClient.setHostConfig(target);
    setMessage(`已切换到 ${target.hostAddress}:${target.hostPort}，正在前往登录页`);

    const nextParams = new URLSearchParams({
      hostAddress: target.hostAddress,
      hostPort: target.hostPort
    });
    const nextPath = `/login?${nextParams.toString()}`;
    const timer = setTimeout(() => router.replace(nextPath), 450);
    return () => clearTimeout(timer);
  }, [router, target]);

  return (
    <main className="flex min-h-dvh items-center justify-center bg-[var(--background)] px-4 text-[var(--navy)] [@media(orientation:landscape)_and_(max-height:500px)]:px-3">
      <section className="w-full max-w-sm rounded-[8px] border border-[var(--line)] bg-[var(--surface)] p-6 shadow-[var(--shadow-soft)] backdrop-blur-xl [@media(orientation:landscape)]:max-w-[min(84vw,560px)] [@media(orientation:landscape)_and_(max-height:500px)]:p-4">
        <h1 className="text-2xl font-semibold tracking-normal">加入局域网房间</h1>
        <p className="mt-3 text-sm leading-6 text-[var(--text-soft)]">{message}</p>
        <div className="mt-5 rounded-[8px] border border-[var(--line)] bg-[var(--muted)] px-3 py-2 font-mono text-sm font-semibold text-[var(--teal)]">
          {target.hostAddress}:{target.hostPort}
        </div>
      </section>
    </main>
  );
}
