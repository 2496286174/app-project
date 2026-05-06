import React, { useState } from 'react';
import { buttonStyles, cardStyles } from './styles';
import { formatJoinAddress } from './joinUrlDisplay';

interface LoginPageProps {
  hostConfig?: {
    hostAddress: string;
    hostPort: string;
  };
  joinUrl?: string;
  joinQrDataUrl?: string;
  onLogin: (name: string) => void;
}

export default function LoginPage({ hostConfig, joinUrl, joinQrDataUrl, onLogin }: LoginPageProps) {
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const hostLabel = hostConfig ? `${hostConfig.hostAddress}:${hostConfig.hostPort}` : '等待主机地址';
  const displayedJoinUrl = formatJoinAddress(joinUrl);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const trimmedName = name.trim();

    if (!trimmedName) {
      setError('请输入玩家名称');
      return;
    }

    onLogin(trimmedName);
  };

  return (
    <main className="relative flex h-dvh min-h-dvh items-center justify-center overflow-hidden bg-[var(--background)] px-4 py-6 text-[var(--navy)] [@media(orientation:landscape)]:px-3 [@media(orientation:landscape)]:py-3 [@media(orientation:landscape)_and_(max-height:500px)]:px-1.5 [@media(orientation:landscape)_and_(max-height:500px)]:py-1.5">
      <div
        aria-hidden="true"
        className="absolute inset-0 opacity-80"
        style={{
          backgroundImage:
            'var(--page-background)',
          backgroundSize: '100% 100%'
        }}
      />

      <section className="relative z-10 grid max-h-[calc(100dvh-24px)] w-full max-w-4xl gap-0 overflow-hidden rounded-[8px] border border-[var(--line)] bg-[var(--surface)] shadow-[var(--shadow-soft)] backdrop-blur-xl md:grid-cols-[0.86fr_1.14fr] [@media(orientation:landscape)]:grid-cols-[0.72fr_1.28fr] [@media(orientation:landscape)_and_(max-height:500px)]:h-[calc(100dvh-12px)] [@media(orientation:landscape)_and_(max-height:500px)]:max-h-[calc(100dvh-12px)]">
        <div className="hidden min-h-0 border-r border-[var(--line-bright)] bg-[linear-gradient(145deg,var(--sky-wash),var(--sky-surface)_56%,var(--sun-wash))] p-7 text-[var(--navy)] md:flex md:flex-col md:justify-between [@media(orientation:landscape)]:flex [@media(orientation:landscape)]:flex-col [@media(orientation:landscape)]:justify-between [@media(orientation:landscape)_and_(max-height:500px)]:p-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--teal)]">LAN TABLE</p>
            <h1 className="mt-4 text-5xl font-semibold leading-none tracking-normal [@media(orientation:landscape)_and_(max-height:500px)]:mt-2 [@media(orientation:landscape)_and_(max-height:500px)]:text-3xl">Liar&apos;s Bar</h1>
            <p className="mt-5 max-w-[16rem] text-sm font-medium leading-6 text-[var(--text-soft)] [@media(orientation:landscape)_and_(max-height:500px)]:mt-2 [@media(orientation:landscape)_and_(max-height:500px)]:max-w-[14rem] [@media(orientation:landscape)_and_(max-height:500px)]:text-[11px] [@media(orientation:landscape)_and_(max-height:500px)]:leading-4">
              局域网开桌，浏览器入座。扫码或输入主机地址后即可开始骗子酒馆。
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs font-semibold [@media(orientation:landscape)_and_(max-height:500px)]:hidden">
            <div className="rounded-[8px] border border-[var(--line)] bg-[var(--surface-glass)] px-3 py-2">局域网</div>
            <div className="rounded-[8px] border border-[var(--line)] bg-[var(--surface-glass)] px-3 py-2">浏览器加入</div>
            <div className="rounded-[8px] border border-[var(--line)] bg-[var(--surface-glass)] px-3 py-2">PC 主机</div>
            <div className="rounded-[8px] border border-[var(--line)] bg-[var(--surface-glass)] px-3 py-2">安卓主机</div>
          </div>
        </div>

        <div className="min-h-0 overflow-y-auto p-5 sm:p-7 [@media(orientation:landscape)_and_(max-height:500px)]:flex [@media(orientation:landscape)_and_(max-height:500px)]:flex-col [@media(orientation:landscape)_and_(max-height:500px)]:overflow-hidden [@media(orientation:landscape)_and_(max-height:500px)]:p-3">
          <div className="mb-6 md:hidden [@media(orientation:landscape)]:hidden">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--teal)]">LAN TABLE</p>
            <h1 className="mt-1 text-4xl font-semibold leading-tight tracking-normal">Liar&apos;s Bar</h1>
            <p className="mt-2 text-sm font-medium leading-6 text-[var(--text-soft)]">连接局域网主机，输入你的桌面昵称后入座。</p>
          </div>

          <div className="mb-4 rounded-[8px] border border-[var(--line)] bg-[var(--surface-glass)] p-3 shadow-sm [@media(orientation:landscape)_and_(max-height:500px)]:mb-2 [@media(orientation:landscape)_and_(max-height:500px)]:shrink-0 [@media(orientation:landscape)_and_(max-height:500px)]:p-2">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between [@media(orientation:landscape)_and_(max-height:500px)]:flex-row [@media(orientation:landscape)_and_(max-height:500px)]:gap-2">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--teal)]">局域网加入</p>
                <p className="mt-1 text-xs font-semibold text-[var(--text-soft)] [@media(orientation:landscape)_and_(max-height:500px)]:hidden">把二维码或链接发给同一热点/局域网内的玩家。</p>
              </div>
              {joinQrDataUrl ? (
                <img
                  src={joinQrDataUrl}
                  alt="局域网加入二维码"
                  className="mx-auto size-28 shrink-0 rounded-[8px] border border-[var(--line)] bg-[var(--surface-strong)] p-2 sm:mx-0 sm:size-24 [@media(orientation:landscape)_and_(max-height:500px)]:size-16 [@media(orientation:landscape)_and_(max-height:500px)]:p-1"
                />
              ) : null}
            </div>
            <a
              href={joinUrl || undefined}
              title={joinUrl || undefined}
              className="mt-2 block max-h-14 overflow-hidden break-all rounded-[8px] border border-dashed border-[var(--line)] bg-[var(--surface-cool)] px-3 py-2 font-mono text-sm font-semibold leading-6 text-[var(--navy)] [@media(orientation:landscape)_and_(max-height:500px)]:max-h-9 [@media(orientation:landscape)_and_(max-height:500px)]:px-2 [@media(orientation:landscape)_and_(max-height:500px)]:py-1 [@media(orientation:landscape)_and_(max-height:500px)]:text-[11px] [@media(orientation:landscape)_and_(max-height:500px)]:leading-[18px]"
            >
              {displayedJoinUrl || '正在读取加入链接'}
            </a>
            <p className="mt-2 truncate text-xs font-semibold text-[var(--text-soft)] [@media(orientation:landscape)_and_(max-height:500px)]:mt-1 [@media(orientation:landscape)_and_(max-height:500px)]:text-[10px]">当前连接：{hostLabel}</p>
          </div>

          {error ? (
            <div className="mb-4 rounded-[8px] bg-[var(--destructive)] px-3 py-2 text-sm font-semibold text-[var(--paper)] [@media(orientation:landscape)_and_(max-height:500px)]:mb-2 [@media(orientation:landscape)_and_(max-height:500px)]:py-1.5 [@media(orientation:landscape)_and_(max-height:500px)]:text-xs">
              {error}
            </div>
          ) : null}

          <form onSubmit={handleSubmit} className="flex flex-col gap-4 [@media(orientation:landscape)_and_(max-height:500px)]:grid [@media(orientation:landscape)_and_(max-height:500px)]:grid-cols-[minmax(0,1fr)_132px] [@media(orientation:landscape)_and_(max-height:500px)]:items-end [@media(orientation:landscape)_and_(max-height:500px)]:gap-2">
            <label htmlFor="player-name" className="flex flex-col gap-1 text-sm font-semibold text-[var(--navy)] [@media(orientation:landscape)_and_(max-height:500px)]:text-xs">
              玩家名称
              <input
                id="player-name"
                type="text"
                value={name}
                onChange={(event) => {
                  setName(event.target.value);
                  setError('');
                }}
                className={`${cardStyles.input} [@media(orientation:landscape)_and_(max-height:500px)]:min-h-9 [@media(orientation:landscape)_and_(max-height:500px)]:px-2.5 [@media(orientation:landscape)_and_(max-height:500px)]:py-1.5 [@media(orientation:landscape)_and_(max-height:500px)]:text-sm`}
                placeholder="输入你的名称"
                autoComplete="nickname"
              />
            </label>

            <button type="submit" className={`${buttonStyles.primary} w-full [@media(orientation:landscape)_and_(max-height:500px)]:min-h-9`}>
              进入房间
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
