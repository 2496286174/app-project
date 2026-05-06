import React from 'react';
import { modalStyles } from './styles';
import { formatJoinAddress } from './joinUrlDisplay';

interface RoomQrModalProps {
  isVisible: boolean;
  joinUrl?: string;
  qrDataUrl?: string;
  isLoading?: boolean;
  onClose: () => void;
}

export default function RoomQrModal({
  isVisible,
  joinUrl = '',
  qrDataUrl = '',
  isLoading = false,
  onClose
}: RoomQrModalProps) {
  if (!isVisible) {
    return null;
  }

  const displayedJoinUrl = formatJoinAddress(joinUrl);

  return (
    <div className={modalStyles.overlay} role="dialog" aria-modal="true" aria-labelledby="room-qr-title" onClick={onClose}>
      <div
        className="max-h-[calc(100dvh-16px)] w-[min(88vw,320px)] overflow-y-auto rounded-[8px] border border-[var(--line)] bg-[var(--surface-strong)] p-4 text-[var(--navy)] shadow-[var(--shadow-soft)] [@media(orientation:landscape)]:w-[min(42vw,300px)] [@media(orientation:landscape)_and_(max-height:500px)]:w-[min(38vw,240px)] [@media(orientation:landscape)_and_(max-height:500px)]:p-3"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="room-qr-title" className="text-lg font-semibold text-[var(--navy)]">房间二维码</h2>
            <p className="mt-1 text-xs font-semibold text-[var(--text-soft)]">同一局域网扫码加入</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex size-9 shrink-0 items-center justify-center rounded-[8px] bg-[var(--surface-glass)] text-[var(--navy)] transition hover:bg-[var(--surface-tint)]"
            aria-label="关闭房间二维码"
          >
            <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </div>

        <div className="mx-auto mt-4 flex size-[min(68vw,240px)] items-center justify-center rounded-[8px] border border-[var(--line-bright)] bg-[var(--surface-strong)] p-3 shadow-[var(--chip-shadow)] [@media(orientation:landscape)]:size-[min(46dvh,220px)] [@media(orientation:landscape)_and_(max-height:500px)]:mt-3 [@media(orientation:landscape)_and_(max-height:500px)]:size-[min(42dvh,170px)] [@media(orientation:landscape)_and_(max-height:500px)]:p-2">
          {qrDataUrl ? (
            <img src={qrDataUrl} alt="房间加入二维码" className="size-full object-contain" />
          ) : (
            <span className="text-sm font-semibold text-[var(--text-soft)]">{isLoading ? '正在生成二维码' : '暂无二维码'}</span>
          )}
        </div>

        {displayedJoinUrl ? (
          <div
            className="mt-3 overflow-hidden truncate rounded-[8px] border border-[var(--line)] bg-[var(--muted)] px-3 py-2 font-mono text-[11px] font-semibold leading-4 text-[var(--navy)] [@media(orientation:landscape)_and_(max-height:500px)]:text-[10px]"
            title={joinUrl}
          >
            {displayedJoinUrl}
          </div>
        ) : null}
      </div>
    </div>
  );
}
