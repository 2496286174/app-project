import React, { useState } from 'react';

interface HeaderProps {
  isLoading?: boolean;
  onToggleRules: () => void;
  onViewScores: () => void;
  onShowRoomQr?: () => void;
  showRules: boolean;
  type?: 'game' | 'room';
  isHost?: boolean;
  onExitRoom?: () => void;
  onReturnToRoom?: () => void;
  onDealCards?: () => void;
  networkStatus?: 'online' | 'offline' | 'reconnecting';
  showNetworkStatus?: boolean;
  topStatusText?: string;
}

const MenuIcon = () => (
  <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2">
    <path strokeLinecap="round" d="M4 7h16M4 12h16M4 17h16" />
  </svg>
);

const QrIcon = () => (
  <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4z" />
    <path strokeLinecap="round" d="M14 14h2M19 14h1M14 17h6M14 20h2M19 20h1" />
  </svg>
);

const Header: React.FC<HeaderProps> = ({
  isLoading = false,
  onToggleRules,
  onViewScores,
  onShowRoomQr,
  showRules,
  type = 'room',
  isHost = false,
  onExitRoom,
  onReturnToRoom,
  onDealCards,
  networkStatus = 'online',
  showNetworkStatus = true,
  topStatusText
}) => {
  const [showMenu, setShowMenu] = useState(false);
  const statusLabel = networkStatus === 'online' ? '在线' : networkStatus === 'reconnecting' ? '重连中' : '离线';

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--line)] bg-[var(--surface)] px-3 py-2.5 text-[var(--navy)] backdrop-blur-xl [@media(orientation:landscape)_and_(max-height:500px)]:px-2 [@media(orientation:landscape)_and_(max-height:500px)]:py-1.5">
      <div className="grid grid-cols-[40px_1fr_56px] items-center gap-2 [@media(orientation:landscape)_and_(max-height:500px)]:grid-cols-[34px_1fr_48px] [@media(orientation:landscape)_and_(max-height:500px)]:gap-1.5">
        <button
          type="button"
          onClick={() => setShowMenu((value) => !value)}
          className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-[8px] bg-[var(--surface-glass)] text-[var(--navy)] transition hover:bg-[var(--surface-strong)] [@media(orientation:landscape)_and_(max-height:500px)]:min-h-8 [@media(orientation:landscape)_and_(max-height:500px)]:min-w-8"
          aria-expanded={showMenu}
          aria-haspopup="menu"
          aria-label="打开菜单"
        >
          <MenuIcon />
        </button>

        <div className="min-w-0 text-center">
          <div className="flex min-w-0 flex-wrap items-center justify-center gap-1.5 [@media(orientation:landscape)_and_(max-height:500px)]:gap-1">
            <div className="truncate text-[15px] font-semibold tracking-normal [@media(orientation:landscape)_and_(max-height:500px)]:text-[13px]">Liar&apos;s Bar</div>
            {topStatusText ? (
              <span className="inline-flex shrink-0 items-center rounded-[999px] bg-[var(--surface-tint)] px-2 py-1 text-[10px] font-semibold leading-none text-[var(--teal)] [@media(orientation:landscape)_and_(max-height:500px)]:px-1.5 [@media(orientation:landscape)_and_(max-height:500px)]:py-0.5 [@media(orientation:landscape)_and_(max-height:500px)]:text-[9px]">
                {topStatusText}
              </span>
            ) : null}
          </div>
        </div>

        <div className="flex justify-end">
          {isLoading ? (
            <div className="size-5 animate-spin rounded-full border-2 border-[var(--ring-cyan)] border-b-[var(--cyan)]" aria-label="加载中" />
          ) : showNetworkStatus ? (
            <span className={`inline-flex min-h-7 min-w-11 items-center justify-center whitespace-nowrap rounded-[8px] px-2 text-[10px] font-semibold leading-none [@media(orientation:landscape)_and_(max-height:500px)]:min-h-6 [@media(orientation:landscape)_and_(max-height:500px)]:min-w-9 [@media(orientation:landscape)_and_(max-height:500px)]:px-1.5 [@media(orientation:landscape)_and_(max-height:500px)]:text-[9px] ${networkStatus === 'online' ? 'bg-[var(--surface-success)] text-[var(--teal)]' : networkStatus === 'reconnecting' ? 'bg-[var(--surface-tint)] text-[var(--teal)]' : 'bg-[var(--surface-danger)] text-[var(--destructive)]'}`}>
              {statusLabel}
            </span>
          ) : (
            <span aria-hidden="true" className="inline-flex min-h-8 min-w-12" />
          )}
        </div>
      </div>

      {showMenu ? (
        <div className="absolute left-3 top-[calc(100%+8px)] z-[120] flex w-[min(18rem,calc(100vw-1.5rem))] flex-col gap-1 rounded-[8px] border border-[var(--line)] bg-[var(--surface-strong)] p-2 text-[var(--navy)] shadow-[var(--shadow-soft)]" role="menu">
          <button
            type="button"
            onClick={() => {
              onToggleRules();
              setShowMenu(false);
            }}
            className="min-h-11 rounded-[8px] px-3 text-left text-sm font-semibold text-[var(--navy)] transition hover:bg-[var(--surface-tint)]"
            role="menuitem"
          >
            {showRules ? '隐藏规则' : '查看规则'}
          </button>
          <button
            type="button"
            onClick={() => {
              onViewScores();
              setShowMenu(false);
            }}
            className="min-h-11 rounded-[8px] px-3 text-left text-sm font-semibold text-[var(--navy)] transition hover:bg-[var(--surface-tint)]"
            role="menuitem"
          >
            查看积分榜
          </button>
          {onShowRoomQr ? (
            <button
              type="button"
              onClick={() => {
                onShowRoomQr();
                setShowMenu(false);
              }}
              className="flex min-h-11 items-center gap-2 rounded-[8px] px-3 text-left text-sm font-semibold text-[var(--navy)] transition hover:bg-[var(--surface-tint)]"
              role="menuitem"
            >
              <QrIcon />
              <span>房间二维码</span>
            </button>
          ) : null}
          {onExitRoom ? (
            <button
              type="button"
              onClick={() => {
                onExitRoom();
                setShowMenu(false);
              }}
              className="min-h-11 rounded-[8px] px-3 text-left text-sm font-semibold text-[var(--destructive)] transition hover:bg-[var(--surface-danger)]"
              role="menuitem"
            >
              退出房间
            </button>
          ) : null}
          {type === 'game' && isHost ? (
            <>
              {onReturnToRoom ? (
                <button
                  type="button"
                  onClick={() => {
                    onReturnToRoom();
                    setShowMenu(false);
                  }}
                  className="min-h-11 rounded-[8px] px-3 text-left text-sm font-semibold text-[var(--navy)] transition hover:bg-[var(--surface-tint)]"
                  role="menuitem"
                >
                  返回房间
                </button>
              ) : null}
              {onDealCards ? (
                <button
                  type="button"
                  onClick={() => {
                    onDealCards();
                    setShowMenu(false);
                  }}
                  className="min-h-11 rounded-[8px] px-3 text-left text-sm font-semibold text-[var(--navy)] transition hover:bg-[var(--surface-tint)]"
                  role="menuitem"
                >
                  重新开局
                </button>
              ) : null}
            </>
          ) : null}
        </div>
      ) : null}
    </header>
  );
};

export default Header;
