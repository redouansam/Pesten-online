export type Wallet = {
  coins: number;
  gems: number;
  xp: number;
  premiumPass: boolean;
  selectedCardBackId: string;
  ownedCardBackIds: string[];
  selectedTableSkinId: string;
  ownedTableSkinIds: string[];
  gamesPlayed: number;
  wins: number;
  winStreak: number;
  bestWinStreak: number;
  claimedMilestoneRewards: string[];
  lastDailyReward?: string;
  lastGemReward?: string;
  claimedSeasonRewards: string[];
  rewardedRounds: string[];
};

export type SeasonReward = {
  id: string;
  level: number;
  title: string;
  description: string;
  premium?: boolean;
  coins?: number;
  cardBackId?: string;
};

export type MilestoneReward = {
  id: string;
  title: string;
  description: string;
  metric: "gamesPlayed" | "wins" | "cardBacks" | "bestWinStreak";
  target: number;
  coins?: number;
  gems?: number;
};

export const MATCH_ENTRY_COINS = 10;
export const REDRAW_COST_GEMS = 5;
export const COINS_PER_GEM_PACK = 100;
export const GEM_PACK_COST = 10;
export const DAILY_LOGIN_COINS = 25;
export const DAILY_GEMS = 3;
export const GAME_PLAYED_COINS = 10;
export const GAME_WIN_COINS = 30;
export const GAME_PLAYED_XP = 60;
export const GAME_WIN_XP = 40;
export const XP_PER_SEASON_LEVEL = 100;

export const defaultWallet: Wallet = {
  coins: 250,
  gems: 25,
  xp: 0,
  premiumPass: false,
  selectedCardBackId: "classic-blue",
  ownedCardBackIds: ["classic-blue"],
  selectedTableSkinId: "royal-green",
  ownedTableSkinIds: ["royal-green"],
  gamesPlayed: 0,
  wins: 0,
  winStreak: 0,
  bestWinStreak: 0,
  claimedMilestoneRewards: [],
  claimedSeasonRewards: [],
  rewardedRounds: [],
};

export const seasonRewards: SeasonReward[] = [
  {
    id: "level-1-coins",
    level: 1,
    title: "100 coins",
    description: "Startbonus voor Season 1.",
    coins: 100,
  },
  {
    id: "level-5-red-cardback",
    level: 5,
    title: "Rode kaartback",
    description: "Cosmetic reward.",
    cardBackId: "classic-red",
  },
  {
    id: "level-10-gold-frame",
    level: 10,
    title: "Gouden avatar frame",
    description: "Premium cosmetic.",
    premium: true,
  },
  {
    id: "level-20-premium-table",
    level: 20,
    title: "Premium tafel",
    description: "Royal Table skin.",
    premium: true,
  },
];

export const milestoneRewards: MilestoneReward[] = [
  {
    id: "first-match",
    title: "Eerste tafel",
    description: "Speel je eerste potje.",
    metric: "gamesPlayed",
    target: 1,
    coins: 40,
  },
  {
    id: "first-win",
    title: "Eerste winst",
    description: "Win een potje.",
    metric: "wins",
    target: 1,
    gems: 5,
  },
  {
    id: "collector-3",
    title: "Collector",
    description: "Bezit 3 kaartbacks.",
    metric: "cardBacks",
    target: 3,
    coins: 75,
  },
  {
    id: "streak-2",
    title: "Hot streak",
    description: "Win 2 potjes achter elkaar.",
    metric: "bestWinStreak",
    target: 2,
    gems: 8,
  },
];

export function getMilestoneProgress(
  wallet: Wallet,
  reward: MilestoneReward
) {
  if (reward.metric === "gamesPlayed") return wallet.gamesPlayed;
  if (reward.metric === "wins") return wallet.wins;
  if (reward.metric === "cardBacks") return wallet.ownedCardBackIds.length;

  return wallet.bestWinStreak;
}

export function getSeasonLevel(xp: number) {
  return Math.min(20, Math.floor(xp / XP_PER_SEASON_LEVEL) + 1);
}

export function getSeasonProgress(xp: number) {
  const level = getSeasonLevel(xp);
  const currentLevelXp = (level - 1) * XP_PER_SEASON_LEVEL;
  const nextLevelXp = level * XP_PER_SEASON_LEVEL;
  const progressXp = Math.max(0, xp - currentLevelXp);
  const progressPercent =
    level >= 20
      ? 100
      : Math.min(100, Math.round((progressXp / XP_PER_SEASON_LEVEL) * 100));

  return {
    level,
    progressXp,
    nextLevelXp,
    progressPercent,
  };
}
