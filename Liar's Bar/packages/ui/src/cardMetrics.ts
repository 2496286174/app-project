export const HAND_CARD_METRICS = {
  regular: {
    width: 64,
    height: 96,
    gap: 6,
    rankClass: 'text-[clamp(1.35rem,5vw,2rem)]',
    suitClass: 'text-[clamp(0.7rem,2.4vw,0.875rem)]',
    cornerSuitClass: 'text-[10px]',
    jokerClass: 'text-[clamp(0.72rem,2.8vw,1rem)]',
    selectedOffsetClass: '-translate-y-2'
  },
  compact: {
    width: 44,
    height: 72,
    gap: 4,
    rankClass: 'text-[1.55rem]',
    suitClass: 'text-[10px]',
    cornerSuitClass: 'text-[8px]',
    jokerClass: 'text-[11px]',
    selectedOffsetClass: '-translate-y-1'
  }
} as const;

export const COMMUNITY_CARD_METRICS = {
  regular: {
    width: 72,
    height: 92,
    gap: 8,
    rankClass: 'text-[34px] sm:text-[38px]',
    suitClass: 'text-sm sm:text-base',
    declaredBadgeClass: 'left-2 top-2 rounded-[6px] px-1.5 py-0.5 text-[10px]',
    jokerClass: 'text-base'
  },
  compact: {
    width: 54,
    height: 72,
    gap: 6,
    rankClass: 'text-[28px]',
    suitClass: 'text-xs',
    declaredBadgeClass: 'left-1 top-1 rounded-[5px] px-1 py-0.5 text-[8px]',
    jokerClass: 'text-[13px]'
  }
} as const;

export const GAME_LAYOUT_METRICS = {
  regular: {
    actionControlsMaxWidth: 296,
    actionRowMinHeight: 44,
    handPanelMinHeight: 148,
    playerInfoPanelMinHeight: 148,
    statusPromptMinHeight: 44,
    communityWellMinHeight: 116
  },
  compact: {
    actionControlsMaxWidth: 236,
    actionRowMinHeight: 32,
    handPanelMinHeight: 94,
    playerInfoPanelMinHeight: 94,
    statusPromptMinHeight: 28,
    communityWellMinHeight: 74
  }
} as const;

export const PLAYER_SEAT_METRICS = {
  regular: {
    slotWidth: 102,
    trackGap: 6
  },
  compact: {
    slotWidth: 78,
    trackGap: 4
  }
} as const;

export type HandCardMetrics = (typeof HAND_CARD_METRICS)[keyof typeof HAND_CARD_METRICS];
export type CommunityCardMetrics = (typeof COMMUNITY_CARD_METRICS)[keyof typeof COMMUNITY_CARD_METRICS];
export type GameLayoutMetrics = (typeof GAME_LAYOUT_METRICS)[keyof typeof GAME_LAYOUT_METRICS];
export type PlayerSeatMetrics = (typeof PLAYER_SEAT_METRICS)[keyof typeof PLAYER_SEAT_METRICS];
