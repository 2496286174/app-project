import React from 'react';
import { GameMode } from '@liars-bar/shared';

interface RulesPanelProps {
  isVisible: boolean;
  gameMode?: GameMode;
  onClose: () => void;
}

const liarsDeckRows = [
  { players: '2-4', ranks: '6', jokers: '2', total: '20' },
  { players: '5', ranks: '8', jokers: '3', total: '27' },
  { players: '6', ranks: '10', jokers: '4', total: '34' },
  { players: '7', ranks: '12', jokers: '5', total: '41' },
  { players: '8', ranks: '14', jokers: '6', total: '48' }
];

type TexasSampleCard = {
  rank: string;
  suit: string;
};

type TexasHandRank = {
  title: string;
  description: string;
  cards: TexasSampleCard[];
};

const texasHandRanks: TexasHandRank[] = [
  {
    title: '皇家同花顺',
    description: '同一花色 A K Q J 10，最大牌型',
    cards: [
      { rank: 'A', suit: '♥' },
      { rank: 'K', suit: '♥' },
      { rank: 'Q', suit: '♥' },
      { rank: 'J', suit: '♥' },
      { rank: '10', suit: '♥' }
    ]
  },
  {
    title: '同花顺',
    description: '同一花色连续五张',
    cards: [
      { rank: '9', suit: '♠' },
      { rank: '8', suit: '♠' },
      { rank: '7', suit: '♠' },
      { rank: '6', suit: '♠' },
      { rank: '5', suit: '♠' }
    ]
  },
  {
    title: '四条',
    description: '四张点数相同，加一张踢脚牌',
    cards: [
      { rank: 'K', suit: '♠' },
      { rank: 'K', suit: '♥' },
      { rank: 'K', suit: '♦' },
      { rank: 'K', suit: '♣' },
      { rank: '2', suit: '♠' }
    ]
  },
  {
    title: '葫芦',
    description: '三张相同点数，加一对',
    cards: [
      { rank: 'Q', suit: '♠' },
      { rank: 'Q', suit: '♥' },
      { rank: 'Q', suit: '♦' },
      { rank: '8', suit: '♣' },
      { rank: '8', suit: '♠' }
    ]
  },
  {
    title: '同花',
    description: '同一花色任意五张，不要求连续',
    cards: [
      { rank: 'A', suit: '♦' },
      { rank: 'J', suit: '♦' },
      { rank: '8', suit: '♦' },
      { rank: '4', suit: '♦' },
      { rank: '2', suit: '♦' }
    ]
  },
  {
    title: '顺子',
    description: '连续五张，A 可作最大或最小',
    cards: [
      { rank: '10', suit: '♣' },
      { rank: '9', suit: '♥' },
      { rank: '8', suit: '♠' },
      { rank: '7', suit: '♦' },
      { rank: '6', suit: '♣' }
    ]
  },
  {
    title: '三条',
    description: '三张点数相同，加两张踢脚牌',
    cards: [
      { rank: '7', suit: '♠' },
      { rank: '7', suit: '♥' },
      { rank: '7', suit: '♦' },
      { rank: 'K', suit: '♣' },
      { rank: '3', suit: '♠' }
    ]
  },
  {
    title: '两对',
    description: '两组对子，加一张踢脚牌',
    cards: [
      { rank: 'A', suit: '♠' },
      { rank: 'A', suit: '♥' },
      { rank: '5', suit: '♦' },
      { rank: '5', suit: '♣' },
      { rank: 'Q', suit: '♠' }
    ]
  },
  {
    title: '一对',
    description: '一组对子，加三张踢脚牌',
    cards: [
      { rank: 'J', suit: '♠' },
      { rank: 'J', suit: '♥' },
      { rank: 'A', suit: '♦' },
      { rank: '9', suit: '♣' },
      { rank: '4', suit: '♠' }
    ]
  },
  {
    title: '高牌',
    description: '没有组成以上牌型时，比最大单牌',
    cards: [
      { rank: 'A', suit: '♣' },
      { rank: 'K', suit: '♦' },
      { rank: '9', suit: '♠' },
      { rank: '6', suit: '♥' },
      { rank: '3', suit: '♣' }
    ]
  }
];

function isRedSuit(suit: TexasSampleCard['suit']): boolean {
  return suit === '♥' || suit === '♦';
}

function TexasMiniCards({ cards }: { cards: TexasSampleCard[] }) {
  return (
    <div className="flex min-w-0 items-center gap-1">
      {cards.map((card, index) => (
        <span
          key={`${card.rank}-${card.suit}-${index}`}
          className={`flex h-8 w-6 shrink-0 flex-col items-center justify-center rounded-[6px] border border-[var(--line-strong)] bg-[var(--card-face)] text-[10px] font-black leading-none shadow-[var(--chip-shadow)] ${
            isRedSuit(card.suit) ? 'text-[#C5252C]' : 'text-[var(--ink)]'
          }`}
        >
          <span>{card.rank}</span>
          <span className="text-[9px]">{card.suit}</span>
        </span>
      ))}
    </div>
  );
}

