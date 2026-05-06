import React, { useState, useEffect } from 'react';

interface BulletExecutionModalProps {
  isOpen: boolean;
  victimName: string;
  onFire: () => void;
  onClose: () => void;
  shot: boolean | null;
  isSpinning: boolean;
  canFire: boolean;
  waitingMessage?: string;
}

const BulletExecutionModal: React.FC<BulletExecutionModalProps> = ({
  isOpen,
  victimName,
  onFire,
  onClose,
  shot,
  isSpinning,
  canFire,
  waitingMessage
}) => {
  const [spinAngle, setSpinAngle] = useState(0);
  const [showResult, setShowResult] = useState(false);

  useEffect(() => {
    if (isSpinning) {
      const spinInterval = setInterval(() => {
        setSpinAngle(prev => (prev + 10) % 360);
      }, 50);
      return () => clearInterval(spinInterval);
    }
  }, [isSpinning]);

  useEffect(() => {
    if (!isOpen || shot === null) {
      setShowResult(false);
      return;
    }

    if (shot !== null) {
      const timer = setTimeout(() => {
        setShowResult(true);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isOpen, shot]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--surface-overlay)] px-3 py-3 backdrop-blur-md [@media(orientation:landscape)_and_(max-height:500px)]:px-2 [@media(orientation:landscape)_and_(max-height:500px)]:py-1.5">
      <div className="relative flex max-h-[calc(100dvh-24px)] w-full max-w-[420px] flex-col overflow-hidden rounded-[8px] border border-[var(--line)] bg-[var(--surface-strong)] p-5 text-[var(--navy)] shadow-[var(--shadow-soft)] [@media(orientation:landscape)]:max-w-[min(94vw,760px)] [@media(orientation:landscape)]:p-4 [@media(orientation:landscape)_and_(max-height:500px)]:max-h-[calc(100dvh-12px)] [@media(orientation:landscape)_and_(max-height:500px)]:p-3">
        <div className="grid min-h-0 gap-4 [@media(orientation:landscape)]:grid-cols-[minmax(0,1fr)_minmax(176px,240px)] [@media(orientation:landscape)]:items-center [@media(orientation:landscape)_and_(max-height:500px)]:gap-3">
          <div className="flex min-h-0 flex-col">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--teal)]">Execution</p>
            <h3 className="mt-1 text-xl font-semibold text-[var(--navy)] [@media(orientation:landscape)_and_(max-height:500px)]:text-lg">
              左轮处决
            </h3>

            <div className="mt-4 rounded-[8px] border border-[var(--line-bright)] bg-[linear-gradient(135deg,var(--surface-tint),var(--surface-warm))] px-4 py-3 [@media(orientation:landscape)_and_(max-height:500px)]:mt-3 [@media(orientation:landscape)_and_(max-height:500px)]:py-2">
              <p className="text-sm font-semibold text-[var(--navy)]">
                {victimName}，准备接受命运的审判！
              </p>
            </div>

            {showResult && shot !== null ? (
              <div
                className={`mt-4 rounded-[8px] border p-4 text-[var(--navy)] [@media(orientation:landscape)_and_(max-height:500px)]:mt-3 [@media(orientation:landscape)_and_(max-height:500px)]:p-3 ${
                  shot ? 'border-[var(--destructive)] bg-[var(--surface-danger)]' : 'border-[var(--line-bright)] bg-[var(--surface-success)]'
                }`}
              >
                <h4 className="text-2xl font-bold leading-tight [@media(orientation:landscape)_and_(max-height:500px)]:text-xl">
                  {shot ? '淘汰！' : '幸存！'}
                </h4>
                <p className="mt-2 text-sm font-semibold">
                  {shot ? `${victimName} 被处决了！` : `${victimName} 幸运地活了下来！`}
                </p>
              </div>
            ) : null}

            <div className="mt-5 flex [@media(orientation:landscape)_and_(max-height:500px)]:mt-3">
              {!showResult ? (
                canFire ? (
                  <button
                    onClick={onFire}
                    className="inline-flex min-h-11 min-w-[136px] items-center justify-center rounded-[8px] border border-[var(--ink)] bg-[var(--ink)] px-8 py-3 text-sm font-semibold text-[var(--paper)] shadow-[var(--shadow-pop)] transition-transform active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 [@media(orientation:landscape)_and_(max-height:500px)]:min-h-9 [@media(orientation:landscape)_and_(max-height:500px)]:py-2"
                    disabled={isSpinning}
                  >
                    {isSpinning ? '转动中...' : '开枪'}
                  </button>
                ) : (
                  <div className="rounded-[8px] border border-[var(--line-bright)] bg-[var(--surface-tint)] px-5 py-2 text-sm font-semibold text-[var(--navy)]">
                    {waitingMessage || `等待 ${victimName} 开枪`}
                  </div>
                )
              ) : (
                <button
                  onClick={onClose}
                  className="inline-flex min-h-11 min-w-[120px] items-center justify-center rounded-[8px] border border-[var(--line-strong)] bg-[var(--surface-strong)] px-6 py-2 text-sm font-semibold text-[var(--navy)] shadow-[var(--chip-shadow)] transition-colors hover:bg-[var(--muted)] [@media(orientation:landscape)_and_(max-height:500px)]:min-h-9"
                >
                  确定
                </button>
              )}
            </div>
          </div>

          <div className="flex justify-center [@media(orientation:landscape)]:justify-end">
            <div
              className="relative flex h-40 w-40 items-center justify-center overflow-hidden rounded-full border-[10px] border-[var(--line-bright)] bg-[linear-gradient(145deg,var(--surface-strong),var(--sky-surface)_58%,var(--sun-wash))] shadow-[var(--shadow-card)] sm:h-44 sm:w-44 [@media(orientation:landscape)_and_(max-height:500px)]:h-36 [@media(orientation:landscape)_and_(max-height:500px)]:w-36 [@media(orientation:landscape)_and_(max-height:500px)]:border-[8px]"
              style={{
                transform: isSpinning ? `rotate(${spinAngle}deg)` : 'rotate(0deg)',
                transition: isSpinning ? 'none' : 'transform 1s ease-out'
              }}
            >
              {[...Array(6)].map((_, index) => (
                <div
                  key={index}
                  className="absolute h-full w-1 bg-[var(--line-strong)]"
                  style={{ transform: `rotate(${index * 60}deg) translateX(82px)` }}
                />
              ))}
              <div className="absolute left-1/2 top-4 size-4 -translate-x-1/2 rounded-full bg-[var(--destructive)]" />
              <div className="z-10 size-8 rounded-full border border-[var(--line)] bg-[var(--surface-strong)] shadow-[inset_0_0_0_5px_var(--sun)]" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BulletExecutionModal;
