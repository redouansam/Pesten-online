import type { Wallet } from "./economy";

export type PlayerProfileFoundation = {
  playerId: string;
  playerName: string;
  wins: number;
  losses: number;
  gamesPlayed: number;
  favoriteCardback: string;
  level: number;
  xp: number;
  coins: number;
  gems: number;
  onlineStatus: "online" | "offline" | "reconnecting";
};

export type RecentPlayer = {
  playerId: string;
  name: string;
  lastPlayedAt: number;
  result: "win" | "loss" | "played";
};

export type FriendFoundation = {
  playerId: string;
  name: string;
  onlineStatus: "online" | "offline";
  relationship: "recent" | "placeholder";
};

export const RECENT_PLAYERS_STORAGE_KEY = "pesten.recentPlayers.v1";

export function buildProfileFoundation({
  connected,
  level,
  name,
  playerId,
  wallet,
}: {
  connected: boolean;
  level: number;
  name: string;
  playerId: string;
  wallet: Wallet;
}): PlayerProfileFoundation {
  return {
    playerId,
    playerName: name,
    wins: wallet.wins,
    losses: Math.max(0, wallet.gamesPlayed - wallet.wins),
    gamesPlayed: wallet.gamesPlayed,
    favoriteCardback: wallet.selectedCardBackId,
    level,
    xp: wallet.xp,
    coins: wallet.coins,
    gems: wallet.gems,
    onlineStatus: connected ? "online" : "reconnecting",
  };
}