const RulesPanel: React.FC<RulesPanelProps> = ({ isVisible, gameMode = 'liarsBar', onClose }) => {
  if (!isVisible) return null;

  const isTexasHoldem = gameMode === 'texasHoldem';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--surface-overlay)] px-4 py-6 backdrop-blur-md">
      <div className="max-h-[85vh] w-full max-w-[460px] overflow-y-auto rounded-[8px] border border-[var(--line)] bg-[var(--surface-strong)] p-5 text-[var(--navy)] shadow-[var(--shadow-soft)] [@media(orientation:landscape)]:max-w-[min(92vw,820px)] [@media(orientation:landscape)_and_(max-height:500px)]:max-h-[94vh] [@media(orientation:landscape)_and_(max-height:500px)]:p-4">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-[var(--navy)]">游戏规则</h2>
            <p className="mt-1 text-xs font-semibold text-[var(--text-soft)]">
              {isTexasHoldem ? '德州扑克 · 牌型排名' : '骗子酒馆 · 牌组与质疑'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex min-h-11 min-w-11 items-center justify-center rounded-[8px] bg-[var(--surface-tint)] text-lg font-semibold text-[var(--teal)] transition-colors hover:bg-[var(--surface-success)]"
            aria-label="关闭规则"
          >
            ×
          </button>
        </div>

        {isTexasHoldem ? (
          <div className="space-y-3">
            <div className="rounded-[8px] border border-[var(--line)] bg-[var(--muted)] px-3 py-2 text-xs font-semibold leading-5 text-[var(--text-soft)]">
              从 2 张手牌 + 公共牌中选最强 5 张比较；同牌型继续比关键点数，再比踢脚牌。
            </div>

            <ol className="grid gap-2 text-sm font-semibold text-[var(--text-soft)] [@media(orientation:landscape)]:grid-cols-2">
              {texasHandRanks.map((rank, index) => (
                <li key={rank.title} className="grid grid-cols-[1.75rem_minmax(0,1fr)] gap-2 rounded-[8px] border border-[var(--line)] bg-[var(--surface)] px-2.5 py-2">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-[8px] bg-[var(--ink)] font-mono text-xs text-[var(--paper)]">
                    {index + 1}
                  </span>
                  <div className="min-w-0">
                    <div className="flex min-w-0 items-center justify-between gap-2">
                      <span className="truncate text-[var(--navy)]">{rank.title}</span>
                      <TexasMiniCards cards={rank.cards} />
                    </div>
                    <p className="mt-1 text-xs font-semibold leading-4 text-[var(--text-soft)]">{rank.description}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        ) : (
          <div className="flex flex-col gap-3 text-sm font-medium leading-6 text-[var(--text-soft)]">
            <div className="rounded-[8px] border border-[var(--line)] bg-[var(--muted)] p-4">
              <h3 className="mb-2 font-semibold text-[var(--navy)]">基础玩法</h3>
              <p>1. 主牌随机为 Q / K / A，每位存活玩家发 5 张牌。</p>
              <p>2. 轮到玩家时先加子弹，再打出 1-3 张牌并声明数量。</p>
              <p>3. Joker 可当作本局主牌；只有主牌和 Joker 算真实命中。</p>
              <p>4. 其他玩家选择相信或质疑，质疑结果决定谁开枪。</p>
            </div>

            <div className="rounded-[8px] border border-[var(--line)] bg-[var(--muted)] p-4">
              <h3 className="mb-3 font-semibold text-[var(--navy)]">人数与牌组数量</h3>
              <div className="grid grid-cols-[0.9fr_1fr_0.8fr_0.8fr] gap-px overflow-hidden rounded-[8px] border border-[var(--line)] bg-[var(--line)] text-center text-xs font-semibold">
                <div className="bg-[var(--surface-strong)] px-2 py-2 text-[var(--text-soft)]">人数</div>
                <div className="bg-[var(--surface-strong)] px-2 py-2 text-[var(--text-soft)]">Q/K/A 各</div>
                <div className="bg-[var(--surface-strong)] px-2 py-2 text-[var(--text-soft)]">Joker</div>
                <div className="bg-[var(--surface-strong)] px-2 py-2 text-[var(--text-soft)]">总牌</div>
                {liarsDeckRows.map((row) => (
                  <React.Fragment key={row.players}>
                    <div className="bg-[var(--surface-strong)] px-2 py-2 text-[var(--navy)]">{row.players}</div>
                    <div className="bg-[var(--surface-strong)] px-2 py-2 text-[var(--navy)]">{row.ranks}</div>
                    <div className="bg-[var(--surface-strong)] px-2 py-2 text-[var(--navy)]">{row.jokers}</div>
                    <div className="bg-[var(--surface-strong)] px-2 py-2 text-[var(--navy)]">{row.total}</div>
                  </React.Fragment>
                ))}
              </div>
            </div>

            <div className="rounded-[8px] border border-[var(--line)] bg-[var(--muted)] p-4">
              <h3 className="mb-2 font-semibold text-[var(--navy)]">结算</h3>
              <p>第一个出完手牌且出牌成立的玩家锁定第一名；剩余玩家继续比赛，全部结束后统一排名结算。</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default RulesPanel;
